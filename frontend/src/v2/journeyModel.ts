import {
  type HomePlace,
  type PlannerSettings,
} from '../userSettings'
import {
  arriveTimeSortKey,
  commitClockTimeInput,
  formatExpenseAmount,
  normalizeClockTime,
  normalizeEditableClockTime,
  normalizeDepartures,
  normalizeTravelers,
  parsePriceAmount,
} from '../api'
import { localizeJourneyPlaces } from '../placeNames'
import { compactNoteHtml, noteHasContent } from './noteHtml'

export type JourneyPackageType =
  | 'cruise'
  | 'tour'
  | 'charter'
  | 'roadtrip'
  | 'other'

export type JourneyStopKind = 'place' | 'home' | JourneyPackageType

/** Visit the city, or pass through without staying (ticket via). */
export type PlacePurpose = 'visit' | 'transfer'
/** Same-mode connection on one ride (train→train, bus→bus). Not bus→train. */
export type RideConnection = 'direct' | 'change'

export const PACKAGE_TYPES: JourneyPackageType[] = [
  'cruise',
  'tour',
  'charter',
  'roadtrip',
  'other',
]

export function isPackageType(kind: string | undefined): kind is JourneyPackageType {
  return PACKAGE_TYPES.includes(kind as JourneyPackageType)
}

export function isPackageStop(
  stop: Pick<JourneyStop, 'kind'> | null | undefined,
): boolean {
  return isPackageType(stop?.kind)
}

export type JourneyLegMode =
  | ''
  | 'flight'
  | 'train'
  | 'tram'
  | 'bus'
  | 'car'
  | 'boat'
  | 'walk'
  | 'other'

export interface JourneyStay {
  nights: number
  /** hotel (default) or airbnb */
  kind?: StayKind
  hotelName?: string
  address?: string
  url?: string
  price?: string
  notes?: string
  checkInTime?: string
  checkOutTime?: string
  booked?: boolean
  bookedWhere?: string
  paid?: boolean
  /** User chose no overnight lodging — not a missing hotel. */
  withoutOvernight?: boolean
}

export const DEFAULT_HOTEL_CHECK_IN = '15:00'
export const DEFAULT_HOTEL_CHECK_OUT = '11:00'

export type StayKind = 'hotel' | 'airbnb'

export function stayKind(stay?: JourneyStay | null): StayKind {
  return stay?.kind === 'airbnb' ? 'airbnb' : 'hotel'
}

export function stayKindLabel(kind: StayKind): string {
  return kind === 'airbnb' ? 'Airbnb' : 'Hotell'
}

export function stayNameFieldLabel(kind: StayKind): string {
  return kind === 'airbnb' ? 'Navn / sted' : 'Hotell'
}

export function stayNamePlaceholder(kind: StayKind): string {
  return kind === 'airbnb' ? 'Navn på sted' : 'Hotellnavn'
}

/** Legacy placeholder some trips saved before the new label. */
const LEGACY_STAY_ANCHOR_NAMES = new Set(['reiseanker'])

export function isLegacyStayAnchorName(name?: string | null): boolean {
  const n = (name || '').trim().toLowerCase()
  return n.length > 0 && LEGACY_STAY_ANCHOR_NAMES.has(n)
}

/** Hotel / Airbnb name for display and alerts — ignores legacy «reiseanker». */
export function effectiveHotelName(stay?: JourneyStay | null): string {
  const n = (stay?.hotelName || '').trim()
  if (!n || isLegacyStayAnchorName(n)) return ''
  return n
}

export function isStayWithoutOvernight(stay?: JourneyStay | null): boolean {
  return !!stay?.withoutOvernight
}

/** Clear lodging details but keep nights for a day in the city without overnight. */
export function stayAsWithoutOvernight(stay: JourneyStay): JourneyStay {
  return {
    ...stay,
    nights: Math.max(1, stay.nights || 1),
    hotelName: '',
    address: '',
    url: '',
    price: '',
    notes: '',
    booked: false,
    bookedWhere: '',
    paid: false,
    withoutOvernight: true,
  }
}

export const STAY_WITHOUT_HOTEL_LABEL = 'Reisedag uten overnatting'

export function stayUnsetLabel(_kind?: StayKind): string {
  return STAY_WITHOUT_HOTEL_LABEL
}

export type MissingHotelStayEntry = {
  stopId: string
  city: string
  arriveDate: string
  nights: number
  dateLabel: string
}

export function stripLegacyStayAnchorFromJourney(journey: Journey): Journey {
  let changed = false
  const stops = (journey.stops || []).map((stop) => {
    const name = (stop.stay?.hotelName || '').trim()
    if (!stop.stay || !isLegacyStayAnchorName(name)) return stop
    changed = true
    return {
      ...stop,
      stay: { ...stop.stay, hotelName: '' },
    }
  })
  return changed ? { ...journey, stops } : journey
}

export function defaultJourneyStay(): JourneyStay {
  return {
    nights: 1,
    kind: 'hotel',
    hotelName: '',
    address: '',
    checkInTime: DEFAULT_HOTEL_CHECK_IN,
    checkOutTime: DEFAULT_HOTEL_CHECK_OUT,
    booked: false,
    bookedWhere: '',
  }
}

export function hotelCheckInTime(stay?: JourneyStay | null): string {
  const t = (stay?.checkInTime || '').trim()
  return t || DEFAULT_HOTEL_CHECK_IN
}

export function hotelCheckOutTime(stay?: JourneyStay | null): string {
  const t = (stay?.checkOutTime || '').trim()
  return t || DEFAULT_HOTEL_CHECK_OUT
}

export function formatHotelStayTimes(stay?: JourneyStay | null): string {
  if (!stay) return ''
  return `Inn ${hotelCheckInTime(stay)} · ut ${hotelCheckOutTime(stay)}`
}

/** Attraction, excursion or other item at a city / via. */
export type JourneyActivityKind = 'sight' | 'excursion' | 'other'

/** @deprecated Prefer JourneyActivity — same shape. */
export type JourneySight = JourneyActivity

export interface JourneyActivity {
  id: string
  /** City (with place search suggestions in the UI). */
  title: string
  /** Specific place / venue — plain text, no suggestions. */
  place?: string
  url?: string
  /** Default sight (severdighet). */
  kind?: JourneyActivityKind
  /**
   * Day index from stop.arriveDate (0 = ankomstdag).
   * Omitted / 0 for via places and legacy rows.
   */
  dayOffset?: number
  startTime?: string
  endTime?: string
  /** Visit this place, or only change transport there. */
  purpose?: PlacePurpose
  /** Price for utgifter (excursion, sight, other). */
  price?: string
  /** Whether the activity price is paid. */
  paid?: boolean
  /** Legacy single note; kept in sync with the first document. */
  notes?: string
  /** Info documents for this activity. */
  docs?: JourneyCityDoc[]
  sortOrder: number
}

/** One day inside a multi-day package (not a separate thread stop). */
export interface JourneyPackageDay {
  id: string
  /** Day index from start (0 … nights). */
  offset: number
  /** No place that day (cruise: at sea, tour: free/travel day). */
  atSea: boolean
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  arriveTime?: string
  leaveTime?: string
  /** Cruise: last call for passengers before departure (all aboard). */
  allAboardTime?: string
  /** Omit this port from the trip map. */
  hideOnMap?: boolean
  /** Legacy single port note; kept in sync with the first document. */
  notes?: string
  /** Info documents for this port / city day. */
  docs?: JourneyCityDoc[]
}

/** Multi-day block on the journey thread (cruise, pakketur, charter, …). */
export interface JourneyPackage {
  nights: number
  /** Ship / tour / charter / trip name. */
  title?: string
  /** Home port, start city or main base. */
  basePlace?: string
  baseCountry?: string
  baseLatitude?: number
  baseLongitude?: number
  /** Cabin, booking ref, etc. */
  detail?: string
  price?: string
  /** Whether the package price has been paid. */
  paid?: boolean
  /** Extra costs for the whole package (spread over nights in overview). */
  costs?: JourneyCost[]
  days?: JourneyPackageDay[]
}

/** Extra cost line on a package (cruise extras, tips, …). */
export interface JourneyCost {
  id: string
  title: string
  price?: string
  /** Whether this extra cost is paid. */
  paid?: boolean
  notes?: string
  sortOrder: number
}

export function newJourneyCost(sortOrder = 0): JourneyCost {
  return {
    id: crypto.randomUUID(),
    title: '',
    price: '',
    notes: '',
    sortOrder,
  }
}

/** @deprecated Prefer JourneyPackage / pack — kept for older cruise payloads. */
export type JourneyCruiseDay = JourneyPackageDay
/** @deprecated Prefer JourneyPackage / pack. */
export type JourneyCruise = JourneyPackage & {
  shipName?: string
  homePort?: string
  homeCountry?: string
  cabinNumber?: string
}

export interface JourneyStop {
  id: string
  city: string
  country: string
  /** English / API spelling for weather and geocoding. */
  citySearch?: string
  countrySearch?: string
  /** Cached map coordinates from place search (skip geocode on map). */
  latitude?: number
  longitude?: number
  address?: string
  /** Arrival station / terminal for this city (shown with hovedmål). */
  station?: string
  arriveDate: string
  kind: JourneyStopKind
  stay?: JourneyStay | null
  /** Multi-day package payload (cruise, tour, …). */
  pack?: JourneyPackage | null
  /** @deprecated Legacy cruise-only field; use pack. */
  cruise?: JourneyCruise | null
  /** Attractions / excursions in this city (optionally per dayOffset). */
  sights?: JourneyActivity[]
  /** Visit the city, or only change transport there. */
  purpose?: PlacePurpose
  /** Omit this stop from the trip map. */
  hideOnMap?: boolean
  /** Legacy single city note; kept in sync with the first document. */
  notes?: string
  /** Extra info documents for the city (tips, restaurants, tickets, …). */
  docs?: JourneyCityDoc[]
  sortOrder: number
}

export interface JourneyCityDoc {
  id: string
  title: string
  body: string
  sortOrder: number
}

export type CityDocHolder = {
  notes?: string
  docs?: JourneyCityDoc[]
}

export function newCityDoc(sortOrder = 0, title = ''): JourneyCityDoc {
  return {
    id: crypto.randomUUID(),
    title,
    body: '',
    sortOrder,
  }
}

export function normalizeCityDocs(
  list?: JourneyCityDoc[] | null,
  keepEmpty = false,
): JourneyCityDoc[] {
  const mapped = [...(list || [])].map((d, i) => ({
    id: d.id || crypto.randomUUID(),
    title: (d.title || '').trim(),
    body: d.body || '',
    sortOrder: i,
  }))
  return keepEmpty
    ? mapped
    : mapped.filter((d) => noteHasContent(d.body))
}

/** Documents to show, including a legacy `notes` field. */
export function cityDocsOf(
  stop: CityDocHolder | null | undefined,
): JourneyCityDoc[] {
  const docs = normalizeCityDocs(stop?.docs).filter((d) =>
    noteHasContent(d.body),
  )
  if (docs.length) return docs
  const note = (stop?.notes || '').trim()
  if (!noteHasContent(note)) return []
  return [
    {
      id: 'notes',
      title: 'Om byen',
      body: note,
      sortOrder: 0,
    },
  ]
}

/** Always at least one row in the editor. */
export function cityDocsForEdit(
  stop: CityDocHolder | null | undefined,
  defaultFirstTitle = 'Om byen',
): JourneyCityDoc[] {
  const note = (stop?.notes || '').trim()
  const raw = normalizeCityDocs(stop?.docs, true)
  const withBody = raw.filter((d) => noteHasContent(d.body))
  if (withBody.length) return raw
  if (noteHasContent(note)) {
    if (raw.length) {
      const merged = [...raw]
      const emptyIdx = merged.findIndex((d) => !noteHasContent(d.body))
      if (emptyIdx >= 0) {
        merged[emptyIdx] = { ...merged[emptyIdx], body: note }
        return merged
      }
    }
    return [
      {
        id: 'notes',
        title: defaultFirstTitle,
        body: note,
        sortOrder: 0,
      },
    ]
  }
  if (raw.length) return raw
  return [
    { id: 'notes', title: defaultFirstTitle, body: '', sortOrder: 0 },
  ]
}

export function applyCityDocs(
  _holder: CityDocHolder,
  docs: JourneyCityDoc[],
): CityDocHolder {
  const list = [...docs].map((d, i) => ({
    ...d,
    id: d.id || crypto.randomUUID(),
    title: d.title || '',
    body: d.body || '',
    sortOrder: i,
  }))
  const first = list.find((d) => noteHasContent(d.body)) || list[0]
  return {
    docs: list,
    notes: first?.body || '',
  }
}

export function withCityDocs(
  stop: JourneyStop,
  docs: JourneyCityDoc[],
): JourneyStop {
  return {
    ...stop,
    ...applyCityDocs(stop, docs),
  }
}

export function compactCityDocs(
  list?: JourneyCityDoc[] | null,
): JourneyCityDoc[] {
  return normalizeCityDocs(list).map((d, i) => ({
    ...d,
    id: d.id && d.id !== 'notes' ? d.id : crypto.randomUUID(),
    body: compactNoteHtml(d.body),
    sortOrder: i,
  }))
}

/** One way to travel between two places (bus OR train, etc.). */
export interface JourneyTransportOption {
  id: string
  mode?: JourneyLegMode | string
  /** Line / flight number (optional). */
  title?: string
  /** Transport company / carrier. */
  company?: string
  startTime?: string
  endTime?: string
  /** Platform / perong — for bus and train. */
  platform?: string
  /** Airport gate — for flights. */
  gate?: string
  /** Walk duration in minutes (walk mode only). */
  minutes?: string
  /** Extra info — e.g. for “Annet”. */
  info?: string
  /** Expected price (free text). */
  price?: string
  /** Actual cost after travel. Empty → expected `price` is used in expenses. */
  actualPrice?: string
  /** This is the alternative we took — used in expenses. */
  taken?: boolean
  /** Ticket is bought for this departure. */
  ticket?: boolean
  /** Transport price has been paid. */
  paid?: boolean
  /** This ride is direct, or has a change along the way. */
  connection?: RideConnection
  /** Station/city where this ride changes. */
  changePlace?: string
  /** Line / train name after the change. */
  changeTitle?: string
  /** Departure of the connecting ride. */
  changeStartTime?: string
  /** Arrival of the connecting ride. */
  changeEndTime?: string
  /** Platform at the change. */
  changePlatform?: string
  /** Recommended minutes for the change on this ride. */
  changeMinutes?: string
  /** Extra same-mode changes on this ride (after the first). */
  changes?: JourneyLineChange[]
  /** @deprecated Multi-times are separate option rows now. */
  departures?: string[]
}

/** One same-mode change on a transport option. */
export interface JourneyLineChange {
  id: string
  place?: string
  title?: string
  startTime?: string
  endTime?: string
  platform?: string
  minutes?: string
}

/** City or airport point on the way to the main destination. */
export interface JourneyVia {
  id: string
  /** City or airport name (e.g. Bergamo, Milano, Genova). */
  title: string
  /** Arrival station / terminal at this place. */
  station?: string
  country?: string
  latitude?: number
  longitude?: number
  /** @deprecated Prefer options[] — kept for older data. */
  mode?: JourneyLegMode | string
  startTime?: string
  endTime?: string
  notes?: string
  departures?: string[]
  /** Alternative ways to get here from the previous place. */
  options?: JourneyTransportOption[]
  /** Attractions / excursions while at this via city. */
  sights?: JourneyActivity[]
  /** Visit the city, or only change transport there. */
  purpose?: PlacePurpose
  /** Omit this via place from the trip map. */
  hideOnMap?: boolean
  /** The hop here is a direct ride, or involves a change. */
  connection?: RideConnection
  /** Station/city where a change happens (when connection is change). */
  changePlace?: string
  /** Platform at the change. */
  changePlatform?: string
  /** Recommended minutes between two connections. */
  changeMinutes?: string
  sortOrder: number
}

