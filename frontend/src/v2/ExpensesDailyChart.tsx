import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { formatExpenseAmount, type DayExpenseSummary } from '../api'
import { formatChartDateNO } from './weatherDisplay'

const SEGMENTS = [
  {
    key: 'hotel' as const,
    label: 'Hotell',
    color: 'var(--v2-expense-chart-hotel)',
  },
  {
    key: 'transport' as const,
    label: 'Transport',
    color: 'var(--v2-expense-chart-transport)',
  },
  {
    key: 'purchase' as const,
    label: 'Kjøp',
    color: 'var(--v2-expense-chart-purchase)',
  },
] as const

function purchaseAmount(day: DayExpenseSummary): number {
  return day.program + day.live + day.cruise
}

function dayStackTotal(day: DayExpenseSummary): number {
  return day.hotel + day.transport + purchaseAmount(day)
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

function formatAxisAmount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`
  }
  return String(Math.round(n))
}

function niceAmountTicks(max: number): number[] {
  if (max <= 0) return [0, 500, 1000]
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

function segmentAmount(
  day: DayExpenseSummary,
  key: (typeof SEGMENTS)[number]['key'],
): number {
  if (key === 'hotel') return day.hotel
  if (key === 'transport') return day.transport
  return purchaseAmount(day)
}

export function ExpensesDailyChart({ days }: { days: DayExpenseSummary[] }) {
  const { ref, width: boxW, mobile } = useChartBox()

  const chartDays = days.filter((d) => dayStackTotal(d) > 0)
  if (chartDays.length === 0) return null

  const maxTotal = Math.max(1, ...chartDays.map((d) => dayStackTotal(d)))
  const ticks = niceAmountTicks(maxTotal)
  const yMax = ticks[ticks.length - 1]
  const pad = mobile
    ? { top: 8, right: 10, bottom: 54, left: 40 }
    : { top: 10, right: 16, bottom: 58, left: 48 }
  const width = Math.max(boxW, 200)
  const height = mobile ? 196 : 220
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const groupWidth = innerW / chartDays.length
  const barWidth = Math.max(8, groupWidth * 0.55)
  const yAt = (amount: number) =>
    pad.top + innerH - (amount / (yMax || 1)) * innerH
  const labelEvery = labelStep(chartDays.length, innerW, mobile ? 40 : 48)

  return (
    <figure className="v2-expense-chart">
      <figcaption>Utgifter per dag</figcaption>
      <div className="v2-expense-chart-scroll" ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Utgifter per dag fordelt på kjøp, hotell og transport"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yAt(t)}
                y2={yAt(t)}
                className="v2-expense-chart-grid"
              />
              <text
                x={pad.left - 6}
                y={yAt(t) + 3}
                textAnchor="end"
                className="v2-expense-chart-tick"
              >
                {formatAxisAmount(t)}
              </text>
            </g>
          ))}
          {chartDays.map((day, dayIndex) => {
            const groupCenter = pad.left + (dayIndex + 0.5) * groupWidth
            const x = groupCenter - barWidth / 2
            const showLabel =
              dayIndex === 0 ||
              dayIndex === chartDays.length - 1 ||
              dayIndex % labelEvery === 0
            const labelY = pad.top + innerH + 10
            const stackRects = (() => {
              let offsetFromBottom = 0
              const out: {
                key: string
                y: number
                height: number
                label: string
                amount: number
              }[] = []
              for (const seg of SEGMENTS) {
                const amount = segmentAmount(day, seg.key)
                if (amount <= 0) continue
                const segHeight = (amount / (yMax || 1)) * innerH
                const y = pad.top + innerH - offsetFromBottom - segHeight
                offsetFromBottom += segHeight
                out.push({
                  key: seg.key,
                  y,
                  height: segHeight,
                  label: seg.label,
                  amount,
                })
              }
              return out
            })()

            return (
              <g key={day.date}>
                {stackRects.map((seg) => (
                  <rect
                    key={seg.key}
                    x={x}
                    y={seg.y}
                    width={barWidth}
                    height={Math.max(0, seg.height)}
                    rx={Math.min(3, barWidth / 4)}
                    fill={
                      SEGMENTS.find((s) => s.key === seg.key)?.color ?? ''
                    }
                  >
                    <title>
                      {formatChartDateNO(day.date)} · {seg.label}:{' '}
                      {formatExpenseAmount(seg.amount)} kr
                    </title>
                  </rect>
                ))}
                {showLabel ? (
                  <text
                    x={groupCenter}
                    y={labelY}
                    textAnchor="end"
                    className="v2-expense-chart-date"
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
                    className="v2-expense-chart-grid"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="v2-expense-chart-legend" aria-label="Kategorier">
        {SEGMENTS.map((seg) => (
          <li
            key={seg.key}
            style={
              { '--v2-expense-legend-color': seg.color } as CSSProperties
            }
          >
            {seg.label}
          </li>
        ))}
      </ul>
      <p className="v2-expense-chart-hint meta">
        Kjøp inkluderer program, pakker og registreringer underveis.
      </p>
    </figure>
  )
}
