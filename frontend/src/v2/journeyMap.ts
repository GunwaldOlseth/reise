import { arriveTimeSortKey, AT_SEA_LABEL, type TripMapStop } from '../api'
import {
  addDaysIso,
  chosenTransportOption,
  clockMinutesFromMidnight,
  geoCoordsOf,
  isPackageStop,
  legTravelDurationMinutes,
  optionDurationMinutes,
  packageFreeDayLabel,
  packageOf,
  samePlaceName,
  type Journey,
  type JourneyPackageDay,
  type JourneyStop,
} from './journeyModel'

function stopMapName(stop: JourneyStop): string {
  if (isPackageStop(stop)) {
    return (packageOf(stop)?.basePlace || stop.city || '').trim()
  }
  if (stop.kind === 'home') {
    return (stop.address || stop.city || '').trim()
  }
  return (stop.city || '').trim()
}

function packagePortMinutes(
  from?: Pick<JourneyPackageDay, 'offset' | 'leaveTime'> | null,
  to?: Pick<JourneyPackageDay, 'offset' | 'arriveTime'> | null,
): number | null {
  if (!from || !to) return null
  const start = clockMinutesFromMidnight(from.leaveTime)
  const end = clockMinutesFromMidnight(to.arriveTime)
  if (start == null || end == null) return null
  const dayGap = Math.max(0, (to.offset || 0) - (from.offset || 0))
  const diff = end - start + dayGap * 24 * 60
  return diff > 0 ? diff : null
}

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
    let destHopMins: number | undefined
    if (prev) {
      const leg = journey.legs.find(
        (l) => l.fromStopId === prev.id && l.toStopId === stop.id,
      )
      const vias = [...(leg?.vias || [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      )
      const destName = stopMapName(stop)
      const fromName = stopMapName(prev)
      for (const via of vias) {
        const title = via.title?.trim()
        if (!title) continue
        if (via.hideOnMap) continue
        const opt = chosenTransportOption(via)
        const hopMins = opt ? optionDurationMinutes(opt) : null
        if (samePlaceName(title, destName) || samePlaceName(title, fromName)) {
          if (samePlaceName(title, destName)) {
            destHopMins = hopMins ?? destHopMins
          }
          continue
        }
        const timeRaw = opt?.startTime || via.startTime || via.endTime || ''
        const timeKey = arriveTimeSortKey(timeRaw)
        const coords = geoCoordsOf(via.latitude, via.longitude)
        out.push({
          kind: 'via',
          city: title,
          country: via.country || '',
          contextCity: stop.city || prev.city || '',
          date: stop.arriveDate || prev.arriveDate || '',
          key: `via|${leg?.id || prev.id}|${via.id}`,
          timeKey:
            timeKey === Number.POSITIVE_INFINITY ? undefined : timeKey,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          inboundMinutes: hopMins ?? undefined,
        })
      }
    }

    if (isPackageStop(stop)) {
      pushPackageMapStops(out, stop, destHopMins)
      continue
    }

    if (stop.hideOnMap) continue

    const city = stop.city?.trim()
    const address = stop.address?.trim()
    if (!city && !address) continue
    const label = stop.kind === 'home' && address ? address : city || address || ''
    const coords = geoCoordsOf(stop.latitude, stop.longitude)
    const inboundLeg = prev
      ? journey.legs.find(
          (l) => l.fromStopId === prev.id && l.toStopId === stop.id,
        )
      : undefined
    const viaCount = inboundLeg?.vias?.filter((v) => v.title?.trim()).length || 0
    const legMins =
      prev && viaCount === 0 ? legTravelDurationMinutes(inboundLeg) : null
    const last = out[out.length - 1]
    if (last && last.kind !== 'sea' && samePlaceName(last.city, label)) {
      continue
    }
    out.push({
      kind: 'port',
      city: label,
      country: stop.country || '',
      date: stop.arriveDate || '',
      key: `port|${stop.id}`,
      contextCity: stop.kind === 'home' && address ? city : undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      inboundMinutes: destHopMins ?? legMins ?? undefined,
    })
  }

  return out
}

function pushPackageMapStops(
  out: TripMapStop[],
  stop: JourneyStop,
  firstInboundMins?: number,
) {
  const pack = packageOf(stop)
  if (!pack) {
    const city = stop.city?.trim()
    if (city) {
      const coords = geoCoordsOf(stop.latitude, stop.longitude)
      out.push({
        kind: 'port',
        city,
        country: stop.country || '',
        date: stop.arriveDate || '',
        key: `port|${stop.id}`,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      })
    }
    return
  }
  const freeLabel = packageFreeDayLabel(stop.kind)
  const nights = Math.max(1, Math.floor(pack.nights || 1))
  const days = [...(pack.days || [])].sort((a, b) => a.offset - b.offset)
  const byOffset = new Map(days.map((d) => [d.offset, d]))
  const baseCoords = geoCoordsOf(pack.baseLatitude, pack.baseLongitude)
  let lastPort: Pick<JourneyPackageDay, 'offset' | 'leaveTime'> | null = null
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
    if (day?.hideOnMap) {
      lastPort = {
        offset,
        leaveTime: day?.leaveTime,
      }
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
    const dayCoords =
      geoCoordsOf(day?.latitude, day?.longitude) ||
      ((offset === 0 || offset === nights) &&
      city.toLowerCase() === (pack.basePlace || '').trim().toLowerCase()
        ? baseCoords || geoCoordsOf(stop.latitude, stop.longitude)
        : undefined)
    const hopMins =
      packagePortMinutes(lastPort, {
        offset,
        arriveTime: day?.arriveTime,
      }) ??
      (lastPort ? null : firstInboundMins ?? null)
    const last = out[out.length - 1]
    if (last && last.kind !== 'sea' && samePlaceName(last.city, city)) {
      lastPort = {
        offset,
        leaveTime: day?.leaveTime,
      }
      continue
    }
    out.push({
      kind: 'port',
      city,
      country: day?.country || pack.baseCountry || stop.country || '',
      date,
      key: `port|${stop.id}|${day?.id || offset}`,
      timeKey:
        arriveKey === Number.POSITIVE_INFINITY ? undefined : arriveKey,
      latitude: dayCoords?.latitude,
      longitude: dayCoords?.longitude,
      inboundMinutes: hopMins ?? undefined,
    })
    lastPort = {
      offset,
      leaveTime: day?.leaveTime,
    }
  }
}

export function journeyMapStopsForDate(
  journey: Journey,
  date: string,
): TripMapStop[] {
  const d = (date || '').trim()
  if (!d) return []
  return journeyMapStopsInOrder(journey).filter(
    (stop) => (stop.date || '').trim() === d,
  )
}

export function journeyMapRouteKey(journey: Journey): string {
  return journeyMapStopsInOrder(journey)
    .map(
      (s) =>
        `${s.key}:${s.date}:${s.city}:${s.inboundMinutes ?? ''}:${s.latitude ?? ''}:${s.longitude ?? ''}`,
    )
    .join('|')
}

export function journeyMapRouteKeyForDate(journey: Journey, date: string): string {
  return journeyMapStopsForDate(journey, date)
    .map(
      (s) =>
        `${s.key}:${s.city}:${s.latitude ?? ''}:${s.longitude ?? ''}`,
    )
    .join('|')
}