/** Valid map coordinates, or undefined if missing/invalid. */
export function geoCoordsOf(
  lat?: number | null,
  lon?: number | null,
): { latitude: number; longitude: number } | undefined {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    (lat === 0 && lon === 0)
  ) {
    return undefined
  }
  return { latitude: lat, longitude: lon }
}

export interface JourneyLeg {
  id: string
  fromStopId: string
  toStopId: string
  mode?: JourneyLegMode | string
  title?: string
  startTime?: string
  endTime?: string
  notes?: string
  url?: string
  /** Ordered city/airport points (path to main destination). */
  vias?: JourneyVia[]
}

export function newViaId(): string {
  return crypto.randomUUID()
}

export function newOptionId(): string {
  return crypto.randomUUID()
}

export function newTransportOption(
  mode: JourneyLegMode | string = '',
): JourneyTransportOption {
  return {
    id: newOptionId(),
    mode,
    title: '',
    company: '',
    startTime: '',
    endTime: '',
    platform: '',
    gate: '',
    minutes: '',
    info: '',
    price: '',
    actualPrice: '',
    taken: false,
    ticket: false,
    connection: 'direct',
    changePlace: '',
    changeTitle: '',
    changeStartTime: '',
    changeEndTime: '',
    changePlatform: '',
    changeMinutes: '',
    changes: [],
    departures: [],
  }
}

export function newLineChange(): JourneyLineChange {
  return {
    id: crypto.randomUUID(),
    place: '',
    title: '',
    startTime: '',
    endTime: '',
    platform: '',
    minutes: '',
  }
}

function lineChangeHasContent(change: JourneyLineChange): boolean {
  return !!(
    (change.place || '').trim() ||
    (change.title || '').trim() ||
    (change.startTime || '').trim() ||
    (change.endTime || '').trim() ||
    (change.platform || '').trim() ||
    parsePositiveMinutes(change.minutes)
  )
}

export function compactLineChange(change: JourneyLineChange): JourneyLineChange {
  const mins = parsePositiveMinutes(change.minutes)
  return {
    id: change.id || crypto.randomUUID(),
    place: (change.place || '').trim(),
    title: (change.title || '').trim(),
    startTime: (change.startTime || '').trim(),
    endTime: (change.endTime || '').trim(),
    platform: (change.platform || '').trim(),
    minutes: mins != null ? String(mins) : '',
  }
}

export function optionLineChanges(
  option?: Pick<
    JourneyTransportOption,
    | 'id'
    | 'connection'
    | 'changes'
    | 'changePlace'
    | 'changeTitle'
    | 'changeStartTime'
    | 'changeEndTime'
    | 'changePlatform'
    | 'changeMinutes'
  > | null,
): JourneyLineChange[] {
  if (!option) return []
  if (option.changes?.length) return option.changes.map(compactLineChange)
  const legacy: JourneyLineChange = {
    id: `${option.id || 'opt'}-chg0`,
    place: option.changePlace,
    title: option.changeTitle,
    startTime: option.changeStartTime,
    endTime: option.changeEndTime,
    platform: option.changePlatform,
    minutes: option.changeMinutes,
  }
  if (lineChangeHasContent(legacy)) {
    return [compactLineChange(legacy)]
  }
  return []
}

export function withOptionChanges(
  changes: JourneyLineChange[],
): Partial<JourneyTransportOption> {
  const next = changes.map(compactLineChange)
  const first = next[0]
  return {
    connection: next.length ? 'change' : 'direct',
    changes: next,
    changePlace: first?.place || '',
    changeTitle: first?.title || '',
    changeStartTime: first?.startTime || '',
    changeEndTime: first?.endTime || '',
    changePlatform: first?.platform || '',
    changeMinutes: first?.minutes || '',
  }
}

/** Bus / train / tram can have a platform. */
export function modeHasPlatform(mode?: string): boolean {
  return mode === 'train' || mode === 'bus' || mode === 'tram'
}

/** Same-mode line change (not a new via city). */
export function modeAllowsLineChange(mode?: string): boolean {
  return modeHasPlatform(mode)
}

/** Flight uses flight number + gate. */
export function modeIsFlight(mode?: string): boolean {
  return mode === 'flight'
}

/** Free-text type for “Annet”. */
export function modeIsOther(mode?: string): boolean {
  return mode === 'other'
}

/** Walk is a complete last-stretch choice; minutes are optional. */
export function modeIsWalk(mode?: string): boolean {
  return mode === 'walk'
}

export function newJourneyVia(sortOrder = 0): JourneyVia {
  return {
    id: newViaId(),
    title: '',
    station: '',
    country: '',
    mode: '',
    startTime: '',
    endTime: '',
    notes: '',
    departures: [],
    options: [],
    purpose: 'transfer',
    connection: 'direct',
    changePlace: '',
    changePlatform: '',
    changeMinutes: '',
    sortOrder,
  }
}

export function viaPurpose(
  via: Pick<JourneyVia, 'purpose' | 'sights'> | null | undefined,
): PlacePurpose {
  if (via?.purpose === 'transfer') return 'transfer'
  return 'visit'
}

export function viaPurposeLabel(
  purpose: PlacePurpose,
  compact = false,
): string {
  if (purpose === 'transfer') return compact ? 'via' : 'Ikke stopp'
  return compact ? 'besøk' : 'Besøk'
}

export function viaConnection(
  via: Pick<JourneyVia, 'connection'> | null | undefined,
): RideConnection {
  return via?.connection === 'change' ? 'change' : 'direct'
}

export function optionConnection(
  option?: Pick<
    JourneyTransportOption,
    | 'connection'
    | 'changes'
    | 'changePlace'
    | 'changeTitle'
    | 'changeStartTime'
    | 'changeEndTime'
    | 'changePlatform'
    | 'changeMinutes'
    | 'id'
  > | null,
  via?: Pick<JourneyVia, 'connection'> | null,
): RideConnection {
  if (optionLineChanges(option).length >= 1) return 'change'
  if (option?.connection === 'direct') return 'direct'
  return viaConnection(via)
}

export function rideConnectionLabel(connection: RideConnection): string {
  return connection === 'change' ? 'med linjebytte' : 'direkte'
}

