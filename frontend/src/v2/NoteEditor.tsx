import { useEffect, useRef } from 'react'
import { compactNoteHtml, noteHasContent, sanitizeNoteHtml } from './noteHtml'

type Tool = 'bold' | 'highlight' | 'list' | 'indent' | 'outdent' | 'star'

function run(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

export function NoteEditor({
  value,
  disabled,
  placeholder,
  onChange,
  onBlur,
}: {
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (html: string) => void
  onBlur?: (html: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const last = useRef(sanitizeNoteHtml(value || ''))

  useEffect(() => {
    const el = box.current
    if (!el) return
    const next = sanitizeNoteHtml(value || '')
    if (next === sanitizeNoteHtml(el.innerHTML)) return
    el.innerHTML = next
    last.current = next
  }, [value])

  function emit() {
    const el = box.current
    if (!el) return ''
    const html = compactNoteHtml(el.innerHTML)
    if (html !== last.current) {
      last.current = html
      onChange(html)
    }
    return html
  }

  function apply(tool: Tool) {
    if (disabled) return
    box.current?.focus()
    if (tool === 'bold') run('bold')
    if (tool === 'highlight') {
      run('styleWithCSS', 'true')
      run('hiliteColor', '#d4a84a')
    }
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
          className="v2-note-tool"
          disabled={disabled}
          title="Merk tekst"
          aria-label="Merk tekst"
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
