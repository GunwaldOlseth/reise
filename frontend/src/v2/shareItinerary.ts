import { formatTravelers, type Trip } from '../api'
import {
  addDaysIso,
  chosenTransportOption,
  formatChangeTimeLabel,
  formatCityStation,
  formatDateNO,
  formatPackageDayListLine,
  isPackageStop,
  legForGap,
  legModeLabel,
  modeHasPlatform,
  modeIsFlight,
  modeIsOther,
  modeIsWalk,
  packageFreeDayLabel,
  packageNightsOf,
  packageOf,
  packageTypeLabel,
  effectiveHotelName,
  stayNights,
  stopDepartDate,
  sortTransportOptions,
  transportSegments,
  viaTransportOptions,
  type Journey,
  type JourneyStop,
  type JourneyVia,
} from './journeyModel'

export interface ShareHop {
  label: string
}

export interface SharePlace {
  title: string
  /** Cruise / package day rows under the stop title. */
  subs?: ShareHop[]
  hops: ShareHop[]
}

export interface ShareItinerary {
  name: string
  startDate: string
  endDate: string
  places: SharePlace[]
}

export const DEMO_SHARE_ITINERARY: ShareItinerary = {
  name: 'Italia',
  startDate: '2026-06-12',
  endDate: '2026-06-20',
  places: [
    { title: 'Oslo', hops: [{ label: 'Fly 06:30 · Bergamo' }] },
    { title: 'Bergamo', hops: [{ label: 'Buss 10:40 · Milano' }] },
    { title: 'Milano', hops: [{ label: 'Tog 14:20 · Genova' }] },
    { title: 'Genova', hops: [] },
  ],
}