/** Positive whole minutes from a free-text field, or null. */
export function parsePositiveMinutes(raw?: string): number | null {
  const n = Number(String(raw || '').replace(/[^\d]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function viaChangeMinutes(
  via: Pick<JourneyVia, 'changeMinutes'> | null | undefined,
): number | null {
  return parsePositiveMinutes(via?.changeMinutes)
}

function formatOneLineChange(change: JourneyLineChange): string {
  const mins = parsePositiveMinutes(change.minutes)
  const place = (change.place || '').trim()
  const line = (change.title || '').trim()
  const from = (change.startTime || '').trim()
  const to = (change.endTime || '').trim()
  const span = from && to ? `${from}–${to}` : from || to
  const platform = (change.platform || '').trim()
  const plat = platform ? `p.${platform}` : ''
  const wait = mins != null ? formatDurationHM(mins) : ''
  return [place, line, plat, span, wait].filter(Boolean).join(' ')
}

export function formatChangeTimeLabel(
  via: Pick<
    JourneyVia,
    'connection' | 'changePlace' | 'changePlatform' | 'changeMinutes'
  >,
  option?: Pick<
    JourneyTransportOption,
    | 'id'
    | 'connection'
    | 'changes'
    | 'changePlace'
    | 'changeTitle'
    | 'changeStartTime'
    | 'changeEndTime'
    | 'changePlatform'
    | 'changeMinutes'
  > | null,
): string {
  const connection = optionConnection(option, via)
  const list = optionLineChanges(option)
  if (list.length) {
    const bits = list.map(formatOneLineChange).filter(Boolean)
    if (bits.length === 1) return `linjebytte ${bits[0]}`
    if (bits.length > 1) {
      return bits.map((bit, i) => `bytte ${i + 1} ${bit}`).join(' · ')
    }
  }
  const mins =
    parsePositiveMinutes(option?.changeMinutes) ?? viaChangeMinutes(via)
  const place = (option?.changePlace || via.changePlace || '').trim()
  const time = mins != null ? formatDurationHM(mins) : ''
  if (place && time) return `linjebytte ${place} ${time}`
  if (place) return `linjebytte ${place}`
  if (time) return `linjebytte ${time}`
  return connection === 'change' ? 'med linjebytte' : ''
}

/** Minutes from midnight, or null if the clock time is missing/invalid. */
export function clockMinutesFromMidnight(time?: string): number | null {
  const key = arriveTimeSortKey(time)
  if (!Number.isFinite(key) || key === Number.POSITIVE_INFINITY) return null
  return Math.floor(key / 60)
}

/** Duration from start to end. If arrival is earlier, treat as next day. */
export function rideDurationMinutes(
  start?: string,
  end?: string,
): number | null {
  const from = clockMinutesFromMidnight(start)
  const to = clockMinutesFromMidnight(end)
  if (from == null || to == null) return null
  let diff = to - from
  if (diff < 0) diff += 24 * 60
  if (diff <= 0) return null
  return diff
}

export function rideIsOvernight(start?: string, end?: string): boolean {
  const from = clockMinutesFromMidnight(start)
  const to = clockMinutesFromMidnight(end)
  if (from == null || to == null) return false
  return to < from
}

export function optionIsOvernight(option: JourneyTransportOption): boolean {
  if (modeIsWalk(option.mode)) return false
  return rideIsOvernight(option.startTime, option.endTime)
}

export function optionDurationMinutes(
  option: JourneyTransportOption,
): number | null {
  if (modeIsWalk(option.mode)) {
    const n = Number(String(option.minutes || '').replace(/[^\d]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return rideDurationMinutes(option.startTime, option.endTime)
}

export function formatDurationHM(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins} m`
  if (mins === 0) return hours === 1 ? '1 t' : `${hours} t`
  return `${hours} t ${mins} m`
}

/** Chosen alternative on each hop, summed — same rule as expenses. */
export function legTravelDurationMinutes(
  leg?: JourneyLeg | null,
): number | null {
  let total = 0
  let any = false
  for (const via of transportSegments(leg)) {
    const opt = chosenTransportOption(via)
    if (!opt) continue
    const mins = optionDurationMinutes(opt)
    if (mins == null) continue
    total += mins
    any = true
  }
  return any ? total : null
}

export function activityPurpose(
  activity: Pick<JourneyActivity, 'purpose'> | null | undefined,
): PlacePurpose {
  if (activity?.purpose === 'transfer') return 'transfer'
  return 'visit'
}

export interface VisitCity {
  city: string
  country: string
  /** Optional city info shown as an (i) icon. */
  info?: string
  docs?: JourneyCityDoc[]
}

/** Unique visit cities/countries in journey order (not home, not transfer-only). */
export function journeyVisitPlaces(journey: Journey): {
  cities: VisitCity[]
  countries: string[]
} {
  const cities: VisitCity[] = []
  const cityIndex = new Map<string, number>()
  const countries: string[] = []
  const countryKeys = new Set<string>()

  function sameCity(a?: string, b?: string) {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
  }

  function addPlace(
    city?: string,
    country?: string,
    info?: string,
    docs?: JourneyCityDoc[],
  ) {
    const name = (city || '').trim()
    if (!name) return
    const nation = (country || '').trim()
    const note = (info || '').trim()
    const nextDocs = cityDocsOf({ notes: note, docs })
    const key = name.toLowerCase()
    const existing = cityIndex.get(key)
    if (existing !== undefined) {
      const cur = cities[existing]
      cities[existing] = {
        city: cur.city,
        country: cur.country || nation,
        info: cur.info || note || undefined,
        docs: cur.docs?.length ? cur.docs : nextDocs,
      }
    } else {
      cityIndex.set(key, cities.length)
      cities.push({
        city: name,
        country: nation,
        info: note || undefined,
        docs: nextDocs,
      })
    }
    if (nation) {
      const nkey = nation.toLowerCase()
      if (!countryKeys.has(nkey)) {
        countryKeys.add(nkey)
        countries.push(nation)
      }
    }
  }

  function addVisitActivities(
    sights: JourneyActivity[] | null | undefined,
    country?: string,
    parentCity?: string,
  ) {
    for (const activity of sights || []) {
      if (activityPurpose(activity) === 'transfer') continue
      if (sameCity(activity.title, parentCity)) continue
      addPlace(activity.title, country, activity.notes, activity.docs)
    }
  }

  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    if (i > 0) {
      const leg = (journey.legs || []).find(
        (l) => l.fromStopId === stops[i - 1].id && l.toStopId === stop.id,
      )
      for (const via of transportSegments(leg)) {
        if (viaPurpose(via) !== 'transfer') {
          if (
            !sameCity(via.title, stop.city) &&
            !(stop.kind === 'home' && sameCity(via.title, stop.address))
          ) {
            addPlace(via.title, via.country, via.notes)
          }
        }
        addVisitActivities(
          via.sights,
          via.country || stop.country,
          via.title,
        )
      }
    }
    if (stop.kind === 'home') {
      addVisitActivities(stop.sights, stop.country, stop.city || stop.address)
      continue
    }
    if (isPackageStop(stop)) {
      const pack = packageOf(stop)
      const freeLabel = packageFreeDayLabel(stop.kind)
      const nights = Math.max(1, Math.floor(pack?.nights || 1))
      const days = [...(pack?.days || [])].sort((a, b) => a.offset - b.offset)
      const byOffset = new Map(days.map((d) => [d.offset, d]))
      for (let offset = 0; offset <= nights; offset++) {
        const day = byOffset.get(offset)
        if (day?.atSea) continue
        const city =
          day?.city?.trim() ||
          (offset === 0 || offset === nights
            ? pack?.basePlace?.trim() || stop.city?.trim()
            : '') ||
          ''
        if (!city || city === freeLabel) continue
        addPlace(
          city,
          day?.country || pack?.baseCountry || stop.country,
          day?.notes,
          day?.docs,
        )
      }
      addVisitActivities(
        stop.sights,
        pack?.baseCountry || stop.country,
        stop.city,
      )
      continue
    }
    if (stopPurpose(stop) !== 'transfer') {
      addPlace(stop.city, stop.country, stop.notes, stop.docs)
    }
    addVisitActivities(stop.sights, stop.country, stop.city)
  }

  return { cities, countries }
}

export type VisitCountryGroup = {
  country: string
  cities: VisitCity[]
}

/** Visit countries in journey order with their cities grouped underneath. */
export function journeyVisitCountryGroups(journey: Journey): VisitCountryGroup[] {
  const { cities, countries } = journeyVisitPlaces(journey)
  const groups: VisitCountryGroup[] = countries.map((country) => {
    const key = country.trim().toLowerCase()
    return {
      country,
      cities: cities.filter(
        (c) => (c.country || '').trim().toLowerCase() === key,
      ),
    }
  })
  const unassigned = cities.filter((c) => !(c.country || '').trim())
  if (unassigned.length) {
    groups.push({ country: '', cities: unassigned })
  }
  return groups
}

export function journeyVisitStats(journey: Journey): {
  cityCount: number
  countryCount: number
} {
  const { cities, countries } = journeyVisitPlaces(journey)
  return { cityCount: cities.length, countryCount: countries.length }
}

export type OverviewRide = {
  id: string
  date: string
  fromLabel: string
  toLabel: string
  detail: string
  via: JourneyVia
}

export function formatCityStation(city?: string, station?: string): string {
  const c = (city || '').trim()
  const s = (station || '').trim()
  if (c && s && !samePlaceName(c, s)) return `${c} · ${s}`
  return c || s
}

export function stopGoalLabel(
  to?: Pick<JourneyStop, 'city' | 'address' | 'kind' | 'station'> | null,
  fallback = 'Hovedmål',
): string {
  if (!to) return fallback
  if (to.kind === 'home') {
    return (to.address || '').trim() || (to.city || '').trim() || 'Hjem'
  }
  return formatCityStation(to.city, to.station) || fallback
}

function overviewStopLabel(stop: JourneyStop): string {
  if (stop.kind === 'home') {
    return (stop.address || stop.city || 'Start').trim()
  }
  if (isPackageStop(stop)) {
    return (packageOf(stop)?.title || stop.city || packageTypeLabel(stop.kind)).trim()
  }
  return formatCityStation(stop.city, stop.station) || 'Sted'
}

/** Travel day for a hop: checkout / leave day from the previous stop. */
export function legTravelDate(
  from?: JourneyStop | null,
  to?: JourneyStop | null,
): string {
  return (
    (from ? stopDepartDate(from) : '') ||
    (from?.arriveDate || '').trim() ||
    (to?.arriveDate || '').trim()
  )
}

/** Transport hops in journey order, with the day you travel. */
export function journeyOverviewRides(journey: Journey): OverviewRide[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const rides: OverviewRide[] = []
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i]
    const to = stops[i + 1]
    const date = legTravelDate(from, to)
    const leg = (journey.legs || []).find(
      (l) => l.fromStopId === from.id && l.toStopId === to.id,
    )
    const segs = transportSegments(leg)
    if (!segs.length) continue
    let prev = overviewStopLabel(from)
    segs.forEach((via, vi) => {
      const last = vi === segs.length - 1
      const toLabel =
        via.title.trim() || (last ? overviewStopLabel(to) : '…')
      const opt = chosenTransportOption(via)
      const badge = transportHopConnectionBadge(via)
      const detail = [
        badge,
        opt ? formatOptionSummaryBit(opt) : '',
        formatChangeTimeLabel(via, opt),
        opt ? transportOptionPriceLabel(opt) : '',
      ]
        .filter(Boolean)
        .join(' · ')
      if (!toLabel && !detail) return
      rides.push({
        id: via.id,
        date,
        fromLabel: prev,
        toLabel,
        detail,
        via,
      })
      prev = toLabel
    })
  }
  return rides
}

export type OverviewBookedHotel = {
  id: string
  hotelName: string
  city: string
  country: string
  arriveDate: string
  departDate: string
  nights: number
  stay: JourneyStay
  lodgingKind: StayKind
}

/** Booked lodging stops in journey order for the overview tab. */
export function journeyOverviewBookedHotels(journey: Journey): OverviewBookedHotel[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: OverviewBookedHotel[] = []
  for (const stop of stops) {
    if (stop.kind === 'home' || isPackageStop(stop)) continue
    const stay = stop.stay
    if (!stay?.booked) continue
    const nights = stayNights(stop)
    const name = effectiveHotelName(stay)
    out.push({
      id: stop.id,
      hotelName: name || stayUnsetLabel(stayKind(stay)),
      city: (stop.city || '').trim(),
      country: (stop.country || '').trim(),
      arriveDate: (stop.arriveDate || '').trim(),
      departDate: stopDepartDate(stop),
      nights,
      stay,
      lodgingKind: stayKind(stay),
    })
  }
  return out
}

export type LiveDayLodging = {
  stopId: string
  city: string
  stay: JourneyStay
  nights: number
  arriveDate: string
  departDate: string
  lodgingKind: StayKind
  hotelName: string
  arriving: boolean
  missing: boolean
}

/** Lodging for each city stop on a calendar day (arrive through last overnight). */
export function lodgingOnDate(journey: Journey, date: string): LiveDayLodging[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: LiveDayLodging[] = []
  for (const stop of stops) {
    if (stop.kind === 'home' || isPackageStop(stop)) continue
    if (stopPurpose(stop) !== 'visit') continue
    const stay = stop.stay
    if (!stay || isStayWithoutOvernight(stay)) continue
    const nights = stayNights(stop)
    if (nights < 1) continue
    if (!cityStayDays(stop).some((d) => d.date === date)) continue
    const kind = stayKind(stay)
    const name = effectiveHotelName(stay)
    out.push({
      stopId: stop.id,
      city: (stop.city || '').trim() || 'By',
      stay,
      nights,
      arriveDate: (stop.arriveDate || '').trim(),
      departDate: stopDepartDate(stop),
      lodgingKind: kind,
      hotelName: name || stayUnsetLabel(kind),
      arriving: (stop.arriveDate || '').trim() === date,
      missing: cityMissingHotel(stop),
    })
  }
  return out
}

export type JourneyScheduledDeparture = {
  date: string
  time: string
  fromLabel: string
  toLabel: string
}

function scheduledHopLabel(
  place: JourneyStop | JourneyVia,
  fallback = 'Sted',
): string {
  if ('kind' in place) return overviewStopLabel(place)
  return (place.title || '').trim() || fallback
}

/** All registered departure times in journey order (transport + cruise ports). */
export function journeyScheduledDepartures(
  journey: Journey,
): JourneyScheduledDeparture[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: JourneyScheduledDeparture[] = []

  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    const depart = (stopDepartDate(from) || from.arriveDate || '').trim()
    if (!depart) continue
    const leg = (journey.legs || []).find(
      (l) => l.fromStopId === from.id && l.toStopId === to.id,
    )
    const segs = transportSegments(leg, { sort: false })
    for (let s = 0; s < segs.length; s++) {
      const via = segs[s]
      const prev = s === 0 ? from : segs[s - 1]
      const fromLabel = scheduledHopLabel(prev, overviewStopLabel(from))
      const toLabel =
        s === segs.length - 1
          ? stopGoalLabel(to, via.title || to.city)
          : (via.title || '').trim() || '…'
      for (const opt of viaTransportOptions(via)) {
        const time = (opt.startTime || '').trim()
        if (!time) continue
        out.push({ date: depart, time, fromLabel, toLabel })
      }
    }
  }

  for (const stop of stops) {
    if (stop.kind !== 'cruise' || !isPackageStop(stop)) continue
    const pack = packageOf(stop)
    if (!pack) continue
    const ship = (pack.title || stop.city || 'Cruise').trim()
    const nights = packageNightsOf(pack)
    for (const day of pack.days || []) {
      if (day.atSea || day.offset === nights) continue
      const leave = (day.leaveTime || '').trim()
      if (!leave) continue
      const date = stop.arriveDate
        ? addDaysIso(stop.arriveDate, day.offset)
        : ''
      if (!date) continue
      const port = (day.city || pack.basePlace || stop.city || 'Havn').trim()
      out.push({
        date,
        time: leave,
        fromLabel: ship,
        toLabel: port,
      })
    }
  }

  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return arriveTimeSortKey(a.time) - arriveTimeSortKey(b.time)
  })
}

export function stopPurpose(
  stop: Pick<JourneyStop, 'kind' | 'purpose'> | null | undefined,
): PlacePurpose {
  if (!stop || stop.kind === 'home' || isPackageType(stop.kind)) return 'visit'
  if (stop.purpose === 'visit' || stop.purpose === 'transfer') return stop.purpose
  return 'visit'
}

/** One departure alternative — sorted by departure time. */
export function sortTransportOptions(
  options: JourneyTransportOption[],
  by: 'depart' | 'arrive' | 'duration' = 'depart',
): JourneyTransportOption[] {
  const rows = options.map((option, index) => ({
    option,
    index,
    depart: arriveTimeSortKey(option.startTime),
    arrive: arriveTimeSortKey(option.endTime),
    duration: optionDurationMinutes(option) ?? Number.POSITIVE_INFINITY,
  }))
  rows.sort((a, b) => {
    let delta = 0
    if (by === 'arrive') delta = a.arrive - b.arrive
    else if (by === 'duration') delta = a.duration - b.duration
    else delta = a.depart - b.depart
    if (delta !== 0) return delta
    if (a.depart !== b.depart) return a.depart - b.depart
    if (a.arrive !== b.arrive) return a.arrive - b.arrive
    if (a.duration !== b.duration) return a.duration - b.duration
    return a.index - b.index
  })
  return rows.map((row) => row.option)
}

/** @deprecated Prefer sortTransportOptions. */
export function sortTransportOptionsByTime(
  options: JourneyTransportOption[],
  by: 'depart' | 'arrive' | 'duration' = 'depart',
): JourneyTransportOption[] {
  return sortTransportOptions(options, by)
}

/**
 * Expand legacy multi-departure chips into one row per time.
 * Flight stays exclusive (alone). Does not sort (keep edit order stable).
 */
export function expandTransportOptions(
  options: JourneyTransportOption[],
): JourneyTransportOption[] {
  const expanded: JourneyTransportOption[] = []
  for (const o of options) {
    const times = normalizeDepartures(o.departures)
    if (times.length > 1) {
      for (const t of times) {
        expanded.push({
          ...o,
          id: `${o.id}-${t}`,
          startTime: t,
          departures: [],
        })
      }
      continue
    }
    const start = (o.startTime || '').trim() || times[0] || ''
    expanded.push({
      ...o,
      startTime: start,
      departures: [],
    })
  }
  const flight = expanded.find((o) => o.mode === 'flight')
  if (flight) {
    return [
      {
        ...flight,
        departures: [],
        startTime: (flight.startTime || '').trim(),
      },
    ]
  }
  return expanded
}

export function expandSortTransportOptions(
  options: JourneyTransportOption[],
): JourneyTransportOption[] {
  return sortTransportOptionsByTime(expandTransportOptions(options))
}

/** Normalize legacy single-mode fields into options[]. */
export function viaTransportOptions(via: JourneyVia): JourneyTransportOption[] {
  if (via.options?.length) {
    return expandTransportOptions(
      via.options.map((o) => ({
        ...o,
        departures: [...(o.departures || [])],
      })),
    )
  }
  if (
    via.mode?.trim() ||
    via.startTime?.trim() ||
    via.endTime?.trim() ||
    (via.departures || []).length
  ) {
    return expandTransportOptions([
      {
        id: `${via.id}-opt0`,
        mode: via.mode || '',
        title: '',
        startTime: via.startTime || '',
        endTime: via.endTime || '',
        departures: [...(via.departures || [])],
      },
    ])
  }
  return []
}

export function optionIsTaken(option?: JourneyTransportOption | null): boolean {
  return !!option?.taken
}

export function optionHasTicket(option?: JourneyTransportOption | null): boolean {
  return !!option?.ticket
}

/** Actual price when set, otherwise expected. */
export function effectiveTransportPrice(
  option?: Pick<JourneyTransportOption, 'price' | 'actualPrice'> | null,
): string {
  return (option?.actualPrice || '').trim() || (option?.price || '').trim()
}

/** Price label for transport lists (uses actual when set). */
export function transportOptionPriceLabel(
  option?: Pick<JourneyTransportOption, 'price' | 'actualPrice'> | null,
): string {
  const raw = effectiveTransportPrice(option)
  if (!raw) return ''
  const amount = parsePriceAmount(raw)
  if (amount !== null) return `${formatExpenseAmount(amount)} kr`
  const trimmed = raw.trim()
  if (/\bkr\.?\b/i.test(trimmed)) return trimmed
  return `${trimmed} kr`
}

/** The alternative we took, or the first one after current sort if none is kvittert. */
export function chosenTransportOption(
  via: JourneyVia,
): JourneyTransportOption | undefined {
  const opts = sortTransportOptions(viaTransportOptions(via))
  return chosenFromOptions(opts)
}

export function chosenFromOptions(
  options: JourneyTransportOption[],
): JourneyTransportOption | undefined {
  return (
    options.find(optionIsTaken) ||
    options.find(optionHasTicket) ||
    options[0]
  )
}

/** Mark one alternative as taken (or clear if it was already taken). */
export function withTakenTransportOption(
  options: JourneyTransportOption[],
  optionId: string,
): JourneyTransportOption[] {
  const current = options.find((o) => o.id === optionId)
  const nextTaken = !current?.taken
  return options.map((o) => ({
    ...o,
    taken: nextTaken && o.id === optionId,
  }))
}

/** Clear kvittert-valg on all alternatives for a via. */
export function clearTakenTransportOptions(
  options: JourneyTransportOption[],
): JourneyTransportOption[] {
  return options.map((o) => ({ ...o, taken: false }))
}

export function withViaOptions(
  via: JourneyVia,
  options: JourneyTransportOption[],
): JourneyVia {
  const opts = expandTransportOptions(options).map((o) => ({
    ...o,
    startTime: (o.startTime || '').trim(),
    endTime: (o.endTime || '').trim(),
    departures: [] as string[],
  }))
  const first = opts[0]
  return {
    ...via,
    options: opts,
    mode: first?.mode || '',
    startTime: first?.startTime || '',
    endTime: first?.endTime || '',
    // Prefer first option time only — multi-times live as separate options.
    departures: first?.startTime ? [first.startTime] : [],
  }
}

/**
 * Ordered places between two stops.
 * Legacy single mode/time on the leg becomes one place.
 */
export function transportSegments(
  leg?: JourneyLeg | null,
  opts?: { sort?: boolean },
): JourneyVia[] {
  const sortTimes = opts?.sort !== false
  if (!leg) return []
  const vias = [...(leg.vias || [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => {
      const options = viaTransportOptions(v)
      return withViaOptions(
        v,
        sortTimes ? sortTransportOptionsByTime(options) : options,
      )
    })
  if (vias.length) return vias
  if (leg.mode?.trim() || leg.title?.trim() || leg.startTime?.trim()) {
    return [
      withViaOptions(
        {
          id: `${leg.id}-main`,
          title: (leg.title || '').trim(),
          country: '',
          notes: '',
          sortOrder: 0,
        },
        [
          {
            id: `${leg.id}-opt0`,
            mode: leg.mode || '',
            title: '',
            startTime: leg.startTime || '',
            endTime: leg.endTime || '',
            departures: [],
          },
        ],
      ),
    ]
  }
  return []
}

export function withTransportSegments(
  leg: JourneyLeg,
  segments: JourneyVia[],
): JourneyLeg {
  const vias = segments.map((v, i) => {
    const normalized = withViaOptions(v, viaTransportOptions(v))
    return {
      ...normalized,
      title: v.title || '',
      country: v.country || '',
      purpose: viaPurpose(v),
      sortOrder: i,
    }
  })
  const first = vias[0]
  const firstOpt = first ? chosenTransportOption(first) : undefined
  return {
    ...leg,
    vias,
    mode: firstOpt?.mode || '',
    title: (first?.title || '').trim(),
    startTime: firstOpt?.startTime || firstOpt?.departures?.[0] || '',
    endTime: firstOpt?.endTime || '',
  }
}

export function moveTransportSegment(
  segments: JourneyVia[],
  index: number,
  direction: -1 | 1,
): JourneyVia[] {
  return reorderTransportSegments(segments, index, index + direction)
}

/** Move a city-step to a new index (drag-and-drop). */
export function reorderTransportSegments(
  segments: JourneyVia[],
  fromIndex: number,
  toIndex: number,
): JourneyVia[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= segments.length ||
    toIndex >= segments.length
  ) {
    return segments
  }
  const next = [...segments]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next.map((v, i) => ({ ...v, sortOrder: i }))
}

/** Compact label for collapsed list rows (3 letters + dot). */
export function abbreviateTransportCompany(company: string): string {
  const trimmed = company.trim()
  if (!trimmed) return ''
  return `${trimmed.slice(0, 3)}.`
}

function transportCompanyLabel(
  company: string,
  abbreviate = false,
): string {
  const trimmed = company.trim()
  if (!trimmed) return ''
  return abbreviate ? abbreviateTransportCompany(trimmed) : trimmed
}

/** Options on a hop without expanding multi-time departures into separate rows. */
function transportHopRawOptions(via: JourneyVia): JourneyTransportOption[] {
  if (via.options?.length) {
    return via.options.map((o) => ({
      ...o,
      departures: [...(o.departures || [])],
    }))
  }
  if (
    via.mode?.trim() ||
    via.startTime?.trim() ||
    via.endTime?.trim() ||
    (via.departures || []).length
  ) {
    return [
      {
        id: `${via.id}-opt0`,
        mode: via.mode || '',
        title: '',
        startTime: via.startTime || '',
        endTime: via.endTime || '',
        departures: [...(via.departures || [])],
      } as JourneyTransportOption,
    ]
  }
  return []
}

/** D/B for one departure row — rutetider/valg med samme type er direkte. */
export function transportOptionConnectionBadge(
  option: JourneyTransportOption,
  via: JourneyVia,
): 'D' | 'B' | '' {
  if (!isTransportOptionFilled(option)) return ''
  const filled = transportHopRawOptions(via).filter(isTransportOptionFilled)
  const modes = new Set(filled.map((o) => (o.mode || '').trim() || 'other'))
  if (modes.size > 1) return 'B'
  if (optionConnection(option, via) === 'change') return 'B'
  return 'D'
}

/** D/B for a hop summary (valgt eller første avgang). */
export function transportHopConnectionBadge(via: JourneyVia): 'D' | 'B' | '' {
  const opt =
    chosenTransportOption(via) ||
    transportHopRawOptions(via).find(isTransportOptionFilled)
  if (!opt) return ''
  return transportOptionConnectionBadge(opt, via)
}

/** One-line label for a transport option in lists (plan, live, overview). */
export function formatTransportOptionLabel(
  opt: JourneyTransportOption,
  opts?: {
    abbreviateCompany?: boolean
    includePrice?: boolean
    includeHopBadge?: boolean
    via?: JourneyVia
  },
): string {
  const title = (opt.title || '').trim()
  const company = transportCompanyLabel(
    opt.company || '',
    opts?.abbreviateCompany,
  )
  const time = (opt.startTime || '').trim()
  const mins = optionDurationMinutes(opt)
  const dur = mins != null ? formatDurationHM(mins) : ''
  let base: string
  if (modeIsWalk(opt.mode)) {
    const walk = (opt.minutes || '').trim()
    base =
      [legModeLabel(opt.mode), walk ? `${walk} min` : '']
        .filter(Boolean)
        .join(' · ') || 'Rediger avgang'
  } else {
    base = [title, company, time, dur].filter(Boolean).join(' · ') || 'Rediger avgang'
  }
  const badge =
    opts?.includeHopBadge && opts.via
      ? transportOptionConnectionBadge(opt, opts.via)
      : ''
  if (badge) base = `${badge} · ${base}`
  if (!opts?.includePrice) return base
  const price = transportOptionPriceLabel(opt)
  return price ? `${base} · ${price}` : base
}

function formatOptionSummaryBit(
  o: JourneyTransportOption,
  markOvernight = true,
): string {
  const mode = o.mode ? legModeLabel(o.mode) : ''
  const duration = optionDurationMinutes(o)
  const dur = duration != null ? formatDurationHM(duration) : ''
  const overnight = markOvernight && optionIsOvernight(o) ? '+1' : ''
  const taken = optionIsTaken(o) ? 'kvittert' : ''
  const ticket = optionHasTicket(o) ? 'billett' : ''
  const change = formatChangeTimeLabel(
    {
      connection: 'direct',
      changePlace: '',
      changePlatform: '',
      changeMinutes: '',
    },
    o,
  )
  if (modeIsWalk(o.mode)) {
    const m = (o.minutes || '').trim()
    const core = mode && m ? `${mode} ${m} min` : mode || (m ? `${m} min` : '')
    return [core, ticket, taken].filter(Boolean).join(' · ')
  }
  if (modeIsFlight(o.mode)) {
    const company = transportCompanyLabel(o.company || '')
    const nr = (o.title || '').trim()
    const gate = (o.gate || '').trim()
    const t = (o.startTime || '').trim()
    const parts = [
      mode,
      company,
      nr,
      gate ? `gate ${gate}` : '',
      t,
      overnight,
      dur,
      ticket,
      taken,
      change,
    ].filter(Boolean)
    return parts.join(' ')
  }
  if (modeIsOther(o.mode)) {
    const company = transportCompanyLabel(o.company || '')
    const type = (o.title || '').trim()
    const info = (o.info || '').trim()
    const t = (o.startTime || '').trim()
    const head = [company, type || mode, info].filter(Boolean).join(' — ')
    const core = head && t ? `${head} ${t}` : head || t
    return [core, overnight, dur, ticket, taken, change].filter(Boolean).join(' · ')
  }
  const company = transportCompanyLabel(o.company || '')
  const nr = (o.title || '').trim()
  const t = (o.startTime || '').trim()
  const platform = modeHasPlatform(o.mode) ? (o.platform || '').trim() : ''
  const plat = platform ? ` p.${platform}` : ''
  const head = [mode, company, nr].filter(Boolean).join(' ')
  const core =
    head && t ? `${head} ${t}${plat}` : head || (t ? `${t}${plat}` : plat.trim())
  return [core, overnight, dur, ticket, taken, change].filter(Boolean).join(' · ')
}

export function summarizeTransport(
  leg?: JourneyLeg | null,
  markOvernight = true,
): string {
  const segs = transportSegments(leg).filter((s) => {
    const opts = viaTransportOptions(s)
    return (
      s.title.trim() ||
      opts.some(
        (o) =>
          o.mode?.trim() ||
          o.startTime?.trim() ||
          (o.minutes || '').trim() ||
          (o.departures || []).length > 0,
      )
    )
  })
  if (!segs.length) return 'Transport'
  const places = segs.map((s) => {
    const name = s.title.trim() || 'Punkt'
    const bits = viaTransportOptions(s)
      .map((o) => formatOptionSummaryBit(o, markOvernight))
      .filter(Boolean)
    if (!bits.length) return name
    const shown = bits.slice(0, 3).join(' · ')
    const extra = bits.length > 3 ? ` +${bits.length - 3}` : ''
    return `${name} (${shown}${extra})`
  })
  if (places.length === 1) return places[0]
  const shown = places.slice(0, 3)
  const extra = places.length > 3 ? ` +${places.length - 3}` : ''
  return shown.join(' → ') + extra
}

/** Compact one-line summary for a city hop (collapsed accordion). */
export function summarizeViaHop(
  via: JourneyVia,
  fromLabel: string,
  _markOvernight = true,
): string {
  const to = formatCityStation(via.title, via.station) || via.title.trim() || '…'
  const route = `${fromLabel} → ${to}`
  const options = viaTransportOptions(via)
  const opt = chosenTransportOption(via) || options[0]
  if (!opt) return route
  const badge = transportHopConnectionBadge(via)
  const mode = opt.mode ? legModeLabel(opt.mode) : ''
  const company = transportCompanyLabel(opt.company || '')
  const mins = optionDurationMinutes(opt)
  const dur = mins != null ? formatDurationHM(mins) : ''
  const price = transportOptionPriceLabel(opt)
  const ride = [badge, company, mode, dur, price].filter(Boolean).join(' · ')
  return ride ? `${route} · ${ride}` : route
}

/** One line for the alt-count hover list. */
export function formatOptionAltLine(option: JourneyTransportOption): string {
  const mode = option.mode ? legModeLabel(option.mode) : ''
  const company = transportCompanyLabel(option.company || '')
  const time = modeIsWalk(option.mode) ? '' : (option.startTime || '').trim()
  const nr = modeIsFlight(option.mode) ? (option.title || '').trim() : ''
  const mins = optionDurationMinutes(option)
  const dur = mins != null ? formatDurationHM(mins) : ''
  const price = transportOptionPriceLabel(option)
  return [company, mode, nr, time, dur, price].filter(Boolean).join(' · ')
}

export type JourneyLiveKind = 'food' | 'drink' | 'shop' | 'other'

/** An uploaded image attached to a live log entry. */
export interface JourneyPhoto {
  id: string
  url: string
}

/** Something that happened on the trip but is not on the plan. */
export interface JourneyLiveEntry {
  id: string
  date: string
  kind: JourneyLiveKind
  title: string
  price?: string
  notes?: string
  time?: string
  /** 0 = unset, otherwise 1..5. */
  rating?: number
  photos?: JourneyPhoto[]
  /** Trip travelers this entry applies to; empty = all. */
  travelers?: string[]
  sortOrder: number
}

/** Live: user skipped registering sight / excursion / other for a city-day or one planned activity. */
export interface JourneyLiveActivitySkip {
  date: string
  stopId: string
  dayOffset: number
  /** When set, only this planned activity was skipped — not the whole day. */
  activityId?: string
}

export interface JourneyLiveDailySteps {
  date: string
  /** Display name — matches trip.travelers entries. */
  traveler?: string
  steps: number
}

/** Free-text comment logged for a calendar day in Live. */
export interface JourneyLiveDailyComment {
  id: string
  date: string
  text: string
  sortOrder: number
}

/** Photo attached to a calendar day in Live (not tied to a food/shop entry). */
export interface JourneyLiveDailyPhoto {
  id: string
  date: string
  url: string
  sortOrder: number
}

export interface Journey {
  id?: string
  tripId: string
  stops: JourneyStop[]
  legs: JourneyLeg[]
  /** Off-plan log (food, drinks, purchases) while travelling. */
  live?: JourneyLiveEntry[]
  /** Days where planned activities were intentionally not logged in Live. */
  liveActivitySkips?: JourneyLiveActivitySkip[]
  /** Daily step counts logged while travelling (Live). */
  liveDailySteps?: JourneyLiveDailySteps[]
  /** Free-text day comments logged in Live. */
  liveDailyComments?: JourneyLiveDailyComment[]
  /** Day photo gallery logged in Live. */
  liveDailyPhotos?: JourneyLiveDailyPhoto[]
  createdAt?: string
  updatedAt?: string
}

export function emptyJourney(tripId: string): Journey {
  return { tripId, stops: [], legs: [], live: [] }
}

export function newLiveEntry(
  date: string,
  kind: JourneyLiveKind,
  sortOrder = 0,
): JourneyLiveEntry {
  return {
    id: crypto.randomUUID(),
    date,
    kind,
    title: '',
    price: '',
    notes: '',
    time: '',
    rating: 0,
    photos: [],
    sortOrder,
  }
}

export function liveKindLabel(kind?: JourneyLiveKind | string): string {
  switch (kind) {
    case 'food':
      return 'Mat'
    case 'drink':
      return 'Drikke'
    case 'shop':
      return 'Kjøpt'
    default:
      return 'Annet'
  }
}

export function normalizeLive(
  list?: JourneyLiveEntry[] | null,
): JourneyLiveEntry[] {
  return [...(list || [])]
    .map((e, i) => {
      const kind: JourneyLiveKind =
        e.kind === 'food' || e.kind === 'drink' || e.kind === 'shop'
          ? e.kind
          : 'other'
      const rating = Math.max(0, Math.min(5, Math.round(Number(e.rating) || 0)))
      const photos = (e.photos || [])
        .map((p) => ({ id: p.id || crypto.randomUUID(), url: (p.url || '').trim() }))
        .filter((p) => p.url)
      return {
        ...e,
        id: e.id || crypto.randomUUID(),
        date: (e.date || '').trim(),
        kind,
        title: e.title || '',
        price: e.price || '',
        notes: e.notes || '',
        time: e.time || '',
        rating,
        photos,
        travelers: normalizeLiveEntryTravelers(e.travelers),
        sortOrder: i,
      }
    })
}

/** Normalize traveler tags on a live entry; empty = all travelers. */
export function normalizeLiveEntryTravelers(
  list?: string[] | null,
): string[] {
  return normalizeTravelers(list)
}

/** Effective travelers for an entry when trip has a traveler list. */
export function liveEntryTravelers(
  entry: Pick<JourneyLiveEntry, 'travelers'>,
  tripTravelers: string[],
): string[] {
  const all = normalizeTravelers(tripTravelers)
  if (!all.length) return []
  const tagged = normalizeLiveEntryTravelers(entry.travelers)
  if (!tagged.length) return all
  const allowed = new Set(all)
  return tagged.filter((name) => allowed.has(name))
}

export function liveEntryAppliesToTraveler(
  entry: Pick<JourneyLiveEntry, 'travelers'>,
  traveler: string,
  tripTravelers: string[],
): boolean {
  const who = liveEntryTravelers(entry, tripTravelers)
  if (!who.length) return true
  return who.includes(traveler)
}

/** Persist empty when all trip travelers are tagged. */
export function compactLiveEntryTravelers(
  tagged: string[] | undefined,
  tripTravelers: string[],
): string[] {
  const all = normalizeTravelers(tripTravelers)
  const names = normalizeLiveEntryTravelers(tagged).filter((n) =>
    all.includes(n),
  )
  if (!all.length || names.length === 0 || names.length === all.length) {
    return []
  }
  return names
}

export function toggleLiveEntryTraveler(
  entry: Pick<JourneyLiveEntry, 'travelers'>,
  traveler: string,
  tripTravelers: string[],
  on: boolean,
): string[] {
  const all = normalizeTravelers(tripTravelers)
  if (!all.length) return []
  const current = liveEntryTravelers(entry, all)
  const next = on
    ? [...new Set([...current, traveler])]
    : current.filter((n) => n !== traveler)
  return compactLiveEntryTravelers(next, all)
}

/** Drop blank draft rows before persist. */
export function compactLive(
  list?: JourneyLiveEntry[] | null,
  tripTravelers?: string[] | null,
): JourneyLiveEntry[] {
  const all = normalizeTravelers(tripTravelers)
  return normalizeLive(list)
    .filter(
      (e) =>
        e.date &&
        (e.title.trim() ||
          (e.price || '').trim() ||
          (e.notes || '').trim() ||
          (e.rating || 0) > 0 ||
          (e.photos || []).length > 0),
    )
    .map((e) => ({
      ...e,
      travelers: compactLiveEntryTravelers(e.travelers, all),
    }))
}

export function normalizeLiveActivitySkips(
  list?: JourneyLiveActivitySkip[] | null,
): JourneyLiveActivitySkip[] {
  const seen = new Set<string>()
  const out: JourneyLiveActivitySkip[] = []
  for (const raw of list || []) {
    const date = (raw.date || '').trim()
    const stopId = (raw.stopId || '').trim()
    const activityId = (raw.activityId || '').trim()
    const dayOffset =
      typeof raw.dayOffset === 'number' && raw.dayOffset >= 0
        ? Math.floor(raw.dayOffset)
        : 0
    if (!date || !stopId) continue
    const key = `${date}\0${stopId}\0${dayOffset}\0${activityId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      date,
      stopId,
      dayOffset,
      ...(activityId ? { activityId } : {}),
    })
  }
  return out
}

export function normalizeLiveDailySteps(
  list?: JourneyLiveDailySteps[] | null,
): JourneyLiveDailySteps[] {
  const byKey = new Map<string, JourneyLiveDailySteps>()
  for (const raw of list || []) {
    const date = (raw.date || '').trim()
    if (!date) continue
    const traveler = (raw.traveler || '').trim()
    const steps = Math.max(0, Math.floor(Number(raw.steps) || 0))
    const key = `${date}\x00${traveler}`
    byKey.set(key, { date, traveler, steps })
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.traveler || '').localeCompare(b.traveler || '', 'nb')
  })
}

/** Drop zero rows before persist. */
export function compactLiveDailySteps(
  list?: JourneyLiveDailySteps[] | null,
): JourneyLiveDailySteps[] {
  return normalizeLiveDailySteps(list).filter((e) => e.steps > 0)
}

export function liveStepsOnDateForTraveler(
  journey: Journey,
  date: string,
  traveler: string,
): number {
  const d = date.trim()
  const who = traveler.trim()
  if (!d) return 0
  const row = normalizeLiveDailySteps(journey.liveDailySteps).find(
    (e) => e.date === d && (e.traveler || '').trim() === who,
  )
  return row?.steps ?? 0
}

export function liveStepsOnDate(journey: Journey, date: string): number {
  const d = date.trim()
  if (!d) return 0
  return normalizeLiveDailySteps(journey.liveDailySteps)
    .filter((e) => e.date === d)
    .reduce((sum, e) => sum + e.steps, 0)
}

export function liveStepsTotal(journey: Journey): number {
  return normalizeLiveDailySteps(journey.liveDailySteps).reduce(
    (sum, e) => sum + e.steps,
    0,
  )
}

export function liveStepsTotalForTraveler(
  journey: Journey,
  traveler: string,
): number {
  const who = traveler.trim()
  return normalizeLiveDailySteps(journey.liveDailySteps)
    .filter((e) => (e.traveler || '').trim() === who)
    .reduce((sum, e) => sum + e.steps, 0)
}

export interface JourneyOverviewStepsDayRow {
  date: string
  byTraveler: Record<string, number>
  total: number
}

export function journeyOverviewStepsSummary(
  journey: Journey,
  travelers?: string[] | null,
): {
  travelers: string[]
  days: JourneyOverviewStepsDayRow[]
  totalsByTraveler: Record<string, number>
  tripTotal: number
} {
  const people = normalizeTravelers(travelers)
  const dates = [...new Set(
    normalizeLiveDailySteps(journey.liveDailySteps)
      .filter((e) => e.steps > 0)
      .map((e) => e.date),
  )].sort()
  const days = dates.map((date) => {
    const byTraveler: Record<string, number> = {}
    for (const name of people) {
      byTraveler[name] = liveStepsOnDateForTraveler(journey, date, name)
    }
    return {
      date,
      byTraveler,
      total: liveStepsOnDate(journey, date),
    }
  })
  const totalsByTraveler: Record<string, number> = {}
  for (const name of people) {
    totalsByTraveler[name] = liveStepsTotalForTraveler(journey, name)
  }
  return {
    travelers: people,
    days,
    totalsByTraveler,
    tripTotal: liveStepsTotal(journey),
  }
}

export function withLiveDailyStepsForTraveler(
  journey: Journey,
  date: string,
  traveler: string,
  steps: number,
): Journey {
  const d = date.trim()
  const who = traveler.trim()
  const n = Math.max(0, Math.floor(steps))
  const rest = normalizeLiveDailySteps(journey.liveDailySteps).filter(
    (e) => e.date !== d || (e.traveler || '').trim() !== who,
  )
  if (n === 0) return { ...journey, liveDailySteps: rest }
  return {
    ...journey,
    liveDailySteps: [...rest, { date: d, traveler: who, steps: n }],
  }
}

/** Legacy rows without traveler name. */
export function withLiveDailySteps(
  journey: Journey,
  date: string,
  steps: number,
): Journey {
  return withLiveDailyStepsForTraveler(journey, date, '', steps)
}

export function normalizeLiveDailyComments(
  list?: JourneyLiveDailyComment[] | null,
): JourneyLiveDailyComment[] {
  const out: JourneyLiveDailyComment[] = []
  for (const raw of list || []) {
    const id = (raw.id || '').trim() || crypto.randomUUID()
    const date = (raw.date || '').trim()
    const text = (raw.text || '').trim()
    if (!date) continue
    const sortOrder =
      typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder)
        ? Math.floor(raw.sortOrder)
        : out.length
    out.push({ id, date, text, sortOrder })
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.id.localeCompare(b.id)
  })
}

