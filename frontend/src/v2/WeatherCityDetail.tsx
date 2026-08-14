import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  api,
  type WeatherDay,
  type WeatherHistory,
  type WeatherReport,
} from '../api'
import { formatDateNO } from './journeyModel'

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

function DaySpark({
  days,
  highlight,
  onOpen,
}: {
  days: WeatherDay[]
  highlight?: string
  onOpen: () => void
}) {
  if (days.length < 2) return null
  const temps = days.map((d) => d.tempMax)
  const lo = Math.min(...temps) - 1
  const hi = Math.max(...temps) + 1
  const w = 92
  const h = 36
  const pad = 3
  const xAt = (i: number) =>
    pad + (i / (days.length - 1)) * (w - pad * 2)
  const yAt = (t: number) =>
    pad + ((hi - t) / (hi - lo || 1)) * (h - pad * 2)
  const line = days
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.tempMax).toFixed(1)}`,
    )
    .join(' ')

  return (
    <button
      type="button"
      className="v2-weather-spark"
      title="Vis værdetaljer"
      aria-label="Vis værdetaljer"
      onClick={onOpen}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
        <path d={line} className="v2-weather-spark-line" fill="none" />
        {days.map((d, i) => (
          <circle
            key={d.date}
            cx={xAt(i)}
            cy={yAt(d.tempMax)}
            r={d.date === highlight ? 3.2 : 2.2}
            className={
              d.date === highlight
                ? 'v2-weather-spark-dot is-on'
                : 'v2-weather-spark-dot'
            }
          />
        ))}
      </svg>
    </button>
  )
}

function HistoryChart({
  history,
  targetDate,
}: {
  history: WeatherHistory
  targetDate: string
}) {
  const points = history.snapshots
    .map((snap) => {
      const day = snap.days.find((d) => d.date === targetDate)
      if (!day) return null
      return { at: snap.fetchedAt, max: day.tempMax, min: day.tempMin }
    })
    .filter((p): p is { at: string; max: number; min: number } => !!p)
  if (points.length < 2) {
    return (
      <p className="v2-meta">
        Historikk bygges opp to ganger om dagen. Kom tilbake etter neste
        henting for å se hvordan prognosen endrer seg.
      </p>
    )
  }
  const temps = points.flatMap((p) => [p.max, p.min])
  const lo = Math.floor(Math.min(...temps) / 2) * 2
  const hi = Math.ceil(Math.max(...temps) / 2) * 2
  const w = 280
  const h = 120
  const pad = { t: 8, r: 8, b: 22, l: 28 }
  const xAt = (i: number) =>
    pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r)
  const yAt = (t: number) =>
    pad.t + ((hi - t) / (hi - lo || 1)) * (h - pad.t - pad.b)
  const maxLine = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.max).toFixed(1)}`,
    )
    .join(' ')

  return (
    <svg
      className="v2-weather-history-svg"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label={`Prognoseutvikling for ${formatDateNO(targetDate)}`}
    >
      <path d={maxLine} className="v2-weather-chart-max" fill="none" />
      {points.map((p, i) => (
        <g key={p.at}>
          <circle cx={xAt(i)} cy={yAt(p.max)} r="3" className="v2-weather-chart-dot-max" />
          {i === 0 || i === points.length - 1 ? (
            <text
              x={xAt(i)}
              y={h - 6}
              textAnchor={i === 0 ? 'start' : 'end'}
              className="v2-weather-chart-date"
            >
              {formatDateNO(p.at.slice(0, 10))}
            </text>
          ) : null}
        </g>
      ))}
      <text x={4} y={pad.t + 4} className="v2-weather-chart-tick">
        {hi}°
      </text>
      <text x={4} y={h - pad.b} className="v2-weather-chart-tick">
        {lo}°
      </text>
    </svg>
  )
}

export function WeatherDaySpark({
  days,
  highlight,
  city,
  country,
  weather,
}: {
  days: WeatherDay[]
  highlight?: string
  city: string
  country: string
  weather: WeatherReport
}) {
  const [open, setOpen] = useState(false)
  if (days.length < 2) return null
  return (
    <>
      <DaySpark days={days} highlight={highlight} onOpen={() => setOpen(true)} />
      {open && (
        <WeatherCityDialog
          city={city}
          country={country}
          weather={weather}
          highlight={highlight}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function WeatherCityDialog({
  city,
  country,
  weather,
  highlight,
  onClose,
}: {
  city: string
  country: string
  weather: WeatherReport
  highlight?: string
  onClose: () => void
}) {
  const [history, setHistory] = useState<WeatherHistory | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .getWeatherHistory(city, country)
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch(() => {
        if (!cancelled) setHistory(null)
      })
    return () => {
      cancelled = true
    }
  }, [city, country])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const days = weather.days || []

  return createPortal(
    <div className="v2-weather-detail-layer" onClick={onClose}>
      <div
        className="v2-weather-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Vær for ${city}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v2-weather-detail-head">
          <div>
            <h3>{city}</h3>
            <p className="v2-meta">
              Ett punkt per dag · historikk to ganger om dagen
            </p>
          </div>
          <button
            type="button"
            className="v2-city-info-close"
            aria-label="Lukk"
            title="Lukk"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="v2-weather-detail-body">
          <ul className="v2-weather-detail-days">
            {days.map((d) => (
              <li
                key={d.date}
                className={d.date === highlight ? 'is-on' : undefined}
              >
                <strong>{formatDateNO(d.date)}</strong>
                <span>
                  {Math.round(d.tempMax)}° / {Math.round(d.tempMin)}°
                </span>
                <span className="v2-meta">{d.summary}</span>
                {d.precipitation > 0 ? (
                  <span className="v2-meta">{d.precipitation.toFixed(1)} mm</span>
                ) : null}
              </li>
            ))}
          </ul>
          {highlight ? (
            <section>
              <h4>Utvikling for {formatDateNO(highlight)}</h4>
              {history ? (
                <HistoryChart history={history} targetDate={highlight} />
              ) : (
                <p className="v2-meta">Henter historikk…</p>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