export function readShareToken(
  loc: Pick<Location, 'pathname' | 'hash'> = window.location,
): string | null {
  const path = (loc.pathname || '/').replace(/\/+$/, '') || '/'
  const pathMatch = path.match(/^\/d\/([A-Za-z0-9_-]+)$/)
  if (pathMatch) return pathMatch[1]
  const hashMatch = (loc.hash || '').match(/^#\/d\/([A-Za-z0-9_-]+)$/)
  return hashMatch?.[1] || null
}

export function sharePageUrl(token: string): string {
  return `${window.location.origin}/d/${encodeURIComponent(token)}`
}

function isLocalPage(): boolean {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** Windows desktop share sheet often says the page cannot be shared. */
function shouldUseNativeShare(): boolean {
  if (typeof navigator.share !== 'function') return false
  if (isLocalPage()) return false
  if (window.location.protocol !== 'https:') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

export async function shareOrCopy(
  url: string,
  title: string,
): Promise<'shared' | 'copied' | 'copied-local'> {
  if (shouldUseNativeShare()) {
    try {
      await navigator.share({ title, text: title, url })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
    }
  }
  await navigator.clipboard.writeText(url)
  return isLocalPage() ? 'copied-local' : 'copied'
}

export function formatShareDateRange(start: string, end: string): string {
  if (!start && !end) return ''
  if (start && end && start !== end) {
    return `${formatDateNO(start)} – ${formatDateNO(end)}`
  }
  return formatDateNO(start || end)
}

export function shareStopTitle(stop: JourneyStop): string {
  if (isPackageStop(stop)) {
    const pack = packageOf(stop)
    return (
      (pack?.title || stop.city || packageTypeLabel(stop.kind)).trim() || 'Pakke'
    )
  }
  if (stop.kind === 'home') {
    return (stop.city || stop.address || 'Hjem').trim()
  }
  return formatCityStation(stop.city, stop.station) || (stop.address || '').trim() || 'Sted'
}

/** First row on the hop after current sort — not the kvitterte. */
export function firstTransportOption(via: JourneyVia) {
  return sortTransportOptions(viaTransportOptions(via))[0]
}

function pickTransportOption(via: JourneyVia, pick: 'first' | 'chosen') {
  return pick === 'first' ? firstTransportOption(via) : chosenTransportOption(via)
}

function formatClockSpan(start?: string, end?: string, detailed = false): string {
  const from = (start || '').trim()
  const to = (end || '').trim()
  if (detailed && from && to && from !== to) return `${from}–${to}`
  return from
}

function formatTransportBit(
  opt: NonNullable<ReturnType<typeof firstTransportOption>>,
  detailed: boolean,
): string {
  if (modeIsWalk(opt.mode)) {
    const m = (opt.minutes || '').trim()
    return m ? `Til fots ${m} min` : 'Til fots'
  }
  const time = formatClockSpan(opt.startTime, opt.endTime, detailed)
  if (modeIsFlight(opt.mode)) {
    const gate =
      detailed && (opt.gate || '').trim() ? `gate ${opt.gate!.trim()}` : ''
    return [legModeLabel(opt.mode), (opt.title || '').trim(), time, gate]
      .filter(Boolean)
      .join(' ')
  }
  if (modeIsOther(opt.mode)) {
    const type = (opt.title || '').trim() || legModeLabel(opt.mode)
    const info = detailed ? (opt.info || '').trim() : ''
    return [type, info, time].filter(Boolean).join(' ')
  }
  const platform =
    detailed && modeHasPlatform(opt.mode) && (opt.platform || '').trim()
      ? `p.${(opt.platform || '').trim()}`
      : ''
  return [opt.mode ? legModeLabel(opt.mode) : '', time, platform]
    .filter(Boolean)
    .join(' ')
}

function formatShareTimeBit(
  opt: NonNullable<ReturnType<typeof firstTransportOption>>,
): string {
  if (modeIsWalk(opt.mode)) {
    const m = (opt.minutes || '').trim()
    return m ? `${m} min` : ''
  }
  const from = (opt.startTime || '').trim()
  const to = (opt.endTime || '').trim()
  if (from && to && from !== to) return `${from}–${to}`
  if (from) return from
  if (to) return to
  const m = (opt.minutes || '').trim()
  return m ? `${m} min` : ''
}

export function formatShareHop(
  via: JourneyVia,
  pick: 'first' | 'chosen' = 'chosen',
  detailed = false,
  timeOnly = false,
): string {
  const opt = pickTransportOption(via, pick)
  const place = formatCityStation(via.title, via.station)
  const bits: string[] = []
  if (opt) {
    const bit = timeOnly
      ? formatShareTimeBit(opt)
      : formatTransportBit(opt, detailed)
    if (bit) bits.push(bit)
  }
  if (place) bits.push(place)
  const change = formatChangeTimeLabel(via, opt)
  if (change) bits.push(change)
  return bits.filter(Boolean).join(' · ')
}

function shareSubsForStop(stop: JourneyStop): ShareHop[] {
  if (!isPackageStop(stop)) return []
  const pack = packageOf(stop)
  if (!pack?.days?.length) return []
  const type = stop.kind
  const nights = packageNightsOf(pack) || 1
  const freeLabel = packageFreeDayLabel(type)
  const days = [...pack.days].sort((a, b) => a.offset - b.offset)
  const subs: ShareHop[] = []
  for (const day of days) {
    const row = formatPackageDayListLine(day, {
      type,
      nights,
      basePlace: pack.basePlace,
      freeLabel,
      placeFallback: type === 'cruise' ? 'Havn' : 'Sted',
    })
    if (!row) continue
    const arrive = (stop.arriveDate || '').trim()
    const label = arrive
      ? `${formatDateNO(addDaysIso(arrive, day.offset))} · ${row}`
      : row
    subs.push({ label })
  }
  return subs
}

export function buildShareItinerary(
  trip: Pick<Trip, 'name' | 'startDate' | 'endDate'>,
  journey: Journey,
  pick: 'first' | 'chosen' = 'chosen',
): ShareItinerary {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.arriveDate.localeCompare(b.arriveDate),
  )
  const places: SharePlace[] = stops.map((stop, i) => {
    const next = stops[i + 1]
    const hops: ShareHop[] = []
    if (next) {
      const leg = legForGap(journey, stop.id, next.id)
      for (const via of transportSegments(leg, { sort: pick === 'first' ? false : undefined })) {
        const label = formatShareHop(via, pick, false, true)
        if (label) hops.push({ label })
      }
    }
    return {
      title: shareStopTitle(stop),
      subs: shareSubsForStop(stop),
      hops,
    }
  })
  return {
    name: (trip.name || '').trim(),
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    places,
  }
}

export type PdfLine = {
  text: string
  style: 'h1' | 'h2' | 'meta' | 'place' | 'hop' | 'sub'
}

function placeMeta(stop: JourneyStop): string {
  const bits: string[] = []
  if (stop.kind === 'home') bits.push('Hjem')
  const arrive = (stop.arriveDate || '').trim()
  const depart = stopDepartDate(stop)
  const nights = stayNights(stop)
  if (arrive && depart && nights > 0 && arrive !== depart) {
    bits.push(`${formatDateNO(arrive)}–${formatDateNO(depart)} (${nights}n)`)
  } else if (arrive) {
    bits.push(formatDateNO(arrive))
  }
  const hotel = effectiveHotelName(stop.stay)
  if (hotel) bits.push(hotel)
  const address = (stop.stay?.address || stop.address || '').trim()
  if (address && address !== hotel) bits.push(address)
  return bits.join(' · ')
}

export function buildItineraryPdfLines(
  trip: Pick<Trip, 'name' | 'startDate' | 'endDate' | 'travelers'>,
  journey: Journey,
): PdfLine[] {
  const short = buildShareItinerary(trip, journey, 'first')
  const dates = formatShareDateRange(trip.startDate || '', trip.endDate || '')
  const who = formatTravelers(trip.travelers)
  const lines: PdfLine[] = [
    { style: 'h1', text: (trip.name || '').trim() || 'Reise' },
  ]
  if (dates) lines.push({ style: 'meta', text: dates })
  if (who) lines.push({ style: 'meta', text: who })

  lines.push({ style: 'h2', text: 'Kort oversikt' })
  if (short.places.length === 0) {
    lines.push({ style: 'meta', text: 'Ingen stopp ennå.' })
  } else {
    for (const place of short.places) {
      lines.push({ style: 'place', text: place.title })
      for (const hop of place.hops) {
        lines.push({ style: 'hop', text: hop.label })
      }
    }
  }

  lines.push({ style: 'h2', text: 'Fullversjon' })
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.arriveDate.localeCompare(b.arriveDate),
  )
  if (stops.length === 0) {
    lines.push({ style: 'meta', text: 'Ingen steg ennå.' })
    return lines
  }

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    const title = shareStopTitle(stop)
    const meta = placeMeta(stop)
    lines.push({
      style: 'place',
      text: meta && meta !== title ? `${title} · ${meta}` : title,
    })

    if (isPackageStop(stop)) {
      const pack = packageOf(stop)
      const type = stop.kind
      const nights = packageNightsOf(pack)
      const freeLabel = packageFreeDayLabel(type)
      const days = [...(pack?.days || [])].sort((a, b) => a.offset - b.offset)
      for (const day of days) {
        const date = stop.arriveDate
          ? formatDateNO(addDaysIso(stop.arriveDate, day.offset))
          : `Dag ${day.offset + 1}`
        const row = formatPackageDayListLine(day, {
          type,
          nights: nights || 1,
          basePlace: pack?.basePlace,
          freeLabel,
          placeFallback: type === 'cruise' ? 'Havn' : 'Sted',
        })
        lines.push({ style: 'sub', text: `${date} · ${row}` })
      }
    }

    const next = stops[i + 1]
    if (!next) continue
    const leg = legForGap(journey, stop.id, next.id)
    for (const via of transportSegments(leg, { sort: false })) {
      const label = formatShareHop(via, 'first', true)
      if (label) lines.push({ style: 'hop', text: label })
    }
  }

  return lines
}