export function compactLiveDailyComments(
  list?: JourneyLiveDailyComment[] | null,
): JourneyLiveDailyComment[] {
  // Keep empty drafts so "+ Kommentar" rows survive autosave until the user
  // types or deletes them.
  return normalizeLiveDailyComments(list).map((c, i) => ({
    ...c,
    sortOrder: i,
  }))
}

export function liveCommentsOnDate(
  journey: Journey,
  date: string,
): JourneyLiveDailyComment[] {
  const d = date.trim()
  if (!d) return []
  return normalizeLiveDailyComments(journey.liveDailyComments).filter(
    (c) => c.date === d,
  )
}

export function addLiveDailyComment(
  journey: Journey,
  date: string,
  text = '',
): Journey {
  const d = date.trim()
  if (!d) return journey
  const existing = normalizeLiveDailyComments(journey.liveDailyComments)
  const onDay = existing.filter((c) => c.date === d)
  const row: JourneyLiveDailyComment = {
    id: crypto.randomUUID(),
    date: d,
    text: text.trim(),
    sortOrder: onDay.length,
  }
  return {
    ...journey,
    liveDailyComments: [...existing, row],
  }
}

export function updateLiveDailyComment(
  journey: Journey,
  id: string,
  text: string,
): Journey {
  const commentId = id.trim()
  if (!commentId) return journey
  return {
    ...journey,
    liveDailyComments: normalizeLiveDailyComments(journey.liveDailyComments).map(
      (c) => (c.id === commentId ? { ...c, text: text.trim() } : c),
    ),
  }
}

