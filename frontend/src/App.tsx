import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react'
import {
  api,
  ApiError,
  AT_SEA_LABEL,
  atSeaPlaceFields,
  emptyDay,
  groupDaysByCity,
  isAtSeaDay,
  isTransportType,
  itemTypeLabel,
  LEG_MODES,
  legModeLabel,
  cleanCruiseCosts,
  cleanCruiseDayCosts,
  costsForCruiseDay,
  newCruiseActivity,
  newCruiseCost,
  newDayItem,
  newViaPoint,
  setCostsForCruiseDay,
  formatViaRouteDetailed,
  addDaysIso,
  buildCruiseDayPatches,
  cruiseHomePort,
  cruiseNights,
  cruisePortsFromItinerary,
  cruisesCoveringDay,
  cruisesDisembarkingOnDay,
  dayPlaceLabel,
  departurePlaceForDay,
  ensureCruiseDays,
  ensureHotelStayDays,
  formatDeparturesLabel,
  formatShipArriveLabel,
  formatShipDepartLabel,
  formatShipPortTimes,
  formatViaStopTimes,
  mergeDuplicateTripDays,
  resolveShipPortTimes,
  formatHotelPrice,
  formatItemPrice,
  hotelNights,
  hotelCheckoutDate,
  formatHotelStaySpan,
  hotelsCheckingOutOnDay,
  hotelsComSearchUrl,
  hotelsStayingOnDay,
  isHotelsComUrl,
  mergeDayActivityItems,
  modeHasDepartureSchedule,
  nextScheduledDeparture,
  normalizeClockTime,
  normalizeDepartures,
  parseDepartureTimes,
  sortViaPointsByArriveTime,
  summarizeCheckInHotels,
  summarizeCheckoutHotels,
  formatExpenseAmount,
  formatTransportPriceLabel,
  summarizeAttractionTitles,
  summarizeCruiseActivities,
  summarizeCruiseCosts,
  summarizeDayItems,
  summarizeStayingHotels,
  summarizeTransportItems,
  summarizeViaRoute,
  syncRouteLegs,
  emptyTripFeatures,
  insertCalendarDayAfter,
  latestTripDayDate,
  sortTripDays,
  swapTripDayDates,
  tripExpenseSummary,
  tripHasCruise,
  tripHasPackages,
  tripMapRouteKey,
  tripStats,
  type CruiseActivity,
  type CruiseCost,
  type CruiseDayPatch,
  type CruiseStayRef,
  type DayItem,
  type HotelStayRef,
  type TripFeatures,
  type PlaceSuggestion,
  type RouteLeg,
  type ViaPoint,
  type WeatherReport,
  type Trip,
  type TripDay,
  type TripDayInput,
  type TripInput,
} from './api'
import { downloadTripIcs } from './ics'
import { useGoogleAuth } from './googleAuth'
import { googleMapsPlaceUrl } from './googleMaps'
import { CitySuggestFields } from './CitySuggest'
import { TripMap } from './TripMap'

function GoogleLoginButton() {
  const { user, ready, configured, login, logout } = useGoogleAuth()
  if (!configured) return null
  if (!ready) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" disabled>
        Google…
      </button>
    )
  }
  if (user) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm google-user-btn"
        onClick={logout}
        title={`${user.email} — klikk for å logge ut (innlogging huskes til du logger ut)`}
      >
        {user.picture ? (
          <img src={user.picture} alt="" className="google-user-avatar" />
        ) : null}
        <span className="google-user-name">{user.name}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      className="btn btn-soft btn-sm"
      onClick={login}
      title="Logg inn med Google — innloggingen huskes i denne nettleseren"
    >
      Logg inn med Google
    </button>
  )
}

type View =
  | { name: 'home' }
  | { name: 'trip'; tripId: string; tab: TripTab }
  | { name: 'day'; tripId: string; dayId: string | 'new' }
  | { name: 'city'; tripId: string; cityKey: string }
  | { name: 'expenses'; tripId: string }

type TripTab = 'liste' | 'kalender' | 'tidslinje' | 'byer' | 'kart'

function PencilIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function TransportModeIcon({
  mode,
  size = 18,
}: {
  mode: string
  size?: number
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (mode) {
    case 'walk':
      return (
        <svg {...props}>
          <circle cx="12" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
          <path d="M12 7v4.5" />
          <path d="M9.2 21l2-7.5 2.2 3.2L15.5 21" />
          <path d="M8.5 12.5 12 11.5l3.2 1.8" />
          <path d="M10.2 9.2 8 11.2" />
        </svg>
      )
    case 'taxi':
      return (
        <svg {...props}>
          <path d="M4.5 11.5h15l-1.2-3.2a2 2 0 0 0-1.9-1.3H7.6a2 2 0 0 0-1.9 1.3L4.5 11.5Z" />
          <path d="M3.5 11.5h17v5.2a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3v-5.2Z" />
          <circle cx="7.2" cy="16.8" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="16.8" cy="16.8" r="1.15" fill="currentColor" stroke="none" />
          <path d="M9.2 8.2h5.6" />
          <path d="M10.5 5.8h3" />
        </svg>
      )
    case 'bus':
      return (
        <svg {...props}>
          <rect x="5" y="3.5" width="14" height="14.5" rx="2.2" />
          <path d="M5 12.5h14" />
          <path d="M8 17.9v1.8" />
          <path d="M16 17.9v1.8" />
          <path d="M8 6.2h3.2v3.2H8z" />
          <path d="M12.8 6.2H16v3.2h-3.2z" />
          <circle cx="8.2" cy="15.2" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15.8" cy="15.2" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'tram':
      return (
        <svg {...props}>
          <path d="M8 3.5h8" />
          <path d="M12 3.5v2" />
          <rect x="5.5" y="5.5" width="13" height="11" rx="2" />
          <path d="M5.5 12h13" />
          <path d="M8 8h3v2.5H8z" />
          <path d="M13 8h3v2.5h-3z" />
          <circle cx="8.5" cy="14.2" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="14.2" r="0.85" fill="currentColor" stroke="none" />
          <path d="M8 16.5 6.5 20" />
          <path d="M16 16.5 17.5 20" />
          <path d="M5 20.2h14" />
        </svg>
      )
    case 'train':
      return (
        <svg {...props}>
          <rect x="6" y="3.5" width="12" height="13" rx="2.4" />
          <path d="M6 11h12" />
          <path d="M9.2 6.2h5.6v3.2H9.2z" />
          <circle cx="9" cy="13.8" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13.8" r="1" fill="currentColor" stroke="none" />
          <path d="M9 16.5 7.2 20.2" />
          <path d="M15 16.5l1.8 3.7" />
          <path d="M8.5 20.2h7" />
        </svg>
      )
    case 'flight':
      return (
        <svg {...props}>
          <path d="M3.5 13.2 20.5 8.4a1.2 1.2 0 0 1 1.1 2.1L12.8 15.2l-1.4 5.1-2.1-.7 1-4.2-4.8 1.1-1.5 2.4-1.7-.5 1.1-2.8-1.9-1.4Z" />
        </svg>
      )
    case 'boat':
      return (
        <svg {...props}>
          <path d="M4 14.5 12 8.5l8 6" />
          <path d="M3.5 16.2h17l-1.4 2.6a2 2 0 0 1-1.7 1H6.6a2 2 0 0 1-1.7-1L3.5 16.2Z" />
          <path d="M12 8.5V5.8" />
          <path d="M12 5.8h4.2l-1.2 2.2" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M8.5 12h7" />
          <path d="M12 8.5v7" />
        </svg>
      )
  }
}

/** Local clock tick so “neste avgang”-forslag oppdateres uten refresh. */
function useNowTick(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Text time input: "1800" → "18:00" while typing; "930" → "09:30" on blur. */
function ClockTimeInput({
  value,
  onChange,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>) {
  function commit(raw: string) {
    const next = normalizeClockTime(raw)
    if (next !== raw) onChange(next)
  }

  return (
    <input
      {...rest}
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw)
        // Only auto-format complete 4-digit times while typing.
        // Formatting at 3 digits turned "1100" into "01:10" + "0" → "01:100".
        if (/^\d{4}$/.test(raw.trim())) {
          commit(raw)
        }
      }}
      onBlur={() => commit(value)}
    />
  )
}

/**
 * Timetable for bus/tram/train: first = preferred, rest = fallbacks.
 * Fallbacks are suggestions only — accepting one sets planned startTime.
 */
function LegDeparturesField({
  times,
  dayDate,
  onChange,
  onAcceptSuggested,
}: {
  times: string[] | undefined
  dayDate: string
  onChange: (next: string[]) => void
  onAcceptSuggested: (suggested: string) => void
}) {
  const [draft, setDraft] = useState('')
  const now = useNowTick()
  const list = normalizeDepartures(times)
  const suggestion = nextScheduledDeparture(dayDate, list, now)

  function commit(raw: string) {
    const added = parseDepartureTimes(raw)
    if (!added.length) return
    onChange(normalizeDepartures([...list, ...added]))
    setDraft('')
  }

  return (
    <div className="full leg-departures-field">
      <label>
        Avganger
        <span className="meta">
          {' '}
          · første er planen, resten om den går forbi
        </span>
        <div className="leg-departures">
          {list.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`leg-departure-chip${i === 0 ? ' is-preferred' : ''}${
                suggestion?.suggested === t ? ' is-suggested' : ''
              }`}
              title={i === 0 ? 'Planlagt avgang (fjern)' : `Reserve — fjern ${t}`}
              aria-label={
                i === 0 ? `Fjern planlagt avgang ${t}` : `Fjern reserve ${t}`
              }
              onClick={() => onChange(list.filter((x) => x !== t))}
            >
              {i === 0 ? `${t} ★` : t}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <input
            className="leg-departures-input"
            value={draft}
            placeholder="14:05 14:50 …"
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                commit(draft)
              }
            }}
            onBlur={() => {
              if (draft.trim()) commit(draft)
            }}
          />
        </div>
      </label>
      {suggestion && (
        <div className="leg-departure-suggest">
          <span>
            {suggestion.preferred} er passert — neste:{' '}
            <strong>{suggestion.suggested}</strong>
          </span>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => onAcceptSuggested(suggestion.suggested)}
          >
            Bruk {suggestion.suggested}
          </button>
        </div>
      )}
    </div>
  )
}

function TransportBadge({
  mode,
  label,
  detail,
}: {
  mode: string
  label?: string
  detail?: string
}) {
  return (
    <span className={`via-summary-transport mode-${mode || 'other'}`}>
      <TransportModeIcon mode={mode || 'other'} size={16} />
      <span>
        {label || legModeLabel(mode)}
        {detail ? ` · ${detail}` : ''}
      </span>
    </span>
  )
}

