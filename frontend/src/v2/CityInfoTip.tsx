import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cityDocsOf, type JourneyCityDoc } from './journeyModel'
import { noteHasContent, sanitizeNoteHtml } from './noteHtml'

const MOBILE_MQ = '(max-width: 720px)'

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

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

type PopPos = { top: number; left: number; width: number }

function useThemeFieldColor(open: boolean) {
  const [fieldColor, setFieldColor] = useState('')

  useLayoutEffect(() => {
    if (!open) return
    const root = document.documentElement
    const read = () =>
      getComputedStyle(root).getPropertyValue('--v2-field').trim() || '#2a3340'
    setFieldColor(read())
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onTheme = () => setFieldColor(read())
    mq.addEventListener('change', onTheme)
    return () => mq.removeEventListener('change', onTheme)
  }, [open])

  return fieldColor
}

function useMobileSheet() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

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

function DocList({
  items,
  many,
}: {
  items: { title: string; html: string }[]
  many: boolean
}) {
  return (
    <>
      {items.map((item, i) => (
        <section key={`${item.title}:${i}`} className="v2-city-info-doc">
          {many || item.title !== 'Om byen' ? <h4>{item.title}</h4> : null}
          <div
            className="v2-note-html"
            dangerouslySetInnerHTML={{ __html: item.html }}
          />
        </section>
      ))}
    </>
  )
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
  const mobile = useMobileSheet()
  const [open, setOpen] = useState(false)
  const fieldColor = useThemeFieldColor(open)
  const surfaceStyle = fieldColor
    ? { backgroundColor: fieldColor }
    : undefined
  const [pos, setPos] = useState<PopPos | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!open || mobile || !btn.current) return

    function place() {
      const el = btn.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(
        items.length > 1 ? 480 : 420,
        Math.max(280, window.innerWidth - 32),
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
  }, [open, mobile, stamp, items.length])

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
    const prev = document.body.style.overflow
    if (mobile) {
      document.body.style.overflow = 'hidden'
      closeBtn.current?.focus()
    }
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, mobile])

  if (!items.length) return null

  const many = items.length > 1
  const heading = many
    ? 'Om byen'
    : items[0]?.title && items[0].title !== 'Om byen'
      ? items[0].title
      : 'Om byen'

  const popover = mobile ? (
    <div className="v2-city-info-layer" onClick={() => setOpen(false)}>
      <div
        ref={pop}
        className={`v2-city-info-pop is-sheet${many ? ' is-many' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        style={surfaceStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v2-city-info-pop-head">
          <h3>{heading}</h3>
          <button
            ref={closeBtn}
            type="button"
            className="v2-city-info-close"
            aria-label="Lukk"
            title="Lukk"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="v2-city-info-pop-body" style={surfaceStyle}>
          <DocList items={items} many={many} />
        </div>
      </div>
    </div>
  ) : (
    <>
      <button
        type="button"
        className="v2-city-info-backdrop"
        aria-label="Lukk"
        onClick={() => setOpen(false)}
      />
      <div
        ref={pop}
        className={`v2-city-info-pop${many ? ' is-many' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        style={
          pos
            ? {
                top: pos.top,
                left: pos.left,
                width: pos.width,
                ...surfaceStyle,
              }
            : surfaceStyle
        }
      >
        <div className="v2-city-info-pop-inner" style={surfaceStyle}>
          <DocList items={items} many={many} />
        </div>
      </div>
    </>
  )

  return (
    <div className={`v2-city-info${open ? ' is-open' : ''}`} ref={root}>
      <button
        ref={btn}
        type="button"
        className={`v2-city-info-btn${open ? ' is-on' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
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
      {open && createPortal(popover, document.body)}
    </div>
  )
}

/** Clickable linked-preview chip that opens city / activity docs (like HotelLinkedChip). */
export function CityLinkedChip({
  label,
  text,
  docs,
  className = '',
  hint,
}: {
  label: string
  text?: string | null
  docs?: JourneyCityDoc[] | null
  className?: string
  hint?: string
}) {
  const items = visibleDocs(text, docs)
  const stamp = items.map((d) => d.html).join('|')
  const many = items.length > 1
  const hasInfo = items.length > 0
  const mobile = useMobileSheet()
  const [open, setOpen] = useState(false)
  const fieldColor = useThemeFieldColor(open && hasInfo)
  const surfaceStyle = fieldColor
    ? { backgroundColor: fieldColor }
    : undefined
  const [pos, setPos] = useState<PopPos | null>(null)
  const root = useRef<HTMLLIElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!hasInfo || !open || mobile || !btn.current) return

    function place() {
      const el = btn.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(
        many ? 480 : 420,
        Math.max(260, window.innerWidth - 32),
      )
      const margin = 12
      let left = r.left
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
  }, [hasInfo, open, mobile, stamp, many])

  useEffect(() => {
    if (!hasInfo || !open) return
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
    const prev = document.body.style.overflow
    if (mobile) {
      document.body.style.overflow = 'hidden'
      closeBtn.current?.focus()
    }
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [hasInfo, open, mobile])

  if (!hasInfo) {
    return (
      <li className={className} title={hint}>
        {label}
      </li>
    )
  }

  const popover = mobile ? (
    <div className="v2-city-info-layer" onClick={() => setOpen(false)}>
      <div
        ref={pop}
        className={`v2-city-info-pop is-sheet${many ? ' is-many' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={surfaceStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v2-city-info-pop-head">
          <h3>{label}</h3>
          <button
            ref={closeBtn}
            type="button"
            className="v2-city-info-close"
            aria-label="Lukk"
            title="Lukk"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="v2-city-info-pop-body" style={surfaceStyle}>
          <DocList items={items} many={many} />
        </div>
      </div>
    </div>
  ) : (
    <>
      <button
        type="button"
        className="v2-city-info-backdrop"
        aria-label="Lukk"
        onClick={() => setOpen(false)}
      />
      <div
        ref={pop}
        className={`v2-city-info-pop${many ? ' is-many' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={
          pos
            ? {
                top: pos.top,
                left: pos.left,
                width: pos.width,
                ...surfaceStyle,
              }
            : surfaceStyle
        }
      >
        <div className="v2-city-info-pop-inner" style={surfaceStyle}>
          <h3 className="v2-city-linked-chip-title">{label}</h3>
          <DocList items={items} many={many} />
        </div>
      </div>
    </>
  )

  return (
    <li
      ref={root}
      className={`v2-city-linked-chip${className ? ` ${className}` : ''}${
        open ? ' is-open' : ''
      }`}
    >
      <button
        ref={btn}
        type="button"
        className="v2-city-linked-chip-btn"
        title={hint ? `${hint} · vis info` : 'Vis info'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {label}
      </button>
      {open && createPortal(popover, document.body)}
    </li>
  )
}