export function removeLiveDailyComment(
  journey: Journey,
  id: string,
): Journey {
  const commentId = id.trim()
  if (!commentId) return journey
  return {
    ...journey,
    liveDailyComments: normalizeLiveDailyComments(
      journey.liveDailyComments,
    ).filter((c) => c.id !== commentId),
  }
}

export function normalizeLiveDailyPhotos(
  list?: JourneyLiveDailyPhoto[] | null,
): JourneyLiveDailyPhoto[] {
  const out: JourneyLiveDailyPhoto[] = []
  for (const raw of list || []) {
    const id = (raw.id || '').trim() || crypto.randomUUID()
    const date = (raw.date || '').trim()
    const url = (raw.url || '').trim()
    if (!date || !url) continue
    const sortOrder =
      typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder)
        ? Math.floor(raw.sortOrder)
        : out.length
    out.push({ id, date, url, sortOrder })
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.id.localeCompare(b.id)
  })
}

export function compactLiveDailyPhotos(
  list?: JourneyLiveDailyPhoto[] | null,
): JourneyLiveDailyPhoto[] {
  return normalizeLiveDailyPhotos(list).map((p, i) => ({
    ...p,
    sortOrder: i,
  }))
}

export function livePhotosOnDate(
  journey: Journey,
  date: string,
): JourneyLiveDailyPhoto[] {
  const d = date.trim()
  if (!d) return []
  return normalizeLiveDailyPhotos(journey.liveDailyPhotos).filter(
    (p) => p.date === d,
  )
}

export function addLiveDailyPhotos(
  journey: Journey,
  date: string,
  photos: { id?: string; url: string }[],
): Journey {
  const d = date.trim()
  if (!d || !photos.length) return journey
  const existing = normalizeLiveDailyPhotos(journey.liveDailyPhotos)
  const onDay = existing.filter((p) => p.date === d)
  let order = onDay.length
  const added: JourneyLiveDailyPhoto[] = []
  for (const photo of photos) {
    const url = (photo.url || '').trim()
    if (!url) continue
    added.push({
      id: (photo.id || '').trim() || crypto.randomUUID(),
      date: d,
      url,
      sortOrder: order++,
    })
  }
  if (!added.length) return journey
  return {
    ...journey,
    liveDailyPhotos: [...existing, ...added],
  }
}

export function removeLiveDailyPhoto(
  journey: Journey,
  id: string,
): Journey {
  const photoId = id.trim()
  if (!photoId) return journey
  return {
    ...journey,
    liveDailyPhotos: normalizeLiveDailyPhotos(journey.liveDailyPhotos).filter(
      (p) => p.id !== photoId,
    ),
  }
}

export function liveSkippedActivityIds(
  journey: Journey,
  date: string,
  stopId: string,
  dayOffset: number,
): Set<string> {
  const d = date.trim()
  const id = stopId.trim()
  const offset = Math.max(0, Math.floor(dayOffset))
  const ids = new Set<string>()
  if (!d || !id) return ids
  for (const s of normalizeLiveActivitySkips(journey.liveActivitySkips)) {
    if (
      s.date === d &&
      s.stopId === id &&
      s.dayOffset === offset &&
      (s.activityId || '').trim()
    ) {
      ids.add((s.activityId || '').trim())
    }
  }
  return ids
}

export function isLiveActivitySkipped(
  journey: Journey,
  date: string,
  stopId: string,
  dayOffset: number,
): boolean {
  const d = date.trim()
  const id = stopId.trim()
  if (!d || !id) return false
  const offset = Math.max(0, Math.floor(dayOffset))
  return normalizeLiveActivitySkips(journey.liveActivitySkips).some(
    (s) =>
      s.date === d &&
      s.stopId === id &&
      s.dayOffset === offset &&
      !(s.activityId || '').trim(),
  )
}

export function isLiveActivityItemSkipped(
  journey: Journey,
  date: string,
  stopId: string,
  dayOffset: number,
  activityId: string,
): boolean {
  const actId = activityId.trim()
  if (!actId) return false
  return liveSkippedActivityIds(journey, date, stopId, dayOffset).has(actId)
}

export function withLiveActivitySkip(
  journey: Journey,
  date: string,
  stopId: string,
  dayOffset: number,
  skipped: boolean,
): Journey {
  const d = date.trim()
  const id = stopId.trim()
  const offset = Math.max(0, Math.floor(dayOffset))
  const rest = normalizeLiveActivitySkips(journey.liveActivitySkips).filter(
    (s) =>
      s.date !== d ||
      s.stopId !== id ||
      s.dayOffset !== offset ||
      (s.activityId || '').trim(),
  )
  if (!skipped || !d || !id) {
    return { ...journey, liveActivitySkips: rest }
  }
  return {
    ...journey,
    liveActivitySkips: [...rest, { date: d, stopId: id, dayOffset: offset }],
  }
}

export function withLiveActivityItemSkip(
  journey: Journey,
  date: string,
  stopId: string,
  dayOffset: number,
  activityId: string,
  skipped: boolean,
): Journey {
  const d = date.trim()
  const id = stopId.trim()
  const actId = activityId.trim()
  const offset = Math.max(0, Math.floor(dayOffset))
  const rest = normalizeLiveActivitySkips(journey.liveActivitySkips).filter(
    (s) =>
      s.date !== d ||
      s.stopId !== id ||
      s.dayOffset !== offset ||
      (s.activityId || '').trim() !== actId,
  )
  if (!skipped || !d || !id || !actId) {
    return { ...journey, liveActivitySkips: rest }
  }
  return {
    ...journey,
    liveActivitySkips: [
      ...rest,
      { date: d, stopId: id, dayOffset: offset, activityId: actId },
    ],
  }
}

export function todayIsoOslo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' })
}

export function journeyDateSpan(journey: Journey): {
  start: string
  end: string
} | null {
  const dates: string[] = []
  for (const stop of journey.stops || []) {
    const arrive = (stop.arriveDate || '').trim()
    if (arrive) dates.push(arrive)
    const depart = (stopDepartDate(stop) || '').trim()
    if (depart) dates.push(depart)
  }
  dates.sort()
  if (!dates.length) return null
  return { start: dates[0], end: dates[dates.length - 1] }
}

export function newStopId(): string {
  return crypto.randomUUID()
}

export function newSightId(): string {
  return crypto.randomUUID()
}

export function activityKindLabel(kind?: JourneyActivityKind | string): string {
  switch (kind) {
    case 'excursion':
      return 'Utflukt'
    case 'other':
      return 'Annet'
    default:
      return 'Severdighet'
  }
}

/** Primary label for an activity in lists, previews and expenses. */
export function activityDisplayName(
  activity: Pick<JourneyActivity, 'title' | 'place' | 'kind'> | null | undefined,
): string {
  const city = (activity?.title || '').trim()
  const place = (activity?.place || '').trim()
  if (place && city) return `${place} · ${city}`
  if (place) return place
  if (city) return city
  return activityKindLabel(activity?.kind)
}

/** Sync `notes` into `docs` when legacy data only has notes text. */
export function repairActivityNotesDocs(
  activity: JourneyActivity,
): JourneyActivity {
  const note = (activity.notes || '').trim()
  if (!noteHasContent(note)) return activity
  const docs = normalizeCityDocs(activity.docs, true)
  if (docs.some((d) => noteHasContent(d.body))) return activity
  const first = docs[0]
  return {
    ...activity,
    docs: [
      {
        id: first?.id || 'notes',
        title: (first?.title || '').trim() || 'Notat',
        body: note,
        sortOrder: 0,
      },
      ...docs.slice(1),
    ],
  }
}

export function newSight(
  sortOrder = 0,
  kind: JourneyActivityKind = 'sight',
  dayOffset = 0,
): JourneyActivity {
  return {
    id: newSightId(),
    title: '',
    place: '',
    notes: '',
    url: '',
    kind,
    dayOffset,
    startTime: '',
    endTime: '',
    purpose: 'visit',
    price: '',
    paid: false,
    sortOrder,
  }
}

export function compactActivity(activity: JourneyActivity): JourneyActivity {
  const repaired = repairActivityNotesDocs(activity)
  const docs = compactCityDocs(cityDocsOf(repaired))
  return {
    ...repaired,
    docs,
    notes: docs[0]?.body || compactNoteHtml(repaired.notes || ''),
  }
}

export function normalizeSights(
  list?: JourneyActivity[] | null,
): JourneyActivity[] {
  return [...(list || [])]
    .map((s, i) => {
      const kind: JourneyActivityKind =
        s.kind === 'excursion'
          ? 'excursion'
          : s.kind === 'other'
            ? 'other'
            : 'sight'
      return repairActivityNotesDocs({
        ...s,
        id: s.id || newSightId(),
        title: s.title || '',
        place: (s.place || '').trim(),
        notes: s.notes || '',
        url: s.url || '',
        kind,
        dayOffset:
          typeof s.dayOffset === 'number' && s.dayOffset >= 0
            ? Math.floor(s.dayOffset)
            : 0,
        startTime: s.startTime
          ? normalizeClockTime(s.startTime) || s.startTime
          : '',
        endTime: s.endTime
          ? normalizeClockTime(s.endTime) || s.endTime
          : '',
        purpose: activityPurpose(s),
        price: (s.price || '').trim(),
        paid: s.paid || false,
        docs: normalizeCityDocs(s.docs),
        sortOrder: i,
      })
    })
    .filter(
      (s) =>
        s.title.trim() ||
        (s.place || '').trim() ||
        (s.notes || '').trim() ||
        cityDocsOf(s).some((d) => noteHasContent(d.body)) ||
        (s.url || '').trim() ||
        (s.startTime || '').trim() ||
        (s.endTime || '').trim() ||
        (s.price || '').trim(),
    )
}

