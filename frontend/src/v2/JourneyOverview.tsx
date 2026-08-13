import { useState } from 'react'
import { localizeCity, localizeCountry } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import { journeyVisitPlaces, type Journey } from './journeyModel'

type OverviewPage = 'cities' | 'countries'

export function JourneyOverview({ journey }: { journey: Journey }) {
  const [page, setPage] = useState<OverviewPage>('cities')
  const { cities, countries } = journeyVisitPlaces(journey)

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
