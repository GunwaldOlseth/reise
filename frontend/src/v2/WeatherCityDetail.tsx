import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  api,
  type WeatherDay,
  type WeatherHistory,
  type WeatherObservation,
  type WeatherReport,
} from '../api'
import { formatDateNO, todayIsoOslo } from './journeyModel'
import { formatChartDateNO, formatTempC, tempChartScale } from './weatherDisplay'

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

/** Chart: kl. 12 (± legacy 08/19), siste 7 dager. Fyller fra API når lagret historikk er tynn. */
function chartObservations(
  history?: WeatherHistory | null,
  weather?: WeatherReport | null,
): WeatherObservation[] {
  const today = todayIsoOslo()
  const oldest = addDaysIso(today, -7)
  const byDate = new Map<string, WeatherObservation>()

  const add = (o: WeatherObservation, replace = false) => {
    const day = (o.at || '').slice(0, 10)
    if (!day || day < oldest || day > today) return
    const hour = parseOsloHour(o.at)
    if (hour !== null && hour !== 12 && hour !== 8 && hour !== 19) return
    if (!replace && byDate.has(day)) return
    byDate.set(day, { ...o, at: `${day}T12:00:00` })
  }

  for (const o of history?.observations || []) add(o)
  for (const o of weather?.observations || []) add(o)
  for (const d of weather?.days || []) {
    if (!d.date || d.date >= today) continue
    add({
      at: `${d.date}T12:00:00`,
      temperature: d.tempMax,
      weatherCode: d.weatherCode,
      summary: d.summary,
      icon: d.icon,
    })
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, o]) => o)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseOsloHour(at: string): number | null {
  const m = at.match(/T(\d{2}):/)
  if (m) return Number(m[1])
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? null : d.getHours()
}

function sparkPoints(
  weather?: WeatherReport | null,
  history?: WeatherHistory | null,
): WeatherObservation[] {
  return chartObservations(history, weather)
}

function DaySpark({
  observations,
  onOpen,
}: {
  observations: WeatherObservation[]
  onOpen: () => void
}) {
  if (observations.length < 2) return null
  const temps = observations.map((o) => o.temperature)
  const { lo, hi } = tempChartScale(temps)
  const w = 92
  const h = 36
  const pad = 3
  const xAt = (i: number) =>
    pad + (i / (observations.length - 1)) * (w - pad * 2)
  const yAt = (t: number) =>
    pad + ((hi - t) / (hi - lo || 1)) * (h - pad * 2)
  const line = observations
    .map(
      (o, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(o.temperature).toFixed(1)}`,
    )
    .join(' ')
  const last = observations.length - 1

  return (
    <button
      type="button"
      className="v2-weather-spark"
      title="Temperatur kl. 12 de siste 7 dagene"
      aria-label="Vis værdetaljer"
      onClick={onOpen}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
        <path d={line} className="v2-weather-spark-line" fill="none" />
        {observations.map((o, i) => (
          <circle
            key={o.at}
            cx={xAt(i)}
            cy={yAt(o.temperature)}
            r={i === last ? 3.2 : 2.2}
            className={
              i === last
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
  observations,
}: {
  observations: WeatherObservation[]
}) {
  if (observations.length < 2) {
    return (
      <p className="v2-meta">
        Grafen viser temperatur kl. 12 de siste 7 dagene. Historikk fylles inn
        første gang stedet hentes, og én gang daglig kl. 12.
      </p>
    )
  }
  const temps = observations.map((o) => o.temperature)
  const { ticks, lo, hi } = tempChartScale(temps)
  const w = 320
  const h = 148
  const pad = { t: 10, r: 10, b: 30, l: 34 }
  const xAt = (i: number) =>
    pad.l + (i / (observations.length - 1)) * (w - pad.l - pad.r)
  const yAt = (t: number) =>
    pad.t + ((hi - t) / (hi - lo || 1)) * (h - pad.t - pad.b)
  const line = observations
    .map(
      (o, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(o.temperature).toFixed(1)}`,
    )
    .join(' ')

  return (
    <svg
      className="v2-weather-history-svg"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label="Temperatur kl. 12 de siste 7 dagene"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={yAt(t)}
            y2={yAt(t)}
            className="v2-weather-chart-grid"
          />
          <text
            x={pad.l - 5}
            y={yAt(t) + 3}
            textAnchor="end"
            className="v2-weather-chart-tick"
          >
            {t}°
          </text>
        </g>
      ))}
      <path d={line} className="v2-weather-chart-max" fill="none" />
      {observations.map((o, i) => (
        <g key={o.at}>
          <circle
            cx={xAt(i)}
            cy={yAt(o.temperature)}
            r="3.5"
            className="v2-weather-chart-dot-max"
          />
          <text
            x={xAt(i)}
            y={yAt(o.temperature) - 6}
            textAnchor="middle"
            className="v2-weather-chart-temp-label"
          >
            {formatTempC(o.temperature)}
          </text>
        </g>
      ))}
      {observations.map((o, i) => (
        <text
          key={`${o.at}-label`}
          x={xAt(i)}
          y={h - 5}
          textAnchor="middle"
          className="v2-weather-chart-date"
        >
          {formatChartDateNO(o.at.slice(0, 10))}
        </text>
      ))}
    </svg>
  )
}

export function WeatherDaySpark({
  days: _days,
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

  const points = sparkPoints(weather, history)
  if (points.length < 2) return null
  return (
    <>
      <DaySpark observations={points} onOpen={() => setOpen(true)} />
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
  const observations = chartObservations(history, weather)

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
              Temperatur kl. 12 · sju dager bakover
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
          <section>
            <h4>Temperatur kl. 12</h4>
            {history === null && observations.length < 2 ? (
              <p className="v2-meta">Henter historikk…</p>
            ) : (
              <HistoryChart observations={observations} />
            )}
          </section>
          {days.length > 0 ? (
            <section>
              <h4>Prognose per dag</h4>
              <ul className="v2-weather-detail-days">
                {days.map((d) => {
                  const today = todayIsoOslo()
                  const isForecast = d.date > today
                  return (
                    <li
                      key={d.date}
                      className={[
                        d.date === highlight ? 'is-on' : '',
                        isForecast ? 'is-forecast' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined}
                      title={formatDateNO(d.date)}
                    >
                      <span className="v2-weather-detail-day-date">
                        {formatChartDateNO(d.date)}
                      </span>
                      <strong className="v2-weather-detail-day-temp">
                        {formatTempC(d.tempMax)}
                      </strong>
                      <span className="v2-weather-detail-day-summary">
                        {d.summary}
                      </span>
                      {d.precipitation > 0 ? (
                        <span className="v2-meta v2-weather-detail-day-rain">
                          {d.precipitation.toFixed(1)} mm
                        </span>
                      ) : (
                        <span className="v2-weather-detail-day-rain" />
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