/**
 * Calendar days you are “in” a place stop: arrive day through last overnight.
 * 2 netter from 02 → days 02 and 03 (checkout morning 04 is not a full day).
 */
export function cityStayDays(stop: JourneyStop): {
  offset: number
  date: string
  label: string
}[] {
  const arrive = (stop.arriveDate || '').trim()
  if (!arrive) return []
  const nights = stayNights(stop)
  const count = Math.max(1, nights)
  const city = (stop.city || '').trim() || 'byen'
  return Array.from({ length: count }, (_, offset) => ({
    offset,
    date: addDaysIso(arrive, offset),
    label: `I ${city}`,
  }))
}

export function activitiesForDay(
  sights: JourneyActivity[] | null | undefined,
  dayOffset: number,
): JourneyActivity[] {
  return normalizeSights(sights).filter(
    (s) => (s.dayOffset ?? 0) === dayOffset,
  )
}

/** Replace one day’s activities inside a stop’s sights list. */
export function replaceDayActivities(
  sights: JourneyActivity[] | null | undefined,
  dayOffset: number,
  dayList: JourneyActivity[],
): JourneyActivity[] {
  const others = normalizeSights(sights).filter(
    (s) => (s.dayOffset ?? 0) !== dayOffset,
  )
  const nextDay = normalizeSights(
    dayList.map((s) => ({ ...s, dayOffset })),
  )
  return normalizeSights([...others, ...nextDay])
}

/** Move one activity to another calendar day within the same stop. */
export function moveActivityToDay(
  sights: JourneyActivity[] | null | undefined,
  activityId: string,
  targetDayOffset: number,
): JourneyActivity[] {
  const list = normalizeSights(sights)
  const activity = list.find((s) => s.id === activityId)
  if (!activity) return list
  const sourceOffset = activity.dayOffset ?? 0
  const targetOffset =
    typeof targetDayOffset === 'number' && targetDayOffset >= 0
      ? Math.floor(targetDayOffset)
      : 0
  if (sourceOffset === targetOffset) return list

  const without = list.filter((s) => s.id !== activityId)
  const targetDay = without.filter((s) => (s.dayOffset ?? 0) === targetOffset)
  const moved: JourneyActivity = {
    ...activity,
    dayOffset: targetOffset,
    sortOrder: targetDay.length,
  }
  return normalizeSights([...without, moved])
}

/** Calendar days on a stop where activities can be scheduled. */
export function calendarDaysForStop(stop: JourneyStop): {
  offset: number
  date: string
  label: string
}[] {
  const arrive = (stop.arriveDate || '').trim()
  if (!arrive) return []

  if (isPackageStop(stop)) {
    const pack = packageOf(stop)
    const nights = packageNightsOf(pack)
    const freeLabel = packageFreeDayLabel(stop.kind)
    return Array.from({ length: nights + 1 }, (_, offset) => {
      const day = (pack?.days || []).find(
        (d) => packageDayOffset(d) === offset,
      )
      const date = addDaysIso(arrive, offset)
      const place = day?.atSea
        ? freeLabel
        : day?.city?.trim() ||
          pack?.basePlace?.trim() ||
          stop.city?.trim() ||
          'Dag'
      return {
        offset,
        date,
        label: `${formatDateNO(date)} · ${place}`,
      }
    })
  }

  if (stop.kind === 'home') {
    return [{ offset: 0, date: arrive, label: formatDateNO(arrive) }]
  }

  return cityStayDays(stop).map((d) => ({
    offset: d.offset,
    date: d.date,
    label: `${formatDateNO(d.date)} · ${d.label}`,
  }))
}

/** Which stop and dayOffset owns a calendar date on the journey thread. */
export function resolveActivityDateTarget(
  journey: Journey,
  date: string,
): { stopId: string; dayOffset: number; label: string } | null {
  const target = (date || '').trim()
  if (!target) return null
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  for (const stop of stops) {
    const day = calendarDaysForStop(stop).find((d) => d.date === target)
    if (day) {
      return {
        stopId: stop.id,
        dayOffset: day.offset,
        label: day.label,
      }
    }
  }
  return null
}

export function journeyActivityCalendarBounds(journey: Journey): {
  min?: string
  max?: string
} {
  let min = ''
  let max = ''
  for (const stop of journey.stops || []) {
    for (const day of calendarDaysForStop(stop)) {
      if (!min || day.date < min) min = day.date
      if (!max || day.date > max) max = day.date
    }
  }
  return { min: min || undefined, max: max || undefined }
}

/** Move an activity to any calendar day on the journey (may change stop). */
export function moveActivityToCalendarDate(
  journey: Journey,
  sourceStopId: string,
  activityId: string,
  targetDate: string,
): Journey | null {
  const target = resolveActivityDateTarget(journey, targetDate)
  if (!target) return null

  const sourceStop = (journey.stops || []).find((s) => s.id === sourceStopId)
  if (!sourceStop) return null

  const activity = normalizeSights(sourceStop.sights).find(
    (s) => s.id === activityId,
  )
  if (!activity) return null

  const sourceOffset = activity.dayOffset ?? 0
  if (
    target.stopId === sourceStopId &&
    sourceOffset === target.dayOffset
  ) {
    return journey
  }

  const sourceSights = normalizeSights(sourceStop.sights).filter(
    (s) => s.id !== activityId,
  )

  const targetStop = (journey.stops || []).find((s) => s.id === target.stopId)
  if (!targetStop) return null

  const targetDayCount = normalizeSights(targetStop.sights).filter(
    (s) => (s.dayOffset ?? 0) === target.dayOffset,
  ).length
  const moved: JourneyActivity = {
    ...activity,
    dayOffset: target.dayOffset,
    sortOrder: targetDayCount,
  }
  const targetSights = normalizeSights([
    ...normalizeSights(targetStop.sights),
    moved,
  ])

  return {
    ...journey,
    stops: (journey.stops || []).map((s) => {
      if (s.id === sourceStopId) return { ...s, sights: sourceSights }
      if (s.id === target.stopId) return { ...s, sights: targetSights }
      return s
    }),
  }
}

export function newLegId(): string {
  return crypto.randomUUID()
}

export function legModeLabel(mode?: string): string {
  switch (mode) {
    case 'flight':
      return 'Fly'
    case 'train':
      return 'Tog'
    case 'tram':
      return 'Bybane/trikk'
    case 'bus':
      return 'Buss'
    case 'car':
      return 'Bil'
    case 'boat':
      return 'Båt/ferge'
    case 'walk':
      return 'Til fots'
    case 'other':
      return 'Annet'
    default:
      return 'Reise'
  }
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const CRUISE_AT_SEA = 'Til sjøs'

export function packageTypeLabel(type: JourneyPackageType | string): string {
  switch (type) {
    case 'cruise':
      return 'Cruise'
    case 'tour':
      return 'Pakketur'
    case 'charter':
      return 'Charter'
    case 'roadtrip':
      return 'Roadtrip'
    case 'other':
      return 'Annet'
    default:
      return 'Pakke'
  }
}

export function packageFreeDayLabel(type: JourneyPackageType | string): string {
  switch (type) {
    case 'cruise':
      return CRUISE_AT_SEA
    case 'roadtrip':
      return 'Kjøredag'
    case 'charter':
      return 'Fri / pool'
    default:
      return 'Fri dag'
  }
}

export function packagePlaceDayLabel(type: JourneyPackageType | string): string {
  switch (type) {
    case 'cruise':
      return 'Havn'
    case 'charter':
      return 'Destinasjon'
    case 'roadtrip':
      return 'Stopp'
    default:
      return 'Sted'
  }
}

export function packageTitleLabel(type: JourneyPackageType | string): string {
  switch (type) {
    case 'cruise':
      return 'Skip'
    case 'tour':
      return 'Tur / operatør'
    case 'charter':
      return 'Charter / destinasjon'
    case 'roadtrip':
      return 'Rute / navn'
    default:
      return 'Navn'
  }
}

export function packageBaseLabel(type: JourneyPackageType | string): string {
  switch (type) {
    case 'cruise':
      return 'Hjemhavn'
    case 'charter':
      return 'Hovedsted'
    case 'roadtrip':
      return 'Startsted'
    default:
      return 'Base / start'
  }
}

export function packageDetailLabel(type: JourneyPackageType | string): string {
  switch (type) {
    case 'cruise':
      return 'Lugar'
    case 'tour':
      return 'Booking / ref'
    case 'charter':
      return 'Hotell / ref'
    case 'roadtrip':
      return 'Kjøretøy / ref'
    default:
      return 'Ref'
  }
}

export function packageStartRoleLabel(type: JourneyPackageType | string): string {
  return type === 'cruise' ? 'hjemhavn · ombord' : 'start'
}

export function packageEndRoleLabel(type: JourneyPackageType | string): string {
  return type === 'cruise' ? 'iland' : 'slutt'
}

/** Minutes between two clock times; leave before arrive → overnight (+24h). */
export function packagePortMinutes(
  arriveTime?: string,
  leaveTime?: string,
  opts?: { allowOvernight?: boolean },
): number | null {
  const a = arriveTimeSortKey(arriveTime)
  const b = arriveTimeSortKey(leaveTime)
  if (
    a === Number.POSITIVE_INFINITY ||
    b === Number.POSITIVE_INFINITY
  ) {
    return null
  }
  let diff = Math.round((b - a) / 60)
  if (diff < 0) {
    if (opts?.allowOvernight === false) return null
    diff += 24 * 60
  }
  if (diff <= 0) return null
  return diff
}

export function formatPackagePortHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h} t ${m} min`
  if (h > 0) return `${h} t`
  return `${m} min`
}

/** Columns for the borderless cruise/package day table. */
export function packageDayTableRow(
  day: JourneyPackageDay,
  opts: {
    type: JourneyPackageType | string
    nights: number
    basePlace?: string
    freeLabel: string
    placeFallback: string
  },
): {
  place: string
  arrive: string
  allAboard: string
  leave: string
  portHours: string
  atSea: boolean
} {
  if (day.atSea) {
    return {
      place: opts.freeLabel,
      arrive: '',
      allAboard: '',
      leave: '',
      portHours: '',
      atSea: true,
    }
  }
  const place =
    day.city?.trim() ||
    (opts.type === 'cruise' && day.offset === 0
      ? opts.basePlace?.trim() || 'Hjemhavn'
      : opts.placeFallback)
  const isStart = packageDayOffset(day) === 0
  const isLast = packageDayOffset(day) === opts.nights
  const arriveRaw =
    opts.type === 'cruise' && isStart
      ? ''
      : (day.arriveTime || '').trim()
  const leaveRaw =
    opts.type === 'cruise' && isLast
      ? ''
      : (day.leaveTime || '').trim()
  const allAboardRaw =
    opts.type === 'cruise' && !isLast
      ? (day.allAboardTime || '').trim()
      : ''
  const arrive = arriveRaw ? normalizeClockTime(arriveRaw) || arriveRaw : ''
  const allAboard = allAboardRaw
    ? normalizeClockTime(allAboardRaw) || allAboardRaw
    : ''
  const leave = leaveRaw ? normalizeClockTime(leaveRaw) || leaveRaw : ''
  const mins =
    arrive && leave
      ? packagePortMinutes(arrive, leave, {
          allowOvernight: opts.type !== 'cruise',
        })
      : null
  return {
    place,
    arrive,
    allAboard,
    leave,
    portHours: mins != null ? formatPackagePortHours(mins) : '',
    atSea: false,
  }
}

/** @deprecated Prefer packageDayTableRow for the day table. */
export function formatPackageDayListLine(
  day: JourneyPackageDay,
  opts: {
    type: JourneyPackageType | string
    nights: number
    basePlace?: string
    freeLabel: string
    placeFallback: string
  },
): string {
  const row = packageDayTableRow(day, opts)
  if (row.atSea) return row.place
  const parts: string[] = [row.place]
  const timeBits = [
    row.arrive ? `Ank. ${row.arrive}` : '',
    opts.type === 'cruise' && row.allAboard
      ? `All aboard ${row.allAboard}`
      : '',
    row.leave ? `Avg. ${row.leave}` : '',
  ].filter(Boolean)
  if (timeBits.length) parts.push(timeBits.join(' · '))
  return parts.join(' · ')
}

export function newPackageDayId(): string {
  return crypto.randomUUID()
}

/** @deprecated use newPackageDayId */
export function newCruiseDayId(): string {
  return newPackageDayId()
}

/** Normalize legacy cruise field shape into JourneyPackage. */
export function packageOf(
  stop: Pick<
    JourneyStop,
    'pack' | 'cruise' | 'city' | 'country' | 'latitude' | 'longitude'
  > | null | undefined,
): JourneyPackage | null {
  if (stop?.pack) {
    return {
      nights: stop.pack.nights,
      title: stop.pack.title || '',
      // City on the stop is the package base / hjemhavn when pack.basePlace is missing.
      basePlace: stop.pack.basePlace || stop.city || '',
      baseCountry: stop.pack.baseCountry || stop.country || '',
      baseLatitude:
        stop.pack.baseLatitude || stop.latitude || undefined,
      baseLongitude:
        stop.pack.baseLongitude || stop.longitude || undefined,
      detail: stop.pack.detail || '',
      price: stop.pack.price || '',
      paid: stop.pack.paid,
      costs: [...(stop.pack.costs || [])],
      days: [...(stop.pack.days || [])],
    }
  }
  const c = stop?.cruise
  if (!c) return null
  return {
    nights: c.nights,
    title: c.title || c.shipName || '',
    basePlace: c.basePlace || c.homePort || stop.city || '',
    baseCountry: c.baseCountry || c.homeCountry || stop.country || '',
    baseLatitude: stop.latitude || undefined,
    baseLongitude: stop.longitude || undefined,
    detail: c.detail || c.cabinNumber || '',
    price: c.price || '',
    paid: c.paid,
    costs: [...(c.costs || [])],
    days: [...(c.days || [])],
  }
}

export function packageNightsOf(pack?: JourneyPackage | null): number {
  const fromField = Math.floor(Number(pack?.nights) || 0)
  // Day list is offset 0 … nights (inclusive). Prefer the longer signal so a
  // missing/stale nights field cannot collapse a 7-night cruise to 1 day.
  let fromDays = 0
  for (const d of pack?.days || []) {
    const off = packageDayOffset(d)
    if (off > fromDays) fromDays = off
  }
  const n = Math.max(fromField, fromDays)
  return Math.max(1, Math.min(30, n || 1))
}

/** Firestore/JSON may store offset as a string; Map.get(0) then misses "0". */
export function packageDayOffset(
  day: Pick<JourneyPackageDay, 'offset'> | null | undefined,
): number {
  const n = Math.floor(Number(day?.offset))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Always emit clock strings so JSON.stringify keeps allAboardTime on PUT. */
export function persistPackageDay(day: JourneyPackageDay): JourneyPackageDay {
  const dayDocs = compactCityDocs(cityDocsOf(day))
  return {
    ...day,
    offset: packageDayOffset(day),
    arriveTime: commitClockTimeInput((day.arriveTime || '').trim()),
    leaveTime: commitClockTimeInput((day.leaveTime || '').trim()),
    allAboardTime: commitClockTimeInput((day.allAboardTime || '').trim()),
    docs: dayDocs,
    notes: dayDocs[0]?.body || compactNoteHtml(day.notes || ''),
  }
}

/** @deprecated use packageNightsOf */
export function cruiseNightsOf(cruise?: JourneyCruise | null): number {
  return packageNightsOf(cruise)
}

/** Build / resize package day list when nights or base place change. */
export function syncPackageDays(
  pack: JourneyPackage,
  type: JourneyPackageType = 'other',
): JourneyPackage {
  const nights = packageNightsOf(pack)
  const baseRaw = pack.basePlace ?? ''
  const baseCountryRaw = pack.baseCountry ?? ''
  const base = baseRaw.trim()
  const baseCountry = baseCountryRaw.trim()
  const baseCoords = geoCoordsOf(pack.baseLatitude, pack.baseLongitude)
  const freeLabel = packageFreeDayLabel(type)
  const prev = [...(pack.days || [])]
    .map((d) => ({ ...d, offset: packageDayOffset(d) }))
    .sort((a, b) => a.offset - b.offset)
  const byOffset = new Map<number, JourneyPackageDay>()
  for (const d of prev) {
    const cur = byOffset.get(d.offset)
    if (!cur) {
      byOffset.set(d.offset, d)
      continue
    }
    const curAboard = (cur.allAboardTime || '').trim()
    const nextAboard = (d.allAboardTime || '').trim()
    if (!curAboard && nextAboard) byOffset.set(d.offset, d)
  }
  const days: JourneyPackageDay[] = []
  for (let offset = 0; offset <= nights; offset++) {
    const existing = byOffset.get(offset) || prev[offset]
    const isStart = offset === 0
    const isLast = offset === nights
    /** Embark / start day always uses hjemhavn (base). */
    const lockBase = isStart
    const fillBase = isStart || isLast
    if (existing) {
      const atSea = lockBase ? false : !!existing.atSea
      const useBase = lockBase || (!(existing.city || '').trim() && fillBase)
      const city = atSea
        ? freeLabel
        : useBase
          ? base
          : (existing.city || '').trim()
      const atHomePort =
        type === 'cruise' &&
        !atSea &&
        !!base &&
        city.toLowerCase() === base.toLowerCase()
      /** Embark / hjemhavn-dager (ikke iland-dag): no ship arrival. */
      const noArrive = atHomePort && !isLast
      /** Iland-dag: no ship departure. */
      const noLeave = type === 'cruise' && isLast
      const dayCoords = atSea
        ? undefined
        : useBase
          ? baseCoords
          : geoCoordsOf(existing.latitude, existing.longitude)
      days.push({
        ...existing,
        offset,
        atSea,
        city,
        country: atSea
          ? ''
          : useBase
            ? baseCountry
            : (existing.country || '').trim(),
        latitude: dayCoords?.latitude,
        longitude: dayCoords?.longitude,
        arriveTime: atSea || noArrive
          ? ''
          : normalizeEditableClockTime((existing.arriveTime || '').trim()),
        leaveTime: atSea || noLeave
          ? ''
          : normalizeEditableClockTime((existing.leaveTime || '').trim()),
        allAboardTime:
          atSea || isLast
            ? ''
            : normalizeEditableClockTime((existing.allAboardTime || '').trim()),
        hideOnMap: atSea ? false : !!existing.hideOnMap,
      })
      continue
    }
    days.push({
      id: newPackageDayId(),
      offset,
      atSea: false,
      city: fillBase ? base : '',
      country: fillBase ? baseCountry : '',
      latitude: fillBase ? baseCoords?.latitude : undefined,
      longitude: fillBase ? baseCoords?.longitude : undefined,
      arriveTime: '',
      leaveTime: '',
      allAboardTime: '',
      hideOnMap: false,
    })
  }
  return {
    ...pack,
    nights,
    basePlace: baseRaw,
    baseCountry: baseCountryRaw,
    baseLatitude: baseCoords?.latitude,
    baseLongitude: baseCoords?.longitude,
    title: pack.title ?? '',
    detail: pack.detail ?? '',
    price: pack.price ?? '',
    paid: pack.paid,
    costs: [...(pack.costs || [])],
    days,
  }
}

/** @deprecated use syncPackageDays */
export function syncCruiseDays(cruise: JourneyCruise): JourneyCruise {
  const synced = syncPackageDays(
    {
      nights: cruise.nights,
      title: cruise.title || cruise.shipName || '',
      basePlace: cruise.basePlace || cruise.homePort || '',
      baseCountry: cruise.baseCountry || cruise.homeCountry || '',
      detail: cruise.detail || cruise.cabinNumber || '',
      price: cruise.price || '',
      paid: cruise.paid,
      costs: cruise.costs || [],
      days: cruise.days || [],
    },
    'cruise',
  )
  return {
    ...synced,
    shipName: synced.title,
    homePort: synced.basePlace,
    homeCountry: synced.baseCountry,
    cabinNumber: synced.detail,
  }
}

export function emptyPackage(
  type: JourneyPackageType,
  nights = 7,
): JourneyPackage {
  return syncPackageDays(
    {
      nights,
      title: '',
      basePlace: '',
      baseCountry: '',
      baseLatitude: undefined,
      baseLongitude: undefined,
      detail: '',
      price: '',
      costs: [],
      days: [],
    },
    type,
  )
}

/** @deprecated use emptyPackage('cruise') */
export function emptyCruise(nights = 7): JourneyCruise {
  return syncCruiseDays({
    nights,
    shipName: '',
    homePort: '',
    homeCountry: '',
    cabinNumber: '',
    price: '',
    days: [],
  })
}

export function stayNights(stop: JourneyStop): number {
  if (isPackageStop(stop)) return packageNightsOf(packageOf(stop))
  const n = stop.stay?.nights
  if (typeof n === 'number' && n >= 1) return Math.min(60, Math.floor(n))
  return 0
}

/** Checkout morning / package end date (arrive + nights), or arrive if no stay. */
export function stopDepartDate(stop: JourneyStop): string {
  const arrive = (stop.arriveDate || '').trim()
  if (!arrive) return ''
  if (isPackageStop(stop)) {
    return addDaysIso(arrive, packageNightsOf(packageOf(stop)))
  }
  const nights = stayNights(stop)
  return nights > 0 ? addDaysIso(arrive, nights) : arrive
}

/** Visit city that should have a hotel, but no name is set. */
export function cityMissingHotel(stop: JourneyStop): boolean {
  if (stop.kind === 'home' || isPackageStop(stop)) return false
  if (stopPurpose(stop) !== 'visit') return false
  if (effectiveHotelName(stop.stay)) return false
  if (isStayWithoutOvernight(stop.stay)) return false
  if (stop.stay && stayNights(stop) < 1) return false
  return true
}

export type LiveHotelAlert = {
  stopId: string
  city: string
  kind: 'arrive' | 'tomorrow' | 'enroute'
}

/** Cities we are approaching / arriving at on `date` without a hotel. */
export function liveMissingHotelAlerts(
  journey: Journey,
  date: string,
): LiveHotelAlert[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: LiveHotelAlert[] = []
  const seen = new Set<string>()
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    if (!cityMissingHotel(stop)) continue
    const arrive = (stop.arriveDate || '').trim()
    if (!arrive) continue
    const city = (stop.city || '').trim() || 'byen'
    let kind: LiveHotelAlert['kind'] | null = null
    if (arrive === date) kind = 'arrive'
    else if (addDaysIso(arrive, -1) === date) kind = 'tomorrow'
    else if (i > 0 && (stopDepartDate(stops[i - 1]) || '') === date) {
      kind = 'enroute'
    }
    if (!kind || seen.has(stop.id)) continue
    seen.add(stop.id)
    out.push({ stopId: stop.id, city, kind })
  }
  return out
}

export function liveHotelAlertText(alert: LiveHotelAlert): string {
  switch (alert.kind) {
    case 'arrive':
      return `Dere ankommer ${alert.city}, og det er ikke lagt inn hotell.`
    case 'tomorrow':
      return `I morgen ankommer vi ${alert.city} uten hotell.`
    default:
      return `Dere er på vei til ${alert.city} uten hotell.`
  }
}

/**
 * Calendar days from end of `from` (checkout morning) to start of `to`.
 * 0 = leave and arrive same day (or overlapping) — contiguous.
 * 1+ = at least one night/day without a planned stop (e.g. checkout 04, next arrive 05).
 */
export function freeDaysBetweenStops(
  from: JourneyStop,
  to: JourneyStop,
): number {
  const end = (stopDepartDate(from) || from.arriveDate || '').trim()
  const start = (to.arriveDate || '').trim()
  if (!end || !start) return 0
  const a = new Date(`${end}T12:00:00`)
  const b = new Date(`${start}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.max(
    0,
    Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)),
  )
}

