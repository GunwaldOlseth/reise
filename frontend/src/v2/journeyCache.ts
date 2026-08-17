import type { Journey } from './journeyModel'

const cache = new Map<string, Journey>()

export function cachedJourney(tripId: string): Journey | undefined {
  return cache.get(tripId)
}

export function cacheJourney(journey: Journey): void {
  cache.set(journey.tripId, journey)
}

export function clearCachedJourney(tripId: string): void {
  cache.delete(tripId)
}
