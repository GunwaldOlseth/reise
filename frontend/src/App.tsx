import { useEffect, useState } from 'react'
import {
  api,
  emptyTripFeatures,
  normalizeTravelers,
  type BackupMeta,
  type Trip,
  type TripInput,
} from './api'
import { useGoogleAuth } from './googleAuth'
import { CitySuggestFields } from './CitySuggest'
import {
  defaultPlannerSettings,
  hasHomePlace,
  loadHomePlace,
  loadPlannerSettings,
  loadTheme,
  saveHomePlace,
  savePlannerSettings,
  saveTheme,
  THEMES,
  type HomePlace,
  type PlannerSettings,
  type ThemeId,
} from './userSettings'
import { HomePage } from './v2/HomePage'
import { TripHub } from './v2/TripHub'
import { ShareItineraryPage } from './v2/ShareItineraryPage'
import { SharePreviewCard } from './v2/ShareItineraryView'
import { UsefulLinksCard, UsefulLinksPage } from './v2/UsefulLinks'
import { TimeAlertsCard, TravelAlertWatcher } from './v2/TravelAlertWatcher'
import { readShareToken } from './v2/shareItinerary'
import {
  emptyJourney,
  journeyVisitStats,
  newStopId,
  type Journey,
} from './v2/journeyModel'
import { localizeJourneyPlaces } from './placeNames'
import { enqueueJourneyWeather } from './v2/JourneyWeather'
import './v2/v2.css'

function GoogleLoginButton() {
  const { user, ready, configured, login, logout } = useGoogleAuth()
  if (!configured) return null
  if (!ready) {
    return (
      <button className="btn btn-ghost btn-sm" type="button" disabled>
        …
      </button>
    )
  }
  if (user) {
    return (
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        title={`Logg ut ${user.name || user.email || ''}`}
        onClick={() => logout()}
      >
        {user.name || user.email || 'Logg ut'}
      </button>
    )
  }
  return (
    <button
      className="btn btn-ghost btn-sm"
      type="button"
      title="Logg inn med Google"
      onClick={() => login()}
    >
      Logg inn med Google
    </button>
  )
}

type View =
  | { name: 'home' }
  | { name: 'settings'; returnTo?: View }
  | { name: 'links'; returnTo?: View }
  | {
      name: 'trip'
      tripId: string
      autoOnward?: boolean
      tab?: 'plan' | 'live' | 'overview' | 'map' | 'weather' | 'expenses'
    }

function journeyListStats(journey: Journey) {
  const { cityCount, countryCount } = journeyVisitStats(journey)
  return { dayCount: cityCount, countryCount, cityCount }
}