/** True when checkout and next arrive leave at least one calendar day uncovered. */
export function hasPlanGapBetween(
  from: JourneyStop,
  to: JourneyStop,
): boolean {
  return freeDaysBetweenStops(from, to) >= 1
}

/**
 * Prefill for a place stop that fills the calendar gap before `to`
 * (e.g. stay in cruise home port until embarkation).
 */
export function gapFillPrefill(
  from: JourneyStop,
  to: JourneyStop,
): {
  arriveDate: string
  nights: number
  city: string
  country: string
  hint: string
} {
  const days = freeDaysBetweenStops(from, to)
  const arriveDate =
    stopDepartDate(from) || from.arriveDate || to.arriveDate || ''
  const nights = Math.max(1, days)
  const pack = isPackageStop(to) ? packageOf(to) : null
  const city = (pack?.basePlace || '').trim() || (to.city || '').trim()
  const country =
    (pack?.baseCountry || '').trim() || (to.country || '').trim()
  const typeLabel = isPackageType(to.kind)
    ? packageTypeLabel(to.kind).toLowerCase()
    : 'neste stopp'
  return {
    arriveDate,
    nights,
    city,
    country,
    hint: city
      ? `Siste dager i ${city} før ${typeLabel}`
      : `Fyll ${days} dager før neste stopp`,
  }
}

/**
 * «Reise videre herfra» on a stop: at the end of the thread, before home,
 * or when there is a real date gap between this stop and the next.
 * Contiguous city/package pairs hide the action.
 */
/** Overlay registered home city/address onto every home stop. */
export function journeyWithRegisteredHome(
  journey: Journey,
  home: { city: string; country: string; address: string },
): Journey {
  const city = home.city.trim()
  const country = home.country.trim()
  const address = home.address.trim()
  if (!city && !address) return journey
  let changed = false
  const stops = journey.stops.map((s) => {
    if (s.kind !== 'home') return s
    const next = {
      ...s,
      city: city || s.city,
      country: country || s.country,
      address,
    }
    if (
      next.city !== s.city ||
      next.country !== s.country ||
      (s.address || '') !== address
    ) {
      changed = true
    }
    return next
  })
  return changed ? { ...journey, stops } : journey
}

/** Full normalize for Plan tab: legs, localized names, registered home. */
export function normalizePlannerJourney(
  journey: Journey,
  homePlace: HomePlace,
): Journey {
  return journeyWithRegisteredHome(
    localizeJourneyPlaces(
      stripLegacyStayAnchorFromJourney(syncJourneyLegs(journey)),
    ),
    homePlace,
  )
}

export function showOnwardFromHere(
  stop: JourneyStop,
  nextStop?: JourneyStop | null,
): boolean {
  if (stop.kind === 'home') return false
  if (!nextStop) return true
  if (nextStop.kind === 'home') return true
  return hasPlanGapBetween(stop, nextStop)
}

const MONTHS_NO = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'des',
] as const

const WEEKDAYS_NO = [
  'søndag',
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
] as const

