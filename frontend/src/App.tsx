import { useEffect, useState } from 'react'
import {
  api,
  emptyTripFeatures,
  normalizeTravelers,
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
  THEME_GROUPS,
  type HomePlace,
  type PlannerSettings,
  type ThemeId,
} from './userSettings'
import { ConfirmDeleteProvider } from './v2/ConfirmDelete'
import { HomePage } from './v2/HomePage'
import { TripHub } from './v2/TripHub'
import { ShareItineraryPage } from './v2/ShareItineraryPage'
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
import { AdminPage } from './v2/AdminPage'
import { enqueueJourneyWeather } from './v2/JourneyWeather'
import { cacheJourney } from './v2/journeyCache'
import { MissingHotelDaysCard } from './v2/MissingHotelDaysCard'
import {
  hashesEqual,
  mergeAppView,
  parseAppHash,
  sameAppRoute,
  viewToHash,
  type AppView,
} from './appRoute'
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

type View = AppView

function journeyListStats(journey: Journey) {
  const { cityCount, countryCount } = journeyVisitStats(journey)
  return { dayCount: cityCount, countryCount, cityCount }
}

function AppearancePage({ onBack }: { onBack: () => void }) {
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme())

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
            <h1>Utseende</h1>
            <p className="v2-meta">Fargetema for appen</p>
          </div>
        </div>
      </header>

      <div className="v2-settings-body">
        <section className="v2-settings-card">
          <h2>Fargetema</h2>
          <p className="v2-meta">
            Natur, sprek farger og gammeldags uttrykk.
          </p>
          {THEME_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="v2-theme-section">{group.label}</p>
              {(
                [
                  ['Mørke', 'dark'],
                  ['Lyse', 'light'],
                ] as const
              ).map(([label, tone]) => {
                const items = THEMES.filter(
                  (t) => t.group === group.id && t.tone === tone,
                )
                if (items.length === 0) return null
                return (
                  <div key={`${group.id}-${tone}`}>
                    <p className="v2-theme-group">{label}</p>
                    <div className="v2-theme-grid">
                      {items.map((t) => (
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
                )
              })}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function SettingsPage({
  initialHome,
  initialPlanner,
  trips,
  focusTripId,
  error,
  onBack,
  onSave,
  onOpenLinks,
}: {
  initialHome: HomePlace
  initialPlanner: PlannerSettings
  trips: Trip[]
  focusTripId?: string
  error?: string
  onBack: () => void
  onSave: (home: HomePlace, planner: PlannerSettings) => void
  onOpenLinks: () => void
}) {
  const [draft, setDraft] = useState<HomePlace>(initialHome)
  const [planner, setPlanner] = useState<PlannerSettings>(initialPlanner)
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
            <p className="v2-meta">Hjem, lenker, steg og varsler</p>
          </div>
        </div>
      </header>

      <div className="v2-settings-body">
        {error && <p className="v2-error">{error}</p>}

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

        <MissingHotelDaysCard trips={trips} focusTripId={focusTripId} />

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
      </div>
    </div>
  )
}

export default function App() {
  const shareToken = readShareToken()
  return (
    <ConfirmDeleteProvider>
      {shareToken ? (
        <ShareItineraryPage token={shareToken} />
      ) : (
        <AppMain />
      )}
    </ConfirmDeleteProvider>
  )
}

function AppMain() {
  const [view, setViewState] = useState<View>(() =>
    parseAppHash(window.location.hash),
  )

  function applyLocationView() {
    const next = parseAppHash(window.location.hash)
    setViewState((prev) => {
      const merged = mergeAppView(prev, next)
      if (
        sameAppRoute(prev, merged) &&
        (prev.name !== 'trip' ||
          merged.name !== 'trip' ||
          prev.autoOnward === merged.autoOnward)
      ) {
        return prev
      }
      return merged
    })
  }

  function setView(next: View) {
    setViewState((prev) => mergeAppView(prev, next))
    const hash = viewToHash(next)
    if (!hashesEqual(window.location.hash, hash)) {
      window.history.pushState(null, '', hash)
    }
  }

  useEffect(() => {
    const current = window.location.hash
    const canonical = viewToHash(parseAppHash(current))
    if (!current || current === '#' || !hashesEqual(current, canonical)) {
      window.history.replaceState(null, '', canonical)
    }

    let navQueued = false
    function onNav() {
      if (navQueued) return
      navQueued = true
      queueMicrotask(() => {
        navQueued = false
        applyLocationView()
      })
    }

    window.addEventListener('hashchange', onNav)
    window.addEventListener('popstate', onNav)
    return () => {
      window.removeEventListener('hashchange', onNav)
      window.removeEventListener('popstate', onNav)
    }
  }, [])
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
            cacheJourney(localized)
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
        tab: 'plan',
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

  if (view.name === 'appearance') {
    const returnTo = view.returnTo || { name: 'home' as const }
    return (
      <>
        {alerts}
        <AppearancePage
          onBack={() => {
            setError('')
            setView(returnTo)
          }}
        />
      </>
    )
  }

  if (view.name === 'admin') {
    const returnTo = view.returnTo || { name: 'home' as const }
    return (
      <>
        {alerts}
        <AdminPage
          trips={trips}
          previewTripId={
            returnTo.name === 'trip' ? returnTo.tripId : trips[0]?.id
          }
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
    const focusTripId =
      returnTo.name === 'trip' ? returnTo.tripId : undefined
    return (
      <>
        {alerts}
        <SettingsPage
        initialHome={homePlace}
        initialPlanner={plannerSettings}
        trips={trips}
        focusTripId={focusTripId}
        error={error}
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
        onTabChange={(tab) =>
          setView({
            name: 'trip',
            tripId: view.tripId,
            tab,
            autoOnward: view.autoOnward,
          })
        }
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
        onOpenAppearance={() =>
          setView({
            name: 'appearance',
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
        onOpenAdmin={() =>
          setView({
            name: 'admin',
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
      onOpenAppearance={() => {
        setError('')
        setView({ name: 'appearance', returnTo: { name: 'home' } })
      }}
      onOpenLinks={() => {
        setError('')
        setView({ name: 'links', returnTo: { name: 'home' } })
      }}
      onOpenAdmin={() => {
        setError('')
        setView({ name: 'admin', returnTo: { name: 'home' } })
      }}
      onOpenTrip={(tripId) =>
        setView({ name: 'trip', tripId, tab: 'plan' })
      }
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
