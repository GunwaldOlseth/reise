import { type WeatherDay, type WeatherReport } from '../api'
import {
  getWeatherEntry,
  type WeatherCacheEntry,
} from './weatherPrefetch'
import type { JourneyWeatherSpot } from './JourneyWeather'
import { addDaysIso, todayIsoOslo } from './journeyModel'

/** Short axis label, e.g. 10.08 */
export function formatChartDateNO(iso: string): string {
  if (!iso || iso.length < 10) return iso || ''
  const stamp = iso.slice(0, 10)
  const [, month, day] = stamp.split('-')
  const monthNum = Number(month)
  const dayNum = Number(day)
  if (!Number.isFinite(monthNum) || !Number.isFinite(dayNum)) return iso
  return `${dayNum}.${String(monthNum).padStart(2, '0')}`
}

/** One decimal when needed — avoids 33° vs 33° at different heights. */
export function formatTempC(value: number): string {
  if (!Number.isFinite(value)) return '—°'
  const n = Math.round(value * 10) / 10
  const whole = Math.round(n)
  if (Math.abs(n - whole) < 0.05) return `${whole}°`
  return `${n.toFixed(1)}°`
}

/** Weather for a specific trip date — never another day's `requested` snapshot. */
export function pickTripWeatherDay(
  weather: WeatherReport,
  date: string,
): WeatherDay | null {
  const stamp = date.trim().slice(0, 10)
  if (!stamp) return null
  const exact = weather.days.find((d) => d.date === stamp)
  if (exact) return exact
  if (weather.requested?.date === stamp) return weather.requested
  if (stamp === todayIsoOslo() && weather.today?.date === stamp) {
    return weather.today
  }
  return null
}

export type JourneyWeatherRow = {
  spot: JourneyWeatherSpot
  entry: WeatherCacheEntry
  day: WeatherDay | null
  /** Arrival-day `tempMax` when the API has that date (may be outside the 7-day window). */
  tempMax: number | null
  /** Current temperature now, or today's daily max if `current` is missing. */
  tempNow: number | null
  /** Arrival-day max, only when the stop date is not more than 7 days ahead of Oslo today. */
  tempArrive: number | null
  arriveInForecastWindow: boolean
}

const FORECAST_HORIZON_DAYS = 7

/** Arrival-day points: past/today always allowed; future only through today+7 (Oslo). */
export function arriveInForecastWindow(iso: string): boolean {
  const stamp = iso.trim().slice(0, 10)
  if (!stamp) return false
  const today = todayIsoOslo()
  return stamp <= addDaysIso(today, FORECAST_HORIZON_DAYS)
}

export function pickTempNow(weather: WeatherReport | null | undefined): number | null {
  if (!weather) return null
  const current = weather.current?.temperature
  if (typeof current === 'number' && Number.isFinite(current)) return current
  const today = weather.today
  if (today && Number.isFinite(today.tempMax)) return today.tempMax
  const marked = weather.days.find((d) => d.isToday)
  if (marked && Number.isFinite(marked.tempMax)) return marked.tempMax
  const stamp = todayIsoOslo()
  const byDate = weather.days.find((d) => d.date === stamp)
  if (byDate && Number.isFinite(byDate.tempMax)) return byDate.tempMax
  return null
}

function sameCityStay(a: JourneyWeatherSpot, b: JourneyWeatherSpot): boolean {
  return (
    a.city.trim().toLowerCase() === b.city.trim().toLowerCase() &&
    (a.country || '').trim().toLowerCase() ===
      (b.country || '').trim().toLowerCase()
  )
}

/** One chart tick per consecutive city stay (first arrival date). */
export function collapseConsecutiveCityRows(
  rows: JourneyWeatherRow[],
): JourneyWeatherRow[] {
  const out: JourneyWeatherRow[] = []
  for (const row of rows) {
    const prev = out[out.length - 1]
    if (prev && sameCityStay(prev.spot, row.spot)) continue
    out.push(row)
  }
  return out
}

/** Y-axis ticks for small/medium temp charts (adaptive step). */
export function tempChartScale(temps: number[]): {
  ticks: number[]
  lo: number
  hi: number
} {
  if (!temps.length) return { ticks: [15, 20, 25, 30], lo: 15, hi: 30 }
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const span = max - min
  let step = 5
  if (span <= 2) step = 1
  else if (span <= 6) step = 2
  else if (span <= 14) step = 5
  else step = 10

  const lo = Math.floor((min - step * 0.5) / step) * step
  const hi = Math.ceil((max + step * 0.5) / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi; t += step) ticks.push(t)
  if (ticks.length < 3) {
    const mid = (min + max) / 2
    const pad = step * 2
    return tempChartScale([mid - pad, mid + pad])
  }
  return { ticks, lo: ticks[0], hi: ticks[ticks.length - 1] }
}

/** One row per list/chart stop — same trip date + cache lookup everywhere. */
export function buildJourneyWeatherRows(
  spots: JourneyWeatherSpot[],
): JourneyWeatherRow[] {
  return spots.map((spot) => {
    const entry = getWeatherEntry(spot.city, spot.country)
    const weather = entry.weather
    const day = weather ? pickTripWeatherDay(weather, spot.date) : null
    const inWindow = arriveInForecastWindow(spot.date)
    const tempMax = day && Number.isFinite(day.tempMax) ? day.tempMax : null
    return {
      spot,
      entry,
      day,
      tempMax,
      tempNow: pickTempNow(weather),
      tempArrive: inWindow ? tempMax : null,
      arriveInForecastWindow: inWindow,
    }
  })
}

/** Overview chart: collapsed city ticks, same weather lookup as list cards. */
export function buildJourneyWeatherChartRows(
  spots: JourneyWeatherSpot[],
): JourneyWeatherRow[] {
  return collapseConsecutiveCityRows(buildJourneyWeatherRows(spots))
}
