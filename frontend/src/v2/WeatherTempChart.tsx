import { useLayoutEffect, useRef, useState } from 'react'
import { localizeCity } from '../placeNames'
import { type WeatherDay, type WeatherReport } from '../api'
import { formatDateNO } from './journeyModel'
import {
  getWeatherEntry,
  useWeatherCacheVersion,
} from './weatherPrefetch'
import type { JourneyWeatherSpot } from './JourneyWeather'

function pickDay(weather: WeatherReport, date: string): WeatherDay | null {
  return (
    weather.requested ||
    weather.days.find((d) => d.date === date) ||
    weather.today ||
    weather.days[0] ||
    null
  )
}

type TempPoint = {
  key: string
  city: string
  date: string
  max: number
  min: number
}

function useChartBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 720px)').matches,
  )

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      setWidth(el.clientWidth)
      setMobile(window.matchMedia('(max-width: 720px)').matches)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return { ref, width, mobile }
}

function niceTicks(min: number, max: number): number[] {
  const lo = Math.floor(min / 5) * 5
  const hi = Math.ceil(max / 5) * 5
  const ticks: number[] = []
  for (let t = lo; t <= hi; t += 5) ticks.push(t)
  if (ticks.length < 2) ticks.push(lo + 5)
  return ticks
}

export function WeatherTempChart({
  spots,
}: {
  spots: JourneyWeatherSpot[]
}) {
  useWeatherCacheVersion()
  const [showMax, setShowMax] = useState(true)
  const [showMin, setShowMin] = useState(true)
  const { ref, width: boxW, mobile } = useChartBox()

  const points: TempPoint[] = []
  let lastPlace = ''
  for (const spot of spots) {
    const place = `${spot.city.trim().toLowerCase()}|${spot.country.trim().toLowerCase()}`
    if (place === lastPlace) continue
    const entry = getWeatherEntry(spot.city, spot.country)
    const day = entry.weather ? pickDay(entry.weather, spot.date) : null
    if (!day) continue
    lastPlace = place
    points.push({
      key: spot.key,
      city: localizeCity(spot.city) || spot.city,
      date: spot.date,
      max: day.tempMax,
      min: day.tempMin,
    })
  }

  if (points.length < 2) {
    return (
      <p className="v2-meta">
        Temperaturgrafen vises når vær er hentet for minst to byer.
      </p>
    )
  }
  const temps = points.flatMap((p) => [
    ...(showMax ? [p.max] : []),
    ...(showMin ? [p.min] : []),
  ])
  const ticks = niceTicks(
    temps.length ? Math.min(...temps) : 0,
    temps.length ? Math.max(...temps) : 10,
  )
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const pad = mobile
    ? { top: 8, right: 8, bottom: 64, left: 26 }
    : { top: 10, right: 14, bottom: 70, left: 32 }
  const width = Math.max(boxW, 200)
  const height = mobile ? 156 : 172
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const xAt = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const yAt = (temp: number) =>
    pad.top + ((yMax - temp) / (yMax - yMin || 1)) * innerH

  const maxLine = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.max).toFixed(1)}`)
    .join(' ')
  const minLine = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.min).toFixed(1)}`)
    .join(' ')

  return (
    <figure className="v2-weather-chart">
      <figcaption>Temperatur langs reisen</figcaption>
      <div className="v2-weather-chart-scroll" ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Temperatur per by i datorekkefølge"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yAt(t)}
                y2={yAt(t)}
                className="v2-weather-chart-grid"
              />
              <text
                x={pad.left - 6}
                y={yAt(t) + 3}
                textAnchor="end"
                className="v2-weather-chart-tick"
              >
                {t}°
              </text>
            </g>
          ))}
          {showMin && (
            <path d={minLine} className="v2-weather-chart-min" fill="none" />
          )}
          {showMax && (
            <path d={maxLine} className="v2-weather-chart-max" fill="none" />
          )}
          {points.map((p, i) => (
            <g key={p.key}>
              {showMax && (
                <circle cx={xAt(i)} cy={yAt(p.max)} r="3.5" className="v2-weather-chart-dot-max" />
              )}
              {showMin && (
                <circle cx={xAt(i)} cy={yAt(p.min)} r="3" className="v2-weather-chart-dot-min" />
              )}
              <text
                x={xAt(i)}
                y={height - pad.bottom + 8}
                textAnchor="start"
                className="v2-weather-chart-city"
                transform={`rotate(90 ${xAt(i)} ${height - pad.bottom + 8})`}
              >
                {p.city} {formatDateNO(p.date).slice(0, 5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="v2-weather-chart-legend">
        <button
          type="button"
          className={`is-max${showMax ? '' : ' is-off'}`}
          aria-pressed={showMax}
          title={showMax ? 'Skjul høy temperatur' : 'Vis høy temperatur'}
          onClick={() => setShowMax((v) => !v)}
        >
          Høy
        </button>
        <button
          type="button"
          className={`is-min${showMin ? '' : ' is-off'}`}
          aria-pressed={showMin}
          title={showMin ? 'Skjul lav temperatur' : 'Vis lav temperatur'}
          onClick={() => setShowMin((v) => !v)}
        >
          Lav
        </button>
      </p>
    </figure>
  )
}
