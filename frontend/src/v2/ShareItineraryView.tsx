import { useEffect, useState } from 'react'
import { api, type Trip } from '../api'
import { localizeCity, localizeJourneyPlaces } from '../placeNames'
import { emptyJourney, type Journey } from './journeyModel'
import {
  buildShareItinerary,
  DEMO_SHARE_ITINERARY,
  formatShareDateRange,
  shareOrCopy,
  sharePageUrl,
  type ShareItinerary,
} from './shareItinerary'
import { downloadItineraryPdf } from './itineraryPdf'

export function ShareItineraryView({
  itinerary,
}: {
  itinerary: ShareItinerary
}) {
  const dates = formatShareDateRange(itinerary.startDate, itinerary.endDate)
  return (
    <article className="v2-share-view">
      <header className="v2-share-head">
        <h1>{itinerary.name || 'Reise'}</h1>
        {dates ? <p className="v2-meta">{dates}</p> : null}
      </header>
      {itinerary.places.length === 0 ? (
        <p className="v2-meta">Ingen stopp ennå.</p>
      ) : (
        <ol className="v2-share-list">
          {itinerary.places.map((place, i) => (
            <li key={`${place.title}|${i}`}>
              <strong>{localizeCity(place.title) || place.title}</strong>
              {place.hops.length > 0 ? (
                <ul className="v2-share-hops">
                  {place.hops.map((hop, hi) => (
                    <li key={`${hop.label}|${hi}`}>
                      {hop.label
                        .split(' · ')
                        .map((part) => localizeCity(part) || part)
                        .join(' · ')}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

export function SharePreviewCard({
  trips,
  initialTripId,
}: {
  trips: Trip[]
  initialTripId?: string
}) {
  const [tripId, setTripId] = useState(
    () => initialTripId || trips[0]?.id || '',
  )
  const [itinerary, setItinerary] = useState<ShareItinerary>(() =>
    trips.length
      ? {
          name: (trips.find((t) => t.id === (initialTripId || trips[0]?.id))?.name ||
            trips[0]?.name ||
            ''),
          startDate: '',
          endDate: '',
          places: [],
        }
      : DEMO_SHARE_ITINERARY,
  )
  const [journey, setJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [published, setPublished] = useState(
    () => !!trips.find((t) => t.id === (initialTripId || trips[0]?.id))?.shareToken,
  )
  const isDemo = trips.length === 0

  useEffect(() => {
    setTripId((current) => {
      if (current && trips.some((t) => t.id === current)) return current
      if (initialTripId && trips.some((t) => t.id === initialTripId)) {
        return initialTripId
      }
      return trips[0]?.id || ''
    })
  }, [initialTripId, trips])

  useEffect(() => {
    const trip = trips.find((t) => t.id === tripId)
    setPublished(!!trip?.shareToken)
    if (!trip) {
      setItinerary(DEMO_SHARE_ITINERARY)
      setJourney(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void api
      .getJourney(trip.id)
      .then((data) => {
        if (cancelled) return
        const journey: Journey = localizeJourneyPlaces({
          ...emptyJourney(trip.id),
          ...data,
          tripId: trip.id,
        })
        setJourney(journey)
        setItinerary(buildShareItinerary(trip, journey))
      })
      .catch(() => {
        if (cancelled) return
        const empty = emptyJourney(trip.id)
        setJourney(empty)
        setItinerary(buildShareItinerary(trip, empty))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tripId, trips])

  async function copyOrPublish() {
    if (!tripId) return
    setBusy(true)
    setHint('')
    try {
      const { token } = await api.ensureShare(tripId)
      const url = sharePageUrl(token)
      const result = await shareOrCopy(url, itinerary.name || 'Reise')
      setPublished(true)
      setHint(
        result === 'copied-local'
          ? 'Lokal lenke kopiert — andre kan ikke åpne den. Publiser fra Cloud Run.'
          : result === 'copied'
            ? 'Lenke kopiert'
            : 'Publisert',
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setHint('Kunne ikke lage publiseringslenke')
    } finally {
      setBusy(false)
    }
  }

  async function openPublishPage() {
    if (!tripId) return
    setBusy(true)
    setHint('')
    try {
      const { token } = await api.ensureShare(tripId)
      setPublished(true)
      window.open(sharePageUrl(token), '_blank', 'noopener,noreferrer')
    } catch {
      setHint('Kunne ikke åpne publiseringssiden')
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!tripId) return
    setBusy(true)
    setHint('')
    try {
      await api.unpublishShare(tripId)
      setPublished(false)
      setHint('Avpublisert')
    } catch {
      setHint('Kunne ikke avpublisere')
    } finally {
      setBusy(false)
    }
  }

  function downloadPdf() {
    const trip = trips.find((t) => t.id === tripId)
    if (!trip || !journey) return
    downloadItineraryPdf(trip, journey)
    setHint('PDF lastet ned')
  }

  return (
    <section className="v2-settings-card">
      <h2>Publisering</h2>
      <p className="v2-meta">
        Andre får en kort liste med byer og via-transport. Ingen menyer, og de
        kan ikke redigere. PDF-en har den korte oversikten pluss en fullversjon
        med alle steg — bare første transport på listen.
        {published ? ' Listen er publisert.' : ''}
      </p>
      {trips.length > 1 ? (
        <label>
          Tur
          <select
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isDemo ? (
        <p className="v2-meta">Eksempel — slik ser siden ut for andre.</p>
      ) : null}
      <div className="v2-share-preview" aria-busy={loading}>
        <ShareItineraryView itinerary={itinerary} />
      </div>
      {!isDemo ? (
        <div className="v2-settings-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || !tripId}
            onClick={() => void copyOrPublish()}
          >
            {busy ? 'Publiserer…' : 'Publiser / kopier lenke'}
          </button>
          <button
            className="btn btn-soft"
            type="button"
            disabled={busy || !tripId}
            onClick={() => void openPublishPage()}
          >
            Åpne som egen side
          </button>
          {published ? (
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy || !tripId}
              onClick={() => void unpublish()}
            >
              Avpubliser
            </button>
          ) : null}
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!tripId || !journey}
            onClick={downloadPdf}
          >
            Last ned PDF
          </button>
        </div>
      ) : null}
      {hint ? <p className="v2-meta">{hint}</p> : null}
    </section>
  )
}