export function formatDateNO(iso: string): string {
  if (!iso || iso.length < 10) return iso || ''
  const stamp = iso.slice(0, 10)
  const [, month, day] = stamp.split('-')
  const monthName = MONTHS_NO[Number(month) - 1]
  const dayNum = Number(day)
  if (!monthName || !Number.isFinite(dayNum) || dayNum < 1) return iso
  const parsed = new Date(`${stamp}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  const weekday = WEEKDAYS_NO[parsed.getDay()]
  return `${weekday} ${String(dayNum).padStart(2, '0')}. ${monthName}`
}

/** Visit cities in `journey` that lack a hotel / overnatting name. */
export function journeyMissingHotelStays(
  journey: Journey,
): MissingHotelStayEntry[] {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const out: MissingHotelStayEntry[] = []
  for (const stop of stops) {
    if (!cityMissingHotel(stop)) continue
    const arrive = (stop.arriveDate || '').trim()
    const nights = stop.stay ? stayNights(stop) : 0
    const city = stopGoalLabel(stop, 'Uten by')
    const depart =
      arrive && nights > 0 ? addDaysIso(arrive, nights) : arrive
    const dateLabel =
      arrive && nights > 0
        ? `${formatDateNO(arrive)}–${formatDateNO(depart)} (${nights} ${
            nights === 1 ? 'natt' : 'netter'
          })`
        : arrive
          ? formatDateNO(arrive)
          : 'Dato ikke satt'
    out.push({
      stopId: stop.id,
      city,
      arriveDate: arrive,
      nights,
      dateLabel,
    })
  }
  return out
}

export function legForGap(
  journey: Journey,
  fromStopId: string,
  toStopId: string,
): JourneyLeg | undefined {
  return journey.legs.find(
    (l) => l.fromStopId === fromStopId && l.toStopId === toStopId,
  )
}

export function isTransportOptionFilled(
  o?: JourneyTransportOption | null,
): boolean {
  if (!o) return false
  if (modeIsWalk(o.mode)) return true
  return !!(
    o.mode?.trim() ||
    o.title?.trim() ||
    o.company?.trim() ||
    o.startTime?.trim() ||
    (o.minutes || '').trim() ||
    o.info?.trim() ||
    (o.departures || []).length > 0
  )
}

function normalizePlaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
}

/** «Lille Øvregaten» matches «Lille Øvregaten 10» and the same street with extra city text. */
export function samePlaceName(a: string, b: string): boolean {
  const na = normalizePlaceName(a)
  const nb = normalizePlaceName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  if (shorter.length < 5) return false
  return longer.startsWith(`${shorter} `)
}

export type StopGoalRef = Pick<JourneyStop, 'city' | 'address' | 'kind' | 'station'>

export function stopGoalNames(to?: StopGoalRef | null): string[] {
  if (!to) return []
  const names = [to.city, to.address, to.station]
    .map((s) => (s || '').trim())
    .filter(Boolean)
  return [...new Set(names)]
}

export function viaReachesGoal(
  via: Pick<JourneyVia, 'title'>,
  to?: StopGoalRef | null,
): boolean {
  const title = via.title.trim()
  if (!title) return false
  return stopGoalNames(to).some((g) => samePlaceName(title, g))
}

function lastViaIsWalk(segs: JourneyVia[]): boolean {
  const last = segs[segs.length - 1]
  if (!last) return false
  return viaTransportOptions(last).some((o) => modeIsWalk(o.mode))
}

function goalDisplayName(to?: StopGoalRef | null): string {
  return stopGoalLabel(to, 'mål')
}

/** One via place has at least one usable departure/mode. */
export function isViaHopFilled(via?: JourneyVia | null): boolean {
  if (!via) return false
  return viaTransportOptions(via).some(isTransportOptionFilled)
}

export type TransportGapKind =
  | 'empty'
  | 'missing_place'
  | 'missing_ride'
  | 'missing_goal'

export interface TransportGap {
  kind: TransportGapKind
  /** 0-based via index when relevant. */
  index?: number
  label?: string
}

/**
 * Check that the via-path is registered from start through to the destination.
 * Place names (and optionally transport modes) must cover the route to the goal.
 */
export function legTransportGaps(
  leg: JourneyLeg | null | undefined,
  to?: StopGoalRef | null,
  options?: { requireTransportMode?: boolean },
): TransportGap[] {
  const requireMode = options?.requireTransportMode !== false
  const segs = transportSegments(leg)
  if (!segs.length) return [{ kind: 'empty' }]

  const gaps: TransportGap[] = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    const label = s.title.trim() || `Sted ${i + 1}`
    if (!s.title.trim()) {
      gaps.push({ kind: 'missing_place', index: i, label })
    }
    if (requireMode && !isViaHopFilled(s)) {
      gaps.push({ kind: 'missing_ride', index: i, label })
    }
  }

  const goalNames = stopGoalNames(to)
  if (goalNames.length) {
    const reachesGoal =
      segs.some((s) => viaReachesGoal(s, to)) || lastViaIsWalk(segs)
    if (!reachesGoal) {
      gaps.push({
        kind: 'missing_goal',
        label: goalDisplayName(to),
      })
    }
  }

  return gaps
}

export function isLegFilled(
  leg?: JourneyLeg | null,
  to?: StopGoalRef | null,
  options?: { requireTransportMode?: boolean },
): boolean {
  if (!leg) return false
  if (to) return legTransportGaps(leg, to, options).length === 0
  const segs = transportSegments(leg)
  if (!segs.length) return false
  if (options?.requireTransportMode === false) {
    return segs.some((v) => !!v.title.trim())
  }
  return segs.some((v) => isViaHopFilled(v))
}

export function summarizeTransportGaps(gaps: TransportGap[]): string {
  if (!gaps.length) return ''
  if (gaps.some((g) => g.kind === 'empty')) {
    return 'Mangler transport fra start til mål'
  }
  const parts: string[] = []
  const places = gaps.filter((g) => g.kind === 'missing_place')
  const rides = gaps.filter((g) => g.kind === 'missing_ride')
  const goal = gaps.find((g) => g.kind === 'missing_goal')
  if (places.length) {
    parts.push(
      places.length === 1
        ? 'sted uten navn'
        : `${places.length} steder uten navn`,
    )
  }
  if (rides.length) {
    parts.push(
      rides.length === 1
        ? `mangler reise til ${rides[0].label}`
        : `mangler reise på ${rides.length} hopp`,
    )
  }
  if (goal) parts.push(`stien når ikke ${goal.label}`)
  return parts.join(' · ')
}

export type StopWarning = 'place' | 'date' | 'stay' | 'travel' | 'schedule'

export function warningsForStop(
  journey: Journey,
  stopIndex: number,
  settings: PlannerSettings,
): StopWarning[] {
  const stop = journey.stops[stopIndex]
  if (!stop) return []
  const warnings: StopWarning[] = []
  // Multi-day packages = title + nights + day list; no hotel or city-transport on the block.
  if (isPackageStop(stop)) {
    if (scheduleWarnings(journey, stopIndex).length) {
      warnings.push('schedule')
    }
    return warnings
  }
  if (stop.kind !== 'home' && !(stop.city || '').trim()) {
    warnings.push('place')
  }
  if (!(stop.arriveDate || '').trim()) {
    warnings.push('date')
  }
  if (
    settings.warnMissingStay &&
    stop.kind !== 'home' &&
    stayNights(stop) < 1
  ) {
    warnings.push('stay')
  }
  if (settings.warnMissingTravel && stopIndex > 0) {
    const prev = journey.stops[stopIndex - 1]
    // Inbound travel to packages is edited from the previous place, not here.
    const leg = legForGap(journey, prev.id, stop.id)
    if (
      !isLegFilled(leg, stop, {
        requireTransportMode: settings.requireTransportMode,
      })
    ) {
      warnings.push('travel')
    }
  }
  if (scheduleWarnings(journey, stopIndex).length) {
    warnings.push('schedule')
  }
  return warnings
}

export function stopShiftLabel(stop: JourneyStop): string {
  if (stop.kind === 'home') return 'hjem'
  if (isPackageStop(stop)) {
    return packageOf(stop)?.title?.trim() || stop.city?.trim() || 'pakke'
  }
  return stop.city?.trim() || 'by'
}

/** Date clashes and thread-order issues — warnings only, never blocks. */
export function scheduleWarnings(
  journey: Journey,
  stopIndex: number,
): string[] {
  const stop = journey.stops[stopIndex]
  if (!stop || stop.kind === 'home') return []
  const arrive = (stop.arriveDate || '').trim()
  if (!arrive) return []
  const depart = (stopDepartDate(stop) || arrive).trim()
  const msgs: string[] = []
  const seen = new Set<string>()

  function add(msg: string) {
    if (!msg || seen.has(msg)) return
    seen.add(msg)
    msgs.push(msg)
  }

  const prev = journey.stops[stopIndex - 1]
  if (prev && (prev.arriveDate || '').trim() && arrive < prev.arriveDate.trim()) {
    add(`Ankomst er før ${stopShiftLabel(prev)} i listen`)
  }
  const next = journey.stops[stopIndex + 1]
  if (next && (next.arriveDate || '').trim() && arrive > next.arriveDate.trim()) {
    add(`Ankomst er etter ${stopShiftLabel(next)} i listen`)
  }

  for (let i = 0; i < journey.stops.length; i++) {
    if (i === stopIndex) continue
    const other = journey.stops[i]
    if (!other || other.kind === 'home') continue
    const otherArrive = (other.arriveDate || '').trim()
    if (!otherArrive) continue
    const otherDepart = (stopDepartDate(other) || otherArrive).trim()
    const name = stopShiftLabel(other)
    if (arrive === otherArrive) {
      add(`Samme ankomstdag som ${name}`)
    } else if (arrive < otherDepart && otherArrive < depart) {
      add(`Overlapper oppholdet i ${name}`)
    }
  }
  return msgs
}

export function shiftStopsAfter(
  journey: Journey,
  fromStopId: string,
  days: number,
): Journey {
  if (!days) return journey
  const idx = journey.stops.findIndex((s) => s.id === fromStopId)
  if (idx < 0) return journey
  const stops = journey.stops.map((s, i) => {
    if (i <= idx) return s
    const date = (s.arriveDate || '').trim()
    if (!date) return s
    return { ...s, arriveDate: addDaysIso(date, days) }
  })
  return syncJourneyLegs({ ...journey, stops })
}

export function confirmShiftAfterNights(
  city: string,
  delta: number,
  later: JourneyStop[],
): boolean {
  if (!delta || !later.length) return false
  const names = later.map(stopShiftLabel).filter(Boolean)
  if (!names.length) return false
  const abs = Math.abs(delta)
  const nightWord = abs === 1 ? 'natt' : 'netter'
  const dayWord = abs === 1 ? 'dag' : 'dager'
  const longer = delta > 0
  const who =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`
  return window.confirm(
    `Oppholdet i ${city} er ${abs} ${nightWord} ${longer ? 'lenger' : 'kortere'}.\n\nForskyve ${who} ${abs} ${dayWord} ${longer ? 'senere' : 'tidligere'}?`,
  )
}

export function stopWarningLabel(w: StopWarning): string {
  switch (w) {
    case 'place':
      return 'Mangler by'
    case 'date':
      return 'Mangler dato'
    case 'stay':
      return 'Mangler hotell'
    case 'travel':
      return 'Mangler reise'
    case 'schedule':
      return 'Dato eller rekkefølge'
  }
}

function keepActivityPurpose(
  saved: JourneyActivity[] | undefined,
  local: JourneyActivity[] | undefined,
): JourneyActivity[] | undefined {
  if (!saved?.length) return saved
  const byId = new Map((local || []).map((s) => [s.id, s.purpose] as const))
  return saved.map((s) => ({
    ...s,
    purpose: s.purpose || byId.get(s.id),
  }))
}

/** Keep visit/transfer if a save response omitted the field. */
export function keepPlacePurpose(local: Journey, saved: Journey): Journey {
  const stopById = new Map(local.stops.map((s) => [s.id, s] as const))
  const viaById = new Map<string, JourneyVia>()
  for (const leg of local.legs || []) {
    for (const via of leg.vias || []) {
      viaById.set(via.id, via)
    }
  }
  return {
    ...saved,
    stops: (saved.stops || []).map((s) => {
      const prev = stopById.get(s.id)
      return {
        ...s,
        purpose: s.purpose || prev?.purpose,
        hideOnMap: s.hideOnMap ?? prev?.hideOnMap,
        sights: keepActivityPurpose(s.sights, prev?.sights),
        pack:
          s.pack && prev?.pack
            ? {
                ...s.pack,
                days: (s.pack.days || []).map((d) => {
                  const prevDay = (prev.pack?.days || []).find(
                    (pd) => pd.id === d.id,
                  )
                  return {
                    ...d,
                    hideOnMap: d.hideOnMap ?? prevDay?.hideOnMap,
                    arriveTime: d.arriveTime ?? prevDay?.arriveTime,
                    leaveTime: d.leaveTime ?? prevDay?.leaveTime,
                    allAboardTime: d.allAboardTime ?? prevDay?.allAboardTime,
                  }
                }),
              }
            : s.pack,
      }
    }),
    legs: (saved.legs || []).map((l) => ({
      ...l,
      vias: (l.vias || []).map((v) => {
        const prev = viaById.get(v.id)
        const prevTaken = new Map(
          (prev ? viaTransportOptions(prev) : []).map((o) => [o.id, o.taken]),
        )
        const prevTicket = new Map(
          (prev ? viaTransportOptions(prev) : []).map((o) => [o.id, o.ticket]),
        )
        const prevChanges = new Map(
          (prev ? viaTransportOptions(prev) : []).map((o) => [o.id, o.changes]),
        )
        return {
          ...v,
          purpose: v.purpose || prev?.purpose,
          hideOnMap: v.hideOnMap ?? prev?.hideOnMap,
          connection: v.connection || prev?.connection,
          station: v.station || prev?.station,
          changePlace: v.changePlace || prev?.changePlace,
          changePlatform: v.changePlatform || prev?.changePlatform,
          changeMinutes: v.changeMinutes || prev?.changeMinutes,
          options: viaTransportOptions(v).map((o) => ({
            ...o,
            taken: o.taken ?? prevTaken.get(o.id),
            ticket: o.ticket ?? prevTicket.get(o.id),
            changes: o.changes?.length ? o.changes : prevChanges.get(o.id),
          })),
          sights: keepActivityPurpose(v.sights, prev?.sights),
        }
      }),
    })),
  }
}

export function syncJourneyLegs(journey: Journey): Journey {
  const byPair = new Map<string, JourneyLeg>()
  for (const l of journey.legs) {
    byPair.set(`${l.fromStopId}->${l.toStopId}`, l)
  }
  const stops = journey.stops.map((s, i) => {
    const base = { ...s, sortOrder: i }
    if (!isPackageStop(base)) return base
    const type = isPackageType(base.kind) ? base.kind : 'other'
    return {
      ...base,
      stay: null,
      pack: syncPackageDays(
        packageOf(base) || emptyPackage(type),
        type,
      ),
      cruise: null,
    }
  })
  const legs: JourneyLeg[] = []
  for (let i = 0; i + 1 < stops.length; i++) {
    const key = `${stops[i].id}->${stops[i + 1].id}`
    const existing = byPair.get(key)
    legs.push(
      existing
        ? {
            ...existing,
            fromStopId: stops[i].id,
            toStopId: stops[i + 1].id,
            vias: (existing.vias || []).map((v, vi) => ({
              ...v,
              sortOrder: vi,
            })),
          }
        : {
            id: newLegId(),
            fromStopId: stops[i].id,
            toStopId: stops[i + 1].id,
            mode: '',
            vias: [],
          },
    )
  }
  return { ...journey, stops, legs }
}

export function moveStop(
  journey: Journey,
  stopId: string,
  direction: -1 | 1,
): Journey {
  const idx = journey.stops.findIndex((s) => s.id === stopId)
  const swap = idx + direction
  if (idx < 0 || swap < 0 || swap >= journey.stops.length) return journey
  const stops = [...journey.stops]
  ;[stops[idx], stops[swap]] = [stops[swap], stops[idx]]
  return syncJourneyLegs({ ...journey, stops })
}

export function insertStopBefore(
  journey: Journey,
  stop: JourneyStop,
  beforeStopId: string,
): Journey {
  const idx = journey.stops.findIndex((s) => s.id === beforeStopId)
  if (idx < 0) {
    return upsertStop(journey, stop, null)
  }
  const stops = [...journey.stops]
  stops.splice(idx, 0, { ...stop, sortOrder: idx })
  return syncJourneyLegs({ ...journey, stops })
}

export function upsertStop(
  journey: Journey,
  stop: JourneyStop,
  inboundLeg?: Partial<JourneyLeg> | null,
): Journey {
  const normalized: JourneyStop = isPackageStop(stop)
    ? {
        ...stop,
        stay: null,
        pack: syncPackageDays(
          packageOf(stop) ||
            emptyPackage(isPackageType(stop.kind) ? stop.kind : 'other'),
          isPackageType(stop.kind) ? stop.kind : 'other',
        ),
        cruise: null,
      }
    : stop
  const existingIdx = journey.stops.findIndex((s) => s.id === normalized.id)
  let stops: JourneyStop[]
  if (existingIdx >= 0) {
    stops = journey.stops.map((s) =>
      s.id === normalized.id ? normalized : s,
    )
  } else {
    stops = [
      ...journey.stops,
      { ...normalized, sortOrder: journey.stops.length },
    ]
  }
  let next = syncJourneyLegs({ ...journey, stops })
  // Packages have no hotel and no inbound city-transport in their wizard.
  if (isPackageStop(normalized)) {
    return next
  }
  if (inboundLeg && existingIdx < 0 && next.stops.length >= 2) {
    const to = next.stops[next.stops.length - 1]
    const from = next.stops[next.stops.length - 2]
    next = {
      ...next,
      legs: next.legs.map((leg) =>
        leg.fromStopId === from.id && leg.toStopId === to.id
          ? {
              ...leg,
              ...inboundLeg,
              id: leg.id,
              fromStopId: from.id,
              toStopId: to.id,
            }
          : leg,
      ),
    }
  } else if (inboundLeg && existingIdx > 0) {
    const to = next.stops[existingIdx]
    const from = next.stops[existingIdx - 1]
    next = {
      ...next,
      legs: next.legs.map((leg) =>
        leg.fromStopId === from.id && leg.toStopId === to.id
          ? {
              ...leg,
              ...inboundLeg,
              id: leg.id,
              fromStopId: from.id,
              toStopId: to.id,
            }
          : leg,
      ),
    }
  }
  return next
}

export function removeStop(journey: Journey, stopId: string): Journey {
  return syncJourneyLegs({
    ...journey,
    stops: journey.stops.filter((s) => s.id !== stopId),
  })
}

/** Suggested arrive date for the next stop (end of previous block). */
export function suggestNextArriveDate(
  journey: Journey,
  tripStartDate = '',
  fromStopId?: string,
): string {
  const fallback =
    tripStartDate.trim() || new Date().toISOString().slice(0, 10)
  if (!journey.stops.length) {
    return fallback
  }

  const from =
    (fromStopId
      ? journey.stops.find((s) => s.id === fromStopId)
      : undefined) || journey.stops[journey.stops.length - 1]
  if (!from.arriveDate?.trim()) return fallback

  const nights = stayNights(from)
  if (isPackageStop(from) || nights >= 1) {
    return stopDepartDate(from) || addDaysIso(from.arriveDate, nights)
  }
  // Home start: often leave the same day. Other stops without stay: next calendar day.
  if (from.kind === 'home') return from.arriveDate
  return addDaysIso(from.arriveDate, 1)
}
