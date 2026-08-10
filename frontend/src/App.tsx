import { useEffect, useMemo, useRef, useState } from 'react'
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
  ITEM_TYPES,
  LEG_MODES,
  legModeLabel,
  newDayItem,
  newViaPoint,
  formatViaRouteDetailed,
  addDaysIso,
  buildCruiseDayPatches,
  cruiseHomePort,
  cruiseNights,
  cruisesCoveringDay,
  cruisesDisembarkingOnDay,
  dayPlaceLabel,
  ensureCruiseDays,
  ensureHotelStayDays,
  formatViaStopTimes,
  hotelNights,
  hotelsCheckingOutOnDay,
  hotelsStayingOnDay,
  sortViaPointsByArriveTime,
  summarizeCheckoutHotels,
  summarizeDayItems,
  summarizeViaRoute,
  syncRouteLegs,
  tripStats,
  type CruiseDayPatch,
  type CruiseStayRef,
  type DayItem,
  type DayItemType,
  type HotelStayRef,
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
import { CitySuggestFields } from './CitySuggest'
import { TripMap } from './TripMap'

type View =
  | { name: 'home' }
  | { name: 'trip'; tripId: string; tab: TripTab }
  | { name: 'day'; tripId: string; dayId: string | 'new' }
  | { name: 'city'; tripId: string; cityKey: string }

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
  embarkForm: Pick<TripDay, 'city' | 'country' | 'atSea' | 'date'>,
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
    }
  })
}

