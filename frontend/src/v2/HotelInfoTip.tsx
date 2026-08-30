import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  effectiveHotelName,
  formatDateNO,
  formatHotelStayTimes,
  hotelCheckInTime,
  hotelCheckOutTime,
  isStayWithoutOvernight,
  stayKind,
  stayKindLabel,
  stayUnsetLabel,
  type JourneyStay,
} from './journeyModel'
import { noteHasContent, sanitizeNoteHtml } from './noteHtml'

const MOBILE_MQ = '(max-width: 720px)'

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

function useThemeSurfaceColor(open: boolean) {
  const [surfaceColor, setSurfaceColor] = useState('')

  useLayoutEffect(() => {
    if (!open) return
    const root = document.documentElement
    const read = () =>
      getComputedStyle(root).getPropertyValue('--v2-surface-solid').trim() ||
      getComputedStyle(root).getPropertyValue('--v2-field').trim() ||
      '#2a3340'
    setSurfaceColor(read())
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onTheme = () => setSurfaceColor(read())
    mq.addEventListener('change', onTheme)
    return () => mq.removeEventListener('change', onTheme)
  }, [open])

  return surfaceColor
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

type InfoRow = { label: string; value: string }

function buildHotelInfoRows(opts: {
  stay?: JourneyStay | null
  nights?: number
  arriveDate?: string
  departDate?: string
}): { title: string; kindLabel: string; rows: InfoRow[]; notesHtml: string } {
  const stay = opts.stay
  const kind = stayKind(stay)
  const kindLabel = stayKindLabel(kind)
  const name = effectiveHotelName(stay)
  const title = name || (opts.nights && opts.nights >= 1 ? stayUnsetLabel(kind) : kindLabel)
  const rows: InfoRow[] = []

  const address = (stay?.address || '').trim()
  if (address) rows.push({ label: 'Adresse', value: address })

  const arrive = (opts.arriveDate || '').trim()
  const depart = (opts.departDate || '').trim()
  const nights = opts.nights || 0
  if (arrive && depart && nights > 0) {
    rows.push({
      label: 'Dato',
      value: `${formatDateNO(arrive)}–${formatDateNO(depart)} (${nights} ${nights === 1 ? 'natt' : 'netter'})`,
    })
  } else if (arrive) {
    rows.push({ label: 'Ankomst', value: formatDateNO(arrive) })
  } else if (nights > 0) {
    rows.push({
      label: 'Netter',
      value: `${nights} ${nights === 1 ? 'natt' : 'netter'}`,
    })
  }

  if (stay && nights >= 1 && !isStayWithoutOvernight(stay)) {
    rows.push({
      label: 'Innsjekk / utsjekk',
      value: formatHotelStayTimes(stay),
    })
  } else if (stay) {
    const inT = hotelCheckInTime(stay)
    const outT = hotelCheckOutTime(stay)
    if (inT || outT) {
      rows.push({
        label: 'Innsjekk / utsjekk',
        value: `Inn ${inT} · ut ${outT}`,
      })
    }
  }

  const price = (stay?.price || '').trim()
  if (price) rows.push({ label: 'Pris', value: price })

  if (stay?.booked) {
    const where = (stay.bookedWhere || '').trim()
    rows.push({
      label: 'Booket',
      value: where ? `Ja, via ${where}` : 'Ja',
    })
  }

  if (stay?.paid) rows.push({ label: 'Betalt', value: 'Ja' })

  const url = (stay?.url || '').trim()
  if (url) rows.push({ label: 'Lenke', value: url })

  const notesHtml = noteHasContent(stay?.notes)
    ? sanitizeNoteHtml(stay!.notes || '')
    : ''

  return { title, kindLabel, rows, notesHtml }
}

function HotelInfoBody({
  kindLabel,
  rows,
  notesHtml,
}: {
  kindLabel: string
  rows: InfoRow[]
  notesHtml: string
}) {
  return (
    <>
      <p className="v2-hotel-info-kind">{kindLabel}</p>
      {rows.length > 0 ? (
        <dl className="v2-hotel-info-fields">
          {rows.map((row) => (
            <div key={row.label} className="v2-hotel-info-field">
              <dt>{row.label}</dt>
              <dd>
                {row.label === 'Lenke' ? (
                  <a
                    href={row.value}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {notesHtml ? (
        <section className="v2-hotel-info-notes">
          <h4>Notat</h4>
          <div
            className="v2-note-html"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        </section>
      ) : null}
    </>
  )
}

export function HotelLinkedChip({
  stay,
  label,
  lodgingKind = 'hotel',
  empty,
  nights,
  arriveDate,
  departDate,
}: {
  stay?: JourneyStay | null
  label: string
  lodgingKind?: 'hotel' | 'airbnb'
  empty?: boolean
  nights?: number
  arriveDate?: string
  departDate?: string
}) {
  const info = buildHotelInfoRows({ stay, nights, arriveDate, departDate })
  const stamp = [
    info.title,
    info.rows.map((r) => r.value).join('|'),
    info.notesHtml,
  ].join('::')
  const mobile = useMobileSheet()
  const [open, setOpen] = useState(false)
  const surfaceColor = useThemeSurfaceColor(open)
  const surfaceStyle = surfaceColor
    ? { backgroundColor: surfaceColor }
    : undefined
  const [pos, setPos] = useState<PopPos | null>(null)
  const root = useRef<HTMLLIElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  const itemClass = lodgingKind === 'airbnb' ? 'is-airbnb' : 'is-hotel'
  const kindLabel = lodgingKind === 'airbnb' ? 'Airbnb' : 'Hotell'

  useLayoutEffect(() => {
    if (!open || mobile || !btn.current) return

    function place() {
      const el = btn.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(380, Math.max(260, window.innerWidth - 32))
      const margin = 12
      let left = r.left
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - width - margin)
      }
      const gap = 8
      const popH = pop.current?.offsetHeight || 180
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
  }, [open, mobile, stamp])

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

  const popover = mobile ? (
    <div className="v2-city-info-layer" onClick={() => setOpen(false)}>
      <div
        ref={pop}
        className="v2-city-info-pop is-sheet v2-hotel-info-pop"
        role="dialog"
        aria-modal="true"
        aria-label={info.title}
        style={surfaceStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v2-city-info-pop-head">
          <h3>{info.title}</h3>
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
          <HotelInfoBody
            kindLabel={info.kindLabel}
            rows={info.rows}
            notesHtml={info.notesHtml}
          />
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
        className="v2-city-info-pop v2-hotel-info-pop"
        role="dialog"
        aria-modal="true"
        aria-label={info.title}
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
        <div className="v2-city-info-pop-inner v2-hotel-info-pop-inner" style={surfaceStyle}>
          <h3 className="v2-hotel-info-title">{info.title}</h3>
          <HotelInfoBody
            kindLabel={info.kindLabel}
            rows={info.rows}
            notesHtml={info.notesHtml}
          />
        </div>
      </div>
    </>
  )

  return (
    <li
      ref={root}
      className={`v2-hotel-linked-chip${itemClass ? ` ${itemClass}` : ''}${
        empty ? ' is-empty' : ''
      }${open ? ' is-open' : ''}`}
    >
      <button
        ref={btn}
        type="button"
        className="v2-hotel-linked-chip-btn"
        title={`${kindLabel} · vis info`}
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

/** Info (i) button that opens hotel stay details — same popover as HotelLinkedChip. */
export function HotelInfoTip({
  stay,
  nights,
  arriveDate,
  departDate,
  disabled,
}: {
  stay?: JourneyStay | null
  nights?: number
  arriveDate?: string
  departDate?: string
  disabled?: boolean
}) {
  const info = buildHotelInfoRows({ stay, nights, arriveDate, departDate })
  const stamp = [
    info.title,
    info.rows.map((r) => r.value).join('|'),
    info.notesHtml,
  ].join('::')
  const mobile = useMobileSheet()
  const [open, setOpen] = useState(false)
  const surfaceColor = useThemeSurfaceColor(open)
  const surfaceStyle = surfaceColor
    ? { backgroundColor: surfaceColor }
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
      const width = Math.min(380, Math.max(260, window.innerWidth - 32))
      const margin = 12
      let left = r.right - width
      if (left < margin) left = margin
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - width - margin)
      }
      const gap = 8
      const popH = pop.current?.offsetHeight || 180
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
  }, [open, mobile, stamp])

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

  const popover = mobile ? (
    <div className="v2-city-info-layer" onClick={() => setOpen(false)}>
      <div
        ref={pop}
        className="v2-city-info-pop is-sheet v2-hotel-info-pop"
        role="dialog"
        aria-modal="true"
        aria-label={info.title}
        style={surfaceStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v2-city-info-pop-head">
          <h3>{info.title}</h3>
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
          <HotelInfoBody
            kindLabel={info.kindLabel}
            rows={info.rows}
            notesHtml={info.notesHtml}
          />
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
        className="v2-city-info-pop v2-hotel-info-pop"
        role="dialog"
        aria-modal="true"
        aria-label={info.title}
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
        <div
          className="v2-city-info-pop-inner v2-hotel-info-pop-inner"
          style={surfaceStyle}
        >
          <h3 className="v2-hotel-info-title">{info.title}</h3>
          <HotelInfoBody
            kindLabel={info.kindLabel}
            rows={info.rows}
            notesHtml={info.notesHtml}
          />
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
        aria-label="Informasjon om overnatting"
        title={info.title || 'Informasjon om overnatting'}
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
