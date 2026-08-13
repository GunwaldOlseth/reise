import { useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  formatExpenseAmount,
  formatTravelers,
  type Trip,
  type TripExpenseSummary,
} from '../api'
import { EditTripSheet } from './EditTripSheet'
import { TripMap } from '../TripMap'
import {
  hasHomePlace,
  type HomePlace,
  type PlannerSettings,
} from '../userSettings'
import { journeyExpenseSummary } from './journeyExpenses'
import { journeyMapRouteKey, journeyMapStopsInOrder } from './journeyMap'
import { localizeJourneyPlaces } from '../placeNames'
import { compactLive, emptyJourney, type Journey } from './journeyModel'
import { DeleteTripSheet } from './DeleteTripSheet'
import { JourneyLive } from './JourneyLive'
import { JourneyOverview } from './JourneyOverview'
import { JourneyPlanner } from './JourneyPlanner'
import { enqueueJourneyWeather, JourneyWeatherView } from './JourneyWeather'
import './v2.css'

export type TripHubTab =
  | 'plan'
  | 'live'
  | 'overview'
  | 'map'
  | 'weather'
  | 'expenses'

const TABS: { id: TripHubTab; label: string; title: string }[] = [
  {
    id: 'plan',
    label: 'Plan',
    title: 'Reise som tråd — byer, transport og pakker',
  },
  {
    id: 'live',
    label: 'Live',
    title: 'Dagens reise, priser og det som skjer utenom planen',
  },
  {
    id: 'overview',
    label: 'Oversikt',
    title: 'Byer og land vi skal innom',
  },
  { id: 'map', label: 'Kart', title: 'Kart over ruten' },
  { id: 'weather', label: 'Vær', title: 'Vær langs reisen' },
  {
    id: 'expenses',
    label: 'Utgifter',
    title: 'Priser og kostnader for turen',
  },
]

