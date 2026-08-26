import { useEffect, useMemo, useRef, useState } from 'react'
import { api, mediaUrl } from '../api'
import { downscaleImage } from './imageResize'
import { localizeCity } from '../placeNames'
import { CityInfoTip } from './CityInfoTip'
import { CountdownCard, HolidayCountdown, osloWallTimeMs } from './HolidayCountdown'
import { nextScheduledDeparture } from './transportSchedule'
import {
  activitiesForDay,
  activityDisplayName,
  activityKindLabel,
  addDaysIso,
  cityStayDays,
  clockMinutesFromMidnight,
  effectiveHotelName,
  formatDateNO,
  formatChangeTimeLabel,
  formatCityStation,
  formatTransportOptionLabel,
  isPackageStop,
  journeyDateSpan,
  liveHotelAlertText,
  liveKindLabel,
  liveMissingHotelAlerts,
  newLiveEntry,
  normalizeLive,
  optionIsTaken,
  packageOf,
  stopDepartDate,
  stopGoalLabel,
  optionHasTicket,
  todayIsoOslo,
  transportSegments,
  viaPurpose,
  viaPurposeLabel,
  viaTransportOptions,
  sortTransportOptions,
  withTakenTransportOption,
  type Journey,
  type JourneyActivity,
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

function osloMinutesNow(): number {
  const stamp = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return clockMinutesFromMidnight(stamp) ?? 0
}

function optionClockMinutes(option: JourneyTransportOption): number | null {
  return (
    clockMinutesFromMidnight(option.startTime) ??
    clockMinutesFromMidnight(option.endTime)
  )
}

/**
 * Kvittert ride stays. Otherwise the next departure that has not passed yet;
 * if all times have passed, the last one.
 */
function pickLiveOption(
  options: JourneyTransportOption[],
  isToday: boolean,
  nowMins: number,
): JourneyTransportOption | undefined {
  if (!options.length) return undefined
  const taken = options.find(optionIsTaken)
  if (taken) return taken
  if (!isToday) return options[0]
  const next = options.find((option) => {
    const at = optionClockMinutes(option)
    if (at == null) return true
    return at >= nowMins
  })
  return next ?? options[options.length - 1]
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
      city: stopGoalLabel(stop, 'By'),
      hotel: effectiveHotelName(stop.stay),
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
  const askDelete = useConfirmDelete()
  const span = useMemo(() => journeyDateSpan(journey), [journey])
  const today = todayIsoOslo()
  const [date, setDate] = useState(() => {
    if (!span) return today
    if (today >= span.start && today <= span.end) return today
    if (today < span.start) return span.start
    return span.end
  })

  const [nowMins, setNowMins] = useState(osloMinutesNow)
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

  useEffect(() => {
    if (!isToday) return
    setNowMins(osloMinutesNow())
    const timer = window.setInterval(() => setNowMins(osloMinutesNow()), 30_000)
    return () => window.clearInterval(timer)
  }, [isToday])

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
          <NextRideCountdowns rides={rides} date={date} />
          <ul className="v2-live-rides">
            {rides.map((ride) => {
              const focus = pickLiveOption(ride.options, isToday, nowMins)
              return (
                <li key={ride.via.id}>
                  <div className="v2-live-ride-main">
                    <div>
                      <strong>
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
                  </div>
                  <ul className="v2-live-ride-opts">
                    {ride.options.map((option) => {
                      const mode = option.mode || 'other'
                      const selected = option.id === focus?.id
                      const taken = optionIsTaken(option)
                      const ticket = optionHasTicket(option)
                      return (
                        <li
                          key={option.id}
                          className={`v2-live-ride-opt${
                            selected ? ' is-taken' : ''
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
                                  ? 'Kvittert — denne telles i utgifter'
                                  : 'Kvitter ut denne avgangen'
                              }
                              onClick={() =>
                                markTaken(ride.via.id, option.id)
                              }
                            >
                              {taken ? 'Kvittert' : 'Kvitter ut'}
                            </button>
                          </div>
                          {selected ? (
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
                <strong>{activityDisplayName(sight)}</strong>
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
