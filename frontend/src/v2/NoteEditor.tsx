import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, mediaUrl } from '../api'
import { downscaleImage } from './imageResize'
import {
  compactNoteHtml,
  normalizeNoteLinkUrl,
  normalizePastedNoteHtml,
  noteHasContent,
  noteHtmlForDisplay,
  plainTextToNoteHtml,
  sanitizeNoteHtml,
} from './noteHtml'

type Tool =
  | 'bold'
  | 'highlight'
  | 'list'
  | 'checklist'
  | 'link'
  | 'clearFormat'
  | 'indent'
  | 'outdent'
  | 'star'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'

const HIGHLIGHT_COLOR = '#d4a84a'
const CHECKLIST_HTML =
  '<ul class="v2-note-checklist"><li class="v2-note-check-item"><span class="v2-note-check" contenteditable="false">☐</span>&nbsp;</li></ul>'

function run(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

function unwrapElement(el: Element) {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

function isHighlightElement(el: Element): boolean {
  if (el.tagName === 'MARK') return true
  if (el.tagName === 'SPAN' || el.tagName === 'FONT') {
    const styled = el as HTMLElement
    const bg = styled.style.backgroundColor
    if (
      bg &&
      bg !== 'transparent' &&
      bg !== 'inherit' &&
      bg !== 'initial' &&
      bg !== 'rgba(0, 0, 0, 0)'
    ) {
      return true
    }
    if (el.getAttribute('bgcolor')) return true
    const style = el.getAttribute('style') || ''
    if (/background/i.test(style)) return true
  }
  return false
}

function selectionTouchesHighlight(root: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)

  if (range.collapsed) {
    let node: Node | null = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    while (node && node !== root) {
      if (node instanceof Element && isHighlightElement(node)) return true
      node = node.parentNode
    }
    return false
  }

  const candidates = root.querySelectorAll(
    'mark, font[bgcolor], span[style*="background"]',
  )
  for (const el of candidates) {
    if (range.intersectsNode(el)) return true
  }
  return false
}

function removeHighlightFromSelection(root: HTMLElement) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const toUnwrap: Element[] = []

  root.querySelectorAll('mark').forEach((el) => {
    if (range.intersectsNode(el)) toUnwrap.push(el)
  })
  root.querySelectorAll('span, font').forEach((el) => {
    if (isHighlightElement(el) && range.intersectsNode(el)) toUnwrap.push(el)
  })

  toUnwrap.sort((a, b) => {
    if (a.contains(b)) return 1
    if (b.contains(a)) return -1
    return 0
  })

  const seen = new Set<Element>()
  for (const el of toUnwrap) {
    if (seen.has(el) || !root.contains(el)) continue
    seen.add(el)
    unwrapElement(el)
  }

  run('styleWithCSS', 'true')
  run('hiliteColor', 'transparent')
  run('backColor', 'transparent')
}

function toggleHighlight(root: HTMLElement) {
  if (selectionTouchesHighlight(root)) {
    removeHighlightFromSelection(root)
    return
  }
  run('styleWithCSS', 'true')
  run('hiliteColor', HIGHLIGHT_COLOR)
}

function clearFormatting(root: HTMLElement) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)

  run('removeFormat')
  removeHighlightFromSelection(root)

  root.querySelectorAll('a, strong, b, em, i, u, mark').forEach((el) => {
    if (range.intersectsNode(el)) unwrapElement(el)
  })

  root.querySelectorAll('h1, h2, h3, h4').forEach((el) => {
    if (!range.intersectsNode(el)) return
    const p = document.createElement('p')
    p.innerHTML = el.innerHTML
    el.replaceWith(p)
  })
}

function insertOrEditLink(root: HTMLElement) {
  const sel = window.getSelection()
  let anchor: Element | null = null
  if (sel?.anchorNode) {
    const node =
      sel.anchorNode.nodeType === Node.ELEMENT_NODE
        ? (sel.anchorNode as Element)
        : sel.anchorNode.parentElement
    anchor = node?.closest('a') ?? null
  }
  if (anchor && root.contains(anchor)) {
    unwrapElement(anchor)
    return
  }

  const url = window.prompt('Lenke (https://…)', 'https://')
  if (!url?.trim()) return
  const safe = normalizeNoteLinkUrl(url.trim())
  if (!safe) {
    window.alert('Bruk en gyldig http- eller https-lenke.')
    return
  }
  if (sel && sel.isCollapsed) {
    run(
      'insertHTML',
      `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`,
    )
    return
  }
  run('createLink', safe)
}

function toggleChecklistItem(target: HTMLElement, root: HTMLElement) {
  const li = target.closest('.v2-note-check-item')
  if (!li || !root.contains(li)) return
  li.classList.toggle('is-done')
  const mark = li.querySelector('.v2-note-check')
  if (mark) mark.textContent = li.classList.contains('is-done') ? '☑' : '☐'
}