export function TripHub({
  tripId,
  trip,
  tripName,
  tripStartDate = '',
  homePlace,
  settings,
  autoOnward = false,
  initialTab = 'plan',
  onBack,
  onOpenSettings,
  onTripDeleted,
  onTripUpdated,
}: {
  tripId: string
  tripName: string
  tripStartDate?: string
  homePlace: HomePlace
  settings: PlannerSettings
  autoOnward?: boolean
  initialTab?: TripHubTab
  onBack: () => void
  onOpenSettings: () => void
  onTripDeleted: () => void
  trip?: Trip | null
  onTripUpdated: (trip: Trip) => void
}) {
  const [tab, setTab] = useState<TripHubTab>(initialTab)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [journey, setJourney] = useState<Journey>(() => emptyJourney(tripId))
  const [journeyTick, setJourneyTick] = useState(0)
  /** False until first successful/failed journey fetch for this trip. */
  const [journeyReady, setJourneyReady] = useState(false)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab, tripId])

  useEffect(() => {
    setJourney(emptyJourney(tripId))
    setJourneyReady(false)
  }, [tripId])

  // Prefetch journey on open (and after Plan saves / Oppdater) so Kart is not
  // blocked by a refetch every time the tab is clicked.
  useEffect(() => {
    let cancelled = false
    void api
      .getJourney(tripId)
      .then((data) => {
        if (cancelled) return
        setJourney(
          localizeJourneyPlaces({
            ...emptyJourney(tripId),
            ...data,
            tripId,
          }),
        )
        setJourneyReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setJourney(emptyJourney(tripId))
        setJourneyReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [tripId, journeyTick])

  useEffect(() => {
    if (!journeyReady) return
    enqueueJourneyWeather(journey)
  }, [journey, journeyReady])

  const mapStops = useMemo(
    () => journeyMapStopsInOrder(journey),
    [journey],
  )
  const mapKey = useMemo(() => journeyMapRouteKey(journey), [journey])
  const expenseSummary = useMemo(
    () => journeyExpenseSummary(journey),
    [journey],
  )
  const liveSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const livePending = useRef<Journey | null>(null)

  function persistLiveNow(next: Journey) {
    livePending.current = null
    void api
      .saveJourney(
        tripId,
        localizeJourneyPlaces({
          ...next,
          tripId,
          live: compactLive(next.live),
        }),
      )
      .catch(() => {})
  }

  function flushLiveSave() {
    if (liveSaveTimer.current) {
      clearTimeout(liveSaveTimer.current)
      liveSaveTimer.current = null
    }
    if (livePending.current) persistLiveNow(livePending.current)
  }

  function handleLiveChange(next: Journey) {
    setJourney(next)
    livePending.current = next
    if (liveSaveTimer.current) clearTimeout(liveSaveTimer.current)
    liveSaveTimer.current = setTimeout(() => {
      liveSaveTimer.current = null
      if (livePending.current) persistLiveNow(livePending.current)
    }, 450)
  }

  useEffect(() => {
    return () => {
      if (liveSaveTimer.current) clearTimeout(liveSaveTimer.current)
      if (livePending.current) {
        void api
          .saveJourney(
            tripId,
            localizeJourneyPlaces({
              ...livePending.current,
              tripId,
              live: compactLive(livePending.current.live),
            }),
          )
          .catch(() => {})
      }
    }
  }, [tripId])

  return (
    <div className="v2-shell v2-hub">
      <header className="v2-hub-top">
        <div className="v2-hub-brand">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Alle turer"
            onClick={onBack}
          >
            ← Turer
          </button>
          <div>
            <h1>{tripName || 'Reise'}</h1>
            <p className="v2-meta">
              {formatTravelers(trip?.travelers) ||
                'Plan · live · oversikt · kart · vær · utgifter'}
            </p>
          </div>
        </div>
        <div className="v2-hub-actions">
          <div className="v2-hub-menu-wrap">
            <button
              type="button"
              className="v2-hub-burger"
              title="Meny"
              aria-label="Meny"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
            {menuOpen && (
              <div className="v2-hub-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setEditOpen(true)
                  }}
                >
                  Rediger tur…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenSettings()
                  }}
                >
                  Innstillinger
                </button>
                {!hasHomePlace(homePlace) && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenSettings()
                    }}
                  >
                    Sett hjemmeadresse…
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setMenuOpen(false)
                    setDeleteOpen(true)
                  }}
                >
                  Slett ferie…
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="v2-hub-nav" aria-label="Turmeny">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`v2-hub-tab${tab === t.id ? ' is-active' : ''}`}
            title={t.title}
            onClick={() => {
              setMenuOpen(false)
              if (tab === 'live' && t.id !== 'live') flushLiveSave()
              setTab(t.id)
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="v2-hub-body">
        {tab === 'plan' && (
          <JourneyPlanner
            tripId={tripId}
            tripName={tripName}
            tripStartDate={tripStartDate}
            homePlace={homePlace}
            settings={settings}
            autoOnward={autoOnward}
            embedded
            onBack={onBack}
            onOpenSettings={onOpenSettings}
            onJourneySaved={() => setJourneyTick((n) => n + 1)}
          />
        )}
        {tab === 'live' && (
          <div className="v2-hub-panel">
            {!journeyReady ? (
              <p className="v2-meta">Henter dagen…</p>
            ) : (
              <JourneyLive
                journey={journey}
                disabled={!journeyReady}
                onChange={handleLiveChange}
              />
            )}
          </div>
        )}
        {tab === 'overview' && (
          <div className="v2-hub-panel">
            {!journeyReady ? (
              <p className="v2-meta">Henter oversikt…</p>
            ) : (
              <JourneyOverview journey={journey} />
            )}
          </div>
        )}
        {tab === 'map' && (
          <div className="v2-hub-panel">
            {!journeyReady && mapStops.length === 0 ? (
              <p className="v2-meta">Henter kart…</p>
            ) : mapStops.length === 0 ? (
              <p className="v2-empty">
                Ingen steder å vise ennå. Legg til byer eller cruise under{' '}
                <strong>Plan</strong>.
              </p>
            ) : (
              <TripMap
                stops={mapStops}
                routeKey={mapKey}
                tripName={tripName}
                onRefresh={() => setJourneyTick((n) => n + 1)}
              />
            )}
          </div>
        )}
        {tab === 'weather' && (
          <div className="v2-hub-panel">
            {!journeyReady ? (
              <p className="v2-meta">Henter vær…</p>
            ) : (
              <JourneyWeatherView journey={journey} />
            )}
          </div>
        )}
        {tab === 'expenses' && (
          <div className="v2-hub-panel">
            {!journeyReady ? (
              <p className="v2-meta">Henter utgifter…</p>
            ) : (
              <>
                <JourneyExpensesView summary={expenseSummary} />
                <p className="v2-meta" style={{ marginTop: '1rem' }}>
                  Registrer planpriser i{' '}
                  <button
                    type="button"
                    className="v2-text-link"
                    onClick={() => setTab('plan')}
                  >
                    Plan
                  </button>
                  {' '}og mat, drikke og kjøp under{' '}
                  <button
                    type="button"
                    className="v2-text-link"
                    onClick={() => setTab('live')}
                  >
                    Live
                  </button>
                  .
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {editOpen && trip && (
        <EditTripSheet
          trip={trip}
          onCancel={() => setEditOpen(false)}
          onSaved={(next) => {
            setEditOpen(false)
            onTripUpdated(next)
          }}
        />
      )}

      {deleteOpen && (
        <DeleteTripSheet
          tripId={tripId}
          tripName={tripName}
          onCancel={() => setDeleteOpen(false)}
          onDeleted={onTripDeleted}
        />
      )}
    </div>
  )
}

function JourneyExpensesView({
  summary,
}: {
  summary: TripExpenseSummary
}) {
  function CategoryBlock({
    title,
    total,
    lines,
    showDate = true,
  }: {
    title: string
    total: number
    lines: TripExpenseSummary['cruise']['lines']
    showDate?: boolean
  }) {
    return (
      <div className="expense-category">
        <div className="expense-category-head">
          <h3>{title}</h3>
          <strong>{formatExpenseAmount(total)}</strong>
        </div>
        {lines.length === 0 ? (
          <p className="meta expense-empty">Ingen priser registrert</p>
        ) : (
          <ul className="expense-lines">
            {lines.map((line) => (
              <li key={line.id}>
                <span className="expense-line-title">
                  {line.title}
                  {showDate && line.date ? (
                    <span className="meta"> · {line.date}</span>
                  ) : null}
                  {line.isActual ? (
                    <span className="meta">
                      {' '}
                      · faktisk
                      {line.expectedRaw
                        ? ` (forv. ${line.expectedRaw})`
                        : ''}
                    </span>
                  ) : null}
                </span>
                <span className="expense-line-amount">
                  {formatExpenseAmount(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const dayCount = summary.byDay.length
  const avgDay = dayCount > 0 ? summary.total / dayCount : null
  const hotels = summary.hotel.lines
  const hotelNights = hotels.reduce(
    (sum, h) => sum + Math.max(1, h.nights || 1),
    0,
  )
  const hotelAvg =
    hotelNights > 0 ? summary.hotel.total / hotelNights : null
  const perNight = (h: (typeof hotels)[number]) =>
    h.amount / Math.max(1, h.nights || 1)
  let cheapestHotel: (typeof hotels)[number] | null = null
  let dearestHotel: (typeof hotels)[number] | null = null
  for (const h of hotels) {
    if (!cheapestHotel || perNight(h) < perNight(cheapestHotel)) {
      cheapestHotel = h
    }
    if (!dearestHotel || perNight(h) > perNight(dearestHotel)) {
      dearestHotel = h
    }
  }
  const hotelName = (title: string) =>
    title.replace(/^Hotell\s*·\s*/i, '') || title
  const hotelNightMeta = (h: (typeof hotels)[number]) => {
    const n = Math.max(1, h.nights || 1)
    return n > 1 ? `${n} netter · pr natt` : 'pr natt'
  }
  const hotelStatLabel = (h: (typeof hotels)[number]) => {
    const name = hotelName(h.title)
    const city = h.place?.trim() || ''
    const nameIsCity =
      !!city && name.toLowerCase() === city.toLowerCase()
    const head = city && !nameIsCity ? `${name} · ${city}` : name
    return `${head} · ${hotelNightMeta(h)}`
  }

  return (
    <div className="expense-overview">
      <div className="expense-total-card">
        <p className="expense-total-label">Totalt</p>
        <p className="expense-total-amount">
          {formatExpenseAmount(summary.total)}
        </p>
        <p className="meta expense-total-breakdown">
          Pakker {formatExpenseAmount(summary.cruise.total)}
          {' · '}
          Hotell {formatExpenseAmount(summary.hotel.total)}
          {' · '}
          Transport {formatExpenseAmount(summary.transport.total)}
          {' · '}
          Underveis {formatExpenseAmount(summary.live.total)}
        </p>
      </div>

      {(avgDay != null || hotelAvg != null) && (
        <ul className="expense-stats">
          {avgDay != null ? (
            <li>
              <span className="expense-stats-label">Snitt / dag</span>
              <strong>{formatExpenseAmount(avgDay)}</strong>
              <span className="meta">{dayCount} dager</span>
            </li>
          ) : null}
          {hotelAvg != null ? (
            <li>
              <span className="expense-stats-label">Hotell snitt</span>
              <strong>{formatExpenseAmount(hotelAvg)}</strong>
              <span className="meta">pr natt · {hotelNights}n</span>
            </li>
          ) : null}
          {cheapestHotel ? (
            <li>
              <span className="expense-stats-label">Billigst</span>
              <strong>{formatExpenseAmount(perNight(cheapestHotel))}</strong>
              <span className="meta expense-stats-name">
                {hotelStatLabel(cheapestHotel)}
              </span>
            </li>
          ) : null}
          {dearestHotel && dearestHotel.id !== cheapestHotel?.id ? (
            <li>
              <span className="expense-stats-label">Dyrest</span>
              <strong>{formatExpenseAmount(perNight(dearestHotel))}</strong>
              <span className="meta expense-stats-name">
                {hotelStatLabel(dearestHotel)}
              </span>
            </li>
          ) : null}
        </ul>
      )}

      <CategoryBlock
        title="Pakker / cruise"
        total={summary.cruise.total}
        lines={summary.cruise.lines}
        showDate={false}
      />
      <CategoryBlock
        title="Hotell"
        total={summary.hotel.total}
        lines={summary.hotel.lines}
      />
      <CategoryBlock
        title="Transport"
        total={summary.transport.total}
        lines={summary.transport.lines}
      />
      <CategoryBlock
        title="Underveis"
        total={summary.live.total}
        lines={summary.live.lines}
      />

      {summary.byDay.length > 0 && (
        <div className="expense-category">
          <div className="expense-category-head">
            <h3>Per dag</h3>
          </div>
          <ul className="expense-lines">
            {summary.byDay.map((d) => {
              const cruiseLabel =
                d.cruise > 0
                  ? [d.place, d.ship].filter(Boolean).join(' · ')
                  : ''
              const placeLabel =
                cruiseLabel || d.place || (d.ship ? d.ship : '')
              return (
                <li key={d.date}>
                  <span className="expense-line-title">
                    {d.date}
                    {placeLabel ? (
                      <span className="meta"> · {placeLabel}</span>
                    ) : null}
                  </span>
                  <span className="expense-line-amount">
                    {formatExpenseAmount(d.total)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
