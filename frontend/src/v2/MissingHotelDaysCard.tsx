import { useMemo } from 'react'
import type { Trip } from '../api'
import { cachedJourney } from './journeyCache'
import { journeyMissingHotelStays } from './journeyModel'

type Row = {
  tripId: string
  tripName: string
  city: string
  dateLabel: string
  sortKey: string
}

export function MissingHotelDaysCard({
  trips,
  focusTripId,
}: {
  trips: Trip[]
  focusTripId?: string
}) {
  const rows = useMemo(() => {
    const tripList = focusTripId
      ? trips.filter((t) => t.id === focusTripId)
      : trips
    const out: Row[] = []
    for (const trip of tripList) {
      const journey = cachedJourney(trip.id)
      if (!journey) continue
      for (const entry of journeyMissingHotelStays(journey)) {
        out.push({
          tripId: trip.id,
          tripName: (trip.name || '').trim() || 'Reise',
          city: entry.city,
          dateLabel: entry.dateLabel,
          sortKey: entry.arriveDate || 'zzzz',
        })
      }
    }
    return out.sort((a, b) => {
      const byDate = a.sortKey.localeCompare(b.sortKey)
      if (byDate !== 0) return byDate
      return a.city.localeCompare(b.city, 'nb')
    })
  }, [trips, focusTripId])

  const showTripName = !focusTripId && rows.length > 0

  return (
    <section className="v2-settings-card">
      <h2>Dager uten hotell</h2>
      <p className="v2-meta">
        Stopp der dere er i en by uten lagt inn hotell eller overnatting. Legg
        inn under Plan → Hotell / Overnatting.
      </p>
      {rows.length === 0 ? (
        <p className="v2-meta">Ingen dager uten hotell i åpne reiser.</p>
      ) : (
        <ul className="v2-missing-hotel-list">
          {rows.map((row) => (
            <li key={`${row.tripId}-${row.city}-${row.sortKey}`}>
              {showTripName ? (
                <span className="v2-missing-hotel-trip">{row.tripName}</span>
              ) : null}
              <span className="v2-missing-hotel-city">{row.city}</span>
              <span className="v2-missing-hotel-date">{row.dateLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
