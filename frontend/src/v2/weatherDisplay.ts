import { type WeatherDay, type WeatherReport } from '../api'
import {
  getWeatherEntry,
  type WeatherCacheEntry,
} from './weatherPrefetch'
import type { JourneyWeatherSpot } from './JourneyWeather'
import { todayIsoOslo } from './journeyModel'

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
  tempMax: number | null
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
    const day = entry.weather
      ? pickTripWeatherDay(entry.weather, spot.date)
      : null
    return {
      spot,
      entry,
      day,
      tempMax: day?.tempMax ?? null,
    }
  })
}
