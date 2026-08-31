import { useState } from 'react'
import { localizeCity, localizeCountry } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import { HotelInfoTip } from './HotelInfoTip'
import { TransportRideTip } from './TransportRideTip'
import {
  formatDateNO,
  journeyOverviewBookedHotels,
  journeyOverviewRides,
  journeyVisitCountryGroups,
  journeyVisitPlaces,
  type Journey,
} from './journeyModel'

type OverviewPage = 'cities' | 'countries' | 'rides' | 'hotels'

export function JourneyOverview({ journey }: { journey: Journey }) {
  const [page, setPage] = useState<OverviewPage>('cities')
  const { cities, countries } = journeyVisitPlaces(journey)
  const countryGroups = journeyVisitCountryGroups(journey)
  const rides = journeyOverviewRides(journey)
  const bookedHotels = journeyOverviewBookedHotels(journey)

  return (
    <div className="v2-overview">
      <nav className="v2-overview-nav" aria-label="Oversikt">
        <button
          type="button"
          className={`v2-overview-tab${page === 'cities' ? ' is-on' : ''}`}
          title="Byer vi skal besøke"
          onClick={() => setPage('cities')}
        >
          Byer
        </button>
        <button
          type="button"
          className={`v2-overview-tab${page === 'countries' ? ' is-on' : ''}`}
          title="Land vi skal innom"
          onClick={() => setPage('countries')}
        >
          Land
        </button>
        <button
          type="button"
          className={`v2-overview-tab${page === 'hotels' ? ' is-on' : ''}`}
          title="Bookede hoteller og overnatting"
          onClick={() => setPage('hotels')}
        >
          Hotell
        </button>
        <button
          type="button"
          className={`v2-overview-tab${page === 'rides' ? ' is-on' : ''}`}
          title="Transport med dato"
          onClick={() => setPage('rides')}
        >
          Transport
        </button>
      </nav>

      {page === 'cities' && (
        <section>
          <h2>Byer vi skal besøke</h2>
          <p className="v2-meta">
            {cities.length === 0
              ? 'Ingen besøksbyer ennå. Merk steder som Besøk byen under Plan.'
              : `${cities.length} ${cities.length === 1 ? 'by' : 'byer'} i rekkefølge.`}
          </p>
          {cities.length > 0 && (
            <ol className="v2-overview-list">
              {cities.map((place, i) => (
                <li key={`${place.country}|${place.city}|${i}`}>
                  <span className="v2-overview-num">{i + 1}</span>
                  <span className="v2-overview-main">
                    <strong>{localizeCity(place.city)}</strong>
                    {place.country ? (
                      <span className="v2-meta">{localizeCountry(place.country)}</span>
                    ) : null}
                  </span>
                  <CityInfoTip text={place.info} docs={place.docs} />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {page === 'hotels' && (
        <section>
          <h2>Bookede hoteller</h2>
          <p className="v2-meta">
            {bookedHotels.length === 0
              ? 'Ingen booket overnatting ennå. Merk hotell som Er booket under Plan.'
              : `${bookedHotels.length} ${
                  bookedHotels.length === 1 ? 'overnatting' : 'overnattinger'
                } i rekkefølge.`}
          </p>
          {bookedHotels.length > 0 && (
            <ol className="v2-overview-list">
              {bookedHotels.map((hotel, i) => {
                const placeBits = [
                  hotel.city ? localizeCity(hotel.city) : '',
                  hotel.country ? localizeCountry(hotel.country) : '',
                ].filter(Boolean)
                const dateBits: string[] = []
                if (hotel.arriveDate && hotel.departDate && hotel.nights > 0) {
                  dateBits.push(
                    `${formatDateNO(hotel.arriveDate)}–${formatDateNO(hotel.departDate)}`,
                  )
                } else if (hotel.arriveDate) {
                  dateBits.push(formatDateNO(hotel.arriveDate))
                }
                if (hotel.nights > 0) {
                  dateBits.push(
                    `${hotel.nights} ${hotel.nights === 1 ? 'natt' : 'netter'}`,
                  )
                }
                const bookedWhere = (hotel.stay.bookedWhere || '').trim()
                return (
                  <li key={hotel.id}>
                    <span className="v2-overview-num">{i + 1}</span>
                    <span className="v2-overview-main">
                      <strong>{hotel.hotelName}</strong>
                      {placeBits.length > 0 ? (
                        <span className="v2-meta">{placeBits.join(' · ')}</span>
                      ) : null}
                      {dateBits.length > 0 ? (
                        <span className="v2-overview-date">
                          {dateBits.join(' · ')}
                        </span>
                      ) : null}
                      {bookedWhere ? (
                        <span className="v2-meta">via {bookedWhere}</span>
                      ) : null}
                    </span>
                    <HotelInfoTip
                      stay={hotel.stay}
                      nights={hotel.nights}
                      arriveDate={hotel.arriveDate}
                      departDate={hotel.departDate}
                    />
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      )}

      {page === 'rides' && (
        <section>
          <h2>Transport</h2>
          <p className="v2-meta">
            {rides.length === 0
              ? 'Ingen avganger ennå. Legg inn transport under Plan.'
              : `${rides.length} ${rides.length === 1 ? 'etappe' : 'etapper'} i rekkefølge.`}
          </p>
          {rides.length > 0 && (
            <ol className="v2-overview-list is-rides">
              {rides.map((ride, i) => (
                <TransportRideTip key={`${ride.id}|${i}`} ride={ride}>
                  <span className="v2-overview-num">{i + 1}</span>
                  <span className="v2-overview-main">
                    {ride.date ? (
                      <span className="v2-overview-date">
                        {formatDateNO(ride.date)}
                      </span>
                    ) : (
                      <span className="v2-meta">Uten dato</span>
                    )}
                    <strong>
                      {localizeCity(ride.fromLabel)} → {localizeCity(ride.toLabel)}
                    </strong>
                    {ride.detail ? (
                      <span className="v2-meta">{ride.detail}</span>
                    ) : null}
                  </span>
                </TransportRideTip>
              ))}
            </ol>
          )}
        </section>
      )}

      {page === 'countries' && (
        <section>
          <h2>Land vi skal innom</h2>
          <p className="v2-meta">
            {countries.length === 0
              ? 'Ingen land ennå. Legg til byer under Plan.'
              : `${countries.length} land · ${cities.length} ${
                  cities.length === 1 ? 'by' : 'byer'
                } i rekkefølge.`}
          </p>
          {countryGroups.length > 0 && (
            <ol className="v2-overview-list is-countries">
              {countryGroups.map((group, i) => (
                <li key={`${group.country}|${i}`}>
                  <span className="v2-overview-num">{i + 1}</span>
                  <span className="v2-overview-main">
                    <strong>
                      {group.country
                        ? localizeCountry(group.country)
                        : 'Uten land'}
                    </strong>
                    {group.cities.length > 0 ? (
                      <ul className="v2-overview-country-cities">
                        {group.cities.map((place) => (
                          <li key={place.city}>
                            {localizeCity(place.city)}
                            <CityInfoTip text={place.info} docs={place.docs} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="v2-meta">Ingen byer registrert</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
