import { useEffect, useMemo, useState } from 'react'
import { api, formatExpenseAmount, type TripExpenseSummary } from '../api'
import { TripMap } from '../TripMap'
import {
  hasHomePlace,
  type HomePlace,
  type PlannerSettings,
} from '../userSettings'
import { journeyExpenseSummary } from './journeyExpenses'
import { journeyMapRouteKey, journeyMapStopsInOrder } from './journeyMap'
import { emptyJourney, type Journey } from './journeyModel'
import { JourneyPlanner } from './JourneyPlanner'
import { JourneyWeatherView } from './JourneyWeather'
import './v2.css'

export type TripHubTab = 'plan' | 'map' | 'weather' | 'expenses'

const TABS: { id: TripHubTab; label: string; title: string }[] = [
  {
    id: 'plan',
    label: 'Plan',
    title: 'Reise som tråd — byer, transport og pakker',
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
  tripName,
  tripStartDate = '',
  homePlace,
  settings,
  autoOnward = false,
  initialTab = 'plan',
  onBack,
  onOpenSettings,
  onOpenClassic,
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
  onOpenClassic: () => void
}) {
  const [tab, setTab] = useState<TripHubTab>(initialTab)
  const [menuOpen, setMenuOpen] = useState(false)
  const [journey, setJourney] = useState<Journey>(() => emptyJourney(tripId))
  const [journeyTick, setJourneyTick] = useState(0)
  const [sideLoading, setSideLoading] = useState(false)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab, tripId])

  useEffect(() => {
    if (tab === 'plan') return
    let cancelled = false
    setSideLoading(true)
    void api
      .getJourney(tripId)
      .then((data) => {
        if (cancelled) return
        setJourney({ ...emptyJourney(tripId), ...data, tripId })
      })
      .catch(() => {
        if (!cancelled) setJourney(emptyJourney(tripId))
      })
      .finally(() => {
        if (!cancelled) setSideLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, tripId, journeyTick])

  const mapStops = useMemo(
    () => journeyMapStopsInOrder(journey),
    [journey],
  )
  const mapKey = useMemo(() => journeyMapRouteKey(journey), [journey])
  const expenseSummary = useMemo(
    () => journeyExpenseSummary(journey),
    [journey],
  )

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
            <p className="v2-meta">Plan · kart · vær · utgifter</p>
          </div>
        </div>
        <div className="v2-hub-actions">
          <div className="v2-hub-menu-wrap">
            <button
              type="button"
              className="btn btn-soft btn-sm"
              title="Mer"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              Mer
            </button>
            {menuOpen && (
              <div className="v2-hub-menu" role="menu">
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenClassic()
                  }}
                >
                  Klassisk liste
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
              setTab(t.id)
              if (t.id !== 'plan') setJourneyTick((n) => n + 1)
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
        {tab === 'map' && (
          <div className="v2-hub-panel">
            {sideLoading ? (
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
              />
            )}
          </div>
        )}
        {tab === 'weather' && (
          <div className="v2-hub-panel">
            {sideLoading ? (
              <p className="v2-meta">Henter vær…</p>
            ) : (
              <JourneyWeatherView journey={journey} />
            )}
          </div>
        )}
        {tab === 'expenses' && (
          <div className="v2-hub-panel">
            {sideLoading ? (
              <p className="v2-meta">Henter utgifter…</p>
            ) : (
              <>
                <JourneyExpensesView summary={expenseSummary} />
                <p className="v2-meta" style={{ marginTop: '1rem' }}>
                  Registrer priser under hotell, pakke og transport i{' '}
                  <button
                    type="button"
                    className="v2-text-link"
                    onClick={() => setTab('plan')}
                  >
                    Plan
                  </button>
                  .
                </p>
              </>
            )}
          </div>
        )}
      </div>
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
  }: {
    title: string
    total: number
    lines: TripExpenseSummary['cruise']['lines']
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
                  {line.date ? (
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
        </p>
      </div>

      <div className="expense-cruise-avg">
        <span>Pakke snitt per dag</span>
        <strong>
          {summary.cruise.days > 0
            ? formatExpenseAmount(summary.cruise.avgPerDay)
            : '—'}
        </strong>
        {summary.cruise.days > 0 ? (
          <span className="meta">
            {formatExpenseAmount(summary.cruise.total)} over{' '}
            {summary.cruise.days}{' '}
            {summary.cruise.days === 1 ? 'dag' : 'dager'}
          </span>
        ) : (
          <span className="meta">Ingen pakkepris ennå</span>
        )}
      </div>

      <CategoryBlock
        title="Pakker / cruise"
        total={summary.cruise.total}
        lines={summary.cruise.lines}
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

      {summary.byDay.length > 0 && (
        <div className="expense-category">
          <div className="expense-category-head">
            <h3>Per dag</h3>
          </div>
          <ul className="expense-lines">
            {summary.byDay.map((d) => (
              <li key={d.date}>
                <span className="expense-line-title">
                  {d.date}
                  {d.place ? (
                    <span className="meta"> · {d.place}</span>
                  ) : null}
                </span>
                <span className="expense-line-amount">
                  {formatExpenseAmount(d.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
