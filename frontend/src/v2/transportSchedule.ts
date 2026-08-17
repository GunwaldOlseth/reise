import { osloWallTimeMs } from './HolidayCountdown'
import {
  journeyScheduledDepartures,
  type Journey,
  type JourneyScheduledDeparture,
} from './journeyModel'

export type NextScheduledDeparture = JourneyScheduledDeparture & {
  atMs: number
}

/** First upcoming departure with a registered clock time. */
export function nextScheduledDeparture(
  journey: Journey,
  nowMs = Date.now(),
): NextScheduledDeparture | null {
  for (const row of journeyScheduledDepartures(journey)) {
    const atMs = osloWallTimeMs(row.date, row.time)
    if (!Number.isFinite(atMs) || atMs <= nowMs) continue
    return { ...row, atMs }
  }
  return null
}
