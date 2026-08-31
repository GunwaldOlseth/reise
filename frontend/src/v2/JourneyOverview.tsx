import { useState } from 'react'
import { localizeCity, localizeCountry } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import { HotelInfoTip } from './HotelInfoTip'
import { TransportRideTip } from './TransportRideTip'
import {
  formatDateNO,
  journeyOverviewBookedHotels,
  journeyOverviewRides,
  journeyOverviewStepsSummary,
  journeyVisitCountryGroups,
  journeyVisitPlaces,
  type Journey,
} from './journeyModel'

type OverviewPage = 'cities' | 'countries' | 'rides' | 'hotels' | 'steps'

function formatStepCount(n: number): string {
  return n.toLocaleString('nb-NO')
}

export function JourneyOverview({
  journey,
  tripTravelers = [],
}: {
  journey: Journey
  tripTravelers?: string[]
}) {
  const [page, setPage] = useState<OverviewPage>('cities')
  const { cities, countries } = journeyVisitPlaces(journey)
  const countryGroups = journeyVisitCountryGroups(journey)
  const rides = journeyOverviewRides(journey)
  const bookedHotels = journeyOverviewBookedHotels(journey)
  const stepsSummary = journeyOverviewStepsSummary(journey, tripTravelers)

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
        <button
          type="button"
          className={`v2-overview-tab${page === 'steps' ? ' is-on' : ''}`}
          title="Skritt per dag og totalt"
          onClick={() => setPage('steps')}
        >
          Skritt
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
                  <span className="v2-overview-main v2-overview-ride-main">
                    <span className="v2-overview-ride-head">
                      {ride.date ? (
                        <span className="v2-overview-date">
                          {formatDateNO(ride.date)}
                        </span>
                      ) : (
                        <span className="v2-meta">Uten dato</span>
                      )}
                      <strong className="v2-overview-ride-route">
                        {localizeCity(ride.fromLabel)} →{' '}
                        {localizeCity(ride.toLabel)}
                      </strong>
                    </span>
                    {ride.detail ? (
                      <span className="v2-overview-ride-detail">
                        {ride.detail}
                      </span>
                    ) : null}
                  </span>
                </TransportRideTip>
              ))}
            </ol>
          )}
        </section>
      )}

      {page === 'steps' && (
        <section>
          <h2>Skritt</h2>
          {stepsSummary.travelers.length === 0 ? (
            <p className="v2-meta">
              Legg til hvem er med på reisen for å se skritt per person.
            </p>
          ) : stepsSummary.days.length === 0 ? (
            <p className="v2-meta">
              Ingen skritt registrert ennå. Logg under{' '}
              <strong>Live</strong> nederst på dagen.
            </p>
          ) : (
            <>
              <p className="v2-meta">
                {stepsSummary.days.length}{' '}
                {stepsSummary.days.length === 1 ? 'dag' : 'dager'} med
                registrerte skritt.
              </p>
              <div className="v2-overview-steps-wrap">
                <table className="v2-overview-steps-table">
                  <thead>
                    <tr>
                      <th scope="col">Dag</th>
                      {stepsSummary.travelers.map((name) => (
                        <th key={name} scope="col">{name}</th>
                      ))}
                      <th scope="col" className="is-total">Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepsSummary.days.map((row) => (
                      <tr key={row.date}>
                        <th scope="row">{formatDateNO(row.date)}</th>
                        {stepsSummary.travelers.map((name) => (
                          <td key={name}>
                            {row.byTraveler[name] > 0
                              ? formatStepCount(row.byTraveler[name])
                              : '–'}
                          </td>
                        ))}
                        <td className="is-total">
                          <strong>{formatStepCount(row.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Totalt ferie</th>
                      {stepsSummary.travelers.map((name) => (
                        <td key={name}>
                          <strong>
                            {formatStepCount(
                              stepsSummary.totalsByTraveler[name] || 0,
                            )}
                          </strong>
                        </td>
                      ))}
                      <td className="is-total">
                        <strong>{formatStepCount(stepsSummary.tripTotal)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
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
