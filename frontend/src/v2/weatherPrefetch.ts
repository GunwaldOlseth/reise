import { useEffect, useState } from 'react'
import {
  api,
  ApiError,
  type PlaceSuggestion,
  type WeatherReport,
} from '../api'

export type WeatherPlaceRequest = {
  city: string
  country: string
  week?: boolean
  date?: string
  latitude?: number
  longitude?: number
  citySearch?: string
  countrySearch?: string
}

export type WeatherCacheEntry = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  weather?: WeatherReport
  error?: string
  suggestions: PlaceSuggestion[]
}

type QueueItem = WeatherPlaceRequest & { force?: boolean }

const emptyEntry = (): WeatherCacheEntry => ({
  status: 'idle',
  suggestions: [],
})

const cache = new Map<string, WeatherCacheEntry>()
const listeners = new Set<() => void>()
const queuedKeys = new Set<string>()
const queue: QueueItem[] = []
let pumping = false

export function placeWeatherKey(city: string, country: string): string {
  return `${city.trim().toLowerCase()}|${country.trim().toLowerCase()}`
}

export function getWeatherEntry(
  city: string,
  country: string,
): WeatherCacheEntry {
  return cache.get(placeWeatherKey(city, country)) || emptyEntry()
}

function notify() {
  listeners.forEach((fn) => fn())
}

function setEntry(key: string, entry: WeatherCacheEntry) {
  cache.set(key, entry)
  notify()
}

function pastHistoryDays(weather?: WeatherReport): number {
  if (!weather) return 0
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const days = new Set<string>()
  for (const o of weather.observations || []) {
    const day = (o.at || '').slice(0, 10)
    if (day && day < todayIso) days.add(day)
  }
  return days.size
}

async function pump() {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const item = queue.shift()
    if (!item) break
    const key = placeWeatherKey(item.city, item.country)
    queuedKeys.delete(key)
    const city = item.city.trim()
    if (!city) continue
    setEntry(key, { status: 'loading', suggestions: [] })
    try {
      const weatherOpts = {
        week: true,
        date: item.date?.trim() || undefined,
        refresh: !!item.force,
        latitude: item.latitude,
        longitude: item.longitude,
        citySearch: item.citySearch?.trim() || undefined,
        countrySearch: item.countrySearch?.trim() || undefined,
      }
      let weather = await api.getWeather(city, item.country.trim(), weatherOpts)
      if (pastHistoryDays(weather) < 7 && !item.force) {
        weather = await api.getWeather(city, item.country.trim(), {
          ...weatherOpts,
          refresh: true,
        })
      }
      setEntry(key, { status: 'ready', weather, suggestions: [] })
    } catch (err: unknown) {
      const suggestions =
        err instanceof ApiError ? err.suggestions : []
      const error =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Kunne ikke hente vær'
      setEntry(key, { status: 'error', error, suggestions })
    }
  }
  pumping = false
}

export function enqueueWeatherPlaces(
  places: WeatherPlaceRequest[],
  opts?: { force?: boolean; first?: boolean },
) {
  for (const place of places) {
    const city = place.city.trim()
    if (!city) continue
    const key = placeWeatherKey(city, place.country)
    const current = cache.get(key)
    if (
      !opts?.force &&
      current?.status === 'ready' &&
      pastHistoryDays(current.weather) >= 7
    ) {
      continue
    }
    if (!opts?.force && current?.status === 'loading') {
      continue
    }
    if (!opts?.force && queuedKeys.has(key)) continue
    queuedKeys.add(key)
    if (!current || current.status === 'idle' || opts?.force) {
      setEntry(key, { status: 'loading', suggestions: [] })
    }
    const item: QueueItem = { ...place, city, force: opts?.force }
    if (opts?.first) queue.unshift(item)
    else queue.push(item)
  }
  void pump()
}

export function refreshWeatherPlace(place: WeatherPlaceRequest) {
  const key = placeWeatherKey(place.city, place.country)
  queuedKeys.delete(key)
  for (let i = queue.length - 1; i >= 0; i--) {
    if (placeWeatherKey(queue[i].city, queue[i].country) === key) {
      queue.splice(i, 1)
    }
  }
  enqueueWeatherPlaces([place], { force: true, first: true })
}

export function useWeatherCacheVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const onChange = () => setVersion((n) => n + 1)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])
  return version
}

export function useWeatherPlace(
  city: string,
  country: string,
): WeatherCacheEntry {
  const [, bump] = useState(0)
  useEffect(() => {
    const onChange = () => bump((n) => n + 1)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])
  return getWeatherEntry(city, country)
}
