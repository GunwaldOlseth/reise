import { useEffect, useMemo, useState } from 'react'
import { localizeCity } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import { HolidayCountdown } from './HolidayCountdown'
import {
  activitiesForDay,
  activityKindLabel,
  addDaysIso,
  cityStayDays,
  formatDateNO,
  isPackageStop,
  journeyDateSpan,
  liveHotelAlertText,
  liveKindLabel,
  liveMissingHotelAlerts,
  newLiveEntry,
  normalizeLive,
  packageOf,
  stopDepartDate,
  todayIsoOslo,
  transportSegments,
  viaTransportOptions,
  type Journey,
  type JourneyActivity,
  type JourneyLiveEntry,
  type JourneyLiveKind,
  type JourneyStop,
  type JourneyTransportOption,
  type JourneyVia,
} from './journeyModel'
import { TrashIcon, TransportModeIcon } from '../TransportModeIcon'

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
  arriving: boolean
}

type DayRide = {
  via: JourneyVia
  option: JourneyTransportOption
  fromLabel: string
  toLabel: string
}

function placeLabel(place: JourneyStop | JourneyVia): string {
  if ('kind' in place && place.kind === 'home') {
    return place.city || 'Hjem'
  }
  if ('title' in place && place.title?.trim()) return place.title
  if ('city' in place && place.city?.trim()) return place.city
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
      const opts = viaTransportOptions(via)
      if (!opts.length) continue
      for (const option of opts) {
        out.push({
          via,
          option,
          fromLabel: placeLabel(prev),
          toLabel: via.title || to.city || 'Neste',
        })
      }
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
            city: 'Til sjøs',
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
          notes: stop.notes,
          arriving: offset === 0,
        })
      }
      continue
    }
    const days = cityStayDays(stop)
    if (!days.some((d) => d.date === date)) continue
    out.push({
      stop,
      city: stop.city || 'By',
      hotel: stop.stay?.hotelName?.trim() || '',
      notes: stop.notes,
      arriving: (stop.arriveDate || '').trim() === date,
    })
  }
  return out
}

function sightsOnDate(places: DayPlace[], date: string): JourneyActivity[] {
  const seen = new Set<string>()
  const out: JourneyActivity[] = []
  for (const place of places) {
    const offset = dayOffsetOn(place.stop, date)
    for (const sight of activitiesForDay(place.stop.sights, offset)) {
      if (seen.has(sight.id)) continue
      seen.add(sight.id)
      out.push(sight)
    }
  }
  return out
}

export function JourneyLive({
  journey,
  disabled,
  onChange,
}: {
  journey: Journey
  disabled?: boolean
  onChange: (next: Journey) => void
}) {
  const span = useMemo(() => journeyDateSpan(journey), [journey])
  const today = todayIsoOslo()
  const [date, setDate] = useState(() => {
    if (!span) return today
    if (today >= span.start && today <= span.end) return today
    if (today < span.start) return span.start
    return span.end
  })

  const places = useMemo(() => placesOnDate(journey, date), [journey, date])
  const rides = useMemo(() => ridesOnDate(journey, date), [journey, date])
  const sights = useMemo(() => sightsOnDate(places, date), [places, date])
  const entries = useMemo(
    () =>
      normalizeLive(journey.live)
        .filter((e) => e.date === date)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [journey.live, date],
  )
  const history = useMemo(() => {
    const byDate = new Map<string, JourneyLiveEntry[]>()
    for (const e of normalizeLive(journey.live)) {
      if (e.date === date) continue
      if (!e.title.trim() && !(e.price || '').trim() && !(e.notes || '').trim()) continue
      const list = byDate.get(e.date) || []
      list.push(e)
      byDate.set(e.date, list)
    }
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [journey.live, date])
  const isToday = date === today

  function patchJourney(next: Journey) {
    onChange({ ...next, live: normalizeLive(next.live) })
  }

  function setLive(list: JourneyLiveEntry[]) {
    patchJourney({ ...journey, live: normalizeLive(list) })
  }

  function addEntry(kind: JourneyLiveKind) {
    const all = normalizeLive(journey.live)
    const row = newLiveEntry(date, kind, all.length)
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

  return (
    <div className="v2-live">
      {beforeStart && span && (
        <HolidayCountdown startDate={span.start} detail={firstCity} />
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
                <CityInfoTip text={place.notes} docs={place.stop.docs} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rides.length > 0 && (
        <section className="v2-live-block">
          <h3>Transport i dag</h3>
          <ul className="v2-live-rides">
            {rides.map((ride) => {
              const mode = ride.option.mode || 'other'
              const time = [ride.option.startTime, ride.option.endTime]
                .filter(Boolean)
                .join('–')
              return (
                <li key={`${ride.via.id}:${ride.option.id}`}>
                  <div className="v2-live-ride-main">
                    <TransportModeIcon mode={mode} size={18} />
                    <div>
                      <strong>
                        {localizeCity(ride.fromLabel)} →{' '}
                        {localizeCity(ride.toLabel)}
                      </strong>
                      <span className="v2-meta">
                        {[
                          ride.option.title,
                          time,
                          ride.option.platform
                            ? `p. ${ride.option.platform}`
                            : '',
                          ride.option.gate ? `gate ${ride.option.gate}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                  <div className="v2-live-prices">
                    <label>
                      Forventet
                      <input
                        value={ride.option.price || ''}
                        disabled={disabled}
                        placeholder="0"
                        onChange={(e) =>
                          patchOption(ride.via.id, ride.option.id, {
                            price: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Faktisk
                      <input
                        value={ride.option.actualPrice || ''}
                        disabled={disabled}
                        placeholder="Betalt"
                        onChange={(e) =>
                          patchOption(ride.via.id, ride.option.id, {
                            actualPrice: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {sights.length > 0 && (
        <section className="v2-live-block">
          <h3>På programmet</h3>
          <ul className="v2-live-sights">
            {sights.map((sight) => (
              <li key={sight.id}>
                <span
                  className={`v2-activity-kind is-${sight.kind || 'sight'}`}
                >
                  {activityKindLabel(sight.kind)}
                </span>
                <strong>{sight.title}</strong>
                <span className="v2-meta">
                  {[
                    [sight.startTime, sight.endTime].filter(Boolean).join('–'),
                    sight.notes?.trim(),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
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
                disabled={disabled}
                onChange={(partial) => updateEntry(entry.id, partial)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="v2-live-block">
          <h3>Andre dager utenom planen</h3>
          <ul className="v2-live-history">
            {history.map(([day, rows]) => (
              <li key={day}>
                <button
                  type="button"
                  className="v2-text-link"
                  onClick={() => setDate(day)}
                >
                  {formatDateNO(day)}
                </button>
                <span className="v2-meta">
                  {rows
                    .map((e) =>
                      [e.title || liveKindLabel(e.kind), e.price]
                        .filter(Boolean)
                        .join(' '),
                    )
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function LiveEntryRow({
  entry,
  disabled,
  onChange,
  onRemove,
}: {
  entry: JourneyLiveEntry
  disabled?: boolean
  onChange: (partial: Partial<JourneyLiveEntry>) => void
  onRemove: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [price, setPrice] = useState(entry.price || '')
  const [notes, setNotes] = useState(entry.notes || '')

  useEffect(() => {
    setTitle(entry.title)
    setPrice(entry.price || '')
    setNotes(entry.notes || '')
  }, [entry.id, entry.title, entry.price, entry.notes])

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
    </li>
  )
}
