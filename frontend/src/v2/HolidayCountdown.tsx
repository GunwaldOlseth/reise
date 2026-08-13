import { useEffect, useState } from 'react'
import { formatDateNO } from './journeyModel'

function osloMidnightMs(isoDate: string): number {
  const iso = isoDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  let guess = Date.parse(`${iso}T00:00:00Z`)
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    )
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    const wanted = Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10)),
      0,
      0,
      0,
    )
    const delta = wanted - asUtc
    if (delta === 0) break
    guess += delta
  }
  return guess
}

function splitCountdown(ms: number) {
  const safe = Math.max(0, ms)
  const seconds = Math.floor(safe / 1000)
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  }
}

export function HolidayCountdown({
  startDate,
  detail,
  onOpen,
}: {
  startDate: string
  detail?: string
  onOpen?: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const startMs = osloMidnightMs(startDate)
  const left = startMs - now

  useEffect(() => {
    if (!Number.isFinite(startMs)) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [startMs])

  if (!Number.isFinite(startMs) || left <= 0) return null

  const parts = splitCountdown(left)
  const units = [
    { n: parts.days, label: parts.days === 1 ? 'dag' : 'dager' },
    { n: parts.hours, label: parts.hours === 1 ? 'time' : 'timer' },
    { n: parts.minutes, label: 'min' },
  ]
  if (parts.days < 2) {
    units.push({ n: parts.seconds, label: 'sek' })
  }

  const body = (
    <>
      <p className="v2-live-countdown-kicker">Ferie om</p>
      <div className="v2-live-countdown-units">
        {units.map((u) => (
          <div key={u.label} className="v2-live-countdown-unit">
            <strong>{u.n}</strong>
            <span>{u.label}</span>
          </div>
        ))}
      </div>
      <p className="v2-meta">
        Starter {formatDateNO(startDate)}
        {detail ? ` · ${detail}` : ''}
      </p>
    </>
  )

  if (onOpen) {
    return (
      <button
        type="button"
        className="v2-live-countdown is-button"
        onClick={onOpen}
      >
        {body}
      </button>
    )
  }

  return (
    <aside className="v2-live-countdown" role="status">
      {body}
    </aside>
  )
}
