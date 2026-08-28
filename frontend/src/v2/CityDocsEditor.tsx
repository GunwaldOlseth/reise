import { useEffect, useRef, useState } from 'react'
import { TrashIcon } from '../TransportModeIcon'
import { NoteEditor } from './NoteEditor'
import {
  applyCityDocs,
  cityDocsForEdit,
  newCityDoc,
  type CityDocHolder,
  type JourneyCityDoc,
} from './journeyModel'
import { compactNoteHtml } from './noteHtml'
import { useConfirmDelete } from './ConfirmDelete'

function CityDocTitle({
  doc,
  index,
  editing,
  disabled,
  placeholder,
  onChange,
  onCommit,
  onEndEdit,
}: {
  doc: JourneyCityDoc
  index: number
  editing: boolean
  disabled?: boolean
  placeholder: string
  onChange: (title: string) => void
  onCommit: (title: string) => void
  onEndEdit: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const display = doc.title.trim() || placeholder

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="v2-city-doc-title-input"
        value={doc.title}
        disabled={disabled}
        placeholder={index === 0 ? placeholder : 'Tittel'}
        aria-label="Dokumenttittel"
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          onCommit(e.target.value.trim())
          onEndEdit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit((e.target as HTMLInputElement).value.trim())
            onEndEdit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onEndEdit()
          }
        }}
      />
    )
  }

  return <div className="v2-city-doc-title">{display}</div>
}

export function CityDocsEditor({
  value,
  disabled,
  heading = 'Dokumenter',
  firstTitlePlaceholder = 'Om byen',
  firstBodyPlaceholder = 'Tips, område, hvorfor vi er her…',
  onChange,
}: {
  value: CityDocHolder
  disabled?: boolean
  /** Section label above the list. Empty string = compact (activity notes). */
  heading?: string
  firstTitlePlaceholder?: string
  firstBodyPlaceholder?: string
  onChange: (
    next: CityDocHolder,
    opts?: { immediate?: boolean },
  ) => void
}) {
  const askDelete = useConfirmDelete()
  const docs = cityDocsForEdit(value, firstTitlePlaceholder)
  const compact = heading === ''
  const [titleEditId, setTitleEditId] = useState<string | null>(null)

  const showSectionHead = !compact || docs.length > 1
  const sectionLabel = compact && docs.length > 1 ? 'Dokumenter' : heading

  function commit(nextDocs: JourneyCityDoc[], immediate?: boolean) {
    onChange(applyCityDocs(value, nextDocs), { immediate })
  }

  function patchDoc(id: string, partial: Partial<JourneyCityDoc>, immediate?: boolean) {
    commit(
      docs.map((d) => (d.id === id ? { ...d, ...partial } : d)),
      immediate,
    )
  }

  function addDocument() {
    const newDoc = newCityDoc(docs.length, '')
    commit([...docs, newDoc])
    setTitleEditId(newDoc.id)
  }

  return (
    <div className="v2-city-docs">
      {showSectionHead && sectionLabel ? (
        <div className="v2-sights-head">
          <span>{sectionLabel}</span>
          <button
            type="button"
            className="v2-chip-btn"
            disabled={disabled}
            title="Nytt dokument"
            onClick={() => addDocument()}
          >
            + Dokument
          </button>
        </div>
      ) : null}
      <ul className="v2-city-docs-list">
        {docs.map((doc, i) => (
          <li key={doc.id} className="v2-city-doc">
            <CityDocTitle
              doc={doc}
              index={i}
              editing={titleEditId === doc.id}
              disabled={disabled}
              placeholder={i === 0 ? firstTitlePlaceholder : 'Notat'}
              onChange={(title) => patchDoc(doc.id, { title })}
              onCommit={(title) => patchDoc(doc.id, { title }, true)}
              onEndEdit={() => setTitleEditId(null)}
            />
            <NoteEditor
              value={doc.body}
              disabled={disabled}
              placeholder={
                i === 0 ? firstBodyPlaceholder : 'Skriv notatet her…'
              }
              toolbarExtra={
                <>
                  <button
                    type="button"
                    className="v2-note-tool v2-note-tool-title"
                    disabled={disabled}
                    aria-label="Rediger tittel"
                    title="Rediger tittel"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTitleEditId(doc.id)}
                  >
                    T
                  </button>
                  {compact && docs.length === 1 ? (
                    <button
                      type="button"
                      className="v2-note-tool v2-note-tool-add"
                      disabled={disabled}
                      aria-label="Nytt dokument"
                      title="Nytt dokument"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addDocument()}
                    >
                      + Dokument
                    </button>
                  ) : null}
                  {docs.length > 1 ? (
                    <button
                      type="button"
                      className="v2-note-tool v2-note-tool-del"
                      disabled={disabled}
                      aria-label="Slett dokument"
                      title="Slett dokument"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const name =
                          doc.title.trim() ||
                          (i === 0 ? firstTitlePlaceholder : 'dokumentet')
                        void askDelete({ title: `Slette ${name}?` }).then(
                          (ok) => {
                            if (!ok) return
                            if (titleEditId === doc.id) setTitleEditId(null)
                            commit(
                              docs.filter((d) => d.id !== doc.id),
                              true,
                            )
                          },
                        )
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  ) : null}
                </>
              }
              onChange={(html) => patchDoc(doc.id, { body: html })}
              onBlur={(html) =>
                patchDoc(doc.id, { body: compactNoteHtml(html) }, true)
              }
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
