import { useEffect, useState } from 'react'
import { type WeatherDay, type WeatherReport } from '../api'
import { localizeCity, localizeCountry } from '../placeNames'
import {
  enqueueWeatherPlaces,
  refreshWeatherPlace,
  useWeatherPlace,
} from './weatherPrefetch'
import { WeatherTempChart } from './WeatherTempChart'
import { WeatherDaySpark } from './WeatherCityDetail'
import {
  addDaysIso,
  formatDateNO,
  isPackageStop,
  packageOf,
  stayNights,
  type Journey,
} from './journeyModel'

export type JourneyWeatherSpot = {
  key: string
  city: string
  country: string
  date: string
  /** Short context — e.g. cruise day role. */
  note?: string
}

/** Places + dates along the journey that should show weather. */
export function journeyWeatherSpots(journey: Journey): JourneyWeatherSpot[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: JourneyWeatherSpot[] = []
  const seen = new Set<string>()

  function push(spot: JourneyWeatherSpot) {
    const city = spot.city.trim()
    if (!city || !spot.date) return
    const dedupe = `${spot.date}|${city.toLowerCase()}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    out.push({ ...spot, city })
  }

  for (const stop of stops) {
    if (isPackageStop(stop)) {
      const pack = packageOf(stop)
      const nights = Math.max(1, Math.floor(pack?.nights || 1))
      const days = [...(pack?.days || [])].sort((a, b) => a.offset - b.offset)
      const byOffset = new Map(days.map((d) => [d.offset, d]))
      for (let offset = 0; offset <= nights; offset++) {
        const day = byOffset.get(offset)
        if (day?.atSea) continue
        const city =
          day?.city?.trim() ||
          (offset === 0 || offset === nights
            ? pack?.basePlace?.trim() || stop.city.trim()
            : '')
        if (!city) continue
        const date = stop.arriveDate
          ? addDaysIso(stop.arriveDate, offset)
          : ''
        push({
          key: `${stop.id}:${offset}`,
          city,
          country: day?.country || pack?.baseCountry || stop.country || '',
          date,
          note: offset === 0 ? 'ombord' : offset === nights ? 'iland' : undefined,
        })
      }
      continue
    }

    const city = stop.city?.trim()
    if (!city || !stop.arriveDate) continue
    const nights = stayNights(stop)
    const count = Math.max(1, nights)
    for (let i = 0; i < count; i++) {
      push({
        key: `${stop.id}:${i}`,
        city,
        country: stop.country || '',
        date: addDaysIso(stop.arriveDate, i),
        note:
          stop.kind === 'home' && i === 0
            ? 'hjem'
            : nights > 0 && i === 0
              ? 'ankomst'
              : undefined,
      })
    }
  }

  return out
}

function uniqueWeatherPlaces(journey: Journey) {
  const byKey = new Map<
    string,
    { city: string; country: string; week: boolean; date: string }
  >()
  for (const spot of journeyWeatherSpots(journey)) {
    const key = `${spot.city.trim().toLowerCase()}|${spot.country.trim().toLowerCase()}`
    const week = isWithinNext7Days(spot.date)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, {
        city: spot.city,
        country: spot.country,
        week,
        date: spot.date,
      })
      continue
    }
    byKey.set(key, {
      ...prev,
      week: prev.week || week,
      date: prev.date < spot.date ? prev.date : spot.date,
    })
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.week !== b.week) return a.week ? -1 : 1
    return a.date.localeCompare(b.date)
  })
}

/** Start sequential weather fetch for unique cities on a journey. */
export function enqueueJourneyWeather(journey: Journey) {
  enqueueWeatherPlaces(uniqueWeatherPlaces(journey))
}

function isWithinNext7Days(iso: string): boolean {
  if (!iso.trim()) return false
  const target = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(target.getTime())) return false
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return target >= start && target < end
}

function isTodayISO(iso: string): boolean {
  if (!iso.trim()) return false
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function WeatherIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (icon) {
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
        </svg>
      )
    case 'cloud-sun':
      return (
        <svg {...props}>
          <circle cx="8.2" cy="8.2" r="2.4" />
          <path d="M8.2 3.2v1.3M3.2 8.2h1.3M4.4 4.4l.9.9" />
          <path d="M8.5 15.5h8.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.3 1.5 2.7 2.7 0 0 0-.1 4.9Z" />
        </svg>
      )
    case 'cloud':
    case 'fog':
      return (
        <svg {...props}>
          <path d="M7.5 17h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6A2.9 2.9 0 0 0 7.5 17Z" />
          {icon === 'fog' && <path d="M6.5 19.5h11M8 21.2h8" />}
        </svg>
      )
    case 'drizzle':
    case 'rain':
      return (
        <svg {...props}>
          <path d="M7.5 14.2h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6 2.9 2.9 0 0 0-.4 5.2Z" />
          <path d="M9.2 17.2v2.4M12 16.6v3.2M14.8 17.2v2.4" />
        </svg>
      )
    case 'snow':
      return (
        <svg {...props}>
          <path d="M7.5 14h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6A2.9 2.9 0 0 0 7.5 14Z" />
          <path d="M9.2 16.5l.8.8M12 16l1 1M14.8 16.5l.8.8M10 18.5l.6.6M13.5 18.2l.6.6" />
        </svg>
      )
    case 'thunder':
      return (
        <svg {...props}>
          <path d="M7.5 13.5h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6 2.9 2.9 0 0 0-.4 5.2Z" />
          <path d="M11.2 13.2 9.8 18h2.2l-.8 3.2 3.6-5.2h-2.2Z" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2" />
        </svg>
      )
  }
}

function pickDisplayDay(
  weather: WeatherReport,
  date: string,
): WeatherDay | null {
  return (
    weather.requested ||
    weather.days.find((d) => d.date === date) ||
    (isTodayISO(date) ? weather.today : null) ||
    weather.today ||
    weather.days[0] ||
    null
  )
}

function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.4-6.1" />
      <path d="M21 4v6h-6" />
    </svg>
  )
}

function SpotWeatherCard({
  spot,
}: {
  spot: JourneyWeatherSpot
}) {
  const [city, setCity] = useState(spot.city)
  const [country, setCountry] = useState(spot.country)
  const inRange = isWithinNext7Days(spot.date)
  const entry = useWeatherPlace(city, country)
  const weather = entry.weather || null
  const status = entry.status
  const error = entry.error || ''
  const suggestions = entry.suggestions

  useEffect(() => {
    setCity(spot.city)
    setCountry(spot.country)
  }, [spot.city, spot.country, spot.key])

  function load(nextCity = city, nextCountry = country) {
    const place = nextCity.trim()
    if (!place) return
    refreshWeatherPlace({
      city: place,
      country: nextCountry,
      week: inRange,
      date: spot.date.trim() || undefined,
    })
  }

  const display = weather ? pickDisplayDay(weather, spot.date) : null
  const showingNow = !!(
    weather?.current &&
    display &&
    isTodayISO(spot.date)
  )
  const missing = !weather && status !== 'loading'

  return (
    <article className="v2-weather-card">
      <header className="v2-weather-card-head">
        <div className="v2-weather-card-title">
          <strong>{formatDateNO(spot.date)}</strong>
          <span className="v2-meta">
            {' '}
            · {localizeCity(city) || city}
            {spot.note ? ` · ${spot.note}` : ''}
          </span>
          <button
            type="button"
            className={`v2-weather-refresh${missing ? ' is-needed' : ''}`}
            disabled={status === 'loading' || !city.trim()}
            title={weather ? 'Oppdater vær' : 'Hent vær'}
            aria-label={
              weather
                ? `Oppdater vær for ${localizeCity(city) || city}`
                : `Hent vær for ${localizeCity(city) || city}`
            }
            onClick={() => load()}
          >
            <RefreshIcon />
            {status === 'loading' ? 'Henter' : 'Oppdater'}
          </button>
        </div>
        {!inRange && (
          <span className="v2-weather-range" title="Utenfor 7-dagersprognose">
            Utenfor prognose
          </span>
        )}
      </header>

      {status === 'loading' && <p className="v2-meta">Henter vær…</p>}

      {status === 'error' && (
        <div>
          <p className="v2-meta">Vær: {error || 'Fant ikke sted'}</p>
          {suggestions.length > 0 && (
            <div className="v2-weather-suggestions">
              {suggestions.map((place) => (
                <button
                  key={`${place.name}-${place.country}-${place.latitude}`}
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    const nextCity = localizeCity(place.name) || place.name
                    const nextCountry =
                      localizeCountry(place.country) || place.country || country
                    setCity(nextCity)
                    setCountry(nextCountry)
                    load(nextCity, nextCountry)
                  }}
                >
                  {[
                    localizeCity(place.name),
                    localizeCity(place.admin1),
                    localizeCountry(place.country),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {status === 'ready' && display && (
        <div className="v2-weather-body">
          <span className="v2-weather-glyph" title={display.summary}>
            <WeatherIcon icon={display.icon} size={22} />
          </span>
          <div className="v2-weather-temps">
            {showingNow && weather?.current ? (
              <strong>{Math.round(weather.current.temperature)}°</strong>
            ) : (
              <strong>
                {Math.round(display.tempMax)}°
                <span className="v2-meta"> / {Math.round(display.tempMin)}°</span>
              </strong>
            )}
            <span>{display.summary}</span>
            {display.precipitation > 0 && (
              <span className="v2-meta">
                {display.precipitation.toFixed(1)} mm
              </span>
            )}
          </div>
          <WeatherDaySpark
            days={weather.days || []}
            highlight={spot.date}
            city={localizeCity(city) || city}
            country={country}
            weather={weather}
          />
        </div>
      )}

      {status === 'ready' && weather && !display && (
        <p className="v2-meta">
          Ingen prognose for {formatDateNO(spot.date)} ennå.
        </p>
      )}

      {status === 'idle' && !weather && (
        <p className="v2-meta">Ikke hentet ennå.</p>
      )}
    </article>
  )
}

export function JourneyWeatherView({ journey }: { journey: Journey }) {
  const spots = journeyWeatherSpots(journey)
  if (!spots.length) {
    return (
      <p className="v2-empty">
        Ingen steder med dato ennå. Legg til byer eller cruise under{' '}
        <strong>Plan</strong>.
      </p>
    )
  }
  return (
    <div className="v2-weather-list">
      <p className="v2-meta" style={{ marginTop: 0 }}>
        Prognose for stedene på reisen (inntil 7 dager frem). Backend lagrer
        vær to ganger om dagen. Trykk den lille grafen for detaljer.
      </p>
      <WeatherTempChart spots={spots} />
      {spots.map((spot) => (
        <SpotWeatherCard key={spot.key} spot={spot} />
      ))}
    </div>
  )
}
