import { useLayoutEffect, useRef, useState } from 'react'
import { localizeCity } from '../placeNames'
import { useWeatherCacheVersion } from './weatherPrefetch'
import { formatChartDateNO, type JourneyWeatherRow } from './weatherDisplay'

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

export function WeatherTempChart({ rows }: { rows: JourneyWeatherRow[] }) {
  useWeatherCacheVersion()
  const { ref, width: boxW, mobile } = useChartBox()

  if (rows.length < 2) {
    return (
      <p className="v2-meta">
        Temperaturgrafen vises når reisen har minst to stopp med dato.
      </p>
    )
  }

  const points = rows.map((row) => ({
    key: row.spot.key,
    city: localizeCity(row.spot.city) || row.spot.city,
    date: row.spot.date,
    max: row.tempMax,
  }))

  const temps = points.map((p) => p.max).filter((t): t is number => t != null)
  const ticks =
    temps.length > 0
      ? niceTicks(Math.min(...temps), Math.max(...temps))
      : [15, 20, 25, 30]
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const pad = mobile
    ? { top: 8, right: 8, bottom: 52, left: 26 }
    : { top: 10, right: 14, bottom: 56, left: 32 }
  const width = Math.max(boxW, 200)
  const height = mobile ? 156 : 172
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const xAt = (i: number) =>
    pad.left +
    (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const yAt = (temp: number) =>
    pad.top + ((yMax - temp) / (yMax - yMin || 1)) * innerH

  const lineParts: string[] = []
  let segmentOpen = false
  for (let i = 0; i < points.length; i++) {
    const max = points[i].max
    if (max == null) {
      segmentOpen = false
      continue
    }
    const x = xAt(i).toFixed(1)
    const y = yAt(max).toFixed(1)
    if (!segmentOpen) {
      lineParts.push(`M ${x} ${y}`)
      segmentOpen = true
    } else {
      lineParts.push(`L ${x} ${y}`)
    }
  }
  const maxLine = lineParts.join(' ')

  return (
    <figure className="v2-weather-chart">
      <figcaption>Temperatur langs reisen (kl. 12)</figcaption>
      <div className="v2-weather-chart-scroll" ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Temperatur per stopp i datorekkefølge"
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
          {maxLine ? (
            <path d={maxLine} className="v2-weather-chart-max" fill="none" />
          ) : null}
          {points.map((p, i) => (
            <g key={p.key}>
              <title>
                {p.max != null
                  ? `${p.city} · ${formatChartDateNO(p.date)} · ${Math.round(p.max)}°`
                  : `${p.city} · ${formatChartDateNO(p.date)} · ingen data`}
              </title>
              {p.max != null ? (
                <circle
                  cx={xAt(i)}
                  cy={yAt(p.max)}
                  r="3.5"
                  className="v2-weather-chart-dot-max"
                />
              ) : (
                <circle
                  cx={xAt(i)}
                  cy={yAt(yMin)}
                  r="2.5"
                  className="v2-weather-chart-dot-missing"
                />
              )}
              <text
                x={xAt(i)}
                y={height - pad.bottom + 6}
                textAnchor="middle"
                className="v2-weather-chart-city"
              >
                {p.city}
              </text>
              <text
                x={xAt(i)}
                y={height - pad.bottom + 16}
                textAnchor="middle"
                className="v2-weather-chart-date"
              >
                {formatChartDateNO(p.date)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  )
}