function SettingsPage({
  initialHome,
  initialPlanner,
  error,
  trips,
  previewTripId,
  onBack,
  onSave,
  onOpenLinks,
}: {
  initialHome: HomePlace
  initialPlanner: PlannerSettings
  error?: string
  trips: Trip[]
  previewTripId?: string
  onBack: () => void
  onSave: (home: HomePlace, planner: PlannerSettings) => void
  onOpenLinks: () => void
}) {
  const [draft, setDraft] = useState<HomePlace>(initialHome)
  const [planner, setPlanner] = useState<PlannerSettings>(initialPlanner)
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme())

  function togglePlanner<K extends keyof PlannerSettings>(key: K) {
    setPlanner((p) => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="v2-shell v2-settings">
      <header className="v2-hub-top">
        <div className="v2-hub-brand">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Tilbake"
            onClick={onBack}
          >
            ← Tilbake
          </button>
          <div>
            <h1>Innstillinger</h1>
            <p className="v2-meta">Hjem, lenker, steg, deling og varsler</p>
          </div>
        </div>
      </header>

      <div className="v2-settings-body">
        {error && <p className="v2-error">{error}</p>}

        <section className="v2-settings-card">
          <h2>Fargetema</h2>
          <p className="v2-meta">Rolige paletter — velg én, den brukes med en gang.</p>
          {(
            [
              ['Mørke', 'dark'],
              ['Lyse', 'light'],
            ] as const
          ).map(([label, tone]) => (
            <div key={tone}>
              <p className="v2-theme-group">{label}</p>
              <div className="v2-theme-grid">
                {THEMES.filter((t) => t.tone === tone).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`v2-theme-card${theme === t.id ? ' is-active' : ''}`}
                    title={t.blurb}
                    onClick={() => setTheme(saveTheme(t.id))}
                  >
                    <span className="v2-theme-swatches" aria-hidden>
                      {t.swatch.map((c) => (
                        <span key={c} style={{ background: c }} />
                      ))}
                    </span>
                    <strong>{t.name}</strong>
                    <span className="v2-meta">{t.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="v2-settings-card">
          <h2>Hjem</h2>
          <p className="v2-meta">
            Brukes av «Reise hjem». Lagres i denne nettleseren.
          </p>
          <div className="form-grid">
            <div className="full">
              <CitySuggestFields
                city={draft.city}
                country={draft.country}
                cityLabel="Hjemby"
                cityPlaceholder="Oslo"
                countryPlaceholder="Norge"
                autoFocus
                onCityChange={(city) => setDraft((p) => ({ ...p, city }))}
                onCountryChange={(country) =>
                  setDraft((p) => ({ ...p, country }))
                }
                onSelectPlace={(city, country) =>
                  setDraft((p) => ({
                    ...p,
                    city,
                    country: country || p.country,
                  }))
                }
              />
            </div>
            <label className="full">
              Adresse
              <input
                value={draft.address}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Gateadresse (valgfritt)"
              />
            </label>
          </div>
        </section>

        <UsefulLinksCard onOpenPage={onOpenLinks} />

        <section className="v2-settings-card">
          <h2>Planlegger — steg</h2>
          <p className="v2-meta">
            Velg hva veiviseren spør om når du legger til et stopp. Hotell og
            reise kan alltid hoppes over.
          </p>
          <label className="v2-home-check">
            <input
              type="checkbox"
              checked={planner.askStay}
              onChange={() => togglePlanner('askStay')}
            />
            <span>Spør om hotell / overnatting</span>
          </label>
          <label className="v2-home-check">
            <input
              type="checkbox"
              checked={planner.askNotes}
              onChange={() => togglePlanner('askNotes')}
            />
            <span>Spør om notater</span>
          </label>
        </section>

        <section className="v2-settings-card">
          <h2>Varsler (!)</h2>
          <p className="v2-meta">Vis utropstegn på stopp som mangler kobling.</p>
          <label className="v2-home-check">
            <input
              type="checkbox"
              checked={planner.warnMissingStay}
              onChange={() => togglePlanner('warnMissingStay')}
            />
            <span>Varsle når stopp mangler hotell</span>
          </label>
          <label className="v2-home-check">
            <input
              type="checkbox"
              checked={planner.warnMissingTravel}
              onChange={() => togglePlanner('warnMissingTravel')}
            />
            <span>Varsle når transport fra start til mål mangler</span>
          </label>
          <label className="v2-home-check">
            <input
              type="checkbox"
              checked={planner.requireTransportMode}
              onChange={() => togglePlanner('requireTransportMode')}
            />
            <span>Krev transportmiddel på hvert via-sted</span>
          </label>
          <div className="v2-settings-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => onSave(draft, planner)}
            >
              Lagre
            </button>
            <button className="btn btn-soft" type="button" onClick={onBack}>
              Avbryt
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setPlanner(defaultPlannerSettings())}
            >
              Tilbakestill steg
            </button>
          </div>
        </section>

        <TimeAlertsCard />

        <SharePreviewCard trips={trips} initialTripId={previewTripId} />

        <AdminBackupPanel />
      </div>
    </div>
  )
}

const ADMIN_TOKEN_KEY = 'reise.adminToken'

function formatBackupWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminBackupPanel() {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(
    () => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '',
  )
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  async function loadList(nextToken: string) {
    const data = await api.adminListBackups(nextToken)
    setBackups(data.backups || [])
  }

  async function login() {
    setBusy(true)
    setHint('')
    try {
      const data = await api.adminLogin(password)
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      setToken(data.token)
      setPassword('')
      await loadList(data.token)
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Innlogging feilet')
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    if (!token) return
    setBusy(true)
    setHint('')
    try {
      await loadList(token)
    } catch (err) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      setToken('')
      setHint(err instanceof Error ? err.message : 'Kunne ikke hente backup')
    } finally {
      setBusy(false)
    }
  }

  async function createNow() {
    if (!token) return
    setBusy(true)
    setHint('')
    try {
      await api.adminCreateBackup(token)
      await loadList(token)
      setHint('Ny sikkerhetskopi er tatt.')
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Kunne ikke ta backup')
    } finally {
      setBusy(false)
    }
  }

  async function restore(id: string, label: string) {
    if (
      !confirm(
        `Gjenopprette sikkerhetskopi fra ${label}? Dette erstatter alle turer med innholdet i kopien.`,
      )
    ) {
      return
    }
    setBusy(true)
    setHint('')
    try {
      await api.adminRestoreBackup(token, id)
      setHint('Gjenopprettet. Last siden på nytt for å se turene.')
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Kunne ikke gjenopprette')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v2-settings-card">
      <h2>Admin · sikkerhetskopi</h2>
      <p className="v2-meta">
        Automatisk kl. 08, 14 og 19 (norsk tid). Lagres som filer i Google Cloud
        Storage — ingen nye tabeller.
      </p>
      {!token ? (
        <div className="form-grid">
          <label className="full">
            Admin-passord
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void login()
              }}
            />
          </label>
          <div className="v2-settings-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !password.trim()}
              onClick={() => void login()}
            >
              {busy ? 'Logger inn…' : 'Logg inn som admin'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="v2-settings-actions">
            <button
              className="btn btn-soft"
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Oppdater liste
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={() => void createNow()}
            >
              Ta backup nå
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                sessionStorage.removeItem(ADMIN_TOKEN_KEY)
                setToken('')
                setBackups([])
              }}
            >
              Logg ut
            </button>
          </div>
          {backups.length === 0 ? (
            <p className="v2-meta">Ingen sikkerhetskopier ennå.</p>
          ) : (
            <ul className="v2-backup-list">
              {backups.map((b) => {
                const label = formatBackupWhen(b.createdAt)
                return (
                  <li key={b.id}>
                    <span>
                      <strong>{label}</strong>
                      {b.trips != null ? (
                        <span className="v2-meta"> · {b.trips} turer</span>
                      ) : null}
                    </span>
                    <button
                      className="btn btn-soft btn-sm"
                      type="button"
                      disabled={busy}
                      onClick={() => void restore(b.id, label)}
                    >
                      Hent tilbake
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      {hint ? <p className="v2-meta">{hint}</p> : null}
    </section>
  )
}

export default function App() {
  const shareToken = readShareToken()
  if (shareToken) {
    return <ShareItineraryPage token={shareToken} />
  }
  return <AppMain />
}

function AppMain() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [trips, setTrips] = useState<Trip[]>([])
  const [homePlace, setHomePlace] = useState<HomePlace>(() => loadHomePlace())
  const [plannerSettings, setPlannerSettings] = useState<PlannerSettings>(() =>
    loadPlannerSettings(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newTrip, setNewTrip] = useState<TripInput>({
    name: '',
    startDate: '',
    endDate: '',
    colorByCountry: {},
    features: emptyTripFeatures(),
    travelers: [],
  })
  const [showNewTrip, setShowNewTrip] = useState(false)
  const [startsFromHome, setStartsFromHome] = useState(() =>
    hasHomePlace(loadHomePlace()),
  )
  const [tripDayCounts, setTripDayCounts] = useState<
    Record<string, { dayCount: number; countryCount: number; cityCount: number }>
  >({})

  async function loadTrips() {
    setLoading(true)
    setError('')
    try {
      const list = await api.listTrips()
      setTrips(list)
      const counts: typeof tripDayCounts = {}
      await Promise.all(
        list.map(async (trip) => {
          try {
            const journey = await api.getJourney(trip.id)
            const localized = localizeJourneyPlaces({
              ...emptyJourney(trip.id),
              ...journey,
              tripId: trip.id,
            })
            counts[trip.id] = journeyListStats(localized)
            enqueueJourneyWeather(localized)
          } catch {
            counts[trip.id] = { dayCount: 0, countryCount: 0, cityCount: 0 }
          }
        }),
      )
      setTripDayCounts(counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente reiser')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTrips()
  }, [])

  async function handleCreateTrip() {
    if (!newTrip.name.trim()) return
    if (startsFromHome && !hasHomePlace(homePlace)) {
      setError('Sett hjemmeadresse under Innstillinger først.')
      setView({ name: 'settings', returnTo: { name: 'home' } })
      return
    }
    setSaving(true)
    setError('')
    try {
      const created = await api.createTrip({
        ...newTrip,
        name: newTrip.name.trim(),
        colorByCountry: {},
        features: {
          cruise: !!newTrip.features?.cruise,
          packages: !!newTrip.features?.packages,
        },
        travelers: normalizeTravelers(newTrip.travelers),
      })
      const start =
        created.startDate?.trim() || new Date().toISOString().slice(0, 10)

      if (startsFromHome && hasHomePlace(homePlace)) {
        const homeStop = {
          id: newStopId(),
          city: homePlace.city,
          country: homePlace.country,
          address: homePlace.address,
          arriveDate: start,
          kind: 'home' as const,
          stay: null,
          notes: '',
          sortOrder: 0,
        }
        await api.saveJourney(created.id, {
          ...emptyJourney(created.id),
          stops: [homeStop],
          legs: [],
        })
      }

      setShowNewTrip(false)
      setStartsFromHome(hasHomePlace(homePlace))
      setNewTrip({
        name: '',
        startDate: '',
        endDate: '',
        colorByCountry: {},
        features: emptyTripFeatures(),
        travelers: [],
      })
      await loadTrips()
      setView({
        name: 'trip',
        tripId: created.id,
        autoOnward: startsFromHome,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette tur')
    } finally {
      setSaving(false)
    }
  }

  const alerts = <TravelAlertWatcher tripIds={trips.map((t) => t.id)} />

  if (view.name === 'links') {
    const returnTo = view.returnTo || { name: 'home' as const }
    return (
      <>
        {alerts}
        <UsefulLinksPage
          onBack={() => {
            setError('')
            setView(returnTo)
          }}
        />
      </>
    )
  }

  if (view.name === 'settings') {
    const returnTo = view.returnTo || { name: 'home' as const }
    return (
      <>
        {alerts}
        <SettingsPage
        initialHome={homePlace}
        initialPlanner={plannerSettings}
        error={error}
        trips={trips}
        previewTripId={
          returnTo.name === 'trip' ? returnTo.tripId : trips[0]?.id
        }
        onBack={() => {
          setError('')
          setView(returnTo)
        }}
        onOpenLinks={() =>
          setView({
            name: 'links',
            returnTo: { name: 'settings', returnTo },
          })
        }
        onSave={(home, planner) => {
          setHomePlace(saveHomePlace(home))
          setPlannerSettings(savePlannerSettings(planner))
          setError('')
          setView(returnTo)
        }}
      />
      </>
    )
  }

  if (view.name === 'trip') {
    const trip = trips.find((t) => t.id === view.tripId)
    return (
      <>
        {alerts}
        <TripHub
        tripId={view.tripId}
        trip={trip}
        tripName={trip?.name || 'Tur'}
        tripStartDate={trip?.startDate || ''}
        homePlace={homePlace}
        settings={plannerSettings}
        autoOnward={!!view.autoOnward}
        initialTab={view.tab || 'plan'}
        onBack={() => setView({ name: 'home' })}
        onTripUpdated={(updated) => {
          setTrips((list) =>
            list.map((t) => (t.id === updated.id ? updated : t)),
          )
        }}
        onTripDeleted={() => {
          setView({ name: 'home' })
          void loadTrips()
        }}
        onOpenSettings={() =>
          setView({
            name: 'settings',
            returnTo: {
              name: 'trip',
              tripId: view.tripId,
              tab: view.tab || 'plan',
            },
          })
        }
        onOpenLinks={() =>
          setView({
            name: 'links',
            returnTo: {
              name: 'trip',
              tripId: view.tripId,
              tab: view.tab || 'plan',
            },
          })
        }
      />
      </>
    )
  }

  return (
    <>
      {alerts}
      <HomePage
      trips={trips}
      tripDayCounts={tripDayCounts}
      loading={loading}
      error={error}
      saving={saving}
      homePlace={homePlace}
      showNewTrip={showNewTrip}
      newTrip={newTrip}
      startsFromHome={startsFromHome}
      googleSlot={<GoogleLoginButton />}
      onRefresh={() => void loadTrips()}
      onOpenSettings={() => {
        setError('')
        setView({ name: 'settings', returnTo: { name: 'home' } })
      }}
      onOpenLinks={() => {
        setError('')
        setView({ name: 'links', returnTo: { name: 'home' } })
      }}
      onOpenTrip={(tripId) => setView({ name: 'trip', tripId })}
      onShowNewTrip={() => {
        setStartsFromHome(hasHomePlace(homePlace))
        setShowNewTrip(true)
      }}
      onHideNewTrip={() => setShowNewTrip(false)}
      onNewTripChange={setNewTrip}
      onStartsFromHomeChange={setStartsFromHome}
      onCreateTrip={() => void handleCreateTrip()}
      onTripDeleted={() => void loadTrips()}
      onTripUpdated={(updated) => {
        setTrips((list) =>
          list.map((t) => (t.id === updated.id ? updated : t)),
        )
      }}
    />
    </>
  )
}
