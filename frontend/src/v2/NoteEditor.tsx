import { useEffect, useRef, useState, type ReactNode } from 'react'
import { compactNoteHtml, noteHasContent, sanitizeNoteHtml } from './noteHtml'

type Tool = 'bold' | 'highlight' | 'list' | 'indent' | 'outdent' | 'star'

const HIGHLIGHT_COLOR = '#d4a84a'

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

export function NoteEditor({
  value,
  disabled,
  placeholder,
  onChange,
  onBlur,
  toolbarExtra,
}: {
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (html: string) => void
  onBlur?: (html: string) => void
  /** Optional controls on the right side of the formatting toolbar. */
  toolbarExtra?: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const last = useRef(sanitizeNoteHtml(value || ''))
  const [highlightActive, setHighlightActive] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const next = sanitizeNoteHtml(value || '')
    if (next === sanitizeNoteHtml(el.innerHTML)) return
    el.innerHTML = next
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
    if (tool === 'indent') run('indent')
    if (tool === 'outdent') run('outdent')
    if (tool === 'star') {
      run('insertHTML', '<span class="v2-note-star">★</span>')
    }
    emit()
  }

  const empty = !noteHasContent(value)

  return (
    <div className={`v2-note-editor${disabled ? ' is-disabled' : ''}`}>
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
            highlightActive ? 'Fjern markering' : 'Merk tekst (klikk igjen for å fjerne)'
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
        {toolbarExtra ? (
          <div className="v2-note-tools-end">{toolbarExtra}</div>
        ) : null}
      </div>
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
        onBlur={() => onBlur?.(emit())}
        onMouseUp={syncToolbarState}
        onKeyUp={syncToolbarState}
        onPaste={(e) => {
          if (disabled) return
          e.preventDefault()
          const text = e.clipboardData?.getData('text/plain') ?? ''
          if (!text) return
          document.execCommand('insertText', false, text)
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
        }}
      />
    </div>
  )
}
