import { useState } from 'react'
import { localizeCity, localizeCountry } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import {
  formatDateNO,
  journeyOverviewRides,
  journeyVisitPlaces,
  type Journey,
} from './journeyModel'

type OverviewPage = 'cities' | 'countries' | 'rides'

export function JourneyOverview({ journey }: { journey: Journey }) {
  const [page, setPage] = useState<OverviewPage>('cities')
  const { cities, countries } = journeyVisitPlaces(journey)
  const rides = journeyOverviewRides(journey)

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
                <li key={`${ride.id}|${i}`}>
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
                </li>
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
              : `${countries.length} land i rekkefølge.`}
          </p>
          {countries.length > 0 && (
            <ol className="v2-overview-list">
              {countries.map((country, i) => (
                <li key={`${country}|${i}`}>
                  <span className="v2-overview-num">{i + 1}</span>
                  <span className="v2-overview-main">
                    <strong>{localizeCountry(country)}</strong>
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
