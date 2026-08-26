import { localizeCity } from '../placeNames'
import {
  loadTimeAlertSettings,
  type TimeAlertSettings,
} from '../userSettings'
import { osloWallTimeMs } from './HolidayCountdown'
import {
  addDaysIso,
  chosenTransportOption,
  isPackageStop,
  packageNightsOf,
  packageOf,
  stopDepartDate,
  stopGoalLabel,
  todayIsoOslo,
  transportSegments,
  type Journey,
  type JourneyStop,
  type JourneyVia,
} from './journeyModel'

export type TimeAlertKind = 'depart' | 'arrive' | 'cruise'

export interface TimeAlertEvent {
  id: string
  kind: TimeAlertKind
  atMs: number
  title: string
  body: string
}

const FIRED_KEY = 'reise.firedTimeAlerts'

function placeName(name?: string | null): string {
  return localizeCity(name) || (name || '').trim()
}

function hopFromLabel(prev: JourneyStop | JourneyVia): string {
  if ('kind' in prev) {
    if (prev.kind === 'home') return placeName(prev.city || prev.address || 'Hjem')
    return placeName(prev.city)
  }
  return placeName(prev.title)
}

function loadFired(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveFired(ids: Set<string>) {
  sessionStorage.setItem(FIRED_KEY, JSON.stringify([...ids]))
}

export function markAlertFired(id: string) {
  const next = loadFired()
  next.add(id)
  saveFired(next)
}

export function alertWasFired(id: string): boolean {
  return loadFired().has(id)
}

function collectTravelEvents(journey: Journey, date: string): TimeAlertEvent[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: TimeAlertEvent[] = []
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    const arrive = (to.arriveDate || '').trim()
    const depart = (stopDepartDate(from) || from.arriveDate || '').trim()
    const onDepartDay = depart === date
    const onArriveDay = arrive === date
    if (!onDepartDay && !onArriveDay) continue
    const leg = (journey.legs || []).find(
      (l) => l.fromStopId === from.id && l.toStopId === to.id,
    )
    const segs = transportSegments(leg, { sort: false })
    for (let s = 0; s < segs.length; s++) {
      const via = segs[s]
      const prev = s === 0 ? from : segs[s - 1]
      const opt = chosenTransportOption(via)
      if (!opt) continue
      const fromLabel = hopFromLabel(prev)
      const toLabel = placeName(
        s === segs.length - 1
          ? stopGoalLabel(to, via.title || to.city)
          : via.title || to.city,
      )
      const start = (opt.startTime || '').trim()
      const end = (opt.endTime || '').trim()
      if (onDepartDay && start) {
        const atMs = osloWallTimeMs(date, start)
        if (Number.isFinite(atMs)) {
          out.push({
            id: `depart:${via.id}:${opt.id}:${date}:${start}`,
            kind: 'depart',
            atMs,
            title: `Avgang om kort tid`,
            body: `${fromLabel} → ${toLabel} · ${start}`,
          })
        }
      }
      if (onArriveDay && end) {
        const atMs = osloWallTimeMs(date, end)
        if (Number.isFinite(atMs)) {
          out.push({
            id: `arrive:${via.id}:${opt.id}:${date}:${end}`,
            kind: 'arrive',
            atMs,
            title: `Ankomst om kort tid`,
            body: `${toLabel} · ${end}`,
          })
        }
      }
    }
  }
  return out
}

function collectCruiseEvents(journey: Journey, date: string): TimeAlertEvent[] {
  const out: TimeAlertEvent[] = []
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  for (const stop of stops) {
    if (stop.kind !== 'cruise' || !isPackageStop(stop)) continue
    const pack = packageOf(stop)
    const nights = packageNightsOf(pack)
    const ship = (pack?.title || stop.city || 'Cruise').trim()
    const days = [...(pack?.days || [])].sort((a, b) => a.offset - b.offset)
    for (const day of days) {
      if (day.atSea) continue
      if (day.offset === nights) continue
      const dayDate = stop.arriveDate
        ? addDaysIso(stop.arriveDate, day.offset)
        : ''
      if (dayDate !== date) continue
      const aboard = (day.allAboardTime || '').trim()
      const leave = (day.leaveTime || '').trim()
      const alertTime = aboard || leave
      if (!alertTime) continue
      const atMs = osloWallTimeMs(date, alertTime)
      if (!Number.isFinite(atMs)) continue
      const port = placeName(day.city || pack?.basePlace || stop.city)
      out.push({
        id: `cruise:${stop.id}:${day.id || day.offset}:${date}:${alertTime}`,
        kind: 'cruise',
        atMs,
        title: aboard ? `All aboard om kort tid` : `Cruiseavgang om kort tid`,
        body: `${ship} · ${port} · ${alertTime}`,
      })
    }
  }
  return out
}

export function collectTimeAlertEvents(
  journeys: Journey[],
  settings: TimeAlertSettings = loadTimeAlertSettings(),
): TimeAlertEvent[] {
  const today = todayIsoOslo()
  const dates = [today, addDaysIso(today, 1)]
  const out: TimeAlertEvent[] = []
  const seen = new Set<string>()
  for (const journey of journeys) {
    for (const date of dates) {
      if (settings.travelMinutes > 0) {
        for (const event of collectTravelEvents(journey, date)) {
          if (seen.has(event.id)) continue
          seen.add(event.id)
          out.push(event)
        }
      }
      if (settings.cruiseMinutes > 0) {
        for (const event of collectCruiseEvents(journey, date)) {
          if (seen.has(event.id)) continue
          seen.add(event.id)
          out.push(event)
        }
      }
    }
  }
  return out.sort((a, b) => a.atMs - b.atMs)
}

export function leadMinutesFor(
  kind: TimeAlertKind,
  settings: TimeAlertSettings,
): number {
  return kind === 'cruise' ? settings.cruiseMinutes : settings.travelMinutes
}

export function alertsDueNow(
  events: TimeAlertEvent[],
  now = Date.now(),
  settings: TimeAlertSettings = loadTimeAlertSettings(),
): TimeAlertEvent[] {
  const due: TimeAlertEvent[] = []
  for (const event of events) {
    const lead = leadMinutesFor(event.kind, settings)
    if (lead <= 0) continue
    const start = event.atMs - lead * 60_000
    if (now < start || now >= event.atMs) continue
    if (alertWasFired(event.id)) continue
    due.push(event)
  }
  return due
}

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function fireTimeAlert(event: TimeAlertEvent) {
  markAlertFired(event.id)
  if (notificationPermission() !== 'granted') return
  try {
    const note = new Notification(event.title, {
      body: event.body,
      tag: event.id,
      silent: false,
    })
    window.setTimeout(() => note.close(), 20_000)
  } catch {
    /* ignore */
  }
}
