import { TrashIcon } from '../TransportModeIcon'
import { NoteEditor } from './NoteEditor'
import {
  newCityDoc,
  type JourneyCityDoc,
} from './journeyModel'
import { compactNoteHtml } from './noteHtml'
import { useConfirmDelete } from './ConfirmDelete'

export function CityDocsEditor({
  docs,
  disabled,
  firstTitle = 'Om byen',
  firstPlaceholder = 'Tips, område, hvorfor vi er her…',
  onChange,
}: {
  docs: JourneyCityDoc[]
  disabled?: boolean
  firstTitle?: string
  firstPlaceholder?: string
  onChange: (docs: JourneyCityDoc[], opts?: { immediate?: boolean }) => void
}) {
  const askDelete = useConfirmDelete()

  function commit(nextDocs: JourneyCityDoc[], immediate?: boolean) {
    onChange(nextDocs, { immediate })
  }

  function patchDoc(id: string, partial: Partial<JourneyCityDoc>, immediate?: boolean) {
    commit(
      docs.map((d) => (d.id === id ? { ...d, ...partial } : d)),
      immediate,
    )
  }

  return (
    <div className="v2-city-docs">
      <div className="v2-sights-head">
        <span>Dokumenter</span>
        <button
          type="button"
          className="v2-chip-btn"
          disabled={disabled}
          title="Nytt dokument"
          onClick={() =>
            commit([
              ...docs,
              newCityDoc(docs.length, `Notat ${docs.length + 1}`),
            ])
          }
        >
          + Dokument
        </button>
      </div>
      <ul className="v2-city-docs-list">
        {docs.map((doc, i) => (
          <li key={doc.id} className="v2-city-doc">
            <div className="v2-city-doc-head">
              <input
                value={doc.title}
                disabled={disabled}
                placeholder={i === 0 ? firstTitle : 'Tittel'}
                aria-label="Dokumenttittel"
                onChange={(e) => patchDoc(doc.id, { title: e.target.value })}
                onBlur={(e) =>
                  patchDoc(
                    doc.id,
                    { title: e.target.value.trim() },
                    true,
                  )
                }
              />
              {docs.length > 1 && (
                <button
                  type="button"
                  className="v2-via-remove"
                  disabled={disabled}
                  aria-label="Slett dokument"
                  title="Slett dokument"
                  onClick={() => {
                    const name = doc.title.trim() || 'dokumentet'
                    void askDelete({ title: `Slette ${name}?` }).then((ok) => {
                      if (!ok) return
                      commit(
                        docs.filter((d) => d.id !== doc.id),
                        true,
                      )
                    })
                  }}
                >
                  <TrashIcon size={14} />
                </button>
              )}
            </div>
            <NoteEditor
              value={doc.body}
              disabled={disabled}
              placeholder={
                i === 0 ? firstPlaceholder : 'Skriv notatet her…'
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