function CruiseItemEditor({
  cruise,
  embarkDate,
  itinerary,
  onChange,
  onItineraryChange,
  onRemove,
}: {
  cruise: DayItem
  embarkDate: string
  itinerary: CruiseDayPatch[]
  onChange: (cruise: DayItem) => void
  onItineraryChange: (rows: CruiseDayPatch[]) => void
  onRemove: () => void
}) {
  const nights = cruiseNights(cruise)
  const home = cruiseHomePort(cruise)
  const disembarkDate = embarkDate ? addDaysIso(embarkDate, nights) : ''

  function setField<K extends keyof DayItem>(key: K, value: DayItem[K]) {
    onChange({ ...cruise, [key]: value })
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

  function updateRow(idx: number, patch: Partial<CruiseDayPatch>) {
    onItineraryChange(
      itinerary.map((row, i) => {
        if (i !== idx) return row
        const next = { ...row, ...patch }
        if (next.atSea) {
          next.city = AT_SEA_LABEL
          next.country = ''
        }
        return next
      }),
    )
  }

  return (
    <div className="item-card item-cruise via-inline-editor">
      <div className="form-grid">
        <label className="full">
          Skip
          <input
            autoFocus
            value={cruise.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="MSC Orchestra"
          />
        </label>
        <label>
          Netter om bord
          <input
            type="number"
            min={1}
            max={60}
            value={nights}
            onChange={(e) => setNights(Number(e.target.value) || 1)}
          />
        </label>
        <label>
          Embark
          <input
            value={cruise.startTime || ''}
            onChange={(e) => setField('startTime', e.target.value)}
            placeholder="16:00"
          />
        </label>
        <label>
          Disembark
          <input
            value={cruise.endTime || ''}
            onChange={(e) => setField('endTime', e.target.value)}
            placeholder="08:00"
          />
        </label>
        <div className="full">
          <span className="cruise-home-label">Hjemhavn (start og slutt)</span>
          <CitySuggestFields
            className="city-suggest-cruise city-suggest-home-port"
            hideHint
            city={home}
            country={homeCountry}
            cityPlaceholder="Barcelona"
            countryPlaceholder="Spania"
            onCityChange={(city) => setHomePort(city)}
            onCountryChange={(country) => setHomePort(home, country)}
            onSelectPlace={(city, country) => setHomePort(city, country)}
          />
        </div>
        {embarkDate && disembarkDate && (
          <p className="meta full" style={{ margin: 0 }}>
            {formatDateNO(embarkDate)} → {formatDateNO(disembarkDate)} (
            {nights} {nights === 1 ? 'natt' : 'netter'})
          </p>
        )}
        <label className="full">
          Lenke
          <input
            type="url"
            value={cruise.url || ''}
            onChange={(e) => setField('url', e.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="full">
          Notat
          <input
            value={cruise.notes || ''}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </div>

      <div className="cruise-itinerary">
        <h4 className="cruise-itinerary-title">Seilingsplan</h4>
        <div className="cruise-itinerary-list">
          {itinerary.map((row, idx) => (
            <div key={row.date || idx} className="cruise-itinerary-row">
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
                {AT_SEA_LABEL}
              </label>
              {!row.atSea && (
                <CitySuggestFields
                  className="city-suggest-cruise"
                  hideHint
                  city={row.city === AT_SEA_LABEL ? '' : row.city}
                  country={row.country}
                  cityPlaceholder={home || 'Havn'}
                  countryPlaceholder="Spania"
                  onCityChange={(city) => updateRow(idx, { city })}
                  onCountryChange={(country) => updateRow(idx, { country })}
                  onSelectPlace={(city, country) =>
                    updateRow(idx, { city, country, atSea: false })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-danger" onClick={onRemove}>
          Fjern cruise
        </button>
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
  // Always fall back to today's weather in the city when trip-day forecast is out of range.
  const displayDay = arrivalDay || weather.today || weather.days[0] || null
  const showingTodayFallback = Boolean(displayDay && !arrivalDay)
  const showAsToday = Boolean(
    displayDay &&
      (displayDay.isToday ||
        showingTodayFallback ||
        (arrivalDay && isTodayISO(date))),
  )
  const sourceHref = openMeteoForecastUrl(weather.latitude, weather.longitude)

  if (compact) {
    if (!displayDay) return null
    const nowTemp =
      showAsToday && weather.current
        ? Math.round(weather.current.temperature)
        : null
    return (
      <span
        className="weather-pill"
        title={
          showingTodayFallback
            ? `I dag i ${weather.city}: ${displayDay.summary}` +
              (date.trim()
                ? ` (vær for ${formatDateNO(date)} ikke tilgjengelig ennå)`
                : '')
            : `${displayDay.summary} i ${weather.city} ${formatDateNO(displayDay.date)}`
        }
      >
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
            ? `Vær for ${formatDateNO(date)} er ikke tilgjengelig ennå.`
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
    <div className="weather-card weather-side">
      <div className="weather-side-top">
        <span className="weather-glyph" title={displayDay.summary}>
          <WeatherIcon icon={displayDay.icon} size={18} />
        </span>
        <div className="weather-side-temps">
          {showAsToday && weather.current ? (
            <strong>{Math.round(weather.current.temperature)}°</strong>
          ) : (
            <strong>
              {Math.round(displayDay.tempMin)}–{Math.round(displayDay.tempMax)}°
            </strong>
          )}
          <span className="weather-side-summary">{displayDay.summary}</span>
          <span className="meta">
            {showingTodayFallback
              ? `I dag i ${weather.city}`
              : showAsToday
                ? 'I dag'
                : formatDateNO(displayDay.date)}
            {showAsToday && weather.current
              ? ` · ${Math.round(displayDay.tempMin)}–${Math.round(displayDay.tempMax)}°`
              : ''}
            {` · ${displayDay.precipitation.toFixed(0)} mm`}
          </span>
          {showingTodayFallback && date.trim() && (
            <span className="meta">
              Prognose for {formatDateNO(date)} er ikke tilgjengelig ennå.
            </span>
          )}
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
  embedded = false,
}: {
  item: DayItem
  onChange: (item: DayItem) => void
  onRemove: () => void
  /** Used to show hotel checkout date from overnattinger. */
  dayDate?: string
  /** Compact inline editor under a summary row (via-style). */
  embedded?: boolean
}) {
  const transport = isTransportType(item.type)
  const hotel = item.type === 'hotel'
  const nights = hotelNights(item)
  const checkoutDate =
    hotel && dayDate.trim() ? addDaysIso(dayDate, nights) : ''

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
          {hotel ? 'Hotellnavn' : transport ? 'Navn / rute' : 'Navn'}
          <input
            autoFocus={embedded}
            value={item.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={
              hotel
                ? 'Hotel Eden'
                : transport
                  ? 'RY 123 / Intercity'
                  : 'Colosseum'
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
        {(hotel || item.type === 'attraction') && (
          <label className="full">
            Adresse
            <input
              value={item.address || ''}
              onChange={(e) => set('address', e.target.value)}
            />
          </label>
        )}
        <label>
          {hotel ? 'Innsjekk' : transport ? 'Avgang' : 'Tid'}
          <input
            value={item.startTime || ''}
            onChange={(e) => set('startTime', e.target.value)}
            placeholder={hotel ? '15:00' : '10:40'}
          />
        </label>
        <label>
          {hotel ? 'Utsjekk-klokkeslett' : transport ? 'Ankomst' : 'Slutt'}
          <input
            value={item.endTime || ''}
            onChange={(e) => set('endTime', e.target.value)}
            placeholder={hotel ? '11:00' : ''}
          />
        </label>
        {hotel && (
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
        {hotel && checkoutDate && (
          <p className="meta full" style={{ margin: 0 }}>
            Utsjekk-dato: {formatDateNO(checkoutDate)} ({nights}{' '}
            {nights === 1 ? 'natt' : 'netter'})
          </p>
        )}
        <label className={hotel ? '' : 'full'}>
          Lenke
          <input
            type="url"
            value={item.url || ''}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://"
          />
        </label>
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
  onSave,
  onSaveHotelStay,
  onRemoveHotelStay,
  onSaveCruiseStay,
  onRemoveCruiseStay,
  onCancel,
  onDelete,
  saving,
}: {
  initial: TripDayInput & { id?: string }
  tripDays: TripDay[]
  onSave: (
    day: TripDayInput,
    cruisePatches?: CruiseDayPatch[],
  ) => Promise<void>
  /** Persist hotel edits that belong to another day's check-in. */
  onSaveHotelStay: (sourceDayId: string, hotel: DayItem) => Promise<void>
  onRemoveHotelStay: (sourceDayId: string, hotelId: string) => Promise<void>
  onSaveCruiseStay: (
    sourceDayId: string,
    cruise: DayItem,
    patches?: CruiseDayPatch[],
  ) => Promise<void>
  onRemoveCruiseStay: (sourceDayId: string, cruiseId: string) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
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
  const [savingLinkedHotel, setSavingLinkedHotel] = useState(false)
  const [savingLinkedCruise, setSavingLinkedCruise] = useState(false)
  const [dirty, setDirty] = useState(!initial.id)

  const hotels = items.filter((i) => i.type === 'hotel')
  const cruises = items.filter((i) => i.type === 'cruise')
  const otherItems = items.filter(
    (i) => i.type !== 'hotel' && i.type !== 'cruise',
  )
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
  const canSave = dirty || !initial.id

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
    setLinkedCruiseDrafts((prev) => ({ ...prev, [stay.cruise.id]: next }))
    setCruiseItineraries((prev) => ({
      ...prev,
      [stay.cruise.id]: mergeCruiseItinerary(
        stay.embarkDate,
        next,
        tripDays,
        {
          date: stay.embarkDate,
          city: stay.embarkDay.city,
          country: stay.embarkDay.country,
          atSea: stay.embarkDay.atSea,
        },
        prev[stay.cruise.id],
      ),
    }))
  }

  function itineraryFor(
    cruiseId: string,
    cruise: DayItem,
    embarkDate: string,
    embarkForm: Pick<TripDay, 'city' | 'country' | 'atSea' | 'date'>,
  ): CruiseDayPatch[] {
    return (
      cruiseItineraries[cruiseId] ||
      buildCruiseDayPatches(embarkDate, cruise, tripDays, embarkForm)
    )
  }

  async function persistLinkedCruise(stay: CruiseStayRef) {
    const cruise = linkedCruise(stay)
    const patches = itineraryFor(
      cruise.id,
      cruise,
      stay.embarkDate,
      {
        date: stay.embarkDate,
        city: stay.embarkDay.city,
        country: stay.embarkDay.country,
        atSea: stay.embarkDay.atSea,
      },
    )
    setSavingLinkedCruise(true)
    try {
      await onSaveCruiseStay(stay.embarkDay.id, cruise, patches)
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

  function addItem(type: DayItemType) {
    markDirty()
    const item = newDayItem(type, items.length)
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
    setCruiseItineraries((prev) => ({
      ...prev,
      [cruise.id]: buildCruiseDayPatches(form.date, cruise, tripDays, form),
    }))
  }

  function updateItemById(id: string, next: DayItem) {
    markDirty()
    setItems((prev) => prev.map((item) => (item.id === id ? next : item)))
  }

  function updateLocalCruise(id: string, next: DayItem) {
    markDirty()
    setItems((prev) => prev.map((item) => (item.id === id ? next : item)))
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
  }

  function addViaPoint() {
    markDirty()
    // First etappe: create fra + til at once so reisemåte is available immediately.
    if (viaPoints.length === 0) {
      const from = newViaPoint(0)
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
        const cleaned = items
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
              (item.type === 'cruise' && cruiseNights(item) >= 1),
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
        const cruisePatches = localCruises.flatMap((cruise) => {
          const rows = itineraryFor(cruise.id, cruise, form.date, form).map(
            (row) =>
              row.date === form.date
                ? {
                    date: form.date,
                    atSea: isAtSeaDay(form),
                    city: isAtSeaDay(form) ? AT_SEA_LABEL : form.city,
                    country: isAtSeaDay(form) ? '' : form.country,
                  }
                : row.atSea
                  ? { ...row, city: AT_SEA_LABEL, country: '' }
                  : row,
          )
          return rows
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
          items: cleaned,
          viaPoints: keptPoints,
          legs: syncRouteLegs(keptPoints, legs),
          links: form.links || [],
        }
        void onSave(
          dayPayload,
          cruisePatches.length ? cruisePatches : undefined,
        ).then(() => {
          setDirty(false)
          setEditingVia(null)
          setEditingHotelId(null)
          setEditingCruiseId(null)
        })
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
          {!isAtSeaDay(form) && (
            <CitySuggestFields
              city={form.city}
              country={form.country}
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
          )}
        </div>
        {!isAtSeaDay(form) && form.city.trim() && (
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
          Via-rute
        </h3>

        {viaPoints.length === 0 && editingVia === null && (
          <p className="empty">
            Ingen etapper ennå. Første steg åpner fra-by, til-by og reisemåte
            sammen
            {form.city.trim() ? ` (til ${form.city.trim()})` : ''}.
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
                            {viaPoints[0].title || 'Via 1'}
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
                            <input
                              value={viaPoints[0].arriveTime || ''}
                              onChange={(e) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  arriveTime: e.target.value,
                                })
                              }
                              placeholder="10:00"
                            />
                          </label>
                          <label>
                            Avreise
                            <input
                              value={viaPoints[0].leaveTime || ''}
                              onChange={(e) =>
                                updateViaPoint(0, {
                                  ...viaPoints[0],
                                  leaveTime: e.target.value,
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
                          {point.title || `Via ${idx + 1}`}
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
                            <label>
                              Avgang
                              <input
                                value={leg.startTime || ''}
                                onChange={(e) =>
                                  updateLeg(idx, {
                                    ...leg,
                                    startTime: e.target.value,
                                  })
                                }
                                placeholder="11:40"
                              />
                            </label>
                            <label>
                              Ankomst
                              <input
                                value={leg.endTime || ''}
                                onChange={(e) =>
                                  updateLeg(idx, {
                                    ...leg,
                                    endTime: e.target.value,
                                  })
                                }
                                placeholder="12:10"
                              />
                            </label>
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
                        <TransportBadge
                          mode={leg.mode}
                          detail={
                            [
                              leg.title?.trim(),
                              [leg.startTime, leg.endTime]
                                .filter(Boolean)
                                .join('–'),
                            ]
                              .filter(Boolean)
                              .join(' · ') || undefined
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

        <button type="button" className="btn btn-soft btn-sm" onClick={addViaPoint}>
          {viaPoints.length === 0
            ? '+ Legg til etappe (by + reisemåte)'
            : '+ Legg til neste by'}
        </button>
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
                        hotel.endTime?.trim()
                          ? `Utsjekk ${hotel.endTime}`
                          : 'Utsjekk i dag',
                        hotel.address?.trim() || '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
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
                        `Innsjekk ${formatDateNO(stay.checkInDate)}`,
                        `Utsjekk ${formatDateNO(stay.checkoutDate)}`,
                        hotel.startTime || hotel.endTime
                          ? `${hotel.startTime || '—'}–${hotel.endTime || '—'}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
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
                        hotelNights(hotel) > 1) && (
                        <span className="meta via-summary-address">
                          {[
                            hotel.address,
                            hotelNights(hotel) > 1
                              ? `${hotelNights(hotel)} overnattinger`
                              : '',
                            hotel.startTime || hotel.endTime
                              ? `Innsjekk ${hotel.startTime || '—'} · Utsjekk ${hotel.endTime || '—'}`
                              : '',
                            form.date
                              ? `Utsjekk ${formatDateNO(
                                  addDaysIso(form.date, hotelNights(hotel)),
                                )}`
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
                          Åpne lenke
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
                    onChange={(next) => updateLinkedCruise(stay, next)}
                    onItineraryChange={(rows) => {
                      setCruiseItineraries((prev) => ({
                        ...prev,
                        [cruise.id]: rows,
                      }))
                    }}
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
                      setCruiseItineraries((prev) => ({
                        ...prev,
                        [cruise.id]:
                          prev[cruise.id] ||
                          buildCruiseDayPatches(
                            stay.embarkDate,
                            cruise,
                            tripDays,
                            {
                              date: stay.embarkDate,
                              city: stay.embarkDay.city,
                              country: stay.embarkDay.country,
                              atSea: stay.embarkDay.atSea,
                            },
                          ),
                      }))
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
                    onChange={(next) => updateLinkedCruise(stay, next)}
                    onItineraryChange={(rows) => {
                      setCruiseItineraries((prev) => ({
                        ...prev,
                        [cruise.id]: rows,
                      }))
                    }}
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
                      setCruiseItineraries((prev) => ({
                        ...prev,
                        [cruise.id]:
                          prev[cruise.id] ||
                          buildCruiseDayPatches(
                            stay.embarkDate,
                            cruise,
                            tripDays,
                            {
                              date: stay.embarkDate,
                              city: stay.embarkDay.city,
                              country: stay.embarkDay.country,
                              atSea: stay.embarkDay.atSea,
                            },
                          ),
                      }))
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
                      }}
                    >
                      {editing ? <CloseIcon /> : <PencilIcon />}
                    </button>
                  </div>
                  {editing && (
                    <CruiseItemEditor
                      cruise={cruise}
                      embarkDate={form.date}
                      itinerary={itineraryFor(
                        cruise.id,
                        cruise,
                        form.date,
                        form,
                      )}
                      onChange={(next) => updateLocalCruise(cruise.id, next)}
                      onItineraryChange={(rows) => {
                        markDirty()
                        setCruiseItineraries((prev) => ({
                          ...prev,
                          [cruise.id]: rows,
                        }))
                      }}
                      onRemove={() => removeItemById(cruise.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button type="button" className="btn btn-soft btn-sm" onClick={addCruise}>
          + Legg til cruise
        </button>
      </div>

      <div className="stack">
        <h3 className="section-title" style={{ fontSize: '1.2rem' }}>
          På dagen
        </h3>

        {otherItems.length === 0 && editingDayItemId === null && (
          <p className="empty">Ingen elementer ennå.</p>
        )}

        {otherItems.length > 0 && (
          <div className="via-summary-list">
            {otherItems.map((item) => {
              const editing = editingDayItemId === item.id
              const summary = itemSummary(item)
              const transport = isTransportType(item.type)
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
                      {transport ? (
                        <TransportModeIcon mode={item.type} size={18} />
                      ) : (
                        <AttractionIcon size={18} />
                      )}
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
                      title={
                        editing ? 'Lukk redigering' : 'Rediger'
                      }
                      aria-label={
                        editing
                          ? `Lukk redigering av ${item.title || itemTypeLabel(item.type)}`
                          : `Rediger ${item.title || itemTypeLabel(item.type)}`
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

        <div className="add-item-bar">
          {ITEM_TYPES.filter(
            (t) => t.type !== 'hotel' && t.type !== 'cruise',
          ).map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => addItem(type)}
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving || !canSave}
        >
          {saving ? 'Lagrer…' : 'Lagre'}
        </button>
        <button className="btn btn-soft" type="button" onClick={onCancel}>
          Avbryt
        </button>
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
      setDays(list)
      setTripDayCounts((prev) => ({ ...prev, [tripId]: tripStats(list) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente dager')
    }
  }

  useEffect(() => {
    void loadTrips()
  }, [])

  useEffect(() => {
    if (view.name === 'trip' || view.name === 'day' || view.name === 'city') {
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
      })
      setShowNewTrip(false)
      setNewTrip({ name: '', startDate: '', endDate: '', colorByCountry: {} })
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
            saving={saving}
            onCancel={() => setView({ name: 'trip', tripId: view.tripId, tab: 'liste' })}
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
            onSaveCruiseStay={async (sourceDayId, cruise, patches) => {
              const source = days.find((d) => d.id === sourceDayId)
              if (!source) throw new Error('Fant ikke embark-dagen')
              const nextItems = (source.items || []).map((item) =>
                item.id === cruise.id ? cruise : item,
              )
              const { id, createdAt: _c, updatedAt: _u, ...rest } = source
              const payload = { ...rest, items: nextItems }
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
            onSave={async (day, cruisePatches) => {
              setSaving(true)
              setError('')
              try {
                let savedId = existing?.id
                if (existing) {
                  await api.updateDay(existing.id, day)
                } else {
                  const created = await api.createDay(day)
                  savedId = created.id
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
    return (
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1>{group?.city || 'By'}</h1>
            <p>
              {group?.country || ''} · {activeTrip?.name || 'Tur'}
            </p>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setView({ name: 'trip', tripId: view.tripId, tab: 'byer' })}
          >
            Tilbake
          </button>
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
                        {hotel.url && (
                          <>
                            {' · '}
                            <a href={hotel.url} target="_blank" rel="noreferrer">
                              Åpne lenke
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    {hotel.address && <p className="meta">{hotel.address}</p>}
                    <p className="meta">
                      Innsjekk: {hotel.startTime || '—'} · Utsjekk: {hotel.endTime || '—'}
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
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {group.items.filter(
                (i) => i.type !== 'hotel' && i.type !== 'cruise',
              ).length > 0 && (
                <div>
                  <h2 className="section-title">Transport og severdigheter</h2>
                  <div className="item-list">
                    {group.items
                      .filter((i) => i.type !== 'hotel' && i.type !== 'cruise')
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
                  <h2 className="section-title">Via-ruter samme dag</h2>
                  <p className="section-sub">
                    Dager med flere stopp i{' '}
                    {group.city === AT_SEA_LABEL ? 'til havs' : group.city} — med
                    transport mellom stedene.
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
                                    <strong>{point.title || `Via ${idx + 1}`}</strong>
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
                          {viaCount >= 2 ? `${viaCount} via` : 'Åpne'}
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
        </div>
        <div className="toolbar">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setView({ name: 'day', tripId: view.tripId, dayId: 'new' })}
          >
            Ny dag
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
            {days.map((day) => {
              const place = dayPlaceLabel(day)
              const cruiseNames = [
                ...cruisesCoveringDay(days, day.date),
                ...cruisesDisembarkingOnDay(days, day.date),
              ]
                .map((s) => s.cruise.title.trim() || 'Cruise')
                .filter((name, i, arr) => arr.indexOf(name) === i)
              const tone = dayToneClass(day.date)
              return (
              <button
                key={day.id}
                type="button"
                className={['day-row', tone].filter(Boolean).join(' ')}
                onClick={() => setView({ name: 'day', tripId: view.tripId, dayId: day.id })}
              >
                <div>
                  <h3>
                    {formatNiceDate(day.date)}
                    {place !== 'Uten by' ? ` · ${place}` : ''}
                    {tone === 'is-today' ? (
                      <span className="day-today-badge"> I dag</span>
                    ) : null}
                  </h3>
                  <p className="meta">
                    {[
                      isAtSeaDay(day) ? null : day.country,
                      cruiseNames.length
                        ? cruiseNames.map((n) => `Cruise ${n}`).join(' · ')
                        : null,
                      summarizeCheckoutHotels(hotelsCheckingOutOnDay(days, day.date)),
                      summarizeViaRoute(day.viaPoints),
                      summarizeDayItems(
                        (day.items || []).filter((i) => i.type !== 'cruise'),
                      ),
                      day.notes,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Trykk for detaljer'}
                  </p>
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
                  <span className="chip">
                    {day.viaPoints?.length
                      ? `${day.viaPoints.length} via`
                      : day.items?.length
                        ? `${day.items.length} ting`
                        : 'Detaljer'}
                  </span>
                </div>
              </button>
              )
            })}
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
                <p className="meta">
                  {[
                    isAtSeaDay(day) ? null : day.country,
                    cruiseNames.length
                      ? cruiseNames.map((n) => `Cruise ${n}`).join(' · ')
                      : null,
                    summarizeCheckoutHotels(hotelsCheckingOutOnDay(days, day.date)),
                    summarizeViaRoute(day.viaPoints),
                    summarizeDayItems(
                      (day.items || []).filter((i) => i.type !== 'cruise'),
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
            {cityGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                className="city-row"
                onClick={() =>
                  setView({ name: 'city', tripId: view.tripId, cityKey: group.key })
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
                    {group.hotels[0]?.title || 'Uten hotell'} · {group.days.length}{' '}
                    dag
                    {group.days.length === 1 ? '' : 'er'} · {group.items.length} ting
                  </p>
                </div>
                <span className="chip">Åpne</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'kart' && <TripMap days={days} />}
      </section>
    </div>
  )
}