function LegTransportSummary({
  leg,
  dayDate,
  onAcceptSuggested,
}: {
  leg: RouteLeg
  dayDate: string
  onAcceptSuggested?: (suggested: string) => void
}) {
  const now = useNowTick()
  const schedule = modeHasDepartureSchedule(leg.mode)
  const suggestion =
    schedule && onAcceptSuggested
      ? nextScheduledDeparture(dayDate, leg.departures, now)
      : null
  const reserves = normalizeDepartures(leg.departures).slice(1)
  const detail = [
    leg.title?.trim(),
    [leg.startTime, leg.endTime].filter(Boolean).join('–'),
    reserves.length ? `reserve ${reserves.join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="leg-transport-summary">
      <TransportBadge mode={leg.mode} detail={detail || undefined} />
      {suggestion && onAcceptSuggested && (
        <button
          type="button"
          className="leg-departure-suggest-inline"
          onClick={() => onAcceptSuggested(suggestion.suggested)}
          title={`Bruk neste avgang ${suggestion.suggested}`}
        >
          Neste {suggestion.suggested}
        </button>
      )}
    </div>
  )
}

function HotelIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 20.5h17" />
      <path d="M5 20.5V8.2a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 8.2v12.3" />
      <path d="M5 11.5h14" />
      <path d="M8 9.2V7.4" />
      <path d="M12 9.2V7.4" />
      <path d="M16 9.2V7.4" />
      <path d="M8.2 14.2h2.2v2.2H8.2z" />
      <path d="M13.6 14.2h2.2v2.2h-2.2z" />
      <path d="M9.5 4.8h5" />
    </svg>
  )
}

function ShipIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 17.5c1.5 1.2 3.2 1.8 5 1.8s3.5-.6 5-1.8c1.5 1.2 3.2 1.8 5 1.8" />
      <path d="M4.5 17.5 6 10.5h12l1.5 7" />
      <path d="M12 10.5V6.5" />
      <path d="M12 6.5h4.5l-1.2 4" />
      <path d="M8.5 10.5V8.2h3.5" />
    </svg>
  )
}

function mergeCruiseItinerary(
  embarkDate: string,
  cruise: DayItem,
  tripDays: TripDay[],
  embarkForm: Pick<
    TripDay,
    'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
  >,
  previous?: CruiseDayPatch[],
): CruiseDayPatch[] {
  const base = buildCruiseDayPatches(embarkDate, cruise, tripDays, embarkForm)
  if (!previous?.length) return base
  const prevByDate = new Map(previous.map((p) => [p.date, p]))
  return base.map((row) => {
    const old = prevByDate.get(row.date)
    if (!old) return row
    return {
      date: row.date,
      atSea: old.atSea,
      city: old.atSea ? AT_SEA_LABEL : old.city,
      country: old.atSea ? '' : old.country,
      arriveTime: old.atSea ? '' : old.arriveTime || '',
      leaveTime: old.atSea ? '' : old.leaveTime || '',
    }
  })
}

function CompactActivityFields({
  title,
  startTime,
  url,
  notes,
  titlePlaceholder,
  onChange,
  onRemove,
}: {
  title: string
  startTime: string
  url: string
  notes: string
  titlePlaceholder?: string
  onChange: (patch: {
    title?: string
    startTime?: string
    url?: string
    notes?: string
  }) => void
  onRemove: () => void
}) {
  return (
    <div className="cruise-activity-row">
      <label>
        Aktivitet
        <input
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={titlePlaceholder || 'Utflukt, show, middag…'}
        />
      </label>
      <label>
        Tid
        <ClockTimeInput
          value={startTime}
          onChange={(v) => onChange({ startTime: v })}
          placeholder="10:00"
        />
      </label>
      <label className="cruise-activity-wide">
        Lenke
        <input
          type="url"
          value={url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://"
        />
      </label>
      <label className="cruise-activity-wide">
        Notat
        <input
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Billett, møtested…"
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-sm cruise-activity-remove"
        onClick={onRemove}
      >
        Fjern
      </button>
    </div>
  )
}

function CompactCostFields({
  title,
  price,
  notes,
  titlePlaceholder,
  onChange,
  onRemove,
}: {
  title: string
  price: string
  notes: string
  titlePlaceholder?: string
  onChange: (patch: { title?: string; price?: string; notes?: string }) => void
  onRemove: () => void
}) {
  return (
    <div className="cruise-activity-row cruise-cost-row">
      <label>
        Kostnad
        <input
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={titlePlaceholder || 'Drikkepakke, tips, wifi…'}
        />
      </label>
      <label>
        Pris
        <input
          value={price}
          onChange={(e) => onChange({ price: e.target.value })}
          placeholder="500 kr"
          inputMode="decimal"
        />
      </label>
      <label className="cruise-activity-wide">
        Notat
        <input
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Valgfritt"
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-sm cruise-activity-remove"
        onClick={onRemove}
      >
        Fjern
      </button>
    </div>
  )
}

function CruiseItemEditor({
  cruise,
  embarkDate,
  itinerary,
  dayItemsByDate,
  onChange,
  onItineraryChange,
  onDayItemsChange,
  onRemove,
}: {
  cruise: DayItem
  embarkDate: string
  itinerary: CruiseDayPatch[]
  dayItemsByDate: Record<string, DayItem[]>
  onChange: (cruise: DayItem) => void
  onItineraryChange: (rows: CruiseDayPatch[]) => void
  onDayItemsChange: (date: string, items: DayItem[]) => void
  onRemove: () => void
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const nights = cruiseNights(cruise)
  const home = cruiseHomePort(cruise)
  const disembarkDate = embarkDate ? addDaysIso(embarkDate, nights) : ''
  const activities = cruise.activities || []
  const costs = cruise.costs || []

  function setField<K extends keyof DayItem>(key: K, value: DayItem[K]) {
    onChange({ ...cruise, [key]: value })
  }

  function setActivities(next: CruiseActivity[]) {
    onChange({
      ...cruise,
      activities: next.map((a, i) => ({ ...a, sortOrder: i })),
    })
  }

  function setCosts(next: CruiseCost[]) {
    onChange({
      ...cruise,
      costs: next.map((c, i) => ({ ...c, sortOrder: i })),
    })
  }

  function addWholeCruiseActivity() {
    setActivities([...activities, newCruiseActivity(activities.length)])
  }

  function updateWholeCruiseActivity(
    id: string,
    patch: Partial<CruiseActivity>,
  ) {
    setActivities(
      activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    )
  }

  function removeWholeCruiseActivity(id: string) {
    setActivities(activities.filter((a) => a.id !== id))
  }

  function addWholeCruiseCost() {
    setCosts([...costs, newCruiseCost(costs.length)])
  }

  function updateWholeCruiseCost(id: string, patch: Partial<CruiseCost>) {
    setCosts(costs.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeWholeCruiseCost(id: string) {
    setCosts(costs.filter((c) => c.id !== id))
  }

  function dayActs(date: string): DayItem[] {
    return dayItemsByDate[date] || []
  }

  function dayCosts(date: string): CruiseCost[] {
    return costsForCruiseDay(cruise.dayCosts, date)
  }

  function setDayCosts(date: string, next: CruiseCost[]) {
    onChange({
      ...cruise,
      dayCosts: setCostsForCruiseDay(cruise.dayCosts, date, next),
    })
  }

  function addDayCost(date: string) {
    const current = dayCosts(date)
    setDayCosts(date, [...current, newCruiseCost(current.length)])
  }

  function updateDayCost(
    date: string,
    id: string,
    patch: Partial<CruiseCost>,
  ) {
    setDayCosts(
      date,
      dayCosts(date).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    )
  }

  function removeDayCost(date: string, id: string) {
    setDayCosts(
      date,
      dayCosts(date).filter((c) => c.id !== id),
    )
  }

  function addDayActivity(date: string) {
    const current = dayActs(date)
    onDayItemsChange(date, [
      ...current,
      newDayItem('attraction', current.length),
    ])
  }

  function updateDayActivity(
    date: string,
    id: string,
    patch: Partial<DayItem>,
  ) {
    onDayItemsChange(
      date,
      dayActs(date).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    )
  }

  function removeDayActivity(date: string, id: string) {
    onDayItemsChange(
      date,
      dayActs(date).filter((item) => item.id !== id),
    )
  }

  function setHomePort(port: string, country?: string) {
    onChange({ ...cruise, from: port, to: port })
    if (!itinerary.length) return
    onItineraryChange(
      itinerary.map((row, i) => {
        const isEnd = i === 0 || i === itinerary.length - 1
        if (!isEnd || row.atSea) return row
        return {
          ...row,
          city: port,
          country:
            country !== undefined && country !== ''
              ? country
              : row.country,
        }
      }),
    )
  }

  const homeCountry =
    itinerary[0]?.country?.trim() ||
    itinerary[itinerary.length - 1]?.country?.trim() ||
    ''

  function setNights(value: number) {
    const nextNights = Math.max(1, Math.min(60, Math.floor(value) || 1))
    onChange({ ...cruise, nights: nextNights })
  }

  function setEmbarkTime(value: string) {
    if (!itinerary.length) {
      setField('startTime', value)
      return
    }
    onItineraryChange(
      itinerary.map((row, i) =>
        i === 0 && !row.atSea ? { ...row, leaveTime: value } : row,
      ),
    )
  }

  function setDisembarkTime(value: string) {
    if (itinerary.length < 1) {
      setField('endTime', value)
      return
    }
    const last = itinerary.length - 1
    onItineraryChange(
      itinerary.map((row, i) =>
        i === last && !row.atSea ? { ...row, arriveTime: value } : row,
      ),
    )
  }

  function updateRow(idx: number, patch: Partial<CruiseDayPatch>) {
    const nextRows = itinerary.map((row, i) => {
      if (i !== idx) return row
      const next = { ...row, ...patch }
      if (next.atSea) {
        next.city = AT_SEA_LABEL
        next.country = ''
        next.arriveTime = ''
        next.leaveTime = ''
      }
      return next
    })
    // Parent syncs embark/disembark + cruisePorts from the full itinerary.
    onItineraryChange(nextRows)
  }

  return (
    <div className="item-card item-cruise via-inline-editor">
      <div className="form-grid cruise-form-grid">
        <div className="cruise-title-row full">
          <label className="cruise-ship-field">
            Skip
            <input
              autoFocus
              value={cruise.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="MSC Orchestra"
            />
          </label>
          <div className="cruise-home-field">
            <CitySuggestFields
              className="city-suggest-cruise city-suggest-home-port"
              hideHint
              cityLabel="Hjemhavn"
              city={home}
              country={homeCountry}
              cityPlaceholder="Barcelona"
              countryPlaceholder="Spania"
              onCityChange={(city) => setHomePort(city)}
              onCountryChange={(country) => setHomePort(home, country)}
              onSelectPlace={(city, country) => setHomePort(city, country)}
            />
          </div>
          <label className="cruise-nights-field">
            Netter
            <input
              type="number"
              min={1}
              max={60}
              value={nights}
              onChange={(e) => setNights(Number(e.target.value) || 1)}
            />
          </label>
        </div>
        <div className="cruise-timing-row full">
          <label>
            Embark
            <ClockTimeInput
              value={cruise.startTime || ''}
              onChange={setEmbarkTime}
              placeholder="16:00"
            />
          </label>
          <label>
            Disembark
            <ClockTimeInput
              value={cruise.endTime || ''}
              onChange={setDisembarkTime}
              placeholder="08:00"
            />
          </label>
          <label className="cruise-cabin-field">
            Lugar
            <input
              value={cruise.cabinNumber || ''}
              onChange={(e) => setField('cabinNumber', e.target.value)}
              placeholder="8271"
              autoComplete="off"
            />
          </label>
          <label className="cruise-price-field">
            Pris
            <input
              value={cruise.price || ''}
              onChange={(e) => setField('price', e.target.value)}
              placeholder="12000 kr"
              inputMode="decimal"
            />
          </label>
        </div>
        {embarkDate && disembarkDate && (
          <p className="meta full cruise-date-range">
            {formatDateNO(embarkDate)} → {formatDateNO(disembarkDate)} (
            {nights} {nights === 1 ? 'natt' : 'netter'})
          </p>
        )}
        <label>
          Lenke
          <input
            type="url"
            value={cruise.url || ''}
            onChange={(e) => setField('url', e.target.value)}
            placeholder="https://"
          />
        </label>
        <label>
          Notat
          <input
            value={cruise.notes || ''}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </div>

      <div className="cruise-activities-block">
        <div className="cruise-activities-head">
          <h4 className="cruise-itinerary-title">For hele cruiset</h4>
          <div className="cruise-activities-actions">
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={addWholeCruiseActivity}
            >
              + Aktivitet
            </button>
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={addWholeCruiseCost}
            >
              + Kostnad
            </button>
          </div>
        </div>
        {activities.length === 0 && costs.length === 0 ? (
          <p className="meta cruise-activities-empty">
            Aktiviteter og ekstra kostnader som gjelder hele seilasen.
          </p>
        ) : null}
        {activities.length > 0 && (
          <div className="cruise-activities-list">
            {activities.map((act) => (
              <CompactActivityFields
                key={act.id}
                title={act.title}
                startTime={act.startTime || ''}
                url={act.url || ''}
                notes={act.notes || ''}
                onChange={(patch) => updateWholeCruiseActivity(act.id, patch)}
                onRemove={() => removeWholeCruiseActivity(act.id)}
              />
            ))}
          </div>
        )}
        {costs.length > 0 && (
          <div className="cruise-activities-list">
            {costs.map((cost) => (
              <CompactCostFields
                key={cost.id}
                title={cost.title}
                price={cost.price || ''}
                notes={cost.notes || ''}
                onChange={(patch) => updateWholeCruiseCost(cost.id, patch)}
                onRemove={() => removeWholeCruiseCost(cost.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="cruise-itinerary">
        <h4 className="cruise-itinerary-title">Seilingsplan</h4>
        <div className="cruise-itinerary-list">
          {itinerary.map((row, idx) => {
            const rowActs = dayActs(row.date)
            const rowCosts = dayCosts(row.date)
            return (
              <div
                key={row.date || idx}
                className={[
                  'cruise-itinerary-row',
                  row.atSea ? 'is-at-sea' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="cruise-itinerary-head">
                  <span className="cruise-itinerary-date">
                    {formatDateNO(row.date) || `Dag ${idx + 1}`}
                    {idx === 0 ? ' · Embark' : ''}
                    {idx === itinerary.length - 1 && itinerary.length > 1
                      ? ' · Disembark'
                      : ''}
                  </span>
                  <label className="cruise-at-sea-toggle">
                    <input
                      type="checkbox"
                      checked={row.atSea}
                      onChange={(e) =>
                        updateRow(idx, {
                          atSea: e.target.checked,
                          city: e.target.checked
                            ? AT_SEA_LABEL
                            : row.city === AT_SEA_LABEL
                              ? home
                              : row.city || home,
                        })
                      }
                    />
                    Er hele dagen til sjøs
                  </label>
                </div>
                {!row.atSea && (
                  <div className="cruise-itinerary-body">
                    <CitySuggestFields
                      className="city-suggest-cruise"
                      hideHint
                      city={row.city === AT_SEA_LABEL ? '' : row.city}
                      country={row.country}
                      cityLabel="Havn"
                      cityPlaceholder={home || 'Havn'}
                      countryPlaceholder="Spania"
                      onCityChange={(city) => updateRow(idx, { city })}
                      onCountryChange={(country) =>
                        updateRow(idx, { country })
                      }
                      onSelectPlace={(city, country) =>
                        updateRow(idx, { city, country, atSea: false })
                      }
                    />
                    <div className="cruise-port-times">
                      <label>
                        Ankomst
                        <ClockTimeInput
                          value={row.arriveTime || ''}
                          onChange={(v) => updateRow(idx, { arriveTime: v })}
                          placeholder={idx === 0 ? '—' : '08:00'}
                          disabled={idx === 0}
                          title={
                            idx === 0
                              ? 'Embark-dagen har vanligvis ingen ankomst'
                              : undefined
                          }
                        />
                      </label>
                      <label>
                        Avgang
                        <ClockTimeInput
                          value={row.leaveTime || ''}
                          onChange={(v) => updateRow(idx, { leaveTime: v })}
                          placeholder={
                            idx === itinerary.length - 1 ? '—' : '18:00'
                          }
                          disabled={idx === itinerary.length - 1}
                          title={
                            idx === itinerary.length - 1
                              ? 'Disembark-dagen har vanligvis ingen avgang'
                              : undefined
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
                <div className="cruise-day-activities">
                  <div className="cruise-activities-head">
                    <span className="cruise-day-activities-label">
                      Aktiviteter
                      {rowActs.length ? ` (${rowActs.length})` : ''}
                    </span>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => addDayActivity(row.date)}
                    >
                      + Aktivitet
                    </button>
                  </div>
                  {rowActs.length > 0 && (
                    <div className="cruise-activities-list">
                      {rowActs.map((act) => (
                        <CompactActivityFields
                          key={act.id}
                          title={act.title}
                          startTime={act.startTime || ''}
                          url={act.url || ''}
                          notes={act.notes || ''}
                          titlePlaceholder={
                            row.atSea
                              ? 'Show, spa, middag…'
                              : 'Utflukt, byvandring…'
                          }
                          onChange={(patch) =>
                            updateDayActivity(row.date, act.id, patch)
                          }
                          onRemove={() => removeDayActivity(row.date, act.id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="cruise-activities-head">
                    <span className="cruise-day-activities-label">
                      Kostnader
                      {rowCosts.length ? ` (${rowCosts.length})` : ''}
                    </span>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => addDayCost(row.date)}
                    >
                      + Kostnad
                    </button>
                  </div>
                  {rowCosts.length > 0 && (
                    <div className="cruise-activities-list">
                      {rowCosts.map((cost) => (
                        <CompactCostFields
                          key={cost.id}
                          title={cost.title}
                          price={cost.price || ''}
                          notes={cost.notes || ''}
                          titlePlaceholder={
                            row.atSea
                              ? 'Wifi, drikkepakke…'
                              : 'Utflukt, taxi i havn…'
                          }
                          onChange={(patch) =>
                            updateDayCost(row.date, cost.id, patch)
                          }
                          onRemove={() => removeDayCost(row.date, cost.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="cruise-remove-block">
        {!confirmRemove ? (
          <button
            type="button"
            className="btn btn-ghost cruise-remove-trigger"
            onClick={() => setConfirmRemove(true)}
          >
            Fjern cruise…
          </button>
        ) : (
          <div className="cruise-remove-confirm">
            <p className="meta">
              Fjerne {cruise.title?.trim() || 'dette cruise'}? Seilingsplanen
              og koblingen til dagene blir borte. Dette kan ikke angres herfra.
            </p>
            <div className="toolbar">
              <button
                type="button"
                className="btn btn-danger"
                onClick={onRemove}
              >
                Ja, fjern cruise
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setConfirmRemove(false)}
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Display dates as Norwegian DD.MM.YYYY (storage stays YYYY-MM-DD). */
function formatDateNO(iso: string) {
  if (!iso) return ''
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string) {
  if (!start && !end) return 'Uten datoer'
  if (start && end) return `${formatDateNO(start)} – ${formatDateNO(end)}`
  return formatDateNO(start || end)
}

function formatNiceDate(iso: string) {
  if (!iso) return 'Uten dato'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return formatDateNO(iso) || iso
  const weekday = d.toLocaleDateString('nb-NO', { weekday: 'long' })
  return `${weekday} ${formatDateNO(iso)}`
}

/** Weekday labels with Monday as first day of the week (Norwegian). */
const WEEKDAYS_MON_FIRST = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'] as const

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

/** JS getDay(): Sun=0 … Sat=6 → offset where Monday is column 0. */
function mondayFirstOffset(year: number, month: number) {
  const sundayBased = new Date(year, month, 1).getDay()
  return (sundayBased + 6) % 7
}

function toISODate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonthCells(year: number, month: number) {
  const offset = mondayFirstOffset(year, month)
  const total = daysInMonth(year, month)
  const cells: Array<{ dayNum: number | null; date: string }> = []
  for (let i = 0; i < offset; i++) cells.push({ dayNum: null, date: '' })
  for (let d = 1; d <= total; d++) {
    cells.push({ dayNum: d, date: toISODate(year, month, d) })
  }
  return cells
}

function DatePickerField({
  value,
  onChange,
  required = false,
  id,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date()
  const initialYear = Number.isNaN(parsed.getTime())
    ? new Date().getFullYear()
    : parsed.getFullYear()
  const initialMonth = Number.isNaN(parsed.getTime())
    ? new Date().getMonth()
    : parsed.getMonth()
  const [viewYear, setViewYear] = useState(initialYear)
  const [viewMonth, setViewMonth] = useState(initialMonth)

  useEffect(() => {
    if (!open) return
    const d = value ? new Date(`${value}T12:00:00`) : new Date()
    if (!Number.isNaN(d.getTime())) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [open, value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = buildMonthCells(viewYear, viewMonth)
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('nb-NO', {
    month: 'long',
    year: 'numeric',
  })

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="date-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? formatDateNO(value) : 'Velg dato'}
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="date-picker-required"
          value={value}
          onChange={() => undefined}
          required
        />
      )}
      {open && (
        <div className="date-picker-dropdown" role="dialog" aria-label="Velg dato">
          <div className="date-picker-nav">
            <button type="button" className="btn btn-soft" onClick={() => shiftMonth(-1)}>
              Forrige
            </button>
            <span className="date-picker-month">{monthLabel}</span>
            <button type="button" className="btn btn-soft" onClick={() => shiftMonth(1)}>
              Neste
            </button>
          </div>
          <div className="calendar date-picker-grid">
            {WEEKDAYS_MON_FIRST.map((d) => (
              <div key={d} className="calendar-head">
                {d}
              </div>
            ))}
            {cells.map((cell, idx) =>
              cell.dayNum ? (
                <button
                  key={cell.date}
                  type="button"
                  className={`calendar-cell date-picker-day ${
                    cell.date === value ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    onChange(cell.date)
                    setOpen(false)
                  }}
                >
                  <span className="calendar-daynum">{cell.dayNum}</span>
                </button>
              ) : (
                <div key={`e-${idx}`} className="calendar-cell empty" />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ExpensesView({ days }: { days: TripDay[] }) {
  const summary = useMemo(() => tripExpenseSummary(days), [days])

  function CategoryBlock({
    title,
    total,
    lines,
  }: {
    title: string
    total: number
    lines: {
      id: string
      title: string
      date?: string
      amount: number
      rawPrice: string
      isActual?: boolean
      expectedRaw?: string
    }[]
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
                    <span className="meta"> · {formatDateNO(line.date)}</span>
                  ) : null}
                  {line.isActual ? (
                    <span className="meta">
                      {' '}
                      · faktisk
                      {line.expectedRaw
                        ? ` (forv. ${line.expectedRaw})`
                        : ''}
                    </span>
                  ) : line.expectedRaw === undefined && title === 'Transport' ? (
                    <span className="meta"> · forventet</span>
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
          Cruise {formatExpenseAmount(summary.cruise.total)}
          {' · '}
          Hotell {formatExpenseAmount(summary.hotel.total)}
          {' · '}
          Transport {formatExpenseAmount(summary.transport.total)}
        </p>
      </div>

      <div className="expense-cruise-avg">
        <span>Cruise snitt per dag</span>
        <strong>
          {summary.cruise.days > 0
            ? formatExpenseAmount(summary.cruise.avgPerDay)
            : '—'}
        </strong>
        {summary.cruise.days > 0 ? (
          <span className="meta">
            {formatExpenseAmount(summary.cruise.total)} over{' '}
            {summary.cruise.days}{' '}
            {summary.cruise.days === 1 ? 'dag' : 'dager'} (etter netter om
            bord)
          </span>
        ) : (
          <span className="meta">Ingen cruisepris ennå</span>
        )}
      </div>

      <CategoryBlock
        title="Cruise"
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

      <div className="expense-by-day">
        <h3 className="expense-by-day-title">Per dag</h3>
        <p className="meta expense-by-day-hint">
          Generelt for cruise (billett og kostnader for hele cruiset) og hotell
          fordeles jevnt over nettene. Kostnader registrert på en cruisedag, og
          transport, vises bare den dagen.
        </p>
        {summary.byDay.length === 0 ? (
          <p className="meta expense-empty">Ingen dagsutgifter ennå</p>
        ) : (
          <ul className="expense-day-list">
            {summary.byDay.map((day) => {
              const parts = [
                day.cruise > 0
                  ? `Cruise ${formatExpenseAmount(day.cruise)}`
                  : '',
                day.hotel > 0
                  ? `Hotell ${formatExpenseAmount(day.hotel)}`
                  : '',
                day.transport > 0
                  ? `Transport ${formatExpenseAmount(day.transport)}`
                  : '',
              ].filter(Boolean)
              return (
                <li key={day.date} className="expense-day-row">
                  <div className="expense-day-main">
                    <div className="expense-day-head">
                      <span className="expense-day-date">
                        {formatNiceDate(day.date)}
                        {day.place && day.place !== 'Uten by'
                          ? ` · ${day.place}`
                          : ''}
                      </span>
                      <strong className="expense-day-total">
                        {formatExpenseAmount(day.total)}
                      </strong>
                    </div>
                    {parts.length > 0 ? (
                      <span className="meta">{parts.join(' · ')}</span>
                    ) : null}
                    {day.lines.length > 0 ? (
                      <ul className="expense-day-lines">
                        {day.lines.map((line) => (
                          <li key={line.id}>
                            <span>{line.title}</span>
                            <span className="expense-line-amount">
                              {formatExpenseAmount(line.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="meta expense-footnote">
        Summerer tall fra prisfeltene (f.eks. «12000 kr»). For transport brukes
        faktisk kostnad når den er fylt inn, ellers forventet pris. Blandede
        valutaer summeres som tall uten omregning.
        {summary.unparsedCount > 0
          ? ` ${summary.unparsedCount} pris${
              summary.unparsedCount === 1 ? '' : 'er'
            } kunne ikke tolkes.`
          : ''}
      </p>
    </div>
  )
}

function CalendarView({
  days,
  onOpenDay,
}: {
  days: TripDay[]
  onOpenDay: (id: string) => void
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, TripDay[]>()
    for (const day of days) {
      const list = map.get(day.date) || []
      list.push(day)
      map.set(day.date, list)
    }
    return map
  }, [days])

  const anchor = days[0]?.date || new Date().toISOString().slice(0, 10)
  const anchorDate = new Date(`${anchor}T12:00:00`)
  const year = anchorDate.getFullYear()
  const month = anchorDate.getMonth()
  const cells = buildMonthCells(year, month)

  const monthLabel = anchorDate.toLocaleDateString('nb-NO', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="stack">
      <p className="section-sub" style={{ marginBottom: 0, textTransform: 'capitalize' }}>
        {monthLabel}
      </p>
      <div className="calendar">
        {WEEKDAYS_MON_FIRST.map((d) => (
          <div key={d} className="calendar-head">
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.dayNum) {
            return <div key={`e-${idx}`} className="calendar-cell empty" />
          }
          const dayList = byDate.get(cell.date) || []
          const first = dayList[0]
          return (
            <button
              key={cell.date}
              type="button"
              className={`calendar-cell ${first ? 'has-day' : ''}`}
              onClick={() => first && onOpenDay(first.id)}
              disabled={!first}
            >
              <span className="calendar-daynum">{cell.dayNum}</span>
              {first && (
                <span
                  className="calendar-city"
                  title={
                    dayPlaceLabel(first) === 'Uten by'
                      ? first.country || 'Dag'
                      : dayPlaceLabel(first)
                  }
                >
                  {dayPlaceLabel(first) === 'Uten by'
                    ? first.country || 'Dag'
                    : dayPlaceLabel(first)}
                  {dayList.length > 1 ? ` +${dayList.length - 1}` : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeatherIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (icon) {
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
        </svg>
      )
    case 'cloud-sun':
      return (
        <svg {...props}>
          <circle cx="8.2" cy="8.2" r="2.4" />
          <path d="M8.2 3.2v1.3M3.2 8.2h1.3M4.4 4.4l.9.9" />
          <path d="M8.5 15.5h8.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.3 1.5 2.7 2.7 0 0 0-.1 4.9Z" />
        </svg>
      )
    case 'cloud':
    case 'fog':
      return (
        <svg {...props}>
          <path d="M7.5 17h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6A2.9 2.9 0 0 0 7.5 17Z" />
          {icon === 'fog' && <path d="M6.5 19.5h11M8 21.2h8" />}
        </svg>
      )
    case 'drizzle':
    case 'rain':
      return (
        <svg {...props}>
          <path d="M7.5 14.2h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6 2.9 2.9 0 0 0-.4 5.2Z" />
          <path d="M9.2 17.2v2.4M12 16.6v3.2M14.8 17.2v2.4" />
        </svg>
      )
    case 'snow':
      return (
        <svg {...props}>
          <path d="M7.5 14.2h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6 2.9 2.9 0 0 0-.4 5.2Z" />
          <path d="M9.2 17.5h0.1M12 18.4h0.1M14.8 17.5h0.1" strokeWidth="2.4" />
        </svg>
      )
    case 'thunder':
      return (
        <svg {...props}>
          <path d="M7.5 13.5h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6 2.9 2.9 0 0 0-.4 5.2Z" />
          <path d="m11 14.2 2.2 3.2h-2.1L12.8 21" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <path d="M7.5 17h9.2a3.4 3.4 0 0 0 .2-6.8 4.7 4.7 0 0 0-9 1.6A2.9 2.9 0 0 0 7.5 17Z" />
        </svg>
      )
  }
}

const WEATHER_SOURCE_LABEL = 'Open-Meteo'

function openMeteoForecastUrl(lat?: number, lon?: number) {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return 'https://open-meteo.com/'
  }
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    forecast_days: '16',
    timezone: 'auto',
  })
  return `https://open-meteo.com/en/docs#${params.toString()}`
}

function isTodayISO(iso: string): boolean {
  if (!iso.trim()) return false
  const trip = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(trip.getTime())) return false
  const today = new Date()
  return (
    trip.getFullYear() === today.getFullYear() &&
    trip.getMonth() === today.getMonth() &&
    trip.getDate() === today.getDate()
  )
}

function isPastISO(iso: string): boolean {
  if (!iso.trim() || isTodayISO(iso)) return false
  const trip = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(trip.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return trip < today
}

function dayToneClass(iso: string): string {
  if (isTodayISO(iso)) return 'is-today'
  if (isPastISO(iso)) return 'is-past'
  return ''
}

/** True when trip date is today or within the next 6 days (7-day window). */
function isWithinNext7Days(iso: string): boolean {
  if (!iso.trim()) return false
  const trip = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(trip.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return trip >= today && trip <= end
}

function placeSuggestionLabel(place: PlaceSuggestion): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ')
}

function DayWeatherCard({
  city,
  country,
  date = '',
  compact = false,
  onSelectPlace,
}: {
  city: string
  country: string
  /** Arrival / trip day — weather is always for this date when available. */
  date?: string
  compact?: boolean
  /** When geocoding fails, user can pick a suggested place. */
  onSelectPlace?: (city: string, country: string) => void
}) {
  const [weather, setWeather] = useState<WeatherReport | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const arrivalInRange = isWithinNext7Days(date)

  useEffect(() => {
    if (!city.trim()) {
      setWeather(null)
      setStatus('idle')
      setError('')
      setSuggestions([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setStatus('loading')
      setError('')
      setSuggestions([])
      void api
        .getWeather(city.trim(), country.trim(), {
          // Need week forecast whenever arrival day is within Open-Meteo window.
          week: arrivalInRange,
          date: date.trim() || undefined,
        })
        .then((result) => {
          if (cancelled) return
          setWeather(result)
          setSuggestions([])
          setStatus('idle')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setWeather(null)
          setStatus('error')
          if (err instanceof ApiError) {
            setError(err.message)
            setSuggestions(err.suggestions)
          } else {
            setError(err instanceof Error ? err.message : 'Kunne ikke hente vær')
            setSuggestions([])
          }
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [city, country, date, arrivalInRange])

  if (!city.trim()) {
    if (compact) return null
    return (
      <div className="weather-card weather-side weather-empty">
        <p className="meta">Oppgi by for vær.</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={`weather-card ${compact ? 'weather-compact' : 'weather-side'}`}>
        <p className="meta">Henter vær…</p>
      </div>
    )
  }

  if (status === 'error') {
    if (compact) return null
    return (
      <div className="weather-card weather-side weather-empty">
        <p className="meta">Vær: {error || 'Fant ikke sted'}</p>
        {suggestions.length > 0 && (
          <div className="weather-suggestions">
            <p className="meta" style={{ margin: 0 }}>
              Mente du:
            </p>
            <div className="weather-suggestion-list">
              {suggestions.map((place) => (
                <button
                  key={`${place.name}-${place.country}-${place.admin1}-${place.latitude}`}
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() =>
                    onSelectPlace?.(place.name, place.country || country)
                  }
                  disabled={!onSelectPlace}
                >
                  {placeSuggestionLabel(place)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!weather) return null

  const arrivalDay =
    weather.requested ||
    weather.days.find((d) => d.date === date) ||
    (isTodayISO(date) ? weather.today : null) ||
    null
  // Fall back to today's weather in the city when trip-day forecast is out of range.
  const displayDay = arrivalDay || weather.today || weather.days[0] || null
  const showingTodayFallback = Boolean(displayDay && !arrivalDay)
  const arrivalIsToday = Boolean(date.trim() && isTodayISO(date) && arrivalDay)
  /** True when the primary figure is live conditions, not the arrival-day band. */
  const showingNow = Boolean(
    weather.current &&
      (showingTodayFallback || arrivalIsToday || (!date.trim() && displayDay?.isToday)),
  )
  const kindLabel = showingNow
    ? 'Nå'
    : arrivalDay
      ? `Ankomst ${formatDateNO(arrivalDay.date)}`
      : displayDay
        ? formatDateNO(displayDay.date)
        : ''
  const sourceHref = openMeteoForecastUrl(weather.latitude, weather.longitude)

  if (compact) {
    if (!displayDay) return null
    const nowTemp = showingNow ? Math.round(weather.current!.temperature) : null
    return (
      <span
        className={`weather-pill${showingNow ? ' is-now' : ' is-arrival'}`}
        title={
          showingTodayFallback
            ? `Nå i ${weather.city}: ${displayDay.summary}` +
              (date.trim()
                ? ` — ankomst ${formatDateNO(date)}: prognose ikke klar ennå`
                : '')
            : showingNow
              ? `Nå i ${weather.city}: ${displayDay.summary}`
              : `Ankomst ${formatDateNO(displayDay.date)} i ${weather.city}: ${displayDay.summary}`
        }
      >
        <span className="weather-pill-kind" aria-hidden="true">
          {showingNow ? 'Nå' : 'Ank.'}
        </span>
        <WeatherIcon icon={displayDay.icon} size={14} />
        {nowTemp !== null
          ? `${nowTemp}°`
          : `${Math.round(displayDay.tempMin)}–${Math.round(displayDay.tempMax)}°`}
      </span>
    )
  }

  if (!displayDay) {
    return (
      <div className="weather-card weather-side weather-empty">
        <p className="meta">
          {date.trim()
            ? `Ankomst ${formatDateNO(date)}: værprognose er ikke tilgjengelig ennå.`
            : 'Velg dato for vær.'}
        </p>
        <p className="weather-source">
          Kilde:{' '}
          <a href={sourceHref} target="_blank" rel="noreferrer">
            {WEATHER_SOURCE_LABEL}
          </a>
        </p>
      </div>
    )
  }

  return (
    <div
      className={`weather-card weather-side${showingNow ? ' is-now' : ' is-arrival'}`}
    >
      <div className="weather-kind-row">
        <span className={`weather-kind-badge${showingNow ? ' is-now' : ' is-arrival'}`}>
          {kindLabel}
        </span>
        {showingTodayFallback && date.trim() && (
          <span className="meta weather-kind-note">
            Ankomst {formatDateNO(date)}: prognose ikke klar
          </span>
        )}
        {arrivalIsToday && weather.current && (
          <span className="meta weather-kind-note">
            Ankomst i dag · {Math.round(displayDay.tempMin)}–
            {Math.round(displayDay.tempMax)}°
          </span>
        )}
      </div>
      <div className="weather-side-top">
        <span className="weather-glyph" title={displayDay.summary}>
          <WeatherIcon icon={displayDay.icon} size={18} />
        </span>
        <div className="weather-side-temps">
          {showingNow ? (
            <strong>{Math.round(weather.current!.temperature)}°</strong>
          ) : (
            <strong>
              {Math.round(displayDay.tempMin)}–{Math.round(displayDay.tempMax)}°
            </strong>
          )}
          <span className="weather-side-summary">{displayDay.summary}</span>
          <span className="meta">
            {weather.city}
            {showingNow && !arrivalIsToday
              ? ` · dag ${Math.round(displayDay.tempMin)}–${Math.round(displayDay.tempMax)}°`
              : ''}
            {` · ${displayDay.precipitation.toFixed(0)} mm`}
          </span>
        </div>
      </div>

      <p className="weather-source">
        Kilde:{' '}
        <a href={sourceHref} target="_blank" rel="noreferrer">
          {WEATHER_SOURCE_LABEL}
        </a>
      </p>
    </div>
  )
}

function itemSummary(item: DayItem): string {
  const bits: string[] = []
  if (isTransportType(item.type) && (item.from || item.to)) {
    bits.push([item.from, item.to].filter(Boolean).join(' → '))
  }
  if (item.address) bits.push(item.address)
  if (item.startTime || item.endTime) {
    bits.push([item.startTime, item.endTime].filter(Boolean).join('–'))
  }
  if (item.type === 'attraction' && item.notes?.trim()) {
    bits.push(item.notes.trim())
  }
  if (isTransportType(item.type)) {
    const price = formatTransportPriceLabel(item)
    if (price) bits.push(price)
  } else {
    const price = formatItemPrice(item)
    if (price) bits.push(price)
  }
  return bits.filter(Boolean).join(' · ')
}

function AttractionIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s6.5-5.2 6.5-11a6.5 6.5 0 1 0-13 0c0 5.8 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  )
}

function DayItemEditor({
  item,
  onChange,
  onRemove,
  dayDate = '',
  city = '',
  country = '',
  embedded = false,
}: {
  item: DayItem
  onChange: (item: DayItem) => void
  onRemove: () => void
  /** Used to show hotel checkout date from overnattinger. */
  dayDate?: string
  /** City/country for Hotels.com search. */
  city?: string
  country?: string
  /** Compact inline editor under a summary row (via-style). */
  embedded?: boolean
}) {
  const transport = isTransportType(item.type)
  const hotel = item.type === 'hotel'
  const packageTour = item.type === 'package'
  const nights = hotelNights(item)
  const checkoutDate =
    hotel && dayDate.trim() ? hotelCheckoutDate(dayDate, nights) : ''
  const staySpan =
    hotel && dayDate.trim()
      ? formatHotelStaySpan(dayDate, item, formatDateNO)
      : ''
  const hotelsComUrl = hotel
    ? hotelsComSearchUrl({
        hotelName: item.title,
        city,
        country,
        checkIn: dayDate,
        checkOut: checkoutDate,
      })
    : ''

  function set<K extends keyof DayItem>(key: K, value: DayItem[K]) {
    onChange({ ...item, [key]: value })
  }

  return (
    <div
      className={`item-card item-${item.type}${
        embedded ? ' via-inline-editor' : ''
      }`}
    >
      {!embedded && (
        <div className="item-card-head">
          <span className={`chip ${hotel ? 'chip-hotel' : ''}`}>
            {hotel && <HotelIcon size={14} />}
            {itemTypeLabel(item.type)}
          </span>
          <button type="button" className="btn btn-soft" onClick={onRemove}>
            Fjern
          </button>
        </div>
      )}
      <div className="form-grid">
        <label className="full">
          {hotel
            ? 'Hotellnavn'
            : packageTour
              ? 'Pakketur / arrangør'
              : transport
                ? 'Navn / rute'
                : 'Navn'}
          <input
            autoFocus={embedded}
            value={item.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={
              hotel
                ? 'Hotel Eden'
                : packageTour
                  ? 'Vin-tur Toscana'
                  : transport
                    ? 'RY 123 / Intercity'
                    : 'Byvandring, museum, utsiktspunkt…'
            }
          />
        </label>
        {transport && (
          <>
            <label>
              Fra
              <input
                value={item.from || ''}
                onChange={(e) => set('from', e.target.value)}
                placeholder="Oslo"
              />
            </label>
            <label>
              Til
              <input
                value={item.to || ''}
                onChange={(e) => set('to', e.target.value)}
                placeholder="Roma"
              />
            </label>
          </>
        )}
        {(hotel || item.type === 'attraction' || packageTour) && (
          <label className="full">
            Adresse
            <input
              value={item.address || ''}
              onChange={(e) => set('address', e.target.value)}
            />
          </label>
        )}
        <label>
          {hotel ? 'Innsjekk-klokkeslett' : transport ? 'Avgang' : 'Tid'}
          <ClockTimeInput
            value={item.startTime || ''}
            onChange={(v) => set('startTime', v)}
            placeholder={hotel ? '15:00' : '10:40'}
          />
        </label>
        <label>
          {hotel ? 'Utsjekk-klokkeslett' : transport ? 'Ankomst' : 'Slutt'}
          <ClockTimeInput
            value={item.endTime || ''}
            onChange={(v) => set('endTime', v)}
            placeholder={hotel ? '11:00' : ''}
          />
        </label>
        {(hotel || packageTour) && (
          <label>
            Overnattinger
            <input
              type="number"
              min={1}
              max={60}
              value={nights}
              onChange={(e) =>
                set('nights', Math.max(1, Number(e.target.value) || 1))
              }
            />
          </label>
        )}
        {(hotel || item.type === 'attraction' || packageTour) && (
          <label>
            Pris
            <input
              value={item.price || ''}
              onChange={(e) => set('price', e.target.value)}
              placeholder={hotel ? '4500 kr' : '15 €'}
              inputMode="decimal"
            />
          </label>
        )}
        {transport && (
          <>
            <label>
              Forventet pris
              <input
                value={item.price || ''}
                onChange={(e) => set('price', e.target.value)}
                placeholder="45 €"
                inputMode="decimal"
              />
            </label>
            <label>
              Faktisk kostnad
              <input
                value={item.actualPrice || ''}
                onChange={(e) => set('actualPrice', e.target.value)}
                placeholder="Fyll inn etterpå"
                inputMode="decimal"
              />
            </label>
          </>
        )}
        {hotel && dayDate.trim() && checkoutDate && (
          <p className="meta full hotel-stay-span" style={{ margin: 0 }}>
            <strong>Opphold:</strong> {staySpan}
            <br />
            Innsjekk-dato {formatDateNO(dayDate)} · Utsjekk-dato{' '}
            {formatDateNO(checkoutDate)}
            {nights > 0 ? (
              <>
                {' '}
                · overnatter{' '}
                {nights === 1
                  ? formatDateNO(dayDate)
                  : `${formatDateNO(dayDate)}–${formatDateNO(
                      addDaysIso(dayDate, nights - 1),
                    )}`}
              </>
            ) : null}
          </p>
        )}
        {hotel ? (
          <div className="full hotel-hotelscom">
            <label>
              Hotels.com
              <input
                type="url"
                value={item.url || ''}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://www.hotels.com/..."
              />
            </label>
            <div className="toolbar hotel-hotelscom-actions">
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => set('url', hotelsComUrl)}
                title="Fyll inn søkelenke med hotell, by og datoer"
              >
                Fyll Hotels.com-søk
              </button>
              <a
                className="btn btn-soft btn-sm"
                href={item.url?.trim() || hotelsComUrl}
                target="_blank"
                rel="noreferrer"
              >
                Åpne Hotels.com
              </a>
            </div>
          </div>
        ) : (
          <label className="full">
            Lenke
            <input
              type="url"
              value={item.url || ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://"
            />
          </label>
        )}
        <label className="full">
          Notat
          <input
            value={item.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
      </div>
      {embedded && (
        <div className="toolbar" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-danger" onClick={onRemove}>
            Fjern
          </button>
        </div>
      )}
    </div>
  )
}

function DayForm({
  initial,
  tripDays,
  tripFeatures,
  onSave,
  onSaveHotelStay,
  onRemoveHotelStay,
  onSaveCruiseStay,
  onRemoveCruiseStay,
  onCancel,
  onDelete,
  onInsertDayAfter,
  saving,
}: {
  initial: TripDayInput & { id?: string }
  tripDays: TripDay[]
  /** Trip-level modules (cruise / packages). */
  tripFeatures?: TripFeatures
  onSave: (
    day: TripDayInput,
    cruisePatches?: CruiseDayPatch[],
    cruiseDayItemsByDate?: Record<string, DayItem[]>,
  ) => Promise<void>
  /** Persist hotel edits that belong to another day's check-in. */
  onSaveHotelStay: (sourceDayId: string, hotel: DayItem) => Promise<void>
  onRemoveHotelStay: (sourceDayId: string, hotelId: string) => Promise<void>
  onSaveCruiseStay: (
    sourceDayId: string,
    cruise: DayItem,
    patches?: CruiseDayPatch[],
    dayItemsByDate?: Record<string, DayItem[]>,
  ) => Promise<void>
  onRemoveCruiseStay: (sourceDayId: string, cruiseId: string) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  /** Insert a blank day after this one and shift later days. */
  onInsertDayAfter?: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<TripDayInput>(initial)
  const [items, setItems] = useState<DayItem[]>(initial.items || [])
  const [viaPoints, setViaPoints] = useState<ViaPoint[]>(() =>
    sortViaPointsByArriveTime(initial.viaPoints || []),
  )
  const [legs, setLegs] = useState<RouteLeg[]>(() => {
    const points = sortViaPointsByArriveTime(initial.viaPoints || [])
    return syncRouteLegs(points, initial.legs || [])
  })
  /** Compact list by default; pencil opens editor for a leg index, or 'point' for single stop. */
  const [editingVia, setEditingVia] = useState<number | 'point' | null>(null)
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null)
  const [editingCruiseId, setEditingCruiseId] = useState<string | null>(null)
  const [editingDayItemId, setEditingDayItemId] = useState<string | null>(null)
  /** Draft edits for hotels owned by another check-in day. */
  const [linkedHotelDrafts, setLinkedHotelDrafts] = useState<
    Record<string, DayItem>
  >({})
  const [linkedCruiseDrafts, setLinkedCruiseDrafts] = useState<
    Record<string, DayItem>
  >({})
  const [cruiseItineraries, setCruiseItineraries] = useState<
    Record<string, CruiseDayPatch[]>
  >({})
  /** Per-cruise drafts of non-hotel/cruise day items keyed by YYYY-MM-DD. */
  const [cruiseDayItems, setCruiseDayItems] = useState<
    Record<string, Record<string, DayItem[]>>
  >({})
  const [savingLinkedHotel, setSavingLinkedHotel] = useState(false)
  const [savingLinkedCruise, setSavingLinkedCruise] = useState(false)
  const [dirty, setDirty] = useState(!initial.id)

  const hotels = items.filter((i) => i.type === 'hotel')
  const cruises = items.filter((i) => i.type === 'cruise')
  const packageItems = items.filter((i) => i.type === 'package')
  /** Excursions / sights — not city-to-city travel (that belongs in Via). */
  const excursionItems = items.filter((i) => i.type === 'attraction')
  /** Older transport day-items; new travel should use Via. */
  const legacyTransportItems = items.filter((i) => isTransportType(i.type))
  const cruiseModuleOn = !!tripFeatures?.cruise
  const packagesModuleOn = !!tripFeatures?.packages
  const showPackagesSection = packagesModuleOn || packageItems.length > 0
  const stayHotels = useMemo(() => {
    const stays = hotelsStayingOnDay(tripDays, form.date)
    // Local hotels already listed from items; keep linked stays from other days.
    return stays.filter(
      (s) => !initial.id || s.checkInDay.id !== initial.id,
    )
  }, [tripDays, form.date, initial.id])
  const checkoutHotels = useMemo(
    () => hotelsCheckingOutOnDay(tripDays, form.date),
    [tripDays, form.date],
  )
  const stayCruises = useMemo(() => {
    const stays = cruisesCoveringDay(tripDays, form.date)
    return stays.filter(
      (s) => !initial.id || s.embarkDay.id !== initial.id,
    )
  }, [tripDays, form.date, initial.id])
  const disembarkCruises = useMemo(
    () => cruisesDisembarkingOnDay(tripDays, form.date),
    [tripDays, form.date],
  )
  const showCruiseSection =
    cruiseModuleOn ||
    cruises.length > 0 ||
    stayCruises.length > 0 ||
    disembarkCruises.length > 0
  /** Day already belongs to a cruise — do not offer adding another. */
  const dayAlreadyOnCruise =
    cruises.length > 0 ||
    stayCruises.length > 0 ||
    disembarkCruises.length > 0
  const canAddCruise = cruiseModuleOn && !dayAlreadyOnCruise
  const canSave = dirty || !initial.id
  /** «Til sjøs» applies only on cruise days (embark / om bord / disembark). */
  const showAtSeaToggle = showCruiseSection
  const departure = useMemo(
    () => departurePlaceForDay(tripDays, form.date),
    [tripDays, form.date],
  )
  const isCheckoutTravel = checkoutHotels.length > 0
  /**
   * City must be set before transport / save. On checkout mornings the day's
   * city is the arrival city — must differ from the hotel (departure) city.
   */
  const cityReady = (() => {
    if (isAtSeaDay(form)) return true
    const city = form.city.trim()
    if (!city) return false
    if (
      isCheckoutTravel &&
      departure?.kind === 'checkout' &&
      city.toLowerCase() === departure.city.toLowerCase()
    ) {
      return false
    }
    return true
  })()

  useEffect(() => {
    setForm(initial)
    setItems(initial.items || [])
    const points = sortViaPointsByArriveTime(initial.viaPoints || [])
    setViaPoints(points)
    setLegs(syncRouteLegs(points, initial.legs || []))
    setEditingVia(null)
    setEditingHotelId(null)
    setEditingCruiseId(null)
    setEditingDayItemId(null)
    setLinkedHotelDrafts({})
    setLinkedCruiseDrafts({})
    setCruiseItineraries({})
    setDirty(!initial.id)
  }, [initial])

  function markDirty() {
    setDirty(true)
  }

  function linkedHotel(stay: HotelStayRef): DayItem {
    return linkedHotelDrafts[stay.hotel.id] || stay.hotel
  }

  function updateLinkedHotel(stay: HotelStayRef, next: DayItem) {
    setLinkedHotelDrafts((prev) => ({ ...prev, [stay.hotel.id]: next }))
  }

  async function persistLinkedHotel(stay: HotelStayRef) {
    const hotel = linkedHotel(stay)
    setSavingLinkedHotel(true)
    try {
      await onSaveHotelStay(stay.checkInDay.id, hotel)
      setEditingHotelId(null)
    } finally {
      setSavingLinkedHotel(false)
    }
  }

  function linkedCruise(stay: CruiseStayRef): DayItem {
    return linkedCruiseDrafts[stay.cruise.id] || stay.cruise
  }

  function updateLinkedCruise(stay: CruiseStayRef, next: DayItem) {
    const prevCruise = linkedCruise(stay)
    const nightsChanged = cruiseNights(next) !== cruiseNights(prevCruise)
    setLinkedCruiseDrafts((prev) => ({ ...prev, [stay.cruise.id]: next }))
    if (!nightsChanged) return
    const embarkForm = {
      date: stay.embarkDate,
      city: stay.embarkDay.city,
      country: stay.embarkDay.country,
      atSea: stay.embarkDay.atSea,
      arriveTime: stay.embarkDay.arriveTime,
      leaveTime: stay.embarkDay.leaveTime,
    }
    setCruiseItineraries((prev) => ({
      ...prev,
      [stay.cruise.id]: mergeCruiseItinerary(
        stay.embarkDate,
        next,
        tripDays,
        embarkForm,
        prev[stay.cruise.id],
      ),
    }))
    ensureCruiseDayItems(stay.cruise.id, stay.embarkDate, next, embarkForm)
  }

  function setLinkedCruiseItinerary(stay: CruiseStayRef, rows: CruiseDayPatch[]) {
    const cruise = linkedCruise(stay)
    const withPorts = {
      ...cruise,
      cruisePorts: cruisePortsFromItinerary(rows),
      startTime: rows[0] && !rows[0].atSea ? rows[0].leaveTime || '' : cruise.startTime,
      endTime:
        rows.length && !rows[rows.length - 1].atSea
          ? rows[rows.length - 1].arriveTime || ''
          : cruise.endTime,
    }
    setLinkedCruiseDrafts((prev) => ({ ...prev, [cruise.id]: withPorts }))
    setCruiseItineraries((prev) => ({ ...prev, [cruise.id]: rows }))
  }

  function itineraryFor(
    cruiseId: string,
    cruise: DayItem,
    embarkDate: string,
    embarkForm: Pick<
      TripDay,
      'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
    >,
  ): CruiseDayPatch[] {
    return (
      cruiseItineraries[cruiseId] ||
      buildCruiseDayPatches(embarkDate, cruise, tripDays, embarkForm)
    )
  }

  function isDayActivityItem(item: DayItem) {
    return (
      item.type !== 'hotel' &&
      item.type !== 'cruise' &&
      item.type !== 'package'
    )
  }

  function seedDayItemsByDate(
    cruiseId: string,
    embarkDate: string,
    cruise: DayItem,
    embarkForm: Pick<
      TripDay,
      'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
    >,
  ): Record<string, DayItem[]> {
    const rows = itineraryFor(cruiseId, cruise, embarkDate, embarkForm)
    const existing = cruiseDayItems[cruiseId] || {}
    const out: Record<string, DayItem[]> = { ...existing }
    for (const row of rows) {
      if (out[row.date]) continue
      if (row.date === form.date) {
        out[row.date] = items.filter(isDayActivityItem)
      } else {
        const day = tripDays.find((d) => d.date === row.date)
        out[row.date] = (day?.items || []).filter(isDayActivityItem)
      }
    }
    return out
  }

  function dayItemsForCruise(
    cruiseId: string,
    embarkDate: string,
    cruise: DayItem,
    embarkForm: Pick<
      TripDay,
      'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
    >,
  ): Record<string, DayItem[]> {
    return (
      cruiseDayItems[cruiseId] ||
      seedDayItemsByDate(cruiseId, embarkDate, cruise, embarkForm)
    )
  }

  /** Load per-day activities from trip days / current form (fresh each open). */
  function loadCruiseDayItems(
    cruiseId: string,
    embarkDate: string,
    cruise: DayItem,
    embarkForm: Pick<
      TripDay,
      'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
    >,
  ) {
    const rows =
      cruiseItineraries[cruiseId] ||
      buildCruiseDayPatches(embarkDate, cruise, tripDays, embarkForm)
    const byDate: Record<string, DayItem[]> = {}
    for (const row of rows) {
      if (row.date === form.date) {
        byDate[row.date] = items.filter(isDayActivityItem)
      } else {
        const day = tripDays.find((d) => d.date === row.date)
        byDate[row.date] = (day?.items || []).filter(isDayActivityItem)
      }
    }
    setCruiseDayItems((prev) => ({ ...prev, [cruiseId]: byDate }))
  }

  /** When nights grow, fill missing dates without wiping drafts. */
  function ensureCruiseDayItems(
    cruiseId: string,
    embarkDate: string,
    cruise: DayItem,
    embarkForm: Pick<
      TripDay,
      'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
    >,
  ) {
    setCruiseDayItems((prev) => {
      const rows = itineraryFor(cruiseId, cruise, embarkDate, embarkForm)
      const cur = { ...(prev[cruiseId] || {}) }
      let changed = !prev[cruiseId]
      for (const row of rows) {
        if (cur[row.date]) continue
        changed = true
        if (row.date === form.date) {
          cur[row.date] = items.filter(isDayActivityItem)
        } else {
          const day = tripDays.find((d) => d.date === row.date)
          cur[row.date] = (day?.items || []).filter(isDayActivityItem)
        }
      }
      if (!changed) return prev
      return { ...prev, [cruiseId]: cur }
    })
  }

  function setCruiseDayItemsForDate(
    cruiseId: string,
    date: string,
    dayItems: DayItem[],
    syncLocalForm: boolean,
  ) {
    markDirty()
    setCruiseDayItems((prev) => ({
      ...prev,
      [cruiseId]: { ...(prev[cruiseId] || {}), [date]: dayItems },
    }))
    if (syncLocalForm && date === form.date) {
      setItems((prev) => mergeDayActivityItems(prev, dayItems))
    }
  }

  function cleanCruiseActivities(
    activities: CruiseActivity[] | undefined,
  ): CruiseActivity[] | undefined {
    if (!activities?.length) return activities?.length === 0 ? [] : undefined
    const cleaned = activities
      .map((a, i) => ({ ...a, sortOrder: i }))
      .filter(
        (a) => a.title.trim() || a.notes?.trim() || a.url?.trim() || a.startTime?.trim(),
      )
    return cleaned
  }

  async function persistLinkedCruise(stay: CruiseStayRef) {
    const cruise = linkedCruise(stay)
    const embarkForm = {
      date: stay.embarkDate,
      city: stay.embarkDay.city,
      country: stay.embarkDay.country,
      atSea: stay.embarkDay.atSea,
      arriveTime: stay.embarkDay.arriveTime,
      leaveTime: stay.embarkDay.leaveTime,
    }
    const patches = itineraryFor(
      cruise.id,
      cruise,
      stay.embarkDate,
      embarkForm,
    )
    const dayItemsByDate = dayItemsForCruise(
      cruise.id,
      stay.embarkDate,
      cruise,
      embarkForm,
    )
    setSavingLinkedCruise(true)
    try {
      await onSaveCruiseStay(
        stay.embarkDay.id,
        {
          ...cruise,
          cruisePorts: cruisePortsFromItinerary(patches),
          activities: cleanCruiseActivities(cruise.activities),
          costs: cleanCruiseCosts(cruise.costs),
          dayCosts: cleanCruiseDayCosts(cruise.dayCosts),
        },
        patches,
        dayItemsByDate,
      )
      setEditingCruiseId(null)
    } finally {
      setSavingLinkedCruise(false)
    }
  }

  /** Save local embark-day cruise + stamp ankomst/avgang on all port days. */
  async function persistLocalCruise(cruiseId: string) {
    if (!initial.id) return
    const cruise = items.find((i) => i.id === cruiseId)
    if (!cruise || cruise.type !== 'cruise') return
    const patches = itineraryFor(cruise.id, cruise, form.date, form)
    const withPorts = {
      ...cruise,
      cruisePorts: cruisePortsFromItinerary(patches),
      startTime:
        patches[0] && !patches[0].atSea
          ? patches[0].leaveTime || cruise.startTime || ''
          : cruise.startTime,
      endTime:
        patches.length && !patches[patches.length - 1].atSea
          ? patches[patches.length - 1].arriveTime || cruise.endTime || ''
          : cruise.endTime,
      activities: cleanCruiseActivities(cruise.activities),
      costs: cleanCruiseCosts(cruise.costs),
      dayCosts: cleanCruiseDayCosts(cruise.dayCosts),
    }
    setItems((prev) =>
      prev.map((item) => (item.id === cruiseId ? withPorts : item)),
    )
    const emb = patches.find((p) => p.date === form.date)
    if (emb && !emb.atSea) {
      setForm((prev) => ({
        ...prev,
        arriveTime: emb.arriveTime || '',
        leaveTime: emb.leaveTime || '',
      }))
    }
    const dayItemsByDate = dayItemsForCruise(
      cruise.id,
      form.date,
      withPorts,
      form,
    )
    setSavingLinkedCruise(true)
    try {
      await onSaveCruiseStay(initial.id, withPorts, patches, dayItemsByDate)
      setDirty(true)
      setEditingCruiseId(null)
    } finally {
      setSavingLinkedCruise(false)
    }
  }

  function update<K extends keyof TripDayInput>(key: K, value: TripDayInput[K]) {
    markDirty()
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setAtSea(atSea: boolean) {
    markDirty()
    setForm((prev) => ({
      ...prev,
      ...(atSea
        ? atSeaPlaceFields()
        : {
            atSea: false,
            city:
              isAtSeaDay(prev) || prev.city.trim() === AT_SEA_LABEL
                ? ''
                : prev.city,
            country: isAtSeaDay(prev) ? '' : prev.country,
          }),
    }))
  }

  function addExcursion() {
    markDirty()
    const item = newDayItem('attraction', items.length)
    setItems((prev) => [...prev, item])
    setEditingDayItemId(item.id)
  }

  function addHotel() {
    markDirty()
    const hotel = newDayItem('hotel', items.length)
    setItems((prev) => [...prev, hotel])
    setEditingHotelId(hotel.id)
  }

  function addCruise() {
    if (!canAddCruise) return
    markDirty()
    const cruise = newDayItem('cruise', items.length)
    cruise.nights = 7
    const home = form.city.trim()
    if (home) {
      cruise.from = home
      cruise.to = home
    }
    setItems((prev) => [...prev, cruise])
    setEditingCruiseId(cruise.id)
    const rows = buildCruiseDayPatches(form.date, cruise, tripDays, form)
    setCruiseItineraries((prev) => ({
      ...prev,
      [cruise.id]: rows,
    }))
    const byDate: Record<string, DayItem[]> = {}
    for (const row of rows) {
      if (row.date === form.date) {
        byDate[row.date] = items.filter(isDayActivityItem)
      } else {
        const day = tripDays.find((d) => d.date === row.date)
        byDate[row.date] = (day?.items || []).filter(isDayActivityItem)
      }
    }
    setCruiseDayItems((prev) => ({ ...prev, [cruise.id]: byDate }))
  }

  function addPackageTour() {
    if (!packagesModuleOn) return
    markDirty()
    const item = newDayItem('package', items.length)
    setItems((prev) => [...prev, item])
    setEditingDayItemId(item.id)
  }

  function updateItemById(id: string, next: DayItem) {
    markDirty()
    setItems((prev) => prev.map((item) => (item.id === id ? next : item)))
  }

  function updateLocalCruise(id: string, next: DayItem) {
    markDirty()
    const prevCruise = items.find((i) => i.id === id)
    const nightsChanged =
      !!prevCruise && cruiseNights(next) !== cruiseNights(prevCruise)
    setItems((prev) => prev.map((item) => (item.id === id ? next : item)))
    // Only rebuild itinerary when nights change — remarging on every
    // keystroke was wiping unsaved ankomst/avgang.
    if (!nightsChanged) return
    setCruiseItineraries((prev) => ({
      ...prev,
      [id]: mergeCruiseItinerary(
        form.date,
        next,
        tripDays,
        form,
        prev[id],
      ),
    }))
    ensureCruiseDayItems(id, form.date, next, form)
  }

  function setLocalCruiseItinerary(id: string, rows: CruiseDayPatch[]) {
    markDirty()
    setCruiseItineraries((prev) => ({ ...prev, [id]: rows }))
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return {
          ...item,
          cruisePorts: cruisePortsFromItinerary(rows),
          startTime:
            rows[0] && !rows[0].atSea
              ? rows[0].leaveTime || ''
              : item.startTime,
          endTime:
            rows.length && !rows[rows.length - 1].atSea
              ? rows[rows.length - 1].arriveTime || ''
              : item.endTime,
        }
      }),
    )
  }

  function removeItemById(id: string) {
    markDirty()
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (editingHotelId === id) setEditingHotelId(null)
    if (editingCruiseId === id) setEditingCruiseId(null)
    if (editingDayItemId === id) setEditingDayItemId(null)
    setCruiseItineraries((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setCruiseDayItems((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function addViaPoint() {
    if (!cityReady) return
    markDirty()
    // First etappe: create fra + til at once so reisemåte is available immediately.
    if (viaPoints.length === 0) {
      const fromCity =
        departure?.city?.trim() ||
        ''
      const from = {
        ...newViaPoint(0),
        title: fromCity,
      }
      const to = {
        ...newViaPoint(1),
        title: form.city.trim(),
      }
      const next = [from, to]
      setViaPoints(next)
      setLegs(syncRouteLegs(next, []))
      setEditingVia(0)
      return
    }
    const next = [...viaPoints, newViaPoint(viaPoints.length)].map((p, i) => ({
      ...p,
      sortOrder: i,
    }))
    setViaPoints(next)
    setLegs((current) => syncRouteLegs(next, current))
    setEditingVia(Math.max(0, next.length - 2))
  }

  function updateViaPoint(idx: number, point: ViaPoint) {
    markDirty()
    setViaPoints((prev) =>
      prev.map((p, i) => (i === idx ? { ...point, sortOrder: i } : p)),
    )
  }

  function removeViaPoint(idx: number) {
    markDirty()
    setViaPoints((prev) => {
      const next = prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sortOrder: i }))
      setLegs((current) => syncRouteLegs(next, current))
      return next
    })
    setEditingVia(null)
  }

  function updateLeg(idx: number, leg: RouteLeg) {
    markDirty()
    setLegs((prev) => {
      const next = [...prev]
      next[idx] = leg
      return next
    })
    // Avgang → fra-by avreise, ankomst → til-by ankomst (not the other way around).
    setViaPoints((prev) => {
      if (idx < 0 || idx + 1 >= prev.length) return prev
      return prev.map((p, i) => {
        if (i === idx) {
          return {
            ...p,
            leaveTime: leg.startTime || '',
            // First stop should not keep til-ankomst as own ankomst.
            arriveTime: idx === 0 ? '' : p.arriveTime,
          }
        }
        if (i === idx + 1) {
          const isLast = i === prev.length - 1
          return {
            ...p,
            arriveTime: leg.endTime || '',
            // Siste stopp skal ikke beholde gammel avreisetid i visningen.
            leaveTime: isLast ? '' : p.leaveTime,
          }
        }
        return p
      })
    })
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!cityReady) return
        let itemsForSave = items
        for (const cruise of items.filter((i) => i.type === 'cruise')) {
          const draft = cruiseDayItems[cruise.id]?.[form.date]
          if (draft) {
            itemsForSave = mergeDayActivityItems(itemsForSave, draft)
          }
        }
        const cleaned = itemsForSave
          .map((item, idx) => ({
            ...item,
            sortOrder: idx,
            nights:
              item.type === 'hotel'
                ? hotelNights(item)
                : item.type === 'cruise'
                  ? cruiseNights(item)
                  : item.nights,
            from:
              item.type === 'cruise'
                ? cruiseHomePort(item) || item.from
                : item.from,
            to:
              item.type === 'cruise'
                ? cruiseHomePort(item) || item.to
                : item.to,
            activities:
              item.type === 'cruise'
                ? cleanCruiseActivities(item.activities)
                : undefined,
            costs:
              item.type === 'cruise'
                ? cleanCruiseCosts(item.costs)
                : undefined,
            dayCosts:
              item.type === 'cruise'
                ? cleanCruiseDayCosts(item.dayCosts)
                : undefined,
          }))
          .filter(
            (item) =>
              item.title.trim() ||
              item.url?.trim() ||
              item.from?.trim() ||
              item.to?.trim() ||
              item.address?.trim() ||
              item.notes?.trim() ||
              (item.type === 'hotel' && hotelNights(item) >= 1) ||
              (item.type === 'cruise' && cruiseNights(item) >= 1) ||
              (item.type === 'cruise' && (item.activities?.length || 0) > 0) ||
              (item.type === 'cruise' && (item.costs?.length || 0) > 0) ||
              (item.type === 'cruise' && (item.dayCosts?.length || 0) > 0),
          )
        const keptPoints = sortViaPointsByArriveTime(
          viaPoints.filter(
            (p) =>
              p.title.trim() ||
              p.address?.trim() ||
              p.url?.trim() ||
              p.notes?.trim() ||
              p.arriveTime?.trim() ||
              p.leaveTime?.trim(),
          ),
        )
        const localCruises = cleaned.filter((i) => i.type === 'cruise')
        const patchesByCruise = new Map(
          localCruises.map((cruise) => {
            const rows = itineraryFor(cruise.id, cruise, form.date, form).map(
              (row) =>
                row.date === form.date
                  ? {
                      date: form.date,
                      atSea: isAtSeaDay(form),
                      city: isAtSeaDay(form) ? AT_SEA_LABEL : form.city,
                      country: isAtSeaDay(form) ? '' : form.country,
                      arriveTime: isAtSeaDay(form)
                        ? ''
                        : row.arriveTime || form.arriveTime || '',
                      leaveTime: isAtSeaDay(form)
                        ? ''
                        : row.leaveTime || form.leaveTime || '',
                    }
                  : row.atSea
                    ? {
                        ...row,
                        city: AT_SEA_LABEL,
                        country: '',
                        arriveTime: '',
                        leaveTime: '',
                      }
                    : row,
            )
            return [cruise.id, rows] as const
          }),
        )
        const cruisePatches = [...patchesByCruise.values()].flat()
        const cleanedWithPorts = cleaned.map((item) => {
          if (item.type !== 'cruise') return item
          return {
            ...item,
            cruisePorts: cruisePortsFromItinerary(
              patchesByCruise.get(item.id) || [],
            ),
          }
        })
        const embarkPatch = cruisePatches.find((p) => p.date === form.date)
        const dayAtSea = embarkPatch
          ? embarkPatch.atSea
          : isAtSeaDay(form)
        const dayPayload: TripDayInput = {
          ...form,
          atSea: dayAtSea,
          city: dayAtSea
            ? AT_SEA_LABEL
            : embarkPatch
              ? embarkPatch.city
              : form.city,
          country: dayAtSea
            ? ''
            : embarkPatch
              ? embarkPatch.country
              : form.country,
          arriveTime: dayAtSea
            ? ''
            : (embarkPatch?.arriveTime || form.arriveTime || '').trim(),
          leaveTime: dayAtSea
            ? ''
            : (embarkPatch?.leaveTime || form.leaveTime || '').trim(),
          items: cleanedWithPorts,
          viaPoints: keptPoints,
          legs: syncRouteLegs(keptPoints, legs).map((leg) => ({
            ...leg,
            departures: normalizeDepartures(leg.departures),
          })),
          links: form.links || [],
        }
        void (async () => {
          // Flush linked cruise edits (port times) before day save — otherwise
          // "Lagre" on a middle port day would drop ankomst/avgang.
          const linkedStays = [...stayCruises, ...disembarkCruises]
          for (const stay of linkedStays) {
            const hasDraft =
              stay.cruise.id in linkedCruiseDrafts ||
              stay.cruise.id in cruiseItineraries ||
              stay.cruise.id in cruiseDayItems
            if (!hasDraft) continue
            const cruise = linkedCruise(stay)
            const embarkForm = {
              date: stay.embarkDate,
              city: stay.embarkDay.city,
              country: stay.embarkDay.country,
              atSea: stay.embarkDay.atSea,
              arriveTime: stay.embarkDay.arriveTime,
              leaveTime: stay.embarkDay.leaveTime,
            }
            const patches = itineraryFor(
              cruise.id,
              cruise,
              stay.embarkDate,
              embarkForm,
            )
            await onSaveCruiseStay(
              stay.embarkDay.id,
              {
                ...cruise,
                cruisePorts: cruisePortsFromItinerary(patches),
                activities: cleanCruiseActivities(cruise.activities),
                costs: cleanCruiseCosts(cruise.costs),
                dayCosts: cleanCruiseDayCosts(cruise.dayCosts),
              },
              patches,
              dayItemsForCruise(
                cruise.id,
                stay.embarkDate,
                cruise,
                embarkForm,
              ),
            )
          }
          const localDayItemsByDate: Record<string, DayItem[]> = {}
          for (const cruise of localCruises) {
            const byDate = cruiseDayItems[cruise.id]
            if (!byDate) continue
            for (const [date, dayItems] of Object.entries(byDate)) {
              if (date === form.date) continue
              localDayItemsByDate[date] = dayItems
            }
          }
          await onSave(
            dayPayload,
            cruisePatches.length ? cruisePatches : undefined,
            Object.keys(localDayItemsByDate).length
              ? localDayItemsByDate
              : undefined,
          )
          setDirty(false)
          setEditingVia(null)
          setEditingHotelId(null)
          setEditingCruiseId(null)
          setLinkedCruiseDrafts({})
        })()
      }}
    >
      <div className="day-meta-row">
        <div className="day-meta-fields">
          <label>
            Dato
            <DatePickerField
              required
              value={form.date}
              onChange={(date) => update('date', date)}
            />
          </label>
          <label>
            Rekkefølge
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => update('sortOrder', Number(e.target.value) || 0)}
            />
          </label>
          {showAtSeaToggle && (
            <label className="day-at-sea-field">
              <span>{AT_SEA_LABEL}</span>
              <span className="day-at-sea-control">
                <input
                  type="checkbox"
                  checked={isAtSeaDay(form)}
                  onChange={(e) => setAtSea(e.target.checked)}
                />
                Hele dagen til sjøs (ikke i land)
              </span>
            </label>
          )}
          {!(showAtSeaToggle && isAtSeaDay(form)) && (
            <>
              {isCheckoutTravel && departure && (
                <div className="day-departure-context">
                  <span className="meta">Fra</span>
                  <strong>
                    {departure.city}
                    {departure.country ? `, ${departure.country}` : ''}
                  </strong>
                  <span className="meta"> · utsjekk</span>
                </div>
              )}
              <CitySuggestFields
                city={
                  isCheckoutTravel &&
                  departure?.kind === 'checkout' &&
                  form.city.trim().toLowerCase() ===
                    departure.city.toLowerCase()
                    ? ''
                    : form.city
                }
                country={
                  isCheckoutTravel &&
                  departure?.kind === 'checkout' &&
                  form.city.trim().toLowerCase() ===
                    departure.city.toLowerCase()
                    ? ''
                    : form.country
                }
                cityLabel={
                  isCheckoutTravel ? 'Til / ankomstby' : 'By / havn'
                }
                autoFocus={!cityReady}
                onCityChange={(city) => update('city', city)}
                onCountryChange={(country) => update('country', country)}
                onSelectPlace={(city, nextCountry) => {
                  markDirty()
                  setForm((prev) => ({
                    ...prev,
                    city,
                    country: nextCountry || prev.country,
                    atSea: false,
                  }))
                }}
              />
              {!cityReady && (
                <p className="meta day-city-required-hint">
                  {isCheckoutTravel && departure
                    ? `Velg ankomstby først — du sjekker ut fra ${departure.city}.`
                    : 'Velg by først før du legger til transport eller lagrer.'}
                </p>
              )}
            </>
          )}
        </div>
        {!(showAtSeaToggle && isAtSeaDay(form)) && form.city.trim() && (
          <DayWeatherCard
            city={form.city}
            country={form.country}
            date={form.date}
            onSelectPlace={(nextCity, nextCountry) => {
              markDirty()
              setForm((prev) => ({
                ...prev,
                city: nextCity,
                country: nextCountry || prev.country,
                atSea: false,
              }))
            }}
          />
        )}
      </div>

      <label className="day-notes-field">
        Kommentarer / tips for dagen
        <textarea
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </label>

      <div className="stack">
        <h3 className="section-title" style={{ fontSize: '1.2rem' }}>
          Reise
        </h3>
        <p className="section-sub">
          Når du kommer fra en annen by — etapper og reisemåte underveis
          {form.city.trim() ? ` til ${form.city.trim()}` : ''}.
        </p>

        {viaPoints.length === 0 &&
          editingVia === null &&
          legacyTransportItems.length === 0 && (
          <p className="empty">
            Ingen reiseetapper ennå. Legg inn fra-by, til-by og reisemåte.
          </p>
        )}

        {viaPoints.length > 0 && (
          <div className="via-flow">
            {viaPoints.map((point, idx) => {
              const leg = legs[idx]
              const next = viaPoints[idx + 1]
              const inbound = idx > 0 ? legs[idx - 1] : undefined
              const timeLabel = formatViaStopTimes(point, inbound, leg)
              const editingThisLeg = editingVia === idx
              const editingSingle = editingVia === 'point' && idx === 0
              const cityEditKey: number | 'point' =
                viaPoints.length === 1
                  ? 'point'
                  : idx === viaPoints.length - 1
                    ? Math.max(0, idx - 1)
                    : idx
              const isCityEditing = editingVia === cityEditKey

              return (
                <div key={point.id} className="via-flow-unit">
                  {editingSingle ? (
                    <>
                      <div className="via-city-tile is-editing">
                        <span className="via-city-main">
                          <span className="via-city-name">
                            {viaPoints[0].title || 'Stopp 1'}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm via-city-edit icon-btn-close"
                          title="Lukk redigering"
                          aria-label="Lukk redigering"
                          onClick={() => setEditingVia(null)}
                        >
                          <CloseIcon />
                        </button>
                      </div>
                      <div className="item-card item-via via-inline-editor">
                        <div className="form-grid">
                          <div className="full">
                            <CitySuggestFields
                              showCountry={false}
                              hideHint
                              autoFocus
                              cityLabel="By / sted"
                              city={viaPoints[0].title}
                              country={form.country}
                              cityPlaceholder="Roma"
                              onCityChange={(title) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  title,
                                })
                              }
                              onCountryChange={() => {}}
                              onSelectPlace={(title) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  title,
                                })
                              }
                              className="city-suggest-via"
                            />
                          </div>
                          <label className="full">
                            Adresse
                            <input
                              value={viaPoints[0].address || ''}
                              onChange={(e) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  address: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Ankomst
                            <ClockTimeInput
                              value={viaPoints[0].arriveTime || ''}
                              onChange={(v) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  arriveTime: v,
                                })
                              }
                              placeholder="10:00"
                            />
                          </label>
                          <label>
                            Avreise
                            <ClockTimeInput
                              value={viaPoints[0].leaveTime || ''}
                              onChange={(v) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  leaveTime: v,
                                })
                              }
                              placeholder="11:30"
                            />
                          </label>
                          <div className="full toolbar">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={addViaPoint}
                            >
                              Neste by + reisemåte
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => removeViaPoint(0)}
                            >
                              Fjern punkt
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div
                      className={`via-city-tile ${
                        editingThisLeg ? 'is-editing' : ''
                      }`}
                    >
                      <span className="via-city-main">
                        <span className="via-city-name">
                          {point.title || `Stopp ${idx + 1}`}
                        </span>
                        {timeLabel && (
                          <span className="via-city-arrive">{timeLabel}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className={`icon-btn icon-btn-sm via-city-edit ${
                          isCityEditing ? 'icon-btn-close' : ''
                        }`}
                        title={isCityEditing ? 'Lukk redigering' : 'Rediger by'}
                        aria-label={
                          isCityEditing
                            ? `Lukk redigering av ${point.title || `via ${idx + 1}`}`
                            : `Rediger ${point.title || `via ${idx + 1}`}`
                        }
                        onClick={() =>
                          setEditingVia(isCityEditing ? null : cityEditKey)
                        }
                      >
                        {isCityEditing ? <CloseIcon /> : <PencilIcon />}
                      </button>
                    </div>
                  )}

                  {editingThisLeg && next && leg && (
                    <div className="item-card item-via via-inline-editor">
                      <div className="item-card-head">
                        <span className="chip">
                          Etappe {idx + 1}: {point.title || 'Fra'} →{' '}
                          {next.title || 'Til'}
                        </span>
                      </div>
                      <div className="stack">
                        <div className="via-city-edit-grid">
                          <div className="via-city-edit-card">
                            <span className="chip">Fra</span>
                            <CitySuggestFields
                              showCountry={false}
                              hideHint
                              autoFocus
                              cityLabel="By"
                              city={viaPoints[idx].title}
                              country={form.country}
                              cityPlaceholder="Hjem"
                              onCityChange={(title) =>
                                updateViaPoint(idx, {
                                  ...viaPoints[idx],
                                  title,
                                })
                              }
                              onCountryChange={() => {}}
                              onSelectPlace={(title) =>
                                updateViaPoint(idx, {
                                  ...viaPoints[idx],
                                  title,
                                })
                              }
                              className="city-suggest-via"
                            />
                            <label>
                              Adresse
                              <input
                                value={viaPoints[idx].address || ''}
                                onChange={(e) =>
                                  updateViaPoint(idx, {
                                    ...viaPoints[idx],
                                    address: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>

                          <div className="via-city-edit-card">
                            <span className="chip">Til</span>
                            <CitySuggestFields
                              showCountry={false}
                              hideHint
                              cityLabel="By"
                              city={viaPoints[idx + 1].title}
                              country={form.country}
                              cityPlaceholder="Bergen flyplass"
                              onCityChange={(title) =>
                                updateViaPoint(idx + 1, {
                                  ...viaPoints[idx + 1],
                                  title,
                                })
                              }
                              onCountryChange={() => {}}
                              onSelectPlace={(title) =>
                                updateViaPoint(idx + 1, {
                                  ...viaPoints[idx + 1],
                                  title,
                                })
                              }
                              className="city-suggest-via"
                            />
                            <label>
                              Adresse
                              <input
                                value={viaPoints[idx + 1].address || ''}
                                onChange={(e) =>
                                  updateViaPoint(idx + 1, {
                                    ...viaPoints[idx + 1],
                                    address: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>

                        <div
                          className="item-card item-leg"
                          style={{ boxShadow: 'none' }}
                        >
                          <div className="transport-edit-head">
                            <TransportBadge mode={leg.mode} />
                            <p className="meta" style={{ margin: 0 }}>
                              Transport mellom
                            </p>
                          </div>
                          <div className="form-grid">
                            <label className="full">
                              Type
                              <div className="transport-mode-picker">
                                {LEG_MODES.map(({ mode, label }) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    className={`transport-mode-option ${
                                      leg.mode === mode ? 'is-selected' : ''
                                    }`}
                                    onClick={() =>
                                      updateLeg(idx, { ...leg, mode })
                                    }
                                    title={label}
                                    aria-label={label}
                                    aria-pressed={leg.mode === mode}
                                  >
                                    <TransportModeIcon mode={mode} size={15} />
                                    <span>{label}</span>
                                  </button>
                                ))}
                              </div>
                            </label>
                            <label>
                              Navn / linje
                              <input
                                value={leg.title || ''}
                                onChange={(e) =>
                                  updateLeg(idx, {
                                    ...leg,
                                    title: e.target.value,
                                  })
                                }
                                placeholder="IC 512"
                              />
                            </label>
                            {!modeHasDepartureSchedule(leg.mode) && (
                              <label>
                                Avgang
                                <ClockTimeInput
                                  value={leg.startTime || ''}
                                  onChange={(v) =>
                                    updateLeg(idx, {
                                      ...leg,
                                      startTime: v,
                                    })
                                  }
                                  placeholder="11:40"
                                />
                              </label>
                            )}
                            <label>
                              Ankomst
                              <ClockTimeInput
                                value={leg.endTime || ''}
                                onChange={(v) =>
                                  updateLeg(idx, {
                                    ...leg,
                                    endTime: v,
                                  })
                                }
                                placeholder="12:10"
                              />
                            </label>
                            {modeHasDepartureSchedule(leg.mode) && (
                              <LegDeparturesField
                                times={
                                  normalizeDepartures(
                                    leg.departures?.length
                                      ? leg.departures
                                      : leg.startTime
                                        ? [leg.startTime]
                                        : [],
                                  )
                                }
                                dayDate={form.date}
                                onChange={(departures) => {
                                  const next = normalizeDepartures(departures)
                                  updateLeg(idx, {
                                    ...leg,
                                    departures: next,
                                    // First time = what we bet on → planned avgang
                                    startTime: next[0] || '',
                                  })
                                }}
                                onAcceptSuggested={(suggested) => {
                                  const rest = normalizeDepartures(
                                    leg.departures?.length
                                      ? leg.departures
                                      : leg.startTime
                                        ? [leg.startTime]
                                        : [],
                                  ).filter((t) => t !== suggested)
                                  const departures = normalizeDepartures([
                                    suggested,
                                    ...rest,
                                  ])
                                  updateLeg(idx, {
                                    ...leg,
                                    departures,
                                    startTime: suggested,
                                  })
                                }}
                              />
                            )}
                            <label className="full">
                              Lenke
                              <input
                                type="url"
                                value={leg.url || ''}
                                onChange={(e) =>
                                  updateLeg(idx, {
                                    ...leg,
                                    url: e.target.value,
                                  })
                                }
                                placeholder="https://"
                              />
                            </label>
                            <label className="full">
                              Notat
                              <input
                                value={leg.notes || ''}
                                onChange={(e) =>
                                  updateLeg(idx, {
                                    ...leg,
                                    notes: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>

                        <div className="toolbar">
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => removeViaPoint(idx + 1)}
                          >
                            Fjern til-by
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {leg && next && (
                    <div className="via-flow-leg">
                      {!editingThisLeg && (
                        <LegTransportSummary
                          leg={leg}
                          dayDate={form.date}
                          onAcceptSuggested={
                            modeHasDepartureSchedule(leg.mode)
                              ? (suggested) => {
                                  const rest = normalizeDepartures(
                                    leg.departures,
                                  ).filter((t) => t !== suggested)
                                  updateLeg(idx, {
                                    ...leg,
                                    departures: normalizeDepartures([
                                      suggested,
                                      ...rest,
                                    ]),
                                    startTime: suggested,
                                  })
                                }
                              : undefined
                          }
                        />
                      )}
                      <button
                        type="button"
                        className={`icon-btn icon-btn-sm ${
                          editingThisLeg ? 'icon-btn-close' : ''
                        }`}
                        title={
                          editingThisLeg
                            ? 'Lukk redigering'
                            : 'Rediger transport'
                        }
                        aria-label={
                          editingThisLeg
                            ? `Lukk redigering av transport til ${next.title || 'neste'}`
                            : `Rediger transport til ${next.title || 'neste'}`
                        }
                        onClick={() =>
                          setEditingVia(editingThisLeg ? null : idx)
                        }
                      >
                        {editingThisLeg ? <CloseIcon /> : <PencilIcon />}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={addViaPoint}
          disabled={!cityReady}
          title={!cityReady ? 'Velg by først' : undefined}
        >
          {viaPoints.length === 0
            ? '+ Legg til reise (fra-by → hit)'
            : '+ Legg til neste by'}
        </button>

        {legacyTransportItems.length > 0 && (
          <div className="via-summary-list" style={{ marginTop: '0.75rem' }}>
            <p className="meta">
              Eldre transport lagret som dags-element — bruk Reise for ny
              reise mellom byer.
            </p>
            {legacyTransportItems.map((item) => {
              const editing = editingDayItemId === item.id
              const from = (item.from || '').trim()
              const to = (item.to || '').trim()
              const timeLabel = [item.startTime, item.endTime]
                .filter(Boolean)
                .join('–')
              return (
                <div key={item.id}>
                  <div
                    className={`via-flow transport-day-flow${
                      editing ? ' is-editing' : ''
                    }`}
                  >
                    <div className="via-flow-unit">
                      <div className="via-city-tile">
                        <span className="via-city-main">
                          <span className="via-city-name">
                            {from || 'Fra'}
                          </span>
                        </span>
                      </div>
                      <div className="via-flow-leg">
                        <TransportBadge
                          mode={item.type}
                          label={itemTypeLabel(item.type)}
                          detail={
                            [
                              item.title?.trim(),
                              timeLabel,
                              formatTransportPriceLabel(item),
                            ]
                              .filter(Boolean)
                              .join(' · ') || undefined
                          }
                        />
                        <button
                          type="button"
                          className={`icon-btn icon-btn-sm ${
                            editing ? 'icon-btn-close' : ''
                          }`}
                          title={editing ? 'Lukk redigering' : 'Rediger'}
                          aria-label={
                            editing
                              ? `Lukk redigering av ${itemTypeLabel(item.type)}`
                              : `Rediger ${itemTypeLabel(item.type)}`
                          }
                          onClick={() =>
                            setEditingDayItemId(editing ? null : item.id)
                          }
                        >
                          {editing ? <CloseIcon /> : <PencilIcon />}
                        </button>
                      </div>
                      <div className="via-city-tile">
                        <span className="via-city-main">
                          <span className="via-city-name">{to || 'Til'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {editing && (
                    <DayItemEditor
                      embedded
                      item={item}
                      onChange={(next) => updateItemById(item.id, next)}
                      onRemove={() => removeItemById(item.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="stack">
        <h3 className="section-title" style={{ fontSize: '1.2rem' }}>
          Hotell
        </h3>

        {checkoutHotels.map((stay) => {
          const hotel = linkedHotel(stay)
          const editing = editingHotelId === hotel.id
          return (
            <div key={`checkout-${stay.checkInDay.id}-${hotel.id}`}>
              {editing ? (
                <div className="stack">
                  <DayItemEditor
                    item={hotel}
                    dayDate={stay.checkInDate}
                    city={stay.checkInDay.city}
                    country={stay.checkInDay.country}
                    onChange={(next) => updateLinkedHotel(stay, next)}
                    onRemove={() =>
                      void onRemoveHotelStay(stay.checkInDay.id, hotel.id).then(
                        () => setEditingHotelId(null),
                      )
                    }
                  />
                  <div className="toolbar">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingLinkedHotel}
                      onClick={() => void persistLinkedHotel(stay)}
                    >
                      {savingLinkedHotel ? 'Lagrer…' : 'Lagre hotell'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => {
                        setEditingHotelId(null)
                        setLinkedHotelDrafts((prev) => {
                          const next = { ...prev }
                          delete next[hotel.id]
                          return next
                        })
                      }}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="via-summary-row hotel-summary-row hotel-checkout-row">
                  <span className="hotel-badge" aria-hidden="true">
                    <HotelIcon size={18} />
                  </span>
                  <div className="via-summary-main">
                    <span className="chip chip-checkout">Utsjekk</span>
                    <span className="via-summary-city">
                      {hotel.title || 'Hotell uten navn'}
                    </span>
                    <span className="meta via-summary-address">
                      {[
                        stay.checkInDay.city?.trim()
                          ? `Fra ${stay.checkInDay.city.trim()}`
                          : '',
                        `Innsjekk ${formatDateNO(stay.checkInDate)} · Utsjekk-dato ${formatDateNO(stay.checkoutDate)}`,
                        hotel.endTime?.trim()
                          ? `Utsjekk kl. ${hotel.endTime}`
                          : 'Utsjekk i dag',
                        hotel.address?.trim() || '',
                        formatHotelPrice(hotel),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {hotel.url?.trim() && (
                      <a
                        href={hotel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="meta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isHotelsComUrl(hotel.url)
                          ? 'Hotels.com'
                          : 'Åpne lenke'}
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Rediger hotell"
                    aria-label={`Rediger ${hotel.title || 'hotell'}`}
                    onClick={() => setEditingHotelId(hotel.id)}
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {stayHotels.map((stay) => {
          const hotel = linkedHotel(stay)
          const editing = editingHotelId === hotel.id
          return (
            <div key={`stay-${stay.checkInDay.id}-${hotel.id}`}>
              {editing ? (
                <div className="stack">
                  <DayItemEditor
                    item={hotel}
                    dayDate={stay.checkInDate}
                    city={stay.checkInDay.city}
                    country={stay.checkInDay.country}
                    onChange={(next) => updateLinkedHotel(stay, next)}
                    onRemove={() =>
                      void onRemoveHotelStay(stay.checkInDay.id, hotel.id).then(
                        () => setEditingHotelId(null),
                      )
                    }
                  />
                  <div className="toolbar">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingLinkedHotel}
                      onClick={() => void persistLinkedHotel(stay)}
                    >
                      {savingLinkedHotel ? 'Lagrer…' : 'Lagre hotell'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => {
                        setEditingHotelId(null)
                        setLinkedHotelDrafts((prev) => {
                          const next = { ...prev }
                          delete next[hotel.id]
                          return next
                        })
                      }}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="via-summary-row hotel-summary-row">
                  <span className="hotel-badge" aria-hidden="true">
                    <HotelIcon size={18} />
                  </span>
                  <div className="via-summary-main">
                    <span className="chip">Opphold</span>
                    <span className="via-summary-city">
                      {hotel.title || 'Hotell uten navn'}
                    </span>
                    <span className="meta via-summary-address">
                      {[
                        hotel.address,
                        `${hotelNights(hotel)} ${
                          hotelNights(hotel) === 1 ? 'natt' : 'netter'
                        }`,
                        formatHotelPrice(hotel),
                        `Innsjekk ${formatDateNO(stay.checkInDate)}`,
                        `Utsjekk ${formatDateNO(stay.checkoutDate)}`,
                        hotel.startTime || hotel.endTime
                          ? `${hotel.startTime || '—'}–${hotel.endTime || '—'}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {hotel.url?.trim() && (
                      <a
                        href={hotel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="meta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isHotelsComUrl(hotel.url)
                          ? 'Hotels.com'
                          : 'Åpne lenke'}
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Rediger hotell"
                    aria-label={`Rediger ${hotel.title || 'hotell'}`}
                    onClick={() => setEditingHotelId(hotel.id)}
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {hotels.length === 0 &&
          stayHotels.length === 0 &&
          checkoutHotels.length === 0 &&
          !editingHotelId && (
            <p className="empty">Ingen hotell lagt inn.</p>
          )}

        {hotels.length > 0 && (
          <div className="via-summary-list">
            {hotels.map((hotel) => (
              <div key={hotel.id}>
                {editingHotelId === hotel.id ? (
                  <DayItemEditor
                    item={hotel}
                    dayDate={form.date}
                    city={form.city}
                    country={form.country}
                    onChange={(next) => updateItemById(hotel.id, next)}
                    onRemove={() => removeItemById(hotel.id)}
                  />
                ) : (
                  <div className="via-summary-row hotel-summary-row">
                    <span className="hotel-badge" aria-hidden="true">
                      <HotelIcon size={18} />
                    </span>
                    <div className="via-summary-main">
                      <span className="via-summary-city">
                        {hotel.title || 'Hotell uten navn'}
                      </span>
                      {(hotel.address ||
                        hotel.startTime ||
                        hotel.endTime ||
                        formatHotelPrice(hotel) ||
                        hotelNights(hotel) >= 1) && (
                        <span className="meta via-summary-address">
                          {[
                            hotel.address,
                            form.date
                              ? formatHotelStaySpan(
                                  form.date,
                                  hotel,
                                  formatDateNO,
                                )
                              : hotelNights(hotel) > 1
                                ? `${hotelNights(hotel)} overnattinger`
                                : '',
                            formatHotelPrice(hotel),
                            hotel.startTime || hotel.endTime
                              ? `Kl. innsjekk ${hotel.startTime || '—'} · utsjekk ${hotel.endTime || '—'}`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {hotel.url && (
                        <a
                          href={hotel.url}
                          target="_blank"
                          rel="noreferrer"
                          className="meta"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isHotelsComUrl(hotel.url)
                            ? 'Hotels.com'
                            : 'Åpne lenke'}
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Rediger hotell"
                      aria-label={`Rediger ${hotel.title || 'hotell'}`}
                      onClick={() => setEditingHotelId(hotel.id)}
                    >
                      <PencilIcon />
                    </button>
                  </div>
                )}
                {editingHotelId === hotel.id && (
                  <div className="toolbar" style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => setEditingHotelId(null)}
                    >
                      Lukk
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn btn-soft btn-sm" onClick={addHotel}>
          + Legg til hotell
        </button>
      </div>

      {showCruiseSection && (
      <div className="stack">
        <h3 className="section-title" style={{ fontSize: '1.2rem' }}>
          Cruise
        </h3>

        {disembarkCruises.map((stay) => {
          const cruise = linkedCruise(stay)
          const editing = editingCruiseId === cruise.id
          return (
            <div key={`disembark-cruise-${stay.embarkDay.id}-${cruise.id}`}>
              {editing ? (
                <div className="stack">
                  <CruiseItemEditor
                    cruise={cruise}
                    embarkDate={stay.embarkDate}
                    itinerary={itineraryFor(
                      cruise.id,
                      cruise,
                      stay.embarkDate,
                      {
                        date: stay.embarkDate,
                        city: stay.embarkDay.city,
                        country: stay.embarkDay.country,
                        atSea: stay.embarkDay.atSea,
                      },
                    )}
                    dayItemsByDate={dayItemsForCruise(
                      cruise.id,
                      stay.embarkDate,
                      cruise,
                      {
                        date: stay.embarkDate,
                        city: stay.embarkDay.city,
                        country: stay.embarkDay.country,
                        atSea: stay.embarkDay.atSea,
                        arriveTime: stay.embarkDay.arriveTime,
                        leaveTime: stay.embarkDay.leaveTime,
                      },
                    )}
                    onChange={(next) => updateLinkedCruise(stay, next)}
                    onItineraryChange={(rows) =>
                      setLinkedCruiseItinerary(stay, rows)
                    }
                    onDayItemsChange={(date, dayItems) =>
                      setCruiseDayItemsForDate(
                        cruise.id,
                        date,
                        dayItems,
                        false,
                      )
                    }
                    onRemove={() =>
                      void onRemoveCruiseStay(
                        stay.embarkDay.id,
                        cruise.id,
                      ).then(() => setEditingCruiseId(null))
                    }
                  />
                  <div className="toolbar">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingLinkedCruise}
                      onClick={() => void persistLinkedCruise(stay)}
                    >
                      {savingLinkedCruise ? 'Lagrer…' : 'Lagre cruise'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => {
                        setEditingCruiseId(null)
                        setLinkedCruiseDrafts((prev) => {
                          const next = { ...prev }
                          delete next[cruise.id]
                          return next
                        })
                      }}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="via-summary-row hotel-summary-row hotel-checkout-row">
                  <span className="cruise-badge" aria-hidden="true">
                    <ShipIcon size={18} />
                  </span>
                  <div className="via-summary-main">
                    <span className="chip chip-checkout">Disembark</span>
                    <span className="via-summary-city">
                      {cruise.title || 'Cruise uten navn'}
                    </span>
                    <span className="meta via-summary-address">
                      {[
                        cruise.endTime?.trim()
                          ? `Disembark ${cruise.endTime}`
                          : 'Disembark i dag',
                        cruiseHomePort(cruise),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Rediger cruise"
                    aria-label={`Rediger ${cruise.title || 'cruise'}`}
                    onClick={() => {
                      setEditingCruiseId(cruise.id)
                      const embarkForm = {
                        date: stay.embarkDate,
                        city: stay.embarkDay.city,
                        country: stay.embarkDay.country,
                        atSea: stay.embarkDay.atSea,
                        arriveTime: stay.embarkDay.arriveTime,
                        leaveTime: stay.embarkDay.leaveTime,
                      }
                      setCruiseItineraries((prev) => ({
                        ...prev,
                        [cruise.id]:
                          prev[cruise.id] ||
                          buildCruiseDayPatches(
                            stay.embarkDate,
                            cruise,
                            tripDays,
                            embarkForm,
                          ),
                      }))
                      loadCruiseDayItems(
                        cruise.id,
                        stay.embarkDate,
                        cruise,
                        embarkForm,
                      )
                    }}
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {stayCruises.map((stay) => {
          const cruise = linkedCruise(stay)
          const editing = editingCruiseId === cruise.id
          return (
            <div key={`stay-cruise-${stay.embarkDay.id}-${cruise.id}`}>
              {editing ? (
                <div className="stack">
                  <CruiseItemEditor
                    cruise={cruise}
                    embarkDate={stay.embarkDate}
                    itinerary={itineraryFor(
                      cruise.id,
                      cruise,
                      stay.embarkDate,
                      {
                        date: stay.embarkDate,
                        city: stay.embarkDay.city,
                        country: stay.embarkDay.country,
                        atSea: stay.embarkDay.atSea,
                      },
                    )}
                    dayItemsByDate={dayItemsForCruise(
                      cruise.id,
                      stay.embarkDate,
                      cruise,
                      {
                        date: stay.embarkDate,
                        city: stay.embarkDay.city,
                        country: stay.embarkDay.country,
                        atSea: stay.embarkDay.atSea,
                        arriveTime: stay.embarkDay.arriveTime,
                        leaveTime: stay.embarkDay.leaveTime,
                      },
                    )}
                    onChange={(next) => updateLinkedCruise(stay, next)}
                    onItineraryChange={(rows) =>
                      setLinkedCruiseItinerary(stay, rows)
                    }
                    onDayItemsChange={(date, dayItems) =>
                      setCruiseDayItemsForDate(
                        cruise.id,
                        date,
                        dayItems,
                        false,
                      )
                    }
                    onRemove={() =>
                      void onRemoveCruiseStay(
                        stay.embarkDay.id,
                        cruise.id,
                      ).then(() => setEditingCruiseId(null))
                    }
                  />
                  <div className="toolbar">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={savingLinkedCruise}
                      onClick={() => void persistLinkedCruise(stay)}
                    >
                      {savingLinkedCruise ? 'Lagrer…' : 'Lagre cruise'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => {
                        setEditingCruiseId(null)
                        setLinkedCruiseDrafts((prev) => {
                          const next = { ...prev }
                          delete next[cruise.id]
                          return next
                        })
                      }}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="via-summary-row hotel-summary-row">
                  <span className="cruise-badge" aria-hidden="true">
                    <ShipIcon size={18} />
                  </span>
                  <div className="via-summary-main">
                    <span className="chip">Om bord</span>
                    <span className="via-summary-city">
                      {cruise.title || 'Cruise uten navn'}
                    </span>
                    <span className="meta via-summary-address">
                      {[
                        cruiseHomePort(cruise),
                        `${cruiseNights(cruise)} ${
                          cruiseNights(cruise) === 1 ? 'natt' : 'netter'
                        }`,
                        `Embark ${formatDateNO(stay.embarkDate)}`,
                        `Disembark ${formatDateNO(stay.disembarkDate)}`,
                        cruise.cabinNumber?.trim()
                          ? `Lugar ${cruise.cabinNumber.trim()}`
                          : '',
                        formatItemPrice(cruise),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Rediger cruise"
                    aria-label={`Rediger ${cruise.title || 'cruise'}`}
                    onClick={() => {
                      setEditingCruiseId(cruise.id)
                      const embarkForm = {
                        date: stay.embarkDate,
                        city: stay.embarkDay.city,
                        country: stay.embarkDay.country,
                        atSea: stay.embarkDay.atSea,
                        arriveTime: stay.embarkDay.arriveTime,
                        leaveTime: stay.embarkDay.leaveTime,
                      }
                      setCruiseItineraries((prev) => ({
                        ...prev,
                        [cruise.id]:
                          prev[cruise.id] ||
                          buildCruiseDayPatches(
                            stay.embarkDate,
                            cruise,
                            tripDays,
                            embarkForm,
                          ),
                      }))
                      loadCruiseDayItems(
                        cruise.id,
                        stay.embarkDate,
                        cruise,
                        embarkForm,
                      )
                    }}
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {cruises.length === 0 &&
          stayCruises.length === 0 &&
          disembarkCruises.length === 0 &&
          !editingCruiseId && (
            <p className="empty">Ingen cruise lagt inn.</p>
          )}

        {cruises.length > 0 && (
          <div className="via-summary-list">
            {cruises.map((cruise) => {
              const editing = editingCruiseId === cruise.id
              const nights = cruiseNights(cruise)
              const home = cruiseHomePort(cruise)
              const disembarkDate = form.date
                ? addDaysIso(form.date, nights)
                : ''
              return (
                <div key={cruise.id}>
                  <div
                    className={`via-summary-row hotel-summary-row${
                      editing ? ' is-editing' : ''
                    }`}
                  >
                    <span className="cruise-badge" aria-hidden="true">
                      <ShipIcon size={18} />
                    </span>
                    <div className="via-summary-main">
                      <span className="via-summary-city">
                        {cruise.title || 'Cruise uten navn'}
                      </span>
                      <span className="meta via-summary-address">
                        {[
                          home,
                          `${nights} ${nights === 1 ? 'natt' : 'netter'}`,
                          form.date && disembarkDate
                            ? `${formatDateNO(form.date)} → ${formatDateNO(disembarkDate)}`
                            : '',
                          cruise.startTime || cruise.endTime
                            ? `Embark ${cruise.startTime || '—'} · Disembark ${cruise.endTime || '—'}`
                            : '',
                          cruise.cabinNumber?.trim()
                            ? `Lugar ${cruise.cabinNumber.trim()}`
                            : '',
                          formatItemPrice(cruise),
                          summarizeCruiseActivities(cruise.activities),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {!editing && cruise.url && (
                        <a
                          href={cruise.url}
                          target="_blank"
                          rel="noreferrer"
                          className="meta"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Åpne lenke
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`icon-btn ${
                        editing ? 'icon-btn-close' : ''
                      }`}
                      title={editing ? 'Lukk redigering' : 'Rediger cruise'}
                      aria-label={
                        editing
                          ? `Lukk redigering av ${cruise.title || 'cruise'}`
                          : `Rediger ${cruise.title || 'cruise'}`
                      }
                      onClick={() => {
                        if (editing) {
                          setEditingCruiseId(null)
                          return
                        }
                        setEditingCruiseId(cruise.id)
                        setCruiseItineraries((prev) => ({
                          ...prev,
                          [cruise.id]:
                            prev[cruise.id] ||
                            buildCruiseDayPatches(
                              form.date,
                              cruise,
                              tripDays,
                              form,
                            ),
                        }))
                        loadCruiseDayItems(
                          cruise.id,
                          form.date,
                          cruise,
                          form,
                        )
                      }}
                    >
                      {editing ? <CloseIcon /> : <PencilIcon />}
                    </button>
                  </div>
                  {editing && (
                    <div className="stack">
                      <CruiseItemEditor
                        cruise={cruise}
                        embarkDate={form.date}
                        itinerary={itineraryFor(
                          cruise.id,
                          cruise,
                          form.date,
                          form,
                        )}
                        dayItemsByDate={dayItemsForCruise(
                          cruise.id,
                          form.date,
                          cruise,
                          form,
                        )}
                        onChange={(next) => updateLocalCruise(cruise.id, next)}
                        onItineraryChange={(rows) =>
                          setLocalCruiseItinerary(cruise.id, rows)
                        }
                        onDayItemsChange={(date, dayItems) =>
                          setCruiseDayItemsForDate(
                            cruise.id,
                            date,
                            dayItems,
                            true,
                          )
                        }
                        onRemove={() => removeItemById(cruise.id)}
                      />
                      <div className="toolbar">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={savingLinkedCruise || !initial.id}
                          onClick={() => void persistLocalCruise(cruise.id)}
                        >
                          {savingLinkedCruise
                            ? 'Lagrer…'
                            : 'Lagre cruise (ankomst/avgang)'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-soft"
                          onClick={() => setEditingCruiseId(null)}
                        >
                          Lukk
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {canAddCruise && (
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={addCruise}
          >
            + Legg til cruise
          </button>
        )}
      </div>
      )}

      {showPackagesSection && (
      <div className="stack">
        <h3 className="section-title" style={{ fontSize: '1.2rem' }}>
          Pakketurer
        </h3>
        <p className="section-sub">
          Organiserte turer og lignende — ikke vanlig hotell/via.
        </p>

        {packageItems.length === 0 && editingDayItemId === null && (
          <p className="empty">Ingen pakketurer ennå.</p>
        )}

        {packageItems.length > 0 && (
          <div className="via-summary-list">
            {packageItems.map((item) => {
              const editing = editingDayItemId === item.id
              const summary = itemSummary(item)
              return (
                <div key={item.id}>
                  <div
                    className={`via-summary-row day-item-summary-row${
                      editing ? ' is-editing' : ''
                    }`}
                  >
                    <span
                      className={`day-item-badge type-${item.type}`}
                      aria-hidden="true"
                    >
                      <AttractionIcon size={18} />
                    </span>
                    <div className="via-summary-main">
                      <span className="chip">{itemTypeLabel(item.type)}</span>
                      <span className="via-summary-city">
                        {item.title || itemTypeLabel(item.type)}
                      </span>
                      {!editing && summary && (
                        <span className="meta via-summary-address">
                          {summary}
                        </span>
                      )}
                      {!editing && item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="meta"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Åpne lenke
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`icon-btn ${
                        editing ? 'icon-btn-close' : ''
                      }`}
                      title={editing ? 'Lukk redigering' : 'Rediger'}
                      aria-label={
                        editing
                          ? `Lukk redigering av ${item.title || 'pakketur'}`
                          : `Rediger ${item.title || 'pakketur'}`
                      }
                      onClick={() =>
                        setEditingDayItemId(editing ? null : item.id)
                      }
                    >
                      {editing ? <CloseIcon /> : <PencilIcon />}
                    </button>
                  </div>
                  {editing && (
                    <DayItemEditor
                      embedded
                      item={item}
                      onChange={(next) => updateItemById(item.id, next)}
                      onRemove={() => removeItemById(item.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {packagesModuleOn && (
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={addPackageTour}
          >
            + Pakketur
          </button>
        )}
      </div>
      )}

      <div className="stack">
        <h3 className="section-title" style={{ fontSize: '1.2rem' }}>
          Utflukter
        </h3>
        <p className="section-sub">
          Ting å gjøre i byen — ikke reise videre til neste sted (bruk Reise).
        </p>

        {excursionItems.length === 0 &&
          editingDayItemId === null && (
          <p className="empty">Ingen utflukter ennå.</p>
        )}

        {excursionItems.length > 0 && (
          <div className="via-summary-list">
            {excursionItems.map((item) => {
              const editing = editingDayItemId === item.id
              const summary = itemSummary(item)
              return (
                <div key={item.id}>
                  <div
                    className={`via-summary-row day-item-summary-row${
                      editing ? ' is-editing' : ''
                    }`}
                  >
                    <span
                      className={`day-item-badge type-${item.type}`}
                      aria-hidden="true"
                    >
                      <AttractionIcon size={18} />
                    </span>
                    <div className="via-summary-main">
                      <span className="chip">{itemTypeLabel(item.type)}</span>
                      <span className="via-summary-city">
                        {item.title || itemTypeLabel(item.type)}
                      </span>
                      {!editing && summary && (
                        <span className="meta via-summary-address">
                          {summary}
                        </span>
                      )}
                      {!editing && item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="meta"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Åpne lenke
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`icon-btn ${
                        editing ? 'icon-btn-close' : ''
                      }`}
                      title={editing ? 'Lukk redigering' : 'Rediger'}
                      aria-label={
                        editing
                          ? `Lukk redigering av ${item.title || 'utflukt'}`
                          : `Rediger ${item.title || 'utflukt'}`
                      }
                      onClick={() =>
                        setEditingDayItemId(editing ? null : item.id)
                      }
                    >
                      {editing ? <CloseIcon /> : <PencilIcon />}
                    </button>
                  </div>
                  {editing && (
                    <DayItemEditor
                      embedded
                      item={item}
                      onChange={(next) => updateItemById(item.id, next)}
                      onRemove={() => removeItemById(item.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={addExcursion}
        >
          + Utflukt
        </button>
      </div>

      <div className="toolbar">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving || !canSave || !cityReady}
          title={!cityReady ? 'Velg by først' : undefined}
        >
          {saving ? 'Lagrer…' : 'Lagre'}
        </button>
        <button className="btn btn-soft" type="button" onClick={onCancel}>
          Avbryt
        </button>
        {onInsertDayAfter && initial.id && (
          <button
            className="btn btn-soft"
            type="button"
            disabled={saving || dirty}
            title={
              dirty
                ? 'Lagre dagen først'
                : 'Sett inn en dag etter denne — senere dager flyttes én dag frem'
            }
            onClick={() => onInsertDayAfter()}
          >
            Sett inn dag etter
          </button>
        )}
        {onDelete && (
          <button
            className="btn btn-danger"
            type="button"
            disabled={saving}
            onClick={() => void onDelete()}
          >
            Slett dag
          </button>
        )}
      </div>
    </form>
  )
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [trips, setTrips] = useState<Trip[]>([])
  const [days, setDays] = useState<TripDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newTrip, setNewTrip] = useState<TripInput>({
    name: '',
    startDate: '',
    endDate: '',
    colorByCountry: {},
    features: emptyTripFeatures(),
  })
  const [showNewTrip, setShowNewTrip] = useState(false)
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
            const tripDays = await api.listDays(trip.id)
            counts[trip.id] = tripStats(tripDays)
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

  async function loadDays(tripId: string) {
    setError('')
    try {
      const list = await api.listDays(tripId)
      const hasDupes = list.some(
        (d, _, arr) => arr.filter((x) => x.date === d.date).length > 1,
      )
      const merged = hasDupes
        ? await mergeDuplicateTripDays(list, api.updateDay, api.deleteDay)
        : list
      setDays(sortTripDays(merged))
      setTripDayCounts((prev) => ({
        ...prev,
        [tripId]: tripStats(merged),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente dager')
    }
  }

  useEffect(() => {
    void loadTrips()
  }, [])

  useEffect(() => {
    if (
      view.name === 'trip' ||
      view.name === 'day' ||
      view.name === 'city' ||
      view.name === 'expenses'
    ) {
      void loadDays(view.tripId)
    }
  }, [view.name === 'home' ? 'home' : view.tripId])

  const activeTrip = useMemo(() => {
    if (view.name === 'home') return null
    return trips.find((t) => t.id === view.tripId) || null
  }, [trips, view])

  const cityGroups = useMemo(() => groupDaysByCity(days), [days])

  async function handleCreateTrip() {
    if (!newTrip.name.trim()) return
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
      })
      setShowNewTrip(false)
      setNewTrip({
        name: '',
        startDate: '',
        endDate: '',
        colorByCountry: {},
        features: emptyTripFeatures(),
      })
      await loadTrips()
      setView({ name: 'trip', tripId: created.id, tab: 'liste' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette tur')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTrip(tripId: string) {
    if (!confirm('Slette hele turen og alle dager?')) return
    setSaving(true)
    setError('')
    try {
      await api.deleteTrip(tripId)
      setView({ name: 'home' })
      await loadTrips()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette tur')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateTripFeatures(
    trip: Trip,
    patch: Partial<TripFeatures>,
  ) {
    setError('')
    const nextFeatures: TripFeatures = {
      ...emptyTripFeatures(),
      ...trip.features,
      ...patch,
    }
    const { id, createdAt: _c, updatedAt: _u, ...rest } = trip
    try {
      const updated = await api.updateTrip(id, {
        ...rest,
        features: nextFeatures,
      })
      setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kunne ikke oppdatere turvalg',
      )
    }
  }

  async function handleInsertDayAfter(afterDay: TripDay) {
    const insertDate = addDaysIso(afterDay.date, 1)
    const laterCount = days.filter((d) => d.date >= insertDate).length
    const ok = confirm(
      laterCount > 0
        ? `Sett inn en dag etter ${formatDateNO(afterDay.date)}?\n\n${laterCount} senere dag${laterCount === 1 ? '' : 'er'} flyttes én dag frem i tid.`
        : `Sett inn en dag etter ${formatDateNO(afterDay.date)}?`,
    )
    if (!ok) return
    setSaving(true)
    setError('')
    try {
      const created = await insertCalendarDayAfter(
        afterDay.tripId,
        afterDay.date,
        days,
        api.createDay,
        api.updateDay,
      )
      const latest = await api.listDays(afterDay.tripId)
      const last = latestTripDayDate(latest)
      const trip = trips.find((t) => t.id === afterDay.tripId)
      if (trip && last && (!trip.endDate || trip.endDate < last)) {
        const { id, createdAt: _c, updatedAt: _u, ...rest } = trip
        const updated = await api.updateTrip(id, { ...rest, endDate: last })
        setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)))
      }
      setDays(sortTripDays(latest))
      setTripDayCounts((prev) => ({
        ...prev,
        [afterDay.tripId]: tripStats(latest),
      }))
      setView({ name: 'day', tripId: afterDay.tripId, dayId: created.id })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kunne ikke sette inn dag',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveDay(dayId: string, direction: -1 | 1) {
    const ordered = sortTripDays(days)
    const idx = ordered.findIndex((d) => d.id === dayId)
    const other = ordered[idx + direction]
    if (idx < 0 || !other) return
    setSaving(true)
    setError('')
    try {
      const next = await swapTripDayDates(
        ordered[idx],
        other,
        ordered,
        api.updateDay,
      )
      setDays(next)
      setTripDayCounts((prev) => ({
        ...prev,
        [ordered[idx].tripId]: tripStats(next),
      }))
      // Refresh from server so kart/liste always see the saved order.
      await loadDays(ordered[idx].tripId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kunne ikke bytte rekkefølge',
      )
      await loadDays(ordered[idx].tripId)
    } finally {
      setSaving(false)
    }
  }

  if (view.name === 'home') {
    return (
      <div className="app-shell">
        <header className="hero">
          <h1 className="brand">Reise</h1>
          <p className="hero-lead">
            Planlegg turen dag for dag — byer, hotell og lenker samlet på ett sted.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowNewTrip(true)}
            >
              Ny tur
            </button>
            <GoogleLoginButton />
            <button className="btn btn-ghost" type="button" onClick={() => void loadTrips()}>
              Oppdater
            </button>
          </div>
        </header>

        <section className="panel">
          <h2 className="section-title">Dine turer</h2>
          <p className="section-sub">Velg en tur for dag-for-dag-plan, kalender og tidslinje.</p>
          {error && <p className="error">{error}</p>}
          {loading && <p className="empty">Henter turer…</p>}
          {!loading && trips.length === 0 && (
            <p className="empty">Ingen turer ennå. Opprett den første.</p>
          )}
          <div className="trip-list">
            {trips.map((trip) => {
              const stats = tripDayCounts[trip.id]
              return (
                <button
                  key={trip.id}
                  type="button"
                  className="trip-row"
                  onClick={() => setView({ name: 'trip', tripId: trip.id, tab: 'liste' })}
                >
                  <div>
                    <h3>{trip.name}</h3>
                    <p className="meta">{formatDateRange(trip.startDate, trip.endDate)}</p>
                  </div>
                  <span className="chip">
                    {stats
                      ? `${stats.dayCount} dager · ${stats.cityCount} byer · ${stats.countryCount} land`
                      : '…'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {showNewTrip && (
          <section className="panel">
            <h2 className="section-title">Ny tur</h2>
            <div className="form-grid">
              <label className="full">
                Navn
                <input
                  autoFocus
                  value={newTrip.name}
                  onChange={(e) => setNewTrip({ ...newTrip, name: e.target.value })}
                  placeholder="Italia våren 2026"
                />
              </label>
              <label>
                Startdato
                <DatePickerField
                  value={newTrip.startDate}
                  onChange={(startDate) => setNewTrip({ ...newTrip, startDate })}
                />
              </label>
              <label>
                Sluttdato
                <DatePickerField
                  value={newTrip.endDate}
                  onChange={(endDate) => setNewTrip({ ...newTrip, endDate })}
                />
              </label>
              <fieldset className="full trip-features-fieldset">
                <legend>Innhold på turen</legend>
                <p className="section-sub" style={{ marginTop: 0 }}>
                  Velg moduler du trenger. Uten cruise holder dagskjemaet seg
                  kompakt.
                </p>
                <div className="trip-features-options">
                  <label className="trip-feature-option">
                    <input
                      type="checkbox"
                      checked={!!newTrip.features?.cruise}
                      onChange={(e) =>
                        setNewTrip({
                          ...newTrip,
                          features: {
                            ...emptyTripFeatures(),
                            ...newTrip.features,
                            cruise: e.target.checked,
                          },
                        })
                      }
                    />
                    Cruise
                  </label>
                  <label className="trip-feature-option">
                    <input
                      type="checkbox"
                      checked={!!newTrip.features?.packages}
                      onChange={(e) =>
                        setNewTrip({
                          ...newTrip,
                          features: {
                            ...emptyTripFeatures(),
                            ...newTrip.features,
                            packages: e.target.checked,
                          },
                        })
                      }
                    />
                    Pakketurer
                  </label>
                </div>
              </fieldset>
            </div>
            <div className="toolbar" style={{ marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={saving || !newTrip.name.trim()}
                onClick={() => void handleCreateTrip()}
              >
                Opprett
              </button>
              <button
                className="btn btn-soft"
                type="button"
                onClick={() => setShowNewTrip(false)}
              >
                Avbryt
              </button>
            </div>
          </section>
        )}
      </div>
    )
  }

  if (view.name === 'day') {
    const existing = view.dayId === 'new' ? null : days.find((d) => d.id === view.dayId)
    const nextDate = (() => {
      if (days.length === 0) {
        return (
          activeTrip?.startDate || new Date().toISOString().slice(0, 10)
        )
      }
      const latest = [...days].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.sortOrder - b.sortOrder
      }).at(-1)!
      return addDaysIso(latest.date, 1)
    })()
    const initial: TripDayInput & { id?: string } =
      existing || emptyDay(view.tripId, nextDate, days.length)

    return (
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1>{existing ? formatNiceDate(existing.date) : 'Ny dag'}</h1>
            <p>{activeTrip?.name || 'Tur'}</p>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setView({ name: 'trip', tripId: view.tripId, tab: 'liste' })}
          >
            Tilbake
          </button>
        </div>
        <section className="panel">
          {error && <p className="error">{error}</p>}
          <DayForm
            initial={initial}
            tripDays={days}
            tripFeatures={activeTrip?.features}
            saving={saving}
            onCancel={() => setView({ name: 'trip', tripId: view.tripId, tab: 'liste' })}
            onInsertDayAfter={
              existing
                ? () => void handleInsertDayAfter(existing)
                : undefined
            }
            onDelete={
              existing
                ? async () => {
                    if (!confirm('Slette denne dagen?')) return
                    setSaving(true)
                    try {
                      await api.deleteDay(existing.id)
                      setView({ name: 'trip', tripId: view.tripId, tab: 'liste' })
                      await loadDays(view.tripId)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Kunne ikke slette')
                    } finally {
                      setSaving(false)
                    }
                  }
                : undefined
            }
            onSaveHotelStay={async (sourceDayId, hotel) => {
              const source = days.find((d) => d.id === sourceDayId)
              if (!source) throw new Error('Fant ikke innsjekksdagen')
              const nextItems = (source.items || []).map((item) =>
                item.id === hotel.id ? hotel : item,
              )
              const { id, createdAt: _c, updatedAt: _u, ...rest } = source
              const payload = { ...rest, items: nextItems }
              await api.updateDay(id, payload)
              const latest = await api.listDays(view.tripId)
              await ensureHotelStayDays(
                view.tripId,
                payload,
                latest,
                api.createDay,
                api.updateDay,
              )
              await loadDays(view.tripId)
            }}
            onRemoveHotelStay={async (sourceDayId, hotelId) => {
              const source = days.find((d) => d.id === sourceDayId)
              if (!source) return
              const nextItems = (source.items || []).filter((i) => i.id !== hotelId)
              const { id, createdAt: _c, updatedAt: _u, ...rest } = source
              await api.updateDay(id, { ...rest, items: nextItems })
              await loadDays(view.tripId)
            }}
            onSaveCruiseStay={async (
              sourceDayId,
              cruise,
              patches,
              dayItemsByDate,
            ) => {
              const source = days.find((d) => d.id === sourceDayId)
              if (!source) throw new Error('Fant ikke embark-dagen')
              let nextItems = (source.items || []).map((item) =>
                item.id === cruise.id ? cruise : item,
              )
              const embDayItems = dayItemsByDate?.[source.date]
              if (embDayItems) {
                nextItems = mergeDayActivityItems(nextItems, embDayItems)
              }
              const embPatch = (patches || []).find(
                (p) => p.date === source.date,
              )
              const home = cruiseHomePort(cruise)
              const { id, createdAt: _c, updatedAt: _u, ...rest } = source
              const embAtSea = embPatch ? embPatch.atSea : !!rest.atSea
              const embCity = embAtSea
                ? AT_SEA_LABEL
                : (
                    embPatch?.city ||
                    rest.city ||
                    home ||
                    ''
                  ).trim()
              const embCountry = embAtSea
                ? ''
                : (embPatch?.country || rest.country || '').trim()
              const payload = {
                ...rest,
                items: nextItems,
                atSea: embAtSea,
                city: embCity,
                country: embCountry,
                arriveTime: embPatch
                  ? embPatch.atSea
                    ? ''
                    : (embPatch.arriveTime || '').trim()
                  : rest.arriveTime || '',
                leaveTime: embPatch
                  ? embPatch.atSea
                    ? ''
                    : (embPatch.leaveTime || cruise.startTime || '').trim()
                  : (rest.leaveTime || cruise.startTime || '').trim(),
              }
              await api.updateDay(id, payload)
              const latest = await api.listDays(view.tripId)
              await ensureCruiseDays(
                view.tripId,
                payload,
                latest,
                api.createDay,
                api.updateDay,
                patches,
              )
              if (dayItemsByDate && Object.keys(dayItemsByDate).length) {
                const afterCruise = await api.listDays(view.tripId)
                for (const [date, dayItems] of Object.entries(dayItemsByDate)) {
                  if (date === source.date) continue
                  const found = afterCruise.find((d) => d.date === date)
                  if (!found) continue
                  const merged = mergeDayActivityItems(found.items, dayItems)
                  const {
                    id: dayId,
                    createdAt: _dc,
                    updatedAt: _du,
                    ...dayRest
                  } = found
                  await api.updateDay(dayId, { ...dayRest, items: merged })
                }
              }
              await loadDays(view.tripId)
            }}
            onRemoveCruiseStay={async (sourceDayId, cruiseId) => {
              const source = days.find((d) => d.id === sourceDayId)
              if (!source) return
              const nextItems = (source.items || []).filter((i) => i.id !== cruiseId)
              const { id, createdAt: _c, updatedAt: _u, ...rest } = source
              await api.updateDay(id, { ...rest, items: nextItems })
              await loadDays(view.tripId)
            }}
            onSave={async (day, cruisePatches, cruiseDayItemsByDate) => {
              setSaving(true)
              setError('')
              try {
                let savedId = existing?.id
                if (existing) {
                  await api.updateDay(existing.id, day)
                } else {
                  // One calendar day per date — merge into an existing row if any.
                  const before = await api.listDays(view.tripId)
                  const clash = before.find((d) => d.date === day.date)
                  if (clash) {
                    const {
                      id: clashId,
                      createdAt: _cc,
                      updatedAt: _cu,
                      ...clashRest
                    } = clash
                    await api.updateDay(clashId, {
                      ...clashRest,
                      ...day,
                      items: day.items?.length ? day.items : clash.items,
                      viaPoints: day.viaPoints?.length
                        ? day.viaPoints
                        : clash.viaPoints,
                      legs: day.legs?.length ? day.legs : clash.legs,
                      arriveTime:
                        day.arriveTime?.trim() || clash.arriveTime || '',
                      leaveTime:
                        day.leaveTime?.trim() || clash.leaveTime || '',
                      city: day.city.trim() || clash.city,
                      country: day.country.trim() || clash.country,
                    })
                    savedId = clashId
                  } else {
                    const created = await api.createDay(day)
                    savedId = created.id
                  }
                }
                const latest = await api.listDays(view.tripId)
                await ensureHotelStayDays(
                  view.tripId,
                  day,
                  latest,
                  api.createDay,
                  api.updateDay,
                )
                const afterHotel = await api.listDays(view.tripId)
                await ensureCruiseDays(
                  view.tripId,
                  day,
                  afterHotel,
                  api.createDay,
                  api.updateDay,
                  cruisePatches,
                )
                if (
                  cruiseDayItemsByDate &&
                  Object.keys(cruiseDayItemsByDate).length
                ) {
                  const afterCruise = await api.listDays(view.tripId)
                  for (const [date, dayItems] of Object.entries(
                    cruiseDayItemsByDate,
                  )) {
                    if (date === day.date) continue
                    const found = afterCruise.find((d) => d.date === date)
                    if (!found) continue
                    const merged = mergeDayActivityItems(found.items, dayItems)
                    const {
                      id: dayId,
                      createdAt: _dc,
                      updatedAt: _du,
                      ...dayRest
                    } = found
                    await api.updateDay(dayId, { ...dayRest, items: merged })
                  }
                }
                await loadDays(view.tripId)
                if (savedId && view.dayId !== savedId) {
                  setView({
                    name: 'day',
                    tripId: view.tripId,
                    dayId: savedId,
                  })
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Kunne ikke lagre')
                throw err
              } finally {
                setSaving(false)
              }
            }}
          />
        </section>
      </div>
    )
  }

  if (view.name === 'city') {
    const group = cityGroups.find((g) => g.key === view.cityKey)
    const cityMapsUrl =
      group && !isAtSeaDay({ city: group.city, atSea: false }) &&
      group.city !== AT_SEA_LABEL
        ? googleMapsPlaceUrl({
            query: [group.city, group.country].filter(Boolean).join(', '),
          })
        : ''
    return (
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1>{group?.city || 'By'}</h1>
            <p>
              {group?.country || ''} · {activeTrip?.name || 'Tur'}
            </p>
          </div>
          <div className="toolbar">
            {cityMapsUrl && (
              <a
                className="btn btn-soft"
                href={cityMapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Google Maps
              </a>
            )}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setView({ name: 'trip', tripId: view.tripId, tab: 'byer' })
              }
            >
              Tilbake
            </button>
          </div>
        </div>
        <section className="panel">
          {!group && <p className="empty">Fant ikke byen.</p>}
          {group && (
            <div className="stack">
              <div>
                <h2 className="section-title">Hotell</h2>
                {group.hotels.length === 0 && <p className="meta">Ikke satt</p>}
                {group.hotels.map((hotel) => (
                  <div key={hotel.id} className="item-preview item-hotel">
                    <div className="hotel-preview-head">
                      <span className="hotel-badge">
                        <HotelIcon size={18} />
                      </span>
                      <p className="meta" style={{ margin: 0 }}>
                        <strong>{hotel.title || 'Hotell'}</strong>
                        {hotel.url ? (
                          <>
                            {' · '}
                            <a href={hotel.url} target="_blank" rel="noreferrer">
                              {isHotelsComUrl(hotel.url)
                                ? 'Hotels.com'
                                : 'Åpne lenke'}
                            </a>
                          </>
                        ) : (
                          <>
                            {' · '}
                            <a
                              href={hotelsComSearchUrl({
                                hotelName: hotel.title,
                                city: group.city,
                                country: group.country,
                              })}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Søk Hotels.com
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    {hotel.address && <p className="meta">{hotel.address}</p>}
                    <p className="meta">
                      Innsjekk: {hotel.startTime || '—'} · Utsjekk:{' '}
                      {hotel.endTime || '—'}
                      {formatHotelPrice(hotel)
                        ? ` · Pris: ${formatHotelPrice(hotel)}`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
              {group.items.filter((i) => i.type === 'cruise').length > 0 && (
                <div>
                  <h2 className="section-title">Cruise</h2>
                  {group.items
                    .filter((i) => i.type === 'cruise')
                    .map((cruise) => (
                      <div key={cruise.id} className="item-preview item-cruise">
                        <div className="hotel-preview-head">
                          <span className="cruise-badge">
                            <ShipIcon size={18} />
                          </span>
                          <p className="meta" style={{ margin: 0 }}>
                            <strong>{cruise.title || 'Cruise'}</strong>
                            {cruiseHomePort(cruise)
                              ? ` · ${cruiseHomePort(cruise)}`
                              : ''}
                            {` · ${cruiseNights(cruise)} ${
                              cruiseNights(cruise) === 1 ? 'natt' : 'netter'
                            }`}
                            {cruise.cabinNumber?.trim()
                              ? ` · Lugar ${cruise.cabinNumber.trim()}`
                              : ''}
                            {formatItemPrice(cruise)
                              ? ` · ${formatItemPrice(cruise)}`
                              : ''}
                          </p>
                        </div>
                        {summarizeCruiseActivities(cruise.activities) ? (
                          <p className="meta">
                            Hele cruiset:{' '}
                            {summarizeCruiseActivities(cruise.activities)}
                          </p>
                        ) : null}
                        {group.days
                          .map((d) => {
                            const times = formatShipPortTimes(
                              resolveShipPortTimes(d, days),
                            )
                            const dayActs = summarizeDayItems(
                              (d.items || []).filter(
                                (i) =>
                                  i.type !== 'hotel' &&
                                  i.type !== 'cruise' &&
                                  !isTransportType(i.type),
                              ),
                            )
                            if (!times && !dayActs) return null
                            return (
                              <p key={d.id} className="meta day-row-ship">
                                {formatNiceDate(d.date)}
                                {times ? `: ${times}` : ''}
                                {dayActs ? ` · ${dayActs}` : ''}
                              </p>
                            )
                          })
                          .filter(Boolean)}
                      </div>
                    ))}
                </div>
              )}

              {group.items.filter((i) => i.type === 'attraction').length >
                0 && (
                <div>
                  <h2 className="section-title">Utflukter</h2>
                  <div className="item-list">
                    {group.items
                      .filter((i) => i.type === 'attraction')
                      .map((item) => (
                        <div key={item.id} className={`item-preview item-${item.type}`}>
                          <span className="chip">{itemTypeLabel(item.type)}</span>
                          <p className="meta">
                            <strong>{item.title || itemTypeLabel(item.type)}</strong>
                            {itemSummary(item) ? ` · ${itemSummary(item)}` : ''}
                          </p>
                          {item.url && (
                            <p className="meta">
                              <a href={item.url} target="_blank" rel="noreferrer">
                                Åpne lenke
                              </a>
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {group.days.some((d) => (d.viaPoints?.length || 0) >= 2) && (
                <div>
                  <h2 className="section-title">Reise — ankomst fra annen by</h2>
                  <p className="section-sub">
                    Dager du reiser inn til{' '}
                    {group.city === AT_SEA_LABEL ? 'til havs' : group.city} med
                    stopp underveis.
                  </p>
                  <div className="item-list">
                    {group.days
                      .filter((d) => (d.viaPoints?.length || 0) >= 2)
                      .map((day) => (
                        <button
                          key={`route-${day.id}`}
                          type="button"
                          className="city-route-card"
                          onClick={() =>
                            setView({
                              name: 'day',
                              tripId: view.tripId,
                              dayId: day.id,
                            })
                          }
                        >
                          <div className="city-route-head">
                            <h3>{formatNiceDate(day.date)}</h3>
                            <span className="chip">
                              {day.viaPoints.length} stopp
                            </span>
                          </div>
                          <ol className="city-route-steps">
                            {day.viaPoints.map((point, idx) => (
                              <li key={point.id} className="city-route-step">
                                <div className="city-route-stop">
                                  <span className="city-route-index">{idx + 1}</span>
                                  <div>
                                    <strong>{point.title || `Stopp ${idx + 1}`}</strong>
                                    {point.address && (
                                      <p className="meta">{point.address}</p>
                                    )}
                                    {(point.arriveTime || point.leaveTime) && (
                                      <p className="meta">
                                        {[
                                          point.arriveTime
                                            ? `Ankomst ${point.arriveTime}`
                                            : '',
                                          point.leaveTime
                                            ? `Avreise ${point.leaveTime}`
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {idx < day.viaPoints.length - 1 && day.legs?.[idx] && (
                                  <div className="city-route-leg">
                                    <TransportBadge
                                      mode={day.legs[idx].mode}
                                      detail={
                                        [
                                          day.legs[idx].title,
                                          [
                                            day.legs[idx].startTime,
                                            day.legs[idx].endTime,
                                          ]
                                            .filter(Boolean)
                                            .join('–'),
                                          formatDeparturesLabel(
                                            day.legs[idx].departures,
                                          )
                                            ? `alt. ${formatDeparturesLabel(
                                                day.legs[idx].departures,
                                              )}`
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' · ') || undefined
                                      }
                                    />
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                          <p className="meta city-route-summary">
                            {formatViaRouteDetailed(day.viaPoints, day.legs)}
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="section-title">Dager i byen</h2>
                <div className="trip-list">
                  {group.days.map((day) => {
                    const viaCount = day.viaPoints?.length || 0
                    return (
                      <button
                        key={day.id}
                        type="button"
                        className="day-row"
                        onClick={() =>
                          setView({
                            name: 'day',
                            tripId: view.tripId,
                            dayId: day.id,
                          })
                        }
                      >
                        <div>
                          <h3>{formatNiceDate(day.date)}</h3>
                          {formatShipPortTimes(
                            resolveShipPortTimes(day, days),
                          ) ? (
                            <p className="meta day-row-ship">
                              {formatShipPortTimes(
                                resolveShipPortTimes(day, days),
                              )}
                            </p>
                          ) : null}
                          <p className="meta">
                            {viaCount >= 2
                              ? formatViaRouteDetailed(day.viaPoints, day.legs)
                              : summarizeViaRoute(day.viaPoints) ||
                                summarizeDayItems(day.items) ||
                                day.notes ||
                                'Ingen detaljer'}
                          </p>
                        </div>
                        <span className="chip">
                          {viaCount >= 2 ? `${viaCount} stopp` : 'Åpne'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  if (view.name === 'expenses') {
    const stats = tripDayCounts[view.tripId] || tripStats(days)
    return (
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1>Utgifter</h1>
            <p>
              {activeTrip?.name || 'Tur'}
              {' · '}
              {formatDateRange(
                activeTrip?.startDate || '',
                activeTrip?.endDate || '',
              )}
              {' · '}
              {stats.dayCount} dager
            </p>
          </div>
          <div className="toolbar">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setView({ name: 'trip', tripId: view.tripId, tab: 'liste' })
              }
            >
              Tilbake til reisen
            </button>
          </div>
        </div>
        <section className="panel">
          {error && <p className="error">{error}</p>}
          <ExpensesView days={days} />
        </section>
      </div>
    )
  }

  // trip view
  const tab = view.tab
  const stats = tripDayCounts[view.tripId] || tripStats(days)

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1>{activeTrip?.name || 'Tur'}</h1>
          <p>
            {formatDateRange(activeTrip?.startDate || '', activeTrip?.endDate || '')}
            {' · '}
            {stats.dayCount} dager · {stats.cityCount} byer · {stats.countryCount} land
          </p>
          {activeTrip && (
            <div className="trip-features-bar" aria-label="Innhold på turen">
              <label className="trip-feature-option">
                <input
                  type="checkbox"
                  checked={tripHasCruise(activeTrip)}
                  onChange={(e) =>
                    void handleUpdateTripFeatures(activeTrip, {
                      cruise: e.target.checked,
                    })
                  }
                />
                Cruise
              </label>
              <label className="trip-feature-option">
                <input
                  type="checkbox"
                  checked={tripHasPackages(activeTrip)}
                  onChange={(e) =>
                    void handleUpdateTripFeatures(activeTrip, {
                      packages: e.target.checked,
                    })
                  }
                />
                Pakketurer
              </label>
            </div>
          )}
        </div>
        <div className="toolbar">
          <GoogleLoginButton />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setView({ name: 'day', tripId: view.tripId, dayId: 'new' })}
            title={
              latestTripDayDate(days)
                ? `Legger til dagen etter ${formatDateNO(latestTripDayDate(days))}`
                : 'Legg til første dag'
            }
          >
            Ny dag etter siste
          </button>
          <button
            className="btn btn-soft"
            type="button"
            onClick={() =>
              setView({ name: 'expenses', tripId: view.tripId })
            }
          >
            Utgifter
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!activeTrip || days.length === 0}
            title="Last ned .ics til Gmail, Outlook, Apple Kalender m.fl."
            onClick={() => {
              if (!activeTrip) return
              downloadTripIcs(activeTrip, days)
            }}
          >
            Eksporter kalender
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setView({ name: 'home' })}
          >
            Alle turer
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => void handleDeleteTrip(view.tripId)}
          >
            Slett tur
          </button>
        </div>
      </div>

      <section className="panel">
        {error && <p className="error">{error}</p>}
        <div className="tabs" role="tablist">
          {(
            [
              ['liste', 'Liste'],
              ['kalender', 'Kalender'],
              ['tidslinje', 'Tidslinje'],
              ['byer', 'Byer'],
              ['kart', 'Kart'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="tab"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setView({ name: 'trip', tripId: view.tripId, tab: id })}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'liste' && (
          <div className="trip-list">
            {days.length === 0 && (
              <p className="empty">Ingen dager ennå. Legg inn første dag i reiseruten.</p>
            )}
            {sortTripDays(days).map((day, dayIndex, orderedDays) => {
              const canMoveUp = dayIndex > 0
              const canMoveDown = dayIndex < orderedDays.length - 1
              let place = dayPlaceLabel(day)
              // Embark/disembark without city: fall back to cruise home port.
              if (place === 'Uten by') {
                const home =
                  cruisesCoveringDay(days, day.date)
                    .map((s) => cruiseHomePort(s.cruise))
                    .find(Boolean) ||
                  cruisesDisembarkingOnDay(days, day.date)
                    .map((s) => cruiseHomePort(s.cruise))
                    .find(Boolean) ||
                  ''
                if (home) place = home
              }
              const tone = dayToneClass(day.date)
              const checkouts = hotelsCheckingOutOnDay(days, day.date)
              // Overnight hotel (already checked in earlier) — not today's check-in.
              const stayingOn = hotelsStayingOnDay(days, day.date).filter(
                (s) => s.checkInDay.id !== day.id,
              )
              const lineArrive = formatShipArriveLabel(day, days)
              const lineDepart = formatShipDepartLabel(day, days)
              const lineStay = [
                summarizeCheckoutHotels(checkouts),
                summarizeStayingHotels(stayingOn),
              ]
                .filter(Boolean)
                .join(' · ')
              const lineTransport = [
                summarizeViaRoute(day.viaPoints),
                summarizeTransportItems(day.items),
              ]
                .filter(Boolean)
                .join(' · ')
              const lineUpcoming = summarizeCheckInHotels(day.items)
              const cruiseStaysOnDay = [
                ...cruisesCoveringDay(days, day.date),
                ...cruisesDisembarkingOnDay(days, day.date),
              ].filter(
                (s, i, arr) =>
                  arr.findIndex((x) => x.cruise.id === s.cruise.id) === i,
              )
              // Whole-cruise activities apply on every day of the sailing.
              const wholeCruiseActs = cruiseStaysOnDay
                .map((s) => summarizeCruiseActivities(s.cruise.activities))
                .filter(Boolean)
                .join(' · ')
              // Costs registered on this cruise day only.
              const cruiseDayCosts = cruiseStaysOnDay
                .map((s) =>
                  summarizeCruiseCosts(
                    costsForCruiseDay(s.cruise.dayCosts, day.date),
                  ),
                )
                .filter(Boolean)
                .join(' · ')
              const dayAttractions = (day.items || []).filter(
                (i) =>
                  i.type !== 'cruise' &&
                  i.type !== 'hotel' &&
                  !isTransportType(i.type),
              )
              const lineActivities = [
                wholeCruiseActs || null,
                cruiseDayCosts || null,
                summarizeAttractionTitles(dayAttractions) || null,
              ]
                .filter(Boolean)
                .join(' · ')
              const lineExtra = day.notes?.trim() || ''
              return (
              <div
                key={day.id}
                className={['day-row', tone].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className="day-row-open"
                  onClick={() =>
                    setView({ name: 'day', tripId: view.tripId, dayId: day.id })
                  }
                >
                  <div className="day-row-main">
                    <h3>
                      {formatNiceDate(day.date)}
                      {place !== 'Uten by' ? ` · ${place}` : ''}
                      {tone === 'is-today' ? (
                        <span className="day-today-badge"> I dag</span>
                      ) : null}
                    </h3>
                    {lineArrive ? (
                      <p className="meta day-row-line day-row-ship">
                        {lineArrive}
                      </p>
                    ) : null}
                    {lineStay ? (
                      <p className="meta day-row-line">{lineStay}</p>
                    ) : null}
                    {lineActivities ? (
                      <p className="meta day-row-line day-row-activities">
                        {lineActivities}
                      </p>
                    ) : null}
                    {lineTransport ? (
                      <p className="meta day-row-line day-row-transport">
                        {lineTransport}
                      </p>
                    ) : null}
                    {lineUpcoming ? (
                      <p className="meta day-row-line day-row-upcoming">
                        {lineUpcoming}
                      </p>
                    ) : null}
                    {lineExtra ? (
                      <p className="meta day-row-line">{lineExtra}</p>
                    ) : null}
                    {lineDepart ? (
                      <p className="meta day-row-line day-row-ship day-row-depart">
                        {lineDepart}
                      </p>
                    ) : null}
                    {!lineArrive &&
                      !lineDepart &&
                      !lineStay &&
                      !lineActivities &&
                      !lineTransport &&
                      !lineUpcoming &&
                      !lineExtra && (
                        <p className="meta day-row-line">Trykk for detaljer</p>
                      )}
                  </div>
                  <div className="day-row-aside">
                    {!isAtSeaDay(day) && day.city && day.date && (
                      <DayWeatherCard
                        city={day.city}
                        country={day.country}
                        date={day.date}
                        compact
                      />
                    )}
                  </div>
                </button>
                <div className="day-row-actions">
                  <div className="day-row-reorder" role="group" aria-label="Rekkefølge">
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      disabled={saving || !canMoveUp}
                      title="Flytt tidligere"
                      aria-label="Flytt dagen tidligere"
                      onClick={() => void handleMoveDay(day.id, -1)}
                    >
                      <ChevronUpIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      disabled={saving || !canMoveDown}
                      title="Flytt senere"
                      aria-label="Flytt dagen senere"
                      onClick={() => void handleMoveDay(day.id, 1)}
                    >
                      <ChevronDownIcon />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm day-row-insert"
                    disabled={saving}
                    title="Sett inn en dag etter denne — senere dager flyttes én dag frem"
                    onClick={() => void handleInsertDayAfter(day)}
                  >
                    + Sett inn dag
                  </button>
                </div>
              </div>
              )
            })}
            {days.length > 0 && (
              <div className="trip-list-footer">
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() =>
                    setView({
                      name: 'day',
                      tripId: view.tripId,
                      dayId: 'new',
                    })
                  }
                >
                  + Ny dag etter siste
                  {latestTripDayDate(days)
                    ? ` (${formatDateNO(addDaysIso(latestTripDayDate(days), 1))})`
                    : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'kalender' && (
          <CalendarView
            days={days}
            onOpenDay={(id) => setView({ name: 'day', tripId: view.tripId, dayId: id })}
          />
        )}

        {tab === 'tidslinje' && (
          <div className="timeline">
            {days.length === 0 && <p className="empty">Ingen dager å vise.</p>}
            {days.map((day) => {
              const cruiseNames = [
                ...cruisesCoveringDay(days, day.date),
                ...cruisesDisembarkingOnDay(days, day.date),
              ]
                .map((s) => s.cruise.title.trim() || 'Cruise')
                .filter((name, i, arr) => arr.indexOf(name) === i)
              const tone = dayToneClass(day.date)
              const shipTimes = formatShipPortTimes(
                resolveShipPortTimes(day, days),
              )
              return (
              <button
                key={day.id}
                type="button"
                className={['timeline-item', 'timeline-btn', tone]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setView({ name: 'day', tripId: view.tripId, dayId: day.id })}
              >
                <h3>
                  {formatNiceDate(day.date)} — {dayPlaceLabel(day)}
                  {tone === 'is-today' ? (
                    <span className="day-today-badge"> I dag</span>
                  ) : null}
                </h3>
                {shipTimes ? (
                  <p className="meta day-row-ship">{shipTimes}</p>
                ) : null}
                <p className="meta">
                  {[
                    isAtSeaDay(day) ? null : day.country,
                    cruiseNames.length
                      ? cruiseNames.map((n) => `Cruise ${n}`).join(' · ')
                      : null,
                    summarizeCheckoutHotels(hotelsCheckingOutOnDay(days, day.date)),
                    summarizeViaRoute(day.viaPoints),
                    summarizeTransportItems(day.items),
                    summarizeDayItems(
                      (day.items || []).filter(
                        (i) =>
                          i.type !== 'cruise' && !isTransportType(i.type),
                      ),
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </button>
              )
            })}
          </div>
        )}

        {tab === 'byer' && (
          <div className="trip-list">
            {cityGroups.length === 0 && <p className="empty">Ingen byer ennå.</p>}
            {cityGroups.map((group) => {
              const atSea =
                group.city === AT_SEA_LABEL ||
                group.country === AT_SEA_LABEL
              const mapsUrl = atSea
                ? ''
                : googleMapsPlaceUrl({
                    query: [group.city, group.country]
                      .filter(Boolean)
                      .join(', '),
                  })
              return (
                <div key={group.key} className="city-row-wrap">
                  <button
                    type="button"
                    className="city-row"
                    onClick={() =>
                      setView({
                        name: 'city',
                        tripId: view.tripId,
                        cityKey: group.key,
                      })
                    }
                  >
                    <div>
                      <h3>
                        {group.city}
                        <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                          {' '}
                          · {group.country}
                        </span>
                      </h3>
                      <p className="meta">
                        {group.hotels[0]?.title || 'Uten hotell'}
                        {group.hotels[0] && formatHotelPrice(group.hotels[0])
                          ? ` · ${formatHotelPrice(group.hotels[0])}`
                          : ''}{' '}
                        · {group.days.length} dag
                        {group.days.length === 1 ? '' : 'er'} ·{' '}
                        {group.items.length} ting
                      </p>
                      {(() => {
                        const portTimes = group.days
                          .map((d) =>
                            formatShipPortTimes(resolveShipPortTimes(d, days)),
                          )
                          .filter(Boolean)
                        const unique = [...new Set(portTimes)]
                        if (!unique.length) return null
                        return (
                          <p className="meta day-row-line day-row-ship">
                            Skip: {unique.join(' · ')}
                          </p>
                        )
                      })()}
                    </div>
                    <span className="chip">Åpne</span>
                  </button>
                  {mapsUrl && (
                    <a
                      className="city-row-maps"
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`Åpne ${group.city} i Google Maps`}
                    >
                      Maps
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'kart' && (
          <TripMap
            key={tripMapRouteKey(days)}
            days={days}
            tripName={activeTrip?.name || 'Reise'}
          />
        )}
      </section>
    </div>
  )
}
