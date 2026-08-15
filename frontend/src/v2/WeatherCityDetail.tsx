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

function observationsOf(
  weather: WeatherReport,
  history?: WeatherHistory | null,
): WeatherObservation[] {
  const fromWeather = weather.observations || []
  if (fromWeather.length >= 2) return fromWeather
  const fromHist = history?.observations || []
  if (fromHist.length >= 2) return fromHist
  const fromSnaps = (history?.snapshots || [])
    .filter((snap) => snap.current)
    .map((snap) => ({
      at: snap.fetchedAt,
      temperature: snap.current!.temperature,
      weatherCode: snap.current!.weatherCode,
      summary: snap.current!.summary,
      icon: snap.current!.icon,
    }))
  if (fromSnaps.length >= 2) return fromSnaps
  if (fromWeather.length) return fromWeather
  if (fromHist.length) return fromHist
  return fromSnaps
}

function daysAsPoints(days: WeatherDay[]): WeatherObservation[] {
  return (days || []).map((d) => ({
    at: `${d.date}T12:00:00`,
    temperature: d.tempMax,
    weatherCode: d.weatherCode,
    summary: d.summary,
    icon: d.icon,
  }))
}

function sparkPoints(
  weather: WeatherReport,
  history?: WeatherHistory | null,
): WeatherObservation[] {
  const observed = observationsOf(weather, history)
  if (observed.length >= 2) return observed
  const today = todayIsoOslo()
  const past = (weather.days || []).filter((d) => d.date && d.date <= today)
  return daysAsPoints(past)
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
  const lo = Math.min(...temps) - 1
  const hi = Math.max(...temps) + 1
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
      title="Aktuelt vær, to ganger om dagen"
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
        Historikk bygges med aktuelt vær to ganger om dagen. Fem dager bakover
        fylles inn første gang stedet hentes.
      </p>
    )
  }
  const temps = observations.map((o) => o.temperature)
  const lo = Math.floor(Math.min(...temps) / 2) * 2
  const hi = Math.ceil(Math.max(...temps) / 2) * 2
  const w = 280
  const h = 120
  const pad = { t: 8, r: 8, b: 22, l: 28 }
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
  const first = observations[0]
  const last = observations[observations.length - 1]

  return (
    <svg
      className="v2-weather-history-svg"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label="Aktuelt vær over tid"
    >
      <path d={line} className="v2-weather-chart-max" fill="none" />
      {observations.map((o, i) => (
        <circle
          key={o.at}
          cx={xAt(i)}
          cy={yAt(o.temperature)}
          r="3"
          className="v2-weather-chart-dot-max"
        />
      ))}
      <text
        x={xAt(0)}
        y={h - 6}
        textAnchor="start"
        className="v2-weather-chart-date"
      >
        {formatDateNO(first.at.slice(0, 10))}
      </text>
      <text
        x={xAt(observations.length - 1)}
        y={h - 6}
        textAnchor="end"
        className="v2-weather-chart-date"
      >
        {formatDateNO(last.at.slice(0, 10))}
      </text>
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
  const observations = observationsOf(weather, history)

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
              Aktuelt vær · to ganger om dagen · fem dager bakover
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
            <h4>Aktuelt vær</h4>
            {history === null && observations.length < 2 ? (
              <p className="v2-meta">Henter historikk…</p>
            ) : (
              <HistoryChart observations={observations} />
            )}
          </section>
          {days.length > 0 ? (
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
                    <span className="v2-meta">
                      {d.precipitation.toFixed(1)} mm
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
