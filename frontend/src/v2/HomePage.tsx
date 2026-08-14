import { useMemo, useState, type ReactNode } from 'react'
import { HolidayCountdown } from './HolidayCountdown'
import { formatDateNO, todayIsoOslo } from './journeyModel'
import {
  emptyTripFeatures,
  formatTravelers,
  normalizeTravelers,
  type Trip,
  type TripInput,
} from '../api'
import { DeleteTripSheet } from './DeleteTripSheet'
import { EditTripSheet, TravelerEditor } from './EditTripSheet'
import {
  formatHomePlace,
  hasHomePlace,
  type HomePlace,
} from '../userSettings'
import './v2.css'

function formatDateRange(start: string, end: string) {
  if (!start && !end) return 'Uten datoer'
  if (start && end && start !== end) {
    return `${formatDateNO(start)} – ${formatDateNO(end)}`
  }
  return formatDateNO(start || end)
}

export function HomePage({
  trips,
  tripDayCounts,
  loading,
  error,
  saving,
  homePlace,
  showNewTrip,
  newTrip,
  startsFromHome,
  googleSlot,
  onRefresh,
  onOpenSettings,
  onOpenLinks,
  onOpenTrip,
  onShowNewTrip,
  onHideNewTrip,
  onNewTripChange,
  onStartsFromHomeChange,
  onCreateTrip,
  onTripDeleted,
  onTripUpdated,
}: {
  trips: Trip[]
  tripDayCounts: Record<
    string,
    { dayCount: number; countryCount: number; cityCount: number }
  >
  loading: boolean
  error: string
  saving: boolean
  homePlace: HomePlace
  showNewTrip: boolean
  newTrip: TripInput
  startsFromHome: boolean
  googleSlot?: ReactNode
  onRefresh: () => void
  onOpenSettings: () => void
  onOpenLinks: () => void
  onOpenTrip: (tripId: string) => void
  onShowNewTrip: () => void
  onHideNewTrip: () => void
  onNewTripChange: (next: TripInput) => void
  onStartsFromHomeChange: (value: boolean) => void
  onCreateTrip: () => void
  onTripDeleted: () => void
  onTripUpdated: (trip: Trip) => void
}) {
  const [deleteTrip, setDeleteTrip] = useState<Trip | null>(null)
  const [editTrip, setEditTrip] = useState<Trip | null>(null)
  const nextTrip = useMemo(() => {
    const today = todayIsoOslo()
    return [...trips]
      .filter((t) => (t.startDate || '').trim() > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  }, [trips])

  return (
    <div className="v2-shell v2-home">
      <header className="v2-home-top">
        <div className="v2-home-top-actions">
          {googleSlot}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Innstillinger"
            onClick={onOpenSettings}
          >
            Innstillinger
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Nyttige lenker"
            onClick={onOpenLinks}
          >
            Lenker
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Oppdater turer"
            onClick={onRefresh}
          >
            Oppdater
          </button>
        </div>
      </header>

      <section className="v2-home-hero">
        <p className="v2-home-brand">Reise</p>
        <p className="v2-home-lead">
          Planlegg turen som én tråd — byer, cruise, kart, vær og utgifter.
        </p>
        <div className="v2-home-cta">
          <button
            type="button"
            className="btn btn-primary"
            title="Opprett ny tur"
            onClick={onShowNewTrip}
          >
            Ny tur
          </button>
        </div>
        {hasHomePlace(homePlace) && (
          <p className="v2-meta v2-home-homeplace">
            Hjem: {formatHomePlace(homePlace)}
          </p>
        )}
        {nextTrip && (
          <HolidayCountdown
            startDate={nextTrip.startDate}
            detail={nextTrip.name}
            onOpen={() => onOpenTrip(nextTrip.id)}
          />
        )}
      </section>

      <section className="v2-home-section">
        <div className="v2-home-section-head">
          <h2>Dine turer</h2>
          <p className="v2-meta">Åpne en tur for plan, kart, vær og utgifter.</p>
        </div>
        {error && <p className="v2-error">{error}</p>}
        {loading && <p className="v2-meta">Henter turer…</p>}
        {!loading && trips.length === 0 && (
          <p className="v2-empty">Ingen turer ennå. Opprett den første.</p>
        )}
        <div className="v2-home-trips">
          {trips.map((trip) => {
            const stats = tripDayCounts[trip.id]
            const who = formatTravelers(trip.travelers)
            return (
              <div key={trip.id} className="v2-home-trip-row">
                <button
                  type="button"
                  className="v2-home-trip"
                  title={`Åpne ${trip.name}`}
                  onClick={() => onOpenTrip(trip.id)}
                >
                  <span className="v2-home-trip-main">
                    <strong>{trip.name}</strong>
                    <span className="v2-meta">
                      {formatDateRange(trip.startDate, trip.endDate)}
                    </span>
                    {who ? <span className="v2-meta">{who}</span> : null}
                  </span>
                  <span className="v2-home-trip-chip">
                    {stats
                      ? `${stats.cityCount} ${stats.cityCount === 1 ? 'by' : 'byer'} · ${stats.countryCount} land`
                      : '…'}
                    <span className="v2-home-trip-arrow" aria-hidden>
                      ›
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="v2-home-trip-edit"
                  title={`Rediger ${trip.name}`}
                  onClick={() => setEditTrip(trip)}
                >
                  Endre
                </button>
                <button
                  type="button"
                  className="v2-home-trip-delete"
                  title={`Slett ${trip.name}`}
                  onClick={() => setDeleteTrip(trip)}
                >
                  Slett
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {editTrip && (
        <EditTripSheet
          trip={editTrip}
          onCancel={() => setEditTrip(null)}
          onSaved={(trip) => {
            setEditTrip(null)
            onTripUpdated(trip)
          }}
        />
      )}

      {deleteTrip && (
        <DeleteTripSheet
          tripId={deleteTrip.id}
          tripName={deleteTrip.name}
          onCancel={() => setDeleteTrip(null)}
          onDeleted={() => {
            setDeleteTrip(null)
            onTripDeleted()
          }}
        />
      )}

      {showNewTrip && (
        <div className="v2-sheet" role="dialog" aria-modal="true">
          <div className="v2-sheet-panel">
            <div className="v2-sheet-head">
              <div>
                <h2>Ny tur</h2>
                <p className="v2-meta">Navn, datoer og om du starter hjemmefra.</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Lukk"
                onClick={onHideNewTrip}
              >
                Lukk
              </button>
            </div>

            <div className="form-grid">
              <label className="full">
                Navn
                <input
                  autoFocus
                  value={newTrip.name}
                  onChange={(e) =>
                    onNewTripChange({ ...newTrip, name: e.target.value })
                  }
                  placeholder="Italia våren 2026"
                />
              </label>
              <label>
                Startdato
                <input
                  type="date"
                  value={newTrip.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value
                    onNewTripChange({
                      ...newTrip,
                      startDate,
                      endDate:
                        !newTrip.endDate || newTrip.endDate < startDate
                          ? startDate
                          : newTrip.endDate,
                    })
                  }}
                />
              </label>
              <label>
                Sluttdato
                <input
                  type="date"
                  value={newTrip.endDate}
                  min={newTrip.startDate || undefined}
                  onChange={(e) =>
                    onNewTripChange({ ...newTrip, endDate: e.target.value })
                  }
                />
              </label>
              <label className="v2-home-check full">
                <input
                  type="checkbox"
                  checked={startsFromHome}
                  onChange={(e) => onStartsFromHomeChange(e.target.checked)}
                />
                <span>
                  Starter hjemmefra
                  {hasHomePlace(homePlace)
                    ? ` (${formatHomePlace(homePlace)})`
                    : ''}
                </span>
              </label>
              {startsFromHome && !hasHomePlace(homePlace) && (
                <p className="v2-meta full">
                  Ingen hjemmeadresse ennå.{' '}
                  <button
                    type="button"
                    className="v2-text-link"
                    onClick={onOpenSettings}
                  >
                    Sett under Innstillinger
                  </button>
                </p>
              )}
              <div className="full">
                <TravelerEditor
                  travelers={normalizeTravelers(newTrip.travelers)}
                  disabled={saving}
                  onChange={(travelers) =>
                    onNewTripChange({ ...newTrip, travelers })
                  }
                />
              </div>
              <label className="v2-home-check">
                <input
                  type="checkbox"
                  checked={!!newTrip.features?.cruise}
                  onChange={(e) =>
                    onNewTripChange({
                      ...newTrip,
                      features: {
                        ...emptyTripFeatures(),
                        ...newTrip.features,
                        cruise: e.target.checked,
                      },
                    })
                  }
                />
                <span>Cruise</span>
              </label>
              <label className="v2-home-check">
                <input
                  type="checkbox"
                  checked={!!newTrip.features?.packages}
                  onChange={(e) =>
                    onNewTripChange({
                      ...newTrip,
                      features: {
                        ...emptyTripFeatures(),
                        ...newTrip.features,
                        packages: e.target.checked,
                      },
                    })
                  }
                />
                <span>Pakketurer</span>
              </label>
            </div>

            <div className="v2-sheet-actions">
              <button
                type="button"
                className="btn btn-soft"
                disabled={saving}
                title="Avbryt"
                onClick={onHideNewTrip}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !newTrip.name.trim()}
                title="Opprett tur"
                onClick={onCreateTrip}
              >
                {saving ? 'Oppretter…' : 'Opprett'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
