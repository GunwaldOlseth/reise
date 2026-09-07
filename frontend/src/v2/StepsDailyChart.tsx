import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { formatChartDateNO } from './weatherDisplay'
import type { JourneyOverviewStepsDayRow } from './journeyModel'

const TRAVELER_COLORS = [
  'var(--v2-steps-color-1)',
  'var(--v2-steps-color-2)',
  'var(--v2-steps-color-3)',
  'var(--v2-steps-color-4)',
  'var(--v2-steps-color-5)',
  'var(--v2-steps-color-6)',
]

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

function formatStepAxis(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`
  }
  return String(n)
}

function niceStepTicks(max: number): number[] {
  if (max <= 0) return [0, 5000, 10000]
  const rough = max / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / magnitude
  let step = magnitude
  if (residual > 5) step = magnitude * 10
  else if (residual > 2) step = magnitude * 5
  else if (residual > 1) step = magnitude * 2
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= hi; t += step) ticks.push(t)
  return ticks
}

function labelStep(count: number, innerW: number, minPx: number): number {
  if (count <= 2) return 1
  const needed = (count - 1) * minPx
  if (needed <= innerW) return 1
  return Math.ceil(needed / innerW)
}

function formatStepCount(n: number): string {
  return n.toLocaleString('nb-NO')
}

export function StepsDailyChart({
  travelers,
  days,
}: {
  travelers: string[]
  days: JourneyOverviewStepsDayRow[]
}) {
  const { ref, width: boxW, mobile } = useChartBox()

  if (days.length === 0 || travelers.length === 0) return null

  const maxSteps = Math.max(
    1,
    ...days.flatMap((day) => travelers.map((name) => day.byTraveler[name] || 0)),
  )
  const ticks = niceStepTicks(maxSteps)
  const yMax = ticks[ticks.length - 1]
  const pad = mobile
    ? { top: 8, right: 10, bottom: 54, left: 34 }
    : { top: 10, right: 16, bottom: 58, left: 40 }
  const width = Math.max(boxW, 200)
  const height = mobile ? 196 : 220
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const groupWidth = innerW / days.length
  const groupPadding = Math.min(12, groupWidth * 0.12)
  const barGap = travelers.length > 1 ? 2 : 0
  const barWidth = Math.max(
    4,
    (groupWidth - groupPadding * 2 - barGap * (travelers.length - 1)) /
      travelers.length,
  )
  const totalBarsWidth =
    barWidth * travelers.length + barGap * (travelers.length - 1)
  const yAt = (steps: number) =>
    pad.top + innerH - (steps / (yMax || 1)) * innerH
  const labelEvery = labelStep(days.length, innerW, mobile ? 40 : 48)

  return (
    <figure className="v2-steps-chart">
      <figcaption>Skritt per dag</figcaption>
      <div className="v2-steps-chart-scroll" ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Skritt per dag for hver person på reisen"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yAt(t)}
                y2={yAt(t)}
                className="v2-steps-chart-grid"
              />
              <text
                x={pad.left - 6}
                y={yAt(t) + 3}
                textAnchor="end"
                className="v2-steps-chart-tick"
              >
                {formatStepAxis(t)}
              </text>
            </g>
          ))}
          {days.map((day, dayIndex) => {
            const groupCenter =
              pad.left + (dayIndex + 0.5) * groupWidth
            const showLabel =
              dayIndex === 0 ||
              dayIndex === days.length - 1 ||
              dayIndex % labelEvery === 0
            const labelY = pad.top + innerH + 10
            return (
              <g key={day.date}>
                {travelers.map((name, travelerIndex) => {
                  const steps = day.byTraveler[name] || 0
                  if (steps <= 0) return null
                  const x =
                    groupCenter -
                    totalBarsWidth / 2 +
                    travelerIndex * (barWidth + barGap)
                  const barTop = yAt(steps)
                  const barHeight = pad.top + innerH - barTop
                  const color =
                    TRAVELER_COLORS[travelerIndex % TRAVELER_COLORS.length]
                  return (
                    <rect
                      key={name}
                      x={x}
                      y={barTop}
                      width={barWidth}
                      height={Math.max(0, barHeight)}
                      rx={Math.min(3, barWidth / 3)}
                      fill={color}
                    >
                      <title>
                        {name} · {formatChartDateNO(day.date)} ·{' '}
                        {formatStepCount(steps)} skritt
                      </title>
                    </rect>
                  )
                })}
                {showLabel ? (
                  <text
                    x={groupCenter}
                    y={labelY}
                    textAnchor="end"
                    className="v2-steps-chart-date"
                    transform={`rotate(-42 ${groupCenter} ${labelY})`}
                  >
                    {formatChartDateNO(day.date)}
                  </text>
                ) : (
                  <line
                    x1={groupCenter}
                    x2={groupCenter}
                    y1={pad.top + innerH}
                    y2={pad.top + innerH + 4}
                    className="v2-steps-chart-grid"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="v2-steps-chart-legend" aria-label="Personer">
        {travelers.map((name, index) => (
          <li
            key={name}
            style={
              {
                '--v2-steps-legend-color':
                  TRAVELER_COLORS[index % TRAVELER_COLORS.length],
              } as CSSProperties
            }
          >
            {name}
          </li>
        ))}
      </ul>
    </figure>
  )
}
