import { useEffect, useMemo } from 'react'
import { weatherSearchCity, weatherSearchCountry } from '../placeNames'
import { todayIsoOslo } from './journeyModel'
import { WeatherIcon } from './JourneyWeather'
import {
  arriveInForecastWindow,
  formatTempC,
  pickTripWeatherDay,
} from './weatherDisplay'
import { enqueueWeatherPlaces, useWeatherPlace } from './weatherPrefetch'

export function LiveCityWeather({
  city,
  country = '',
  date,
  latitude,
  longitude,
  citySearch,
  countrySearch,
}: {
  city: string
  country?: string
  date: string
  latitude?: number
  longitude?: number
  citySearch?: string
  countrySearch?: string
}) {
  const place = city.trim()
  const nation = (country || '').trim()
  const stamp = date.trim().slice(0, 10)

  useEffect(() => {
    if (!place || !stamp) return
    enqueueWeatherPlaces([
      {
        city: place,
        country: nation,
        week: true,
        date: stamp,
        latitude,
        longitude,
        citySearch: citySearch?.trim() || weatherSearchCity(place),
        countrySearch:
          countrySearch?.trim() || weatherSearchCountry(nation || country),
      },
    ])
  }, [
    place,
    nation,
    stamp,
    latitude,
    longitude,
    citySearch,
    countrySearch,
    country,
  ])

  const entry = useWeatherPlace(place, nation)
  const line = useMemo(() => {
    if (entry.status !== 'ready' || !entry.weather || !stamp) return null
    const weather = entry.weather
    const display = pickTripWeatherDay(weather, stamp)
    const isToday = stamp === todayIsoOslo()
    const nowToday =
      isToday && weather.current ? weather.current : null
    if (!display && !nowToday) {
      if (!arriveInForecastWindow(stamp)) {
        return { kind: 'outside' as const }
      }
      return null
    }
    const forecast =
      Boolean(display) &&
      stamp > todayIsoOslo() &&
      (!isToday || !weather.current)
    const icon = display?.icon || nowToday?.icon || 'cloud'
    const temp = nowToday
      ? formatTempC(nowToday.temperature)
      : display
        ? formatTempC(display.tempMax)
        : '—°'
    const summary = (
      nowToday && display && isToday
        ? `${nowToday.summary || display.summary || ''}`.trim() ||
          display.summary
        : display?.summary || nowToday?.summary || ''
    ).trim()
    return {
      kind: 'weather' as const,
      icon,
      temp,
      summary,
      forecast,
      nowExtra:
        nowToday && display && isToday
          ? `Nå ${formatTempC(nowToday.temperature)}`
          : undefined,
    }
  }, [entry.status, entry.weather, stamp])

  if (entry.status === 'loading' && !line) {
    return <span className="v2-meta v2-live-weather">Henter vær…</span>
  }

  if (!line) return null

  if (line.kind === 'outside') {
    return (
      <span className="v2-meta v2-live-weather is-outside">
        Vær: utenfor 7-dagers prognose
      </span>
    )
  }

  return (
    <span
      className={`v2-meta v2-live-weather${line.forecast ? ' is-forecast' : ''}`}
      title={line.summary || undefined}
    >
      <span className="v2-live-weather-main">
        <WeatherIcon icon={line.icon} size={16} />
        <span className="v2-live-weather-temp">{line.temp}</span>
        {line.summary ? (
          <span className="v2-live-weather-summary">{line.summary}</span>
        ) : null}
        {line.forecast ? (
          <span className="v2-live-weather-forecast-label">prognose</span>
        ) : null}
      </span>
      {line.nowExtra ? (
        <span className="v2-live-weather-now">{line.nowExtra}</span>
      ) : null}
    </span>
  )
}
