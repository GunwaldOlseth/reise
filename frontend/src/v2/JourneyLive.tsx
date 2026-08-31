import { useEffect, useMemo, useRef, useState } from 'react'
import { api, mediaUrl, normalizeTravelers } from '../api'
import { TripMap } from '../TripMap'
import { downscaleImage } from './imageResize'
import { localizeCity } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import { CountdownCard, HolidayCountdown, osloWallTimeMs } from './HolidayCountdown'
import { nextScheduledDeparture } from './transportSchedule'
import {
  activitiesForDay,
  activityDisplayName,
  addDaysIso,
  calendarDaysForStop,
  cityStayDays,
  effectiveHotelName,
  formatDateNO,
  formatChangeTimeLabel,
  formatCityStation,
  formatTransportOptionLabel,
  isLiveActivitySkipped,
  liveSkippedActivityIds,
  isPackageStop,
  journeyActivityCalendarBounds,
  journeyDateSpan,
  liveEntryAppliesToTraveler,
  liveEntryTravelers,
  liveHotelAlertText,
  liveKindLabel,
  liveMissingHotelAlerts,
  moveActivityToCalendarDate,
  moveActivityToDay,
  newLiveEntry,
  normalizeLive,
  normalizeSights,
  optionIsTaken,
  chosenFromOptions,
  clearTakenTransportOptions,
  packageFreeDayLabel,
  packageOf,
  replaceDayActivities,
  stopDepartDate,
  stopGoalLabel,
  optionHasTicket,
  todayIsoOslo,
  toggleLiveEntryTraveler,
  transportSegments,
  viaPurpose,
  viaPurposeLabel,
  viaTransportOptions,
  sortTransportOptions,
  withLiveActivitySkip,
  withLiveActivityItemSkip,
  liveStepsOnDate,
  liveStepsOnDateForTraveler,
  liveStepsTotalForTraveler,
  normalizeLiveDailySteps,
  withLiveDailyStepsForTraveler,
  withTakenTransportOption,
  type JourneyLiveDailySteps,
  type Journey,
  type JourneyActivity,
  type JourneyCityDoc,
  type JourneyLiveEntry,
  type JourneyLiveKind,
  type JourneyPhoto,
  type JourneyStop,
  type JourneyTransportOption,
  type JourneyVia,
} from './journeyModel'
import { TrashIcon, TransportModeIcon } from '../TransportModeIcon'
import { useConfirmDelete } from './ConfirmDelete'
import { TicketToggle } from './PurposeToggle'
import { SightList } from './SightList'
import {
  journeyMapRouteKeyForDate,
  journeyMapStopsForDate,
} from './journeyMap'

function formatStepCount(n: number): string {
  return n.toLocaleString('nb-NO')
}

function LiveStepsTravelerRow({
  journey,
  date,
  traveler,
  disabled,
  onChange,
}: {
  journey: Journey
  date: string
  traveler: string
  disabled?: boolean
  onChange: (next: Journey) => void
}) {
  const savedSteps = liveStepsOnDateForTraveler(journey, date, traveler)
  const [input, setInput] = useState(() =>
    savedSteps > 0 ? String(savedSteps) : '',
  )

  useEffect(() => {
    const steps = liveStepsOnDateForTraveler(journey, date, traveler)
    setInput(steps > 0 ? String(steps) : '')
  }, [journey.liveDailySteps, date, traveler])

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, '')
    const n = digits ? Math.min(999999, Math.floor(Number(digits))) : 0
    const display = n > 0 ? String(n) : ''
    setInput(display)
    if (n === savedSteps) return
    onChange(withLiveDailyStepsForTraveler(journey, date, traveler, n))
  }

  return (
    <li className="v2-live-steps-person">
      <span className="v2-live-steps-person-name">{traveler}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="v2-live-steps-input"
        value={input}
        disabled={disabled}
        placeholder="0"
        aria-label={`Skritt for ${traveler}`}
        onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
        onBlur={() => commit(input)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(input)
          }
        }}
      />
      {savedSteps > 0 ? (
        <span className="v2-live-steps-person-saved">
          <strong>{formatStepCount(savedSteps)}</strong>
        </span>
      ) : null}
    </li>
  )
}

