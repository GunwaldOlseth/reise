import { useLayoutEffect, useRef, useState } from 'react'
import { localizeCity } from '../placeNames'
import { useWeatherCacheVersion } from './weatherPrefetch'
import {
  formatChartDateNO,
  formatTempC,
  type JourneyWeatherRow,
} from './weatherDisplay'

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

function polylinePath(
  values: Array<number | null>,
  xAt: (i: number) => number,
  yAt: (temp: number) => number,
): string {
  const parts: string[] = []
  let open = false
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v == null) {
      open = false
      continue
    }
    const x = xAt(i).toFixed(1)
    const y = yAt(v).toFixed(1)
    if (!open) {
      parts.push(`M ${x} ${y}`)
      open = true
    } else {
      parts.push(`L ${x} ${y}`)
    }
  }
  return parts.join(' ')
}

function labelStep(count: number, innerW: number, minPx: number): number {
  if (count <= 2) return 1
  const needed = (count - 1) * minPx
  if (needed <= innerW) return 1
  return Math.ceil(needed / innerW)
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
    now: row.tempNow,
    arrive: row.tempArrive,
  }))

  const temps = points
    .flatMap((p) => [p.now, p.arrive])
    .filter((t): t is number => t != null)
  const ticks =
    temps.length > 0
      ? niceTicks(Math.min(...temps), Math.max(...temps))
      : [15, 20, 25, 30]
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const pad = mobile
    ? { top: 8, right: 10, bottom: 62, left: 26 }
    : { top: 10, right: 16, bottom: 68, left: 32 }
  const width = Math.max(boxW, 200)
  const height = mobile ? 176 : 196
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const xAt = (i: number) =>
    pad.left +
    (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const yAt = (temp: number) =>
    pad.top + ((yMax - temp) / (yMax - yMin || 1)) * innerH

  const nowLine = polylinePath(
    points.map((p) => p.now),
    xAt,
    yAt,
  )
  const arriveLine = polylinePath(
    points.map((p) => p.arrive),
    xAt,
    yAt,
  )
  const step = labelStep(points.length, innerW, mobile ? 44 : 52)

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
          aria-label="Temperatur per by: nå og ankomstdag"
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
          {nowLine ? (
            <path d={nowLine} className="v2-weather-chart-now" fill="none" />
          ) : null}
          {arriveLine ? (
            <path d={arriveLine} className="v2-weather-chart-max" fill="none" />
          ) : null}
          {points.map((p, i) => {
            const showLabel =
              i === 0 || i === points.length - 1 || i % step === 0
            const x = xAt(i)
            const labelY = pad.top + innerH + 10
            const nowTip =
              p.now != null ? `nå ${formatTempC(p.now)}` : 'nå uten data'
            const arriveTip =
              p.arrive != null
                ? `ankomst ${formatChartDateNO(p.date)} ${formatTempC(p.arrive)}`
                : `ankomst ${formatChartDateNO(p.date)} utenfor 7-dagersprognose`
            return (
              <g key={p.key}>
                <title>
                  {p.city} · {nowTip} · {arriveTip}
                </title>
                {p.now != null ? (
                  <circle
                    cx={x}
                    cy={yAt(p.now)}
                    r="3.2"
                    className="v2-weather-chart-dot-now"
                  />
                ) : null}
                {p.arrive != null ? (
                  <circle
                    cx={x}
                    cy={yAt(p.arrive)}
                    r="3.5"
                    className="v2-weather-chart-dot-max"
                  />
                ) : null}
                {showLabel ? (
                  <text
                    x={x}
                    y={labelY}
                    textAnchor="end"
                    className="v2-weather-chart-city"
                    transform={`rotate(-42 ${x} ${labelY})`}
                  >
                    {p.city}
                  </text>
                ) : (
                  <line
                    x1={x}
                    x2={x}
                    y1={pad.top + innerH}
                    y2={pad.top + innerH + 4}
                    className="v2-weather-chart-grid"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="v2-weather-chart-legend">
        <li className="is-now">Nå</li>
        <li className="is-arrive">Ankomstdag (maks)</li>
      </ul>
    </figure>
  )
}
