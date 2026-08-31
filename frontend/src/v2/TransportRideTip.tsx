import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  formatTransportOptionLabel,
  isTransportOptionFilled,
  sortTransportOptions,
  type OverviewRide,
  viaTransportOptions,
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

function ScheduleIcon({ size = 16 }: { size?: number }) {
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
      <path d="M12 7v5l3 2" />
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

function timetableOptions(ride: OverviewRide) {
  return sortTransportOptions(viaTransportOptions(ride.via)).filter(
    isTransportOptionFilled,
  )
}

export function TransportRideTip({
  ride,
  children,
}: {
  ride: OverviewRide
  children: ReactNode
}) {
  const options = timetableOptions(ride)
  const notesHtml = noteHasContent(ride.via.notes)
    ? sanitizeNoteHtml(ride.via.notes || '')
    : ''
  const canOpen = options.length > 0 || notesHtml.length > 0
  const stamp = [
    options.map((o) => o.id).join('|'),
    options.map((o) => formatTransportOptionLabel(o)).join('|'),
    notesHtml,
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

  const heading = `${ride.fromLabel} → ${ride.toLabel}`

  useLayoutEffect(() => {
    if (!open || mobile || !btn.current) return

    function place() {
      const el = btn.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(420, Math.max(280, window.innerWidth - 32))
      const margin = 12
      let left = r.left
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - width - margin)
      }
      const gap = 8
      const popH = pop.current?.offsetHeight || 200
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

  const body = (
    <>
      {options.length > 0 ? (
        <ol className="v2-transport-timetable">
          {options.map((opt, i) => (
            <li
              key={opt.id}
              className={`v2-transport-timetable-row${
                opt.taken ? ' is-taken' : ''
              }`}
            >
              <span className="v2-transport-timetable-num">{i + 1}</span>
              <span className="v2-transport-timetable-line">
                {formatTransportOptionLabel(opt, {
                  abbreviateCompany: true,
                  includePrice: true,
                  includeHopBadge: true,
                  via: ride.via,
                })}
              </span>
              {opt.taken ? (
                <span className="v2-transport-timetable-badge">Kvittert</span>
              ) : null}
              {opt.ticket ? (
                <span className="v2-transport-timetable-badge is-ticket">
                  Billett
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="v2-meta">Ingen rutetider lagt inn for denne etappen.</p>
      )}
      {notesHtml ? (
        <section className="v2-transport-timetable-notes">
          <h4>Notat</h4>
          <div
            className="v2-note-html"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        </section>
      ) : null}
    </>
  )

  const popover = mobile ? (
    <div className="v2-city-info-layer" onClick={() => setOpen(false)}>
      <div
        ref={pop}
        className="v2-city-info-pop is-sheet v2-transport-timetable-pop"
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
          {body}
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
        className="v2-city-info-pop v2-transport-timetable-pop"
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
          <h3 className="v2-transport-timetable-title">{heading}</h3>
          {body}
        </div>
      </div>
    </>
  )

  return (
    <li
      ref={root}
      className={`${canOpen ? 'is-clickable' : ''}${open ? ' is-open' : ''}`}
    >
      <button
        ref={btn}
        type="button"
        className="v2-overview-ride-btn"
        disabled={!canOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={canOpen ? 'Vis rutetider' : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (canOpen) setOpen((v) => !v)
        }}
      >
        {children}
        {canOpen ? (
          <span className="v2-overview-ride-icon" aria-hidden>
            <ScheduleIcon />
          </span>
        ) : null}
      </button>
      {open && createPortal(popover, document.body)}
    </li>
  )
}
