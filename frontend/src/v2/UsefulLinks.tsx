import { useState } from 'react'
import { useConfirmDelete } from './ConfirmDelete'
import {
  isSafeHttpUrl,
  loadUsefulLinks,
  normalizeUsefulUrl,
  saveUsefulLinks,
  usableUsefulLinks,
  usefulLinkHost,
  usefulLinkHref,
  usefulLinkTitle,
  type UsefulLink,
} from '../userSettings'

function persist(next: UsefulLink[]): UsefulLink[] {
  return saveUsefulLinks(next)
}

export function UsefulLinksCard({ onOpenPage }: { onOpenPage: () => void }) {
  const askDelete = useConfirmDelete()
  const [links, setLinks] = useState<UsefulLink[]>(() => loadUsefulLinks())
  const [draftTitle, setDraftTitle] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [hint, setHint] = useState('')

  function commit(next: UsefulLink[]) {
    setLinks(persist(next))
  }

  function patch(id: string, fields: Partial<Pick<UsefulLink, 'title' | 'url'>>) {
    const next = links.map((link) =>
      link.id === id ? { ...link, ...fields } : link,
    )
    setLinks(next)
    saveUsefulLinks(next)
  }

  function add() {
    const url = normalizeUsefulUrl(draftUrl)
    if (!url || !isSafeHttpUrl(url)) {
      setHint('Skriv en nettside, f.eks. vy.no')
      return
    }
    const title = draftTitle.trim()
    commit([...links, { id: crypto.randomUUID(), title, url }])
    setDraftTitle('')
    setDraftUrl('')
    setHint('')
  }

  function move(id: string, dir: -1 | 1) {
    const i = links.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= links.length) return
    const next = [...links]
    const [item] = next.splice(i, 1)
    next.splice(j, 0, item)
    commit(next)
  }

  return (
    <section className="v2-settings-card">
      <h2>Nyttige lenker</h2>
      <p className="v2-meta">
        Snarveier til andre nettsider. Lag listen her, og åpne den som en egen
        side uten menyer.
      </p>

      {links.length === 0 ? (
        <p className="v2-meta">Ingen lenker ennå.</p>
      ) : (
        <ul className="v2-link-edit-list">
          {links.map((link, i) => (
            <li key={link.id} className="v2-link-edit-row">
              <label>
                Navn
                <input
                  value={link.title}
                  placeholder={usefulLinkTitle(link)}
                  onChange={(e) => patch(link.id, { title: e.target.value })}
                />
              </label>
              <label>
                Adresse
                <input
                  value={link.url}
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder="https://…"
                  onChange={(e) => patch(link.id, { url: e.target.value })}
                  onBlur={(e) => {
                    const url = normalizeUsefulUrl(e.target.value)
                    if (url && url !== link.url) patch(link.id, { url })
                  }}
                />
              </label>
              <div className="v2-link-edit-tools">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Flytt opp"
                  disabled={i === 0}
                  onClick={() => move(link.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Flytt ned"
                  disabled={i === links.length - 1}
                  onClick={() => move(link.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title={`Fjern ${usefulLinkTitle(link)}`}
                  onClick={() => {
                    void askDelete({
                      title: `Slette ${usefulLinkTitle(link)}?`,
                      confirmLabel: 'Fjern',
                    }).then((ok) => {
                      if (ok) commit(links.filter((l) => l.id !== link.id))
                    })
                  }}
                >
                  Fjern
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="v2-link-add">
        <label>
          Navn
          <input
            value={draftTitle}
            placeholder="Vy"
            onChange={(e) => setDraftTitle(e.target.value)}
          />
        </label>
        <label>
          Adresse
          <input
            value={draftUrl}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="vy.no"
            onChange={(e) => {
              setDraftUrl(e.target.value)
              if (hint) setHint('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-soft"
          disabled={!draftUrl.trim()}
          onClick={add}
        >
          Legg til
        </button>
      </div>
      {hint ? <p className="v2-error">{hint}</p> : null}

      <div className="v2-settings-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={onOpenPage}
        >
          Åpne lenkeside
        </button>
      </div>
    </section>
  )
}

export function UsefulLinksPage({ onBack }: { onBack: () => void }) {
  const links = usableUsefulLinks()

  return (
    <div className="v2-shell v2-links-page">
      <header className="v2-hub-top">
        <div className="v2-hub-brand">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Tilbake"
            onClick={onBack}
          >
            ← Tilbake
          </button>
          <div>
            <h1>Nyttige lenker</h1>
            <p className="v2-meta">Snarveier til andre nettsider</p>
          </div>
        </div>
      </header>

      <div className="v2-settings-body">
        {links.length === 0 ? (
          <p className="v2-meta">
            Ingen lenker ennå. Legg dem til under Innstillinger.
          </p>
        ) : (
          <ul className="v2-useful-link-list">
            {links.map((link) => {
              const href = usefulLinkHref(link)
              const host = usefulLinkHost(link)
              return (
                <li key={link.id}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <strong>{usefulLinkTitle(link)}</strong>
                    {host ? <span className="v2-meta">{host}</span> : null}
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