function LiveStepsSection({
  journey,
  date,
  travelers,
  disabled,
  tripName,
  onChange,
}: {
  journey: Journey
  date: string
  travelers: string[]
  disabled?: boolean
  tripName?: string
  onChange: (next: Journey) => void
}) {
  const people = normalizeTravelers(travelers)
  const dayTotal = liveStepsOnDate(journey, date)
  const tripTotal = useMemo(() => {
    return people.reduce((sum, name) => {
      return sum + liveStepsTotalForTraveler(journey, name)
    }, 0)
  }, [journey.liveDailySteps, people])
  const history = useMemo(() => {
    const rows = normalizeLiveDailySteps(journey.liveDailySteps).filter(
      (e) => e.date !== date && e.steps > 0,
    )
    const byDate = new Map<string, JourneyLiveDailySteps[]>()
    for (const row of rows) {
      const list = byDate.get(row.date) || []
      list.push(row)
      byDate.set(row.date, list)
    }
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [journey.liveDailySteps, date])
  const dayMapStops = useMemo(
    () => journeyMapStopsForDate(journey, date),
    [journey, date],
  )
  const dayMapKey = useMemo(
    () => journeyMapRouteKeyForDate(journey, date),
    [journey, date],
  )

  return (
    <section className="v2-live-block v2-live-steps">
      <h3>Skritt</h3>
      {people.length === 0 ? (
        <p className="v2-meta v2-live-steps-hint">
          Legg til hvem er med på reisen (under reiseinfo) for å logge skritt
          per person.
        </p>
      ) : (
        <>
          <p className="v2-meta v2-live-steps-hint">
            Registrer skritt for hver person denne dagen.
          </p>
          <ul className="v2-live-steps-people" aria-label="Skritt per person">
            {people.map((name) => (
              <LiveStepsTravelerRow
                key={name}
                journey={journey}
                date={date}
                traveler={name}
                disabled={disabled}
                onChange={onChange}
              />
            ))}
          </ul>
          {dayTotal > 0 ? (
            <p className="v2-meta v2-live-steps-day-total">
              Sammen denne dagen:{' '}
              <strong>{formatStepCount(dayTotal)}</strong> skritt
            </p>
          ) : null}
          {tripTotal > 0 ? (
            <ul className="v2-live-steps-trip-totals" aria-label="Totalt per person">
              {people.map((name) => {
                const total = liveStepsTotalForTraveler(journey, name)
                if (total <= 0) return null
                return (
                  <li key={name}>
                    <span>{name}</span>
                    <span>{formatStepCount(total)} skritt</span>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )}
      {history.length > 0 ? (
        <ul className="v2-live-steps-history" aria-label="Skritt andre dager">
          {history.map(([histDate, rows]) => (
            <li key={histDate}>
              <span>{formatDateNO(histDate)}</span>
              <span className="v2-live-steps-history-people">
                {rows.map((row) => (
                  <span key={`${row.traveler || 'felles'}`}>
                    {row.traveler
                      ? `${row.traveler}: ${formatStepCount(row.steps)}`
                      : formatStepCount(row.steps)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {dayMapStops.length > 0 ? (
        <div className="v2-live-day-map">
          <p className="v2-meta v2-live-day-map-label">Steder denne dagen</p>
          <TripMap
            stops={dayMapStops}
            routeKey={dayMapKey}
            tripName={tripName || 'Reise'}
          />
        </div>
      ) : null}
    </section>
  )
}

function firstStopOnDate(journey: Journey, date: string): JourneyStop | undefined {
  return [...(journey.stops || [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((s) => (s.arriveDate || '').trim() === date)
}

const LIVE_KINDS: { kind: JourneyLiveKind; label: string }[] = [
  { kind: 'food', label: 'Mat' },
  { kind: 'drink', label: 'Drikke' },
  { kind: 'shop', label: 'Kjøpt' },
  { kind: 'other', label: 'Annet' },
]

type DayPlace = {
  stop: JourneyStop
  city: string
  hotel?: string
  notes?: string
  docs?: JourneyCityDoc[]
  arriving: boolean
}

type DayRide = {
  via: JourneyVia
  options: JourneyTransportOption[]
  fromLabel: string
  toLabel: string
  markOvernight: boolean
}

function placeLabel(place: JourneyStop | JourneyVia): string {
  if ('kind' in place) {
    return stopGoalLabel(place, place.kind === 'home' ? 'Hjem' : 'Fra')
  }
  if (place.title?.trim()) return place.title
  return 'Fra'
}

function dayOffsetOn(stop: JourneyStop, date: string): number {
  const arrive = (stop.arriveDate || '').trim()
  if (!arrive || !date) return 0
  const a = new Date(`${arrive}T12:00:00`).getTime()
  const b = new Date(`${date}T12:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

function NextRideCountdowns({
  rides,
  date,
}: {
  rides: DayRide[]
  date: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const items = useMemo(() => {
    const out: {
      id: string
      from: string
      to: string
      time: string
      atMs: number
    }[] = []
    for (const ride of rides) {
      const taken = ride.options.find(optionIsTaken)
      const candidates = taken ? [taken] : ride.options
      for (const opt of candidates) {
        const time = (opt.startTime || '').trim()
        if (!time) continue
        const atMs = osloWallTimeMs(date, time)
        if (!Number.isFinite(atMs) || atMs <= now) continue
        out.push({
          id: `${ride.via.id}:${opt.id}`,
          from: ride.fromLabel,
          to: ride.toLabel,
          time,
          atMs,
        })
      }
    }
    out.sort((a, b) => a.atMs - b.atMs)
    return out.slice(0, 2)
  }, [rides, date, now])

  if (items.length === 0) return null

  return (
    <section
      className="v2-live-ride-countdowns"
      aria-label="Nedtelling til neste avganger"
    >
      {items.map((item, i) => (
        <CountdownCard
          key={item.id}
          compact
          now={now}
          kicker={i === 0 ? 'Neste avgang' : 'Deretter'}
          atMs={item.atMs}
          detail={`${localizeCity(item.from) || item.from} → ${
            localizeCity(item.to) || item.to
          } · ${item.time}`}
        />
      ))}
    </section>
  )
}

function ridesOnDate(journey: Journey, date: string): DayRide[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: DayRide[] = []
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    const arrive = (to.arriveDate || '').trim()
    const depart = (stopDepartDate(from) || '').trim()
    if (arrive !== date && depart !== date) continue
    const leg = (journey.legs || []).find(
      (l) => l.fromStopId === from.id && l.toStopId === to.id,
    )
    const segs = transportSegments(leg)
    for (let s = 0; s < segs.length; s++) {
      const via = segs[s]
      const prev = s === 0 ? from : segs[s - 1]
      const options = sortTransportOptions(viaTransportOptions(via))
      if (!options.length) continue
      out.push({
        via,
        options,
        fromLabel: placeLabel(prev),
        toLabel:
          s === segs.length - 1
            ? formatCityStation(
                via.title || to.city,
                via.station || to.station,
              ) ||
              stopGoalLabel(to, 'Neste')
            : formatCityStation(via.title, via.station) || via.title || 'Neste',
        markOvernight: from.kind !== 'cruise' && to.kind !== 'cruise',
      })
    }
  }
  return out
}

function placesOnDate(journey: Journey, date: string): DayPlace[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: DayPlace[] = []
  for (const stop of stops) {
    if (stop.kind === 'home') {
      if ((stop.arriveDate || '').trim() === date) {
        out.push({
          stop,
          city: stop.city || 'Hjem',
          notes: stop.notes,
          docs: stop.docs,
          arriving: true,
        })
      }
      continue
    }
    if (isPackageStop(stop)) {
      const pack = packageOf(stop)
      const nights = Math.max(1, Math.floor(pack?.nights || 1))
      for (let offset = 0; offset <= nights; offset++) {
        const dayDate = stop.arriveDate
          ? addDaysIso(stop.arriveDate, offset)
          : ''
        if (dayDate !== date) continue
        const day = (pack?.days || []).find((d) => d.offset === offset)
        if (day?.atSea) {
          out.push({
            stop,
            city: packageFreeDayLabel(stop.kind),
            notes: day?.notes,
            docs: day?.docs,
            arriving: offset === 0,
          })
          continue
        }
        out.push({
          stop,
          city:
            day?.city?.trim() ||
            pack?.basePlace?.trim() ||
            stop.city ||
            'Pakke',
          notes: day?.notes,
          docs: day?.docs,
          arriving: offset === 0,
        })
      }
      continue
    }
    const days = cityStayDays(stop)
    if (!days.some((d) => d.date === date)) continue
    out.push({
      stop,
      city: stopGoalLabel(stop, 'By'),
      hotel: effectiveHotelName(stop.stay),
      notes: stop.notes,
      docs: stop.docs,
      arriving: (stop.arriveDate || '').trim() === date,
    })
  }
  return out
}

type DayActivityTarget = {
  stop: JourneyStop
  city: string
  dayOffset: number
}

function activityTargetsOnDate(journey: Journey, date: string): DayActivityTarget[] {
  const fromPlaces = placesOnDate(journey, date)
    .filter((p) => p.stop.kind !== 'home')
    .map((p) => ({
      stop: p.stop,
      city: p.city,
      dayOffset: dayOffsetOn(p.stop, date),
    }))
  if (fromPlaces.length > 0) return fromPlaces

  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: DayActivityTarget[] = []
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    if (stop.kind === 'home') continue
    const arrive = (stop.arriveDate || '').trim()
    if (arrive === date) {
      out.push({
        stop,
        city: stopGoalLabel(stop, 'By'),
        dayOffset: 0,
      })
      continue
    }
    if (i > 0) {
      const prev = stops[i - 1]
      const depart = (stopDepartDate(prev) || '').trim()
      if (depart === date) {
        out.push({
          stop: prev,
          city: stopGoalLabel(prev, 'By'),
          dayOffset: dayOffsetOn(prev, date),
        })
      }
    }
  }
  return out
}

export function JourneyLive({
  journey,
  tripTravelers = [],
  disabled,
  tripName,
  onChange,
  onRemoveTraveler,
}: {
  journey: Journey
  tripTravelers?: string[]
  disabled?: boolean
  tripName?: string
  onChange: (next: Journey) => void
  onRemoveTraveler?: (name: string) => void
}) {
  const askDelete = useConfirmDelete()
  const span = useMemo(() => journeyDateSpan(journey), [journey])
  const today = todayIsoOslo()
  const travelers = useMemo(
    () => normalizeTravelers(tripTravelers),
    [tripTravelers],
  )
  const [date, setDate] = useState(() => {
    if (!span) return today
    if (today >= span.start && today <= span.end) return today
    if (today < span.start) return span.start
    return span.end
  })
  const [travelerFilter, setTravelerFilter] = useState('')

  useEffect(() => {
    if (travelerFilter && !travelers.includes(travelerFilter)) {
      setTravelerFilter('')
    }
  }, [travelerFilter, travelers])

  const places = useMemo(() => placesOnDate(journey, date), [journey, date])
  const rides = useMemo(() => ridesOnDate(journey, date), [journey, date])
  const activityTargets = useMemo(
    () => activityTargetsOnDate(journey, date),
    [journey, date],
  )
  const activityCalendar = useMemo(
    () => journeyActivityCalendarBounds(journey),
    [journey],
  )
  const entries = useMemo(
    () =>
      normalizeLive(journey.live)
        .filter((e) => e.date === date)
        .filter((e) =>
          travelerFilter
            ? liveEntryAppliesToTraveler(e, travelerFilter, travelers)
            : true,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [journey.live, date, travelerFilter, travelers],
  )
  const dayEntriesAll = useMemo(
    () =>
      normalizeLive(journey.live)
        .filter((e) => e.date === date)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [journey.live, date],
  )
  const travelerDayCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const name of travelers) counts.set(name, 0)
    for (const entry of dayEntriesAll) {
      for (const name of liveEntryTravelers(entry, travelers)) {
        counts.set(name, (counts.get(name) || 0) + 1)
      }
    }
    return counts
  }, [dayEntriesAll, travelers])
  const isToday = date === today

  function patchJourney(next: Journey) {
    onChange({ ...next, live: normalizeLive(next.live) })
  }

  function updateStopActivities(
    stopId: string,
    dayOffset: number,
    daySights: JourneyActivity[],
  ) {
    const cleaned = normalizeSights(daySights)
    let next = {
      ...journey,
      stops: (journey.stops || []).map((stop) =>
        stop.id !== stopId
          ? stop
          : {
              ...stop,
              sights: replaceDayActivities(stop.sights, dayOffset, cleaned),
            },
      ),
    }
    if (
      cleaned.length > 0 &&
      isLiveActivitySkipped(next, date, stopId, dayOffset)
    ) {
      next = withLiveActivitySkip(next, date, stopId, dayOffset, false)
    }
    patchJourney(next)
  }

  function setActivitySkip(
    stopId: string,
    dayOffset: number,
    skipped: boolean,
  ) {
    patchJourney(withLiveActivitySkip(journey, date, stopId, dayOffset, skipped))
  }

  function setActivityItemSkip(
    stopId: string,
    dayOffset: number,
    activityId: string,
    skipped: boolean,
  ) {
    patchJourney(
      withLiveActivityItemSkip(
        journey,
        date,
        stopId,
        dayOffset,
        activityId,
        skipped,
      ),
    )
  }

  function moveActivityOnStop(
    stopId: string,
    activityId: string,
    targetOffset: number,
  ) {
    patchJourney({
      ...journey,
      stops: (journey.stops || []).map((stop) =>
        stop.id !== stopId
          ? stop
          : {
              ...stop,
              sights: moveActivityToDay(stop.sights, activityId, targetOffset),
            },
      ),
    })
  }

  function moveActivityToDate(stopId: string, activityId: string, targetDate: string) {
    const next = moveActivityToCalendarDate(
      journey,
      stopId,
      activityId,
      targetDate,
    )
    if (next) patchJourney(next)
  }

  function setLive(list: JourneyLiveEntry[]) {
    patchJourney({ ...journey, live: normalizeLive(list) })
  }

  function addEntry(kind: JourneyLiveKind) {
    const all = normalizeLive(journey.live)
    const row = newLiveEntry(date, kind, all.length)
    if (travelerFilter && travelers.length > 1) {
      row.travelers = [travelerFilter]
    }
    setLive([...all, row])
  }

  function updateEntry(id: string, partial: Partial<JourneyLiveEntry>) {
    setLive(
      normalizeLive(journey.live).map((e) =>
        e.id === id ? { ...e, ...partial } : e,
      ),
    )
  }

  function removeEntry(id: string) {
    setLive(normalizeLive(journey.live).filter((e) => e.id !== id))
  }

  function patchOption(
    viaId: string,
    optionId: string,
    partial: Partial<JourneyTransportOption>,
  ) {
    patchJourney({
      ...journey,
      legs: (journey.legs || []).map((leg) => ({
        ...leg,
        vias: (leg.vias || []).map((via) =>
          via.id !== viaId
            ? via
            : {
                ...via,
                options: viaTransportOptions(via).map((opt) =>
                  opt.id === optionId ? { ...opt, ...partial } : opt,
                ),
              },
        ),
      })),
    })
  }

  function markTaken(viaId: string, optionId: string) {
    patchJourney({
      ...journey,
      legs: (journey.legs || []).map((leg) => ({
        ...leg,
        vias: (leg.vias || []).map((via) =>
          via.id !== viaId
            ? via
            : {
                ...via,
                options: withTakenTransportOption(
                  viaTransportOptions(via),
                  optionId,
                ),
              },
        ),
      })),
    })
  }

  function resetTaken(viaId: string) {
    patchJourney({
      ...journey,
      legs: (journey.legs || []).map((leg) => ({
        ...leg,
        vias: (leg.vias || []).map((via) =>
          via.id !== viaId
            ? via
            : {
                ...via,
                options: clearTakenTransportOptions(viaTransportOptions(via)),
              },
        ),
      })),
    })
  }

  function shiftDate(delta: number) {
    const next = addDaysIso(date, delta)
    if (span) {
      if (next < span.start || next > span.end) return
    }
    setDate(next)
  }

  const hotelAlerts = useMemo(() => {
    if (date < today) return []
    return liveMissingHotelAlerts(journey, date).map((alert) => ({
      ...alert,
      city: localizeCity(alert.city) || alert.city,
    }))
  }, [journey, date, today])

  const where = places.map((p) => localizeCity(p.city) || p.city).filter(Boolean)
  const beforeStart = !!(span && today < span.start)
  const firstCity = useMemo(() => {
    if (!span) return ''
    const stop = firstStopOnDate(journey, span.start)
    if (!stop) return ''
    const name = stop.kind === 'home' ? stop.city || 'Hjem' : stop.city
    return localizeCity(name) || name
  }, [journey, span])
  const tripDepart = useMemo(
    () => nextScheduledDeparture(journey),
    [journey],
  )

  return (
    <div className="v2-live">
      {beforeStart && span && (
        <HolidayCountdown
          startDate={tripDepart?.date || span.start}
          atMs={tripDepart?.atMs}
          departureTime={tripDepart?.time}
          detail={
            tripDepart
              ? `${localizeCity(tripDepart.fromLabel) || tripDepart.fromLabel} → ${
                  localizeCity(tripDepart.toLabel) || tripDepart.toLabel
                }`
              : firstCity
          }
        />
      )}
      <header className="v2-live-head">
        <button
          type="button"
          className="v2-chip-btn"
          disabled={!span || date <= span.start}
          title="Forrige dag"
          onClick={() => shiftDate(-1)}
        >
          ←
        </button>
        <div className="v2-live-date">
          <strong>{formatDateNO(date)}</strong>
          <span className="v2-meta">
            {isToday ? 'I dag' : date < today ? 'Tidligere' : 'Kommende'}
            {where.length ? ` · ${where.join(' · ')}` : ''}
          </span>
          <input
            type="date"
            className="v2-live-date-input"
            value={date}
            min={span?.start}
            max={span?.end}
            aria-label="Velg dag"
            onChange={(e) => {
              const next = e.target.value
              if (!next) return
              if (span && (next < span.start || next > span.end)) return
              setDate(next)
            }}
          />
        </div>
        <button
          type="button"
          className="v2-chip-btn"
          disabled={!span || date >= span.end}
          title="Neste dag"
          onClick={() => shiftDate(1)}
        >
          →
        </button>
        {!isToday && span && today >= span.start && today <= span.end && (
          <button
            type="button"
            className="v2-chip-btn"
            title="Gå til i dag"
            onClick={() => setDate(today)}
          >
            I dag
          </button>
        )}
      </header>

      {travelers.length > 0 && (
        <section className="v2-live-travelers" aria-label="Deltakere denne dagen">
          <div className="v2-live-travelers-head">
            <h3>Deltakere</h3>
            <p className="v2-meta">
              Registrering dag for dag — velg hvem du ser og logger for.
            </p>
          </div>
          <div className="v2-live-traveler-filter">
            <button
              type="button"
              className={`v2-chip-btn${travelerFilter === '' ? ' is-on' : ''}`}
              title="Vis alle deltakere"
              onClick={() => setTravelerFilter('')}
            >
              Alle
            </button>
            {travelers.map((name) => {
              const count = travelerDayCounts.get(name) || 0
              return (
                <span key={name} className="v2-live-traveler-chip">
                  <button
                    type="button"
                    className={`v2-chip-btn${
                      travelerFilter === name ? ' is-on' : ''
                    }`}
                    title={`Vis registrering for ${name}`}
                    onClick={() =>
                      setTravelerFilter((cur) => (cur === name ? '' : name))
                    }
                  >
                    {name}
                    <span className="v2-live-traveler-count">{count}</span>
                  </button>
                  {onRemoveTraveler && !disabled ? (
                    <button
                      type="button"
                      className="v2-live-traveler-remove"
                      title={`Fjern ${name}`}
                      aria-label={`Fjern ${name}`}
                      onClick={() => {
                        void askDelete({
                          title: `Fjerne ${name} fra reisen?`,
                          confirmLabel: 'Fjern',
                          checkLabel: 'Ja, fjern',
                        }).then((ok) => {
                          if (ok) onRemoveTraveler(name)
                        })
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              )
            })}
          </div>
        </section>
      )}

      {hotelAlerts.length > 0 && (
        <aside className="v2-live-alert" role="status">
          {hotelAlerts.map((alert) => (
            <p key={alert.stopId}>
              {liveHotelAlertText({ ...alert, city: alert.city })}
            </p>
          ))}
        </aside>
      )}

      {places.length === 0 && rides.length === 0 && (
        <p className="v2-empty">
          Ingen plan for denne dagen. Byer og reiser ligger under Plan.
        </p>
      )}

      {places.length > 0 && (
        <section className="v2-live-block">
          <h3>Hvor vi er</h3>
          <ul className="v2-live-places">
            {places.map((place) => (
              <li key={place.stop.id + place.city}>
                <span>
                  <strong>{localizeCity(place.city) || place.city}</strong>
                  {place.arriving ? (
                    <span className="v2-meta"> · ankomst</span>
                  ) : null}
                  {place.hotel ? (
                    <span className="v2-meta"> · {place.hotel}</span>
                  ) : hotelAlerts.some((a) => a.stopId === place.stop.id) ? (
                    <span className="v2-live-hotel-miss"> · uten hotell</span>
                  ) : null}
                </span>
                <CityInfoTip text={place.notes} docs={place.docs} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rides.length > 0 && (
        <section className="v2-live-block">
          <h3>Transport i dag</h3>
          <NextRideCountdowns rides={rides} date={date} />
          <ul className="v2-live-rides">
            {rides.map((ride) => {
              const takenOption = ride.options.find(optionIsTaken)
              const visibleOptions = takenOption
                ? [takenOption]
                : ride.options
              const focus = takenOption || chosenFromOptions(ride.options)
              return (
                <li key={ride.via.id} className={takenOption ? 'is-taken' : ''}>
                  <div className="v2-live-ride-main">
                    <div>
                      <strong className="v2-live-ride-title">
                        {localizeCity(ride.fromLabel)} →{' '}
                        {localizeCity(ride.toLabel)}
                      </strong>
                      <span className="v2-meta">
                        {formatChangeTimeLabel(ride.via, focus) ||
                          (viaPurpose(ride.via) === 'transfer'
                            ? viaPurposeLabel('transfer', true)
                            : '')}
                      </span>
                    </div>
                    <div className="v2-live-ride-actions">
                      {takenOption ? (
                        <button
                          type="button"
                          className="v2-chip-btn v2-live-reset-taken"
                          disabled={disabled}
                          title="Vis alle avganger igjen"
                          onClick={() => resetTaken(ride.via.id)}
                        >
                          Nullstill valg
                        </button>
                      ) : null}
                      <CityInfoTip text={ride.via.notes} />
                    </div>
                  </div>
                  <ul className="v2-live-ride-opts">
                    {visibleOptions.map((option) => {
                      const mode = option.mode || 'other'
                      const taken = optionIsTaken(option)
                      const highlight =
                        taken || (!takenOption && option.id === focus?.id)
                      const ticket = optionHasTicket(option)
                      return (
                        <li
                          key={option.id}
                          className={`v2-live-ride-opt${
                            highlight ? ' is-taken' : ''
                          }`}
                        >
                          <div className="v2-live-ride-opt-main">
                            <TransportModeIcon mode={mode} size={18} />
                            <span className="v2-meta">
                              {[
                                formatTransportOptionLabel(option),
                                option.platform
                                  ? `p. ${option.platform}`
                                  : '',
                                option.gate ? `gate ${option.gate}` : '',
                                formatChangeTimeLabel(ride.via, option),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            <TicketToggle
                              checked={ticket}
                              disabled={disabled}
                              onChange={(next) =>
                                patchOption(ride.via.id, option.id, {
                                  ticket: next,
                                })
                              }
                            />
                            <button
                              type="button"
                              className={`v2-live-taken${
                                taken ? ' is-on' : ''
                              }`}
                              disabled={disabled}
                              title={
                                taken
                                  ? 'Fjern kvittering og vis alle avganger'
                                  : 'Kvitter ut denne avgangen'
                              }
                              onClick={() =>
                                markTaken(ride.via.id, option.id)
                              }
                            >
                              {taken ? 'Kvittert' : 'Kvitter ut'}
                            </button>
                          </div>
                          {highlight ? (
                            <div className="v2-live-prices">
                              <label>
                                Forventet
                                <input
                                  value={option.price || ''}
                                  disabled={disabled}
                                  placeholder="0"
                                  onChange={(e) =>
                                    patchOption(ride.via.id, option.id, {
                                      price: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Faktisk
                                <input
                                  value={option.actualPrice || ''}
                                  disabled={disabled}
                                  placeholder={
                                    option.price?.trim() || 'Forventet pris'
                                  }
                                  title="Tomt felt bruker forventet pris i utgifter"
                                  onChange={(e) =>
                                    patchOption(ride.via.id, option.id, {
                                      actualPrice: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {activityTargets.length > 0 && (
        <section className="v2-live-block v2-live-activities">
          {activityTargets.map((target) => {
            const daySights = activitiesForDay(
              target.stop.sights,
              target.dayOffset,
            )
            const skippedIds = liveSkippedActivityIds(
              journey,
              date,
              target.stop.id,
              target.dayOffset,
            )
            const activeSights = daySights.filter((s) => !skippedIds.has(s.id))
            const skippedSights = daySights.filter((s) => skippedIds.has(s.id))
            const daySkipped = isLiveActivitySkipped(
              journey,
              date,
              target.stop.id,
              target.dayOffset,
            )
            const heading =
              activityTargets.length > 1
                ? localizeCity(target.city) || target.city
                : 'På programmet'
            return (
              <div
                key={`${target.stop.id}:${target.dayOffset}`}
                className="v2-live-activity-group"
              >
                {daySkipped && daySights.length === 0 ? (
                  <div className="v2-live-activity-skipped">
                    <p className="v2-live-activity-skipped-label">
                      Hoppet over severdighet, utflukt og annet
                    </p>
                    <button
                      type="button"
                      className="v2-chip-btn"
                      disabled={disabled}
                      title="Vis registrering igjen"
                      onClick={() =>
                        setActivitySkip(target.stop.id, target.dayOffset, false)
                      }
                    >
                      Registrer likevel
                    </button>
                  </div>
                ) : (
                  <>
                    <SightList
                      compact
                      heading={heading}
                      sights={activeSights}
                      dayOffset={target.dayOffset}
                      disabled={disabled}
                      suggestCountry={target.stop.country}
                      cityDays={calendarDaysForStop(target.stop)}
                      calendarMin={activityCalendar.min}
                      calendarMax={activityCalendar.max}
                      onMoveToDay={(activityId, offset) =>
                        moveActivityOnStop(target.stop.id, activityId, offset)
                      }
                      onMoveToDate={(activityId, targetDate) =>
                        moveActivityToDate(target.stop.id, activityId, targetDate)
                      }
                      onSkipActivity={(activityId) =>
                        setActivityItemSkip(
                          target.stop.id,
                          target.dayOffset,
                          activityId,
                          true,
                        )
                      }
                      onChange={(sights) =>
                        updateStopActivities(
                          target.stop.id,
                          target.dayOffset,
                          [...sights, ...skippedSights],
                        )
                      }
                    />
                    {skippedSights.length > 0 ? (
                      <ul className="v2-live-activity-skipped-list">
                        {skippedSights.map((sight) => (
                          <li
                            key={sight.id}
                            className="v2-live-activity-skipped-item"
                          >
                            <span className="v2-live-activity-skipped-item-label">
                              Hoppet over {activityDisplayName(sight)}
                            </span>
                            <button
                              type="button"
                              className="v2-chip-btn"
                              disabled={disabled}
                              title="Gjør aktiviteten likevel"
                              onClick={() =>
                                setActivityItemSkip(
                                  target.stop.id,
                                  target.dayOffset,
                                  sight.id,
                                  false,
                                )
                              }
                            >
                              Gjør likevel
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {activeSights.length === 0 && skippedSights.length === 0 ? (
                      <button
                        type="button"
                        className="v2-chip-btn v2-live-activity-skip"
                        disabled={disabled}
                        title="Merk at du ikke registrerer severdighet, utflukt eller annet i dag"
                        onClick={() =>
                          setActivitySkip(
                            target.stop.id,
                            target.dayOffset,
                            true,
                          )
                        }
                      >
                        Hoppet over severdighet, utflukt og annet
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
          <p className="v2-meta v2-live-activity-hint">
            Legg til severdighet, utflukt eller annet spontant — uten å gå til
            Plan.
          </p>
        </section>
      )}

      <section className="v2-live-block">
        <div className="v2-sights-head">
          <h3>Utenom planen</h3>
          <div className="v2-sights-add">
            {LIVE_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                className="v2-chip-btn"
                disabled={disabled}
                title={`Legg til ${k.label.toLowerCase()}`}
                onClick={() => addEntry(k.kind)}
              >
                + {k.label}
              </button>
            ))}
          </div>
        </div>
        <p className="v2-meta" style={{ margin: 0 }}>
          Mat, drikke, kjøp og annet som ikke ligger i planen.
        </p>
        {entries.length === 0 ? (
          <p className="v2-empty">Ingenting logget denne dagen ennå.</p>
        ) : (
          <ul className="v2-live-log">
            {entries.map((entry) => (
              <LiveEntryRow
                key={entry.id}
                entry={entry}
                tripTravelers={travelers}
                disabled={disabled}
                onChange={(partial) => updateEntry(entry.id, partial)}
                onRemove={() => {
                  const name =
                    entry.title.trim() || liveKindLabel(entry.kind)
                  void askDelete({ title: `Slette ${name}?` }).then((ok) => {
                    if (ok) removeEntry(entry.id)
                  })
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <LiveStepsSection
        journey={journey}
        date={date}
        travelers={travelers || []}
        disabled={disabled}
        tripName={tripName}
        onChange={patchJourney}
      />

    </div>
  )
}

export function LiveEntryRow({
  entry,
  tripTravelers = [],
  disabled,
  onChange,
  onRemove,
}: {
  entry: JourneyLiveEntry
  tripTravelers?: string[]
  disabled?: boolean
  onChange: (partial: Partial<JourneyLiveEntry>) => void
  onRemove: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [price, setPrice] = useState(entry.price || '')
  const [notes, setNotes] = useState(entry.notes || '')

  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    setTitle(entry.title)
    setPrice(entry.price || '')
    setNotes(entry.notes || '')
  }, [entry.id, entry.title, entry.price, entry.notes])

  const photos = entry.photos || []
  const rating = entry.rating || 0
  const tagged = liveEntryTravelers(entry, tripTravelers)
  const showTravelerPick = tripTravelers.length > 1

  function setTravelerOn(name: string, on: boolean) {
    if (disabled) return
    onChange({
      travelers: toggleLiveEntryTraveler(entry, name, tripTravelers, on),
    })
  }

  function setRating(n: number) {
    if (disabled) return
    onChange({ rating: rating === n ? 0 : n })
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || !files.length || disabled) return
    setPhotoError('')
    setUploading(true)
    const added: JourneyPhoto[] = []
    try {
      for (const file of Array.from(files)) {
        const prepared = await downscaleImage(file)
        const res = await api.uploadImage(prepared)
        added.push({ id: crypto.randomUUID(), url: res.url })
      }
      if (added.length) onChange({ photos: [...photos, ...added] })
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Kunne ikke laste opp bildet',
      )
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removePhoto(id: string) {
    if (disabled) return
    onChange({ photos: photos.filter((p) => p.id !== id) })
  }

  return (
    <li className={`v2-live-log-row is-${entry.kind}`}>
      <span className="v2-activity-kind">{liveKindLabel(entry.kind)}</span>
      <input
        value={title}
        disabled={disabled}
        placeholder={
          entry.kind === 'food'
            ? 'F.eks. Lunsj'
            : entry.kind === 'drink'
              ? 'F.eks. Kaffe'
              : entry.kind === 'shop'
                ? 'F.eks. Souvenir'
                : 'Hva skjedde'
        }
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => onChange({ title: title.trim() })}
      />
      <input
        className="v2-live-price"
        value={price}
        disabled={disabled}
        placeholder="Pris"
        inputMode="decimal"
        onChange={(e) => setPrice(e.target.value)}
        onBlur={() => onChange({ price: price.trim() })}
      />
      <input
        value={notes}
        disabled={disabled}
        placeholder="Notat"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onChange({ notes: notes.trim() })}
      />
      <button
        type="button"
        className="v2-via-remove"
        disabled={disabled}
        aria-label="Slett"
        title="Slett"
        onClick={onRemove}
      >
        <TrashIcon size={14} />
      </button>

      <div className="v2-live-log-extra">
        {showTravelerPick ? (
          <div
            className="v2-live-entry-travelers"
            role="group"
            aria-label="Hvem gjelder dette"
          >
            {tripTravelers.map((name) => {
              const on = tagged.includes(name)
              return (
                <button
                  key={name}
                  type="button"
                  className={`v2-chip-btn v2-live-entry-traveler${
                    on ? ' is-on' : ''
                  }`}
                  disabled={disabled}
                  aria-pressed={on}
                  title={
                    on
                      ? `Fjern ${name} fra registreringen`
                      : `Legg til ${name}`
                  }
                  onClick={() => setTravelerOn(name, !on)}
                >
                  {name}
                </button>
              )
            })}
          </div>
        ) : null}
        <div className="v2-live-stars" role="group" aria-label="Vurdering">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`v2-live-star${n <= rating ? ' is-on' : ''}`}
              disabled={disabled}
              aria-label={`${n} av 5`}
              aria-pressed={n <= rating}
              title={`Gi ${n} av 5`}
              onClick={() => setRating(n)}
            >
              {n <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>

        <div className="v2-live-photos">
          {photos.map((p) => (
            <span className="v2-live-photo" key={p.id}>
              <a href={mediaUrl(p.url)} target="_blank" rel="noreferrer">
                <img src={mediaUrl(p.url)} alt="Bilde" loading="lazy" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="v2-live-photo-del"
                  aria-label="Fjern bilde"
                  title="Fjern bilde"
                  onClick={() => removePhoto(p.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            className="v2-chip-btn v2-live-add-photo"
            disabled={disabled || uploading}
            title="Legg til bilde"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Laster opp…' : '+ Bilde'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPickFiles(e.target.files)}
          />
        </div>
        {photoError ? <p className="v2-live-photo-err">{photoError}</p> : null}
      </div>
    </li>
  )
}
