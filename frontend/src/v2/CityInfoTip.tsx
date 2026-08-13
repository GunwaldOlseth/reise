import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cityDocsOf, type JourneyCityDoc } from './journeyModel'
import { noteHasContent, sanitizeNoteHtml } from './noteHtml'

function InfoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

type PopPos = { top: number; left: number; width: number }

function visibleDocs(
  text?: string | null,
  docs?: JourneyCityDoc[] | null,
): { title: string; html: string }[] {
  const list = cityDocsOf({ notes: text || '', docs: docs || [] })
  return list
    .map((d) => ({
      title: (d.title || '').trim() || 'Notat',
      html: sanitizeNoteHtml(d.body || ''),
    }))
    .filter((d) => noteHasContent(d.html))
}

export function CityInfoTip({
  text,
  docs,
  disabled,
}: {
  text?: string | null
  docs?: JourneyCityDoc[] | null
  disabled?: boolean
}) {
  const items = visibleDocs(text, docs)
  const stamp = items.map((d) => d.html).join('|')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PopPos | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current) return

    function place() {
      const el = btn.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(
        items.length > 1 ? 340 : 288,
        Math.max(198, window.innerWidth - 24),
      )
      const margin = 12
      let left = r.right - width
      if (left < margin) left = margin
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - width - margin)
      }
      const gap = 8
      const popH = pop.current?.offsetHeight || 160
      const below = r.bottom + gap
      const above = r.top - gap - popH
      const top =
        below + popH <= window.innerHeight - margin
          ? below
          : above >= margin
            ? above
            : Math.max(margin, window.innerHeight - popH - margin)
      setPos({ top, left, width })
    }

    place()
    const id = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, stamp, items.length])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (root.current?.contains(t) || pop.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!items.length) return null

  const many = items.length > 1

  return (
    <div className={`v2-city-info${open ? ' is-open' : ''}`} ref={root}>
      <button
        ref={btn}
        type="button"
        className={`v2-city-info-btn${open ? ' is-on' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-label="Informasjon om byen"
        title={
          many
            ? `${items.length} dokumenter`
            : items[0]?.title || 'Informasjon om byen'
        }
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <InfoIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            className={`v2-city-info-pop${many ? ' is-many' : ''}`}
            role="dialog"
            style={
              pos
                ? {
                    top: pos.top,
                    left: pos.left,
                    width: pos.width,
                  }
                : undefined
            }
          >
            {items.map((item, i) => (
              <section key={`${item.title}:${i}`} className="v2-city-info-doc">
                {many || item.title !== 'Om byen' ? (
                  <h4>{item.title}</h4>
                ) : null}
                <div
                  className="v2-note-html"
                  dangerouslySetInnerHTML={{ __html: item.html }}
                />
              </section>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