export function NoteEditor({
  value,
  disabled,
  placeholder,
  onChange,
  onBlur,
  onBusyChange,
  toolbarExtra,
}: {
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (html: string) => void
  onBlur?: (html: string) => void
  onBusyChange?: (busy: boolean) => void
  toolbarExtra?: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const uploadingRef = useRef(false)
  const deferBlurRef = useRef(false)
  const last = useRef(sanitizeNoteHtml(value || ''))
  const [highlightActive, setHighlightActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  function setEditorBusy(busy: boolean) {
    onBusyChange?.(busy)
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    const next = sanitizeNoteHtml(value || '')
    if (next === sanitizeNoteHtml(el.innerHTML)) return
    el.innerHTML = noteHtmlForDisplay(value || '', mediaUrl)
    last.current = next
  }, [value])

  function syncToolbarState() {
    const root = box.current
    if (!root) return
    setHighlightActive(selectionTouchesHighlight(root))
  }

  useEffect(() => {
    const onSelectionChange = () => {
      const root = box.current
      const sel = window.getSelection()
      if (!root || !sel?.anchorNode || !root.contains(sel.anchorNode)) return
      syncToolbarState()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  function saveSelection() {
    const root = box.current
    const sel = window.getSelection()
    if (!root || !sel || sel.rangeCount === 0) return
    if (!sel.anchorNode || !root.contains(sel.anchorNode)) return
    savedRangeRef.current = sel.getRangeAt(0).cloneRange()
  }

  function restoreSelection(): boolean {
    const root = box.current
    const range = savedRangeRef.current
    if (!root || !range) return false
    root.focus()
    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }

  function insertHtmlAtCursor(html: string) {
    const root = box.current
    if (!root) return
    root.focus()
    if (restoreSelection()) {
      document.execCommand('insertHTML', false, html)
      return
    }
    root.insertAdjacentHTML('beforeend', html)
  }

  function focusInsideEditor(): boolean {
    const root = rootRef.current
    const active = document.activeElement
    if (!root || !active) return false
    return root.contains(active)
  }

  function handleAreaBlur() {
    window.setTimeout(() => {
      if (uploadingRef.current || deferBlurRef.current || focusInsideEditor()) return
      onBlur?.(emit())
    }, 0)
  }

  function openImagePicker() {
    if (disabled || uploadingRef.current) return
    saveSelection()
    deferBlurRef.current = true
    setEditorBusy(true)
    fileRef.current?.click()
    const onWinFocus = () => {
      window.setTimeout(() => {
        if (!uploadingRef.current && !fileRef.current?.value) {
          deferBlurRef.current = false
          setEditorBusy(false)
        }
      }, 400)
    }
    window.addEventListener('focus', onWinFocus, { once: true })
  }

  function emit() {
    const el = box.current
    if (!el) return ''
    const html = compactNoteHtml(el.innerHTML)
    if (html !== last.current) {
      last.current = html
      onChange(html)
    }
    syncToolbarState()
    return html
  }

  function apply(tool: Tool) {
    if (disabled) return
    const root = box.current
    if (!root) return
    root.focus()
    if (tool === 'bold') run('bold')
    if (tool === 'highlight') toggleHighlight(root)
    if (tool === 'list') run('insertUnorderedList')
    if (tool === 'checklist') run('insertHTML', CHECKLIST_HTML)
    if (tool === 'link') insertOrEditLink(root)
    if (tool === 'clearFormat') clearFormatting(root)
    if (tool === 'indent') run('indent')
    if (tool === 'outdent') run('outdent')
    if (tool === 'star') {
      run('insertHTML', '<span class="v2-note-star">★</span>')
    }
    if (tool === 'h1') run('formatBlock', 'h1')
    if (tool === 'h2') run('formatBlock', 'h2')
    if (tool === 'h3') run('formatBlock', 'h3')
    if (tool === 'h4') run('formatBlock', 'h4')
    emit()
  }

  async function onPickImage(files: FileList | null) {
    if (!files?.length || disabled) {
      deferBlurRef.current = false
      setEditorBusy(false)
      return
    }
    setUploadError('')
    uploadingRef.current = true
    deferBlurRef.current = true
    setEditorBusy(true)
    setUploading(true)
    try {
      const prepared = await downscaleImage(files[0])
      const res = await api.uploadImage(prepared)
      const displayUrl = mediaUrl(res.url).replace(/"/g, '&quot;')
      insertHtmlAtCursor(
        `<img src="${displayUrl}" alt="" class="v2-note-img" />`,
      )
      emit()
      box.current?.focus()
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Kunne ikke laste opp bildet',
      )
    } finally {
      uploadingRef.current = false
      setUploading(false)
      window.setTimeout(() => {
        deferBlurRef.current = false
        setEditorBusy(false)
        savedRangeRef.current = null
        if (fileRef.current) fileRef.current.value = ''
      }, 300)
    }
  }

  const empty = !noteHasContent(value)

  return (
    <div
      ref={rootRef}
      className={`v2-note-editor${disabled ? ' is-disabled' : ''}`}
    >
      <div className="v2-note-tools" role="toolbar" aria-label="Tekst">
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Uthevet (fet)"
          aria-label="Uthevet"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('bold')}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`v2-note-tool${highlightActive ? ' is-on' : ''}`}
          disabled={disabled}
          title={
            highlightActive
              ? 'Fjern markering'
              : 'Merk tekst (klikk igjen for å fjerne)'
          }
          aria-label="Merk tekst"
          aria-pressed={highlightActive}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('highlight')}
        >
          <span className="v2-note-tool-mark">A</span>
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Sett inn stjerne"
          aria-label="Stjerne"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('star')}
        >
          ★
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Punktliste"
          aria-label="Punktliste"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('list')}
        >
          •
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Sjekkliste"
          aria-label="Sjekkliste"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('checklist')}
        >
          ☑
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Lenke (klikk igjen på lenke for å fjerne)"
          aria-label="Lenke"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('link')}
        >
          <span className="v2-note-tool-link">L</span>
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled || uploading}
          title="Sett inn bilde"
          aria-label="Bilde"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openImagePicker()}
        >
          {uploading ? '…' : '+'}
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Fjern formatering"
          aria-label="Fjern formatering"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('clearFormat')}
        >
          <span className="v2-note-tool-clear">T<sub>x</sub></span>
        </button>
        {toolbarExtra ? (
          <div className="v2-note-tools-end">{toolbarExtra}</div>
        ) : null}
      </div>
      <div className="v2-note-tools v2-note-tools-sub" role="toolbar" aria-label="Skrift">
        <button
          type="button"
          className="v2-note-tool v2-note-tool-heading"
          disabled={disabled}
          title="Stor tittel (H1)"
          aria-label="H1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('h1')}
        >
          H1
        </button>
        <button
          type="button"
          className="v2-note-tool v2-note-tool-heading"
          disabled={disabled}
          title="Tittel (H2)"
          aria-label="H2"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('h2')}
        >
          H2
        </button>
        <button
          type="button"
          className="v2-note-tool v2-note-tool-heading"
          disabled={disabled}
          title="Mellomtittel (H3)"
          aria-label="H3"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('h3')}
        >
          H3
        </button>
        <button
          type="button"
          className="v2-note-tool v2-note-tool-heading"
          disabled={disabled}
          title="Liten tittel (H4)"
          aria-label="H4"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('h4')}
        >
          H4
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Innrykk"
          aria-label="Innrykk"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('indent')}
        >
          →
        </button>
        <button
          type="button"
          className="v2-note-tool"
          disabled={disabled}
          title="Mindre innrykk"
          aria-label="Mindre innrykk"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('outdent')}
        >
          ←
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onPickImage(e.target.files)}
      />
      {uploadError ? <p className="v2-note-upload-err">{uploadError}</p> : null}
      <div
        ref={box}
        className={`v2-note-area v2-note-html${empty ? ' is-empty' : ''}`}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline
        aria-label={placeholder || 'Notat'}
        data-placeholder={placeholder || ''}
        suppressContentEditableWarning
        onInput={() => emit()}
        onBlur={handleAreaBlur}
        onMouseUp={syncToolbarState}
        onKeyUp={syncToolbarState}
        onClick={(e) => {
          const t = e.target as HTMLElement
          if (t.classList.contains('v2-note-check')) {
            e.preventDefault()
            const root = box.current
            if (!root) return
            toggleChecklistItem(t, root)
            emit()
          }
        }}
        onPaste={(e) => {
          if (disabled) return
          e.preventDefault()
          const root = box.current
          if (!root) return
          root.focus()

          const html = e.clipboardData?.getData('text/html') ?? ''
          const plain = e.clipboardData?.getData('text/plain') ?? ''

          let insert = ''
          if (html.trim()) {
            insert = normalizePastedNoteHtml(html)
          }
          if (!insert && plain.trim()) {
            insert = sanitizeNoteHtml(plainTextToNoteHtml(plain))
          }
          if (!insert || !noteHasContent(insert)) return

          document.execCommand('insertHTML', false, insert)
          emit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault()
            apply(e.shiftKey ? 'outdent' : 'indent')
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault()
            apply('bold')
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault()
            apply('link')
          }
        }}
      />
    </div>
  )
}
