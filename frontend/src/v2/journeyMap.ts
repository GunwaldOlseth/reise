import { arriveTimeSortKey, AT_SEA_LABEL, type TripMapStop } from '../api'
import {
  addDaysIso,
  isPackageStop,
  packageFreeDayLabel,
  packageOf,
  type Journey,
  type JourneyStop,
} from './journeyModel'

/**
 * Map stops from the v2 journey thread: via hops on legs, then each place /
 * package day (port or at sea).
 */
export function journeyMapStopsInOrder(journey: Journey): TripMapStop[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: TripMapStop[] = []

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    const prev = i > 0 ? stops[i - 1] : null
    if (prev) {
      const leg = journey.legs.find(
        (l) => l.fromStopId === prev.id && l.toStopId === stop.id,
      )
      const vias = [...(leg?.vias || [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      )
      for (const via of vias) {
        const title = via.title?.trim()
        if (!title) continue
        const opt = (via.options || [])[0]
        const timeRaw = opt?.startTime || via.startTime || via.endTime || ''
        const timeKey = arriveTimeSortKey(timeRaw)
        out.push({
          kind: 'via',
          city: title,
          country: via.country || '',
          contextCity: stop.city || prev.city || '',
          date: stop.arriveDate || prev.arriveDate || '',
          key: `via|${leg?.id || prev.id}|${via.id}`,
          timeKey:
            timeKey === Number.POSITIVE_INFINITY ? undefined : timeKey,
        })
      }
    }

    if (isPackageStop(stop)) {
      pushPackageMapStops(out, stop)
      continue
    }

    const city = stop.city?.trim()
    if (!city) continue
    // Skip pure home start if identical to nothing useful — still show as port.
    out.push({
      kind: 'port',
      city,
      country: stop.country || '',
      date: stop.arriveDate || '',
      key: `port|${stop.id}`,
    })
  }

  return out
}

function pushPackageMapStops(out: TripMapStop[], stop: JourneyStop) {
  const pack = packageOf(stop)
  if (!pack) {
    const city = stop.city?.trim()
    if (city) {
      out.push({
        kind: 'port',
        city,
        country: stop.country || '',
        date: stop.arriveDate || '',
        key: `port|${stop.id}`,
      })
    }
    return
  }
  const freeLabel = packageFreeDayLabel(stop.kind)
  const nights = Math.max(1, Math.floor(pack.nights || 1))
  const days = [...(pack.days || [])].sort((a, b) => a.offset - b.offset)
  const byOffset = new Map(days.map((d) => [d.offset, d]))
  for (let offset = 0; offset <= nights; offset++) {
    const day = byOffset.get(offset)
    const date = stop.arriveDate
      ? addDaysIso(stop.arriveDate, offset)
      : ''
    if (day?.atSea) {
      out.push({
        kind: 'sea',
        city: AT_SEA_LABEL,
        country: '',
        date,
        key: `sea|${stop.id}|${day.id || offset}`,
      })
      continue
    }
    const city =
      day?.city?.trim() ||
      (offset === 0 || offset === nights
        ? pack.basePlace?.trim() || stop.city?.trim()
        : '') ||
      ''
    if (!city || city === freeLabel) {
      if (offset > 0 && offset < nights) {
        out.push({
          kind: 'sea',
          city: AT_SEA_LABEL,
          country: '',
          date,
          key: `sea|${stop.id}|${day?.id || offset}`,
        })
      }
      continue
    }
    const arriveKey = arriveTimeSortKey(day?.arriveTime)
    out.push({
      kind: 'port',
      city,
      country: day?.country || pack.baseCountry || stop.country || '',
      date,
      key: `port|${stop.id}|${day?.id || offset}`,
      timeKey:
        arriveKey === Number.POSITIVE_INFINITY ? undefined : arriveKey,
    })
  }
}

export function journeyMapRouteKey(journey: Journey): string {
  return journeyMapStopsInOrder(journey)
    .map((s) => `${s.key}:${s.date}:${s.city}`)
    .join('|')
}
