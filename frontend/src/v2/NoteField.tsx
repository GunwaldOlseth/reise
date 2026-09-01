import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { loadPlannerSettings } from '../userSettings'
import { mediaUrl } from '../api'
import { NoteEditor } from './NoteEditor'
import { noteHasContent, noteHtmlForDisplay } from './noteHtml'

function clampLines(): number {
  const n = loadPlannerSettings().notePreviewLines
  return typeof n === 'number' && n > 0 ? Math.min(30, Math.max(3, n)) : 12
}

export function NoteEditButton({
  disabled,
  title = 'Rediger',
  onClick,
}: {
  disabled?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="v2-note-edit-btn"
      disabled={disabled}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}

export function NoteField({
  value,
  disabled,
  placeholder,
  onChange,
  onBlur,
  toolbarExtra,
  previewLines: previewLinesProp,
  editing: editingProp,
  onEditingChange,
}: {
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (html: string) => void
  onBlur?: (html: string) => void
  toolbarExtra?: ReactNode
  /** Clamped preview lines when not editing. Defaults from innstillinger. */
  previewLines?: number
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}) {
  const previewLines = previewLinesProp ?? clampLines()
  const hasContent = noteHasContent(value)
  const [internalEditing, setInternalEditing] = useState(() => !hasContent)
  const [expanded, setExpanded] = useState(false)

  const editing = editingProp ?? internalEditing

  useEffect(() => {
    if (!hasContent && editingProp == null) {
      setInternalEditing(true)
    }
  }, [hasContent, editingProp])

  function setEditing(next: boolean) {
    if (editingProp == null) setInternalEditing(next)
    onEditingChange?.(next)
    if (!next) setExpanded(false)
  }

  function handleBlur(html: string) {
    onBlur?.(html)
    if (noteHasContent(html)) setEditing(false)
  }

  if (editing || (!hasContent && editingProp == null)) {
    return (
      <NoteEditor
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        toolbarExtra={toolbarExtra}
        onChange={onChange}
        onBlur={handleBlur}
      />
    )
  }

  if (!hasContent) {
    return (
      <div
        className="v2-note-preview v2-note-preview-empty"
        role="button"
        tabIndex={disabled ? -1 : 0}
        title="Klikk for å redigere"
        onClick={() => {
          if (!disabled) setEditing(true)
        }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
          }
        }}
      >
        {placeholder || 'Notat…'}
      </div>
    )
  }

  const html = noteHtmlForDisplay(value || '', mediaUrl)

  if (expanded) {
    return (
      <div className="v2-note-preview-wrap">
        <div
          className="v2-note-preview v2-note-html is-expanded"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <button
          type="button"
          className="v2-note-less-btn"
          disabled={disabled}
          onClick={() => setExpanded(false)}
        >
          Vis mindre
        </button>
      </div>
    )
  }

  return (
    <div
      className="v2-note-preview v2-note-html is-clamped"
      style={
        {
          '--v2-note-preview-lines': String(previewLines),
        } as CSSProperties
      }
      role="button"
      tabIndex={disabled ? -1 : 0}
      title="Klikk for å lese hele teksten"
      onClick={() => {
        if (!disabled) setExpanded(true)
      }}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded(true)
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
