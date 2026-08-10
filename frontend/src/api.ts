const API_BASE = (() => {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  // Vite production builds for Cloud Run bake this via frontend/.env.production
  if (import.meta.env.PROD) {
    return 'https://reise-backend-624978663833.europe-north1.run.app/api'
  }
  return 'http://localhost:8082/api'
})()

export type DayItemType =
  | 'hotel'
  | 'cruise'
  | 'flight'
  | 'train'
  | 'bus'
  | 'taxi'
  | 'attraction';

export interface DayItem {
  id: string;
  type: DayItemType;
  title: string;
  url?: string;
  address?: string;
  /** Cruise: home port (embark). */
  from?: string;
  /** Cruise: home port (disembark; same as from). */
  to?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  /** Hotel/cruise: number of nights (default 1). */
  nights?: number;
  sortOrder: number;
}

export type LegMode =
  | 'walk'
  | 'taxi'
  | 'bus'
  | 'tram'
  | 'train'
  | 'flight'
  | 'other';

export interface ViaPoint {
  id: string;
  title: string;
  address?: string;
  url?: string;
  arriveTime?: string;
  leaveTime?: string;
  notes?: string;
  sortOrder: number;
}

export interface RouteLeg {
  id: string;
  fromViaPointId: string;
  toViaPointId: string;
  mode: LegMode;
  title?: string;
  /** Chosen / planned departure — drives via sync and map order. */
  startTime?: string;
  /** Chosen / planned arrival — drives via sync and map order. */
  endTime?: string;
  /**
   * Timetable for bus/tram/train: first = preferred bet, rest = fallbacks.
   * Fallbacks never auto-change route sync; UI may suggest the next after preferred has passed.
   * Not used for flight/cruise.
   */
  departures?: string[];
  url?: string;
  notes?: string;
  sortOrder: number;
}

export interface Link {
  title: string;
  url: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  colorByCountry?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripDay {
  id: string;
  tripId: string;
  date: string;
  sortOrder: number;
  country: string;
  city: string;
  /** Cruise day spent entirely at sea (no port call). */
  atSea?: boolean;
  hotelName: string;
  hotelUrl: string;
  address: string;
  checkIn: string;
  checkOut: string;
  transportNext: string;
  notes: string;
  links: Link[];
  items: DayItem[];
  viaPoints: ViaPoint[];
  legs: RouteLeg[];
  createdAt?: string;
  updatedAt?: string;
}

/** One row in a cruise itinerary (port day or at sea). */
export interface CruiseDayPatch {
  date: string;
  city: string;
  country: string;
  atSea: boolean;
}

export const AT_SEA_LABEL = 'Til sjøs';

/** True when day is marked at sea (flag or stored place label). */
export function isAtSeaDay(
  day: Pick<TripDay, 'city' | 'atSea'>,
): boolean {
  if (day.atSea) return true;
  const city = day.city.trim().toLowerCase();
  return city === AT_SEA_LABEL.toLowerCase() || city === 'til havs';
}

export type TripInput = Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>;
export type TripDayInput = Omit<TripDay, 'id' | 'createdAt' | 'updatedAt'>;

export const ITEM_TYPES: { type: DayItemType; label: string }[] = [
  { type: 'hotel', label: 'Hotell' },
  { type: 'cruise', label: 'Cruise' },
  { type: 'flight', label: 'Fly' },
  { type: 'train', label: 'Tog' },
  { type: 'bus', label: 'Buss' },
  { type: 'taxi', label: 'Taxi' },
  { type: 'attraction', label: 'Severdighet' },
];

export function itemTypeLabel(type: string): string {
  return ITEM_TYPES.find((t) => t.type === type)?.label || type;
}

export function newDayItem(type: DayItemType, sortOrder = 0): DayItem {
  return {
    id: crypto.randomUUID(),
    type,
    title: '',
    url: '',
    address: '',
    from: '',
    to: '',
    startTime: '',
    endTime: '',
    notes: '',
    nights: type === 'hotel' || type === 'cruise' ? 1 : undefined,
    sortOrder,
  };
}

export function hotelNights(item: DayItem): number {
  const n = item.nights;
  if (typeof n === 'number' && Number.isFinite(n) && n >= 1) {
    return Math.min(60, Math.floor(n));
  }
  return 1;
}

export function cruiseNights(item: DayItem): number {
  return hotelNights(item);
}

export function cruiseHomePort(item: DayItem): string {
  return (item.from || item.to || '').trim();
}

export function dayPlaceLabel(day: Pick<TripDay, 'city' | 'country' | 'atSea'>): string {
  if (isAtSeaDay(day)) return AT_SEA_LABEL;
  return day.city.trim() || 'Uten by';
}

/** City/country values to persist for an at-sea day (visible in liste/tidslinje). */
export function atSeaPlaceFields(): Pick<TripDay, 'city' | 'country' | 'atSea'> {
  return { city: AT_SEA_LABEL, country: '', atSea: true };
}

export function isTransportType(type: DayItemType): boolean {
  return type === 'flight' || type === 'train' || type === 'bus' || type === 'taxi';
}

export const LEG_MODES: { mode: LegMode; label: string }[] = [
  { mode: 'walk', label: 'Gå' },
  { mode: 'taxi', label: 'Taxi' },
  { mode: 'bus', label: 'Buss' },
  { mode: 'tram', label: 'Bane/trikk' },
  { mode: 'train', label: 'Tog' },
  { mode: 'flight', label: 'Fly' },
  { mode: 'other', label: 'Annet' },
];

export function legModeLabel(mode: string): string {
  return LEG_MODES.find((m) => m.mode === mode)?.label || mode;
}

export function newViaPoint(sortOrder = 0): ViaPoint {
  return {
    id: crypto.randomUUID(),
    title: '',
    address: '',
    url: '',
    arriveTime: '',
    leaveTime: '',
    notes: '',
    sortOrder,
  };
}

export function newRouteLeg(
  fromViaPointId: string,
  toViaPointId: string,
  sortOrder = 0,
): RouteLeg {
  return {
    id: crypto.randomUUID(),
    fromViaPointId,
    toViaPointId,
    mode: 'walk',
    title: '',
    startTime: '',
    endTime: '',
    departures: [],
    url: '',
    notes: '',
    sortOrder,
  };
}

/** Minutes from midnight for HH:mm / HH:mm:ss; empty/invalid sorts last. */
export function arriveTimeSortKey(time?: string): number {
  const t = (time || '').trim();
  if (!t) return Number.POSITIVE_INFINITY;
  // Accept dirty fields like "07:40 07:45" — use the first clock time.
  const m = t.match(/(\d{1,2})[:.](\d{2})(?::(\d{2}))?/);
  if (!m) return Number.POSITIVE_INFINITY;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3] || 0);
  if (h > 23 || min > 59 || sec > 59) return Number.POSITIVE_INFINITY;
  return h * 3600 + min * 60 + sec;
}

/** Parse compact timetable text like "14:05 14.50, 16:10" into HH:mm list. */
export function parseDepartureTimes(raw: string): string[] {
  const parts = raw.split(/[\s,;|]+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const m = part.match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m) continue;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    const norm = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out.sort((a, b) => arriveTimeSortKey(a) - arriveTimeSortKey(b));
}

/** Merge and normalize departure alternatives (display order only). */
export function normalizeDepartures(times: string[] | undefined): string[] {
  return parseDepartureTimes((times || []).join(' '));
}

export function formatDeparturesLabel(times: string[] | undefined): string {
  const list = normalizeDepartures(times);
  return list.length ? list.join(' · ') : '';
}

/** Tog / bane / buss — not fly or cruise. */
export function modeHasDepartureSchedule(mode: string): boolean {
  return mode === 'train' || mode === 'tram' || mode === 'bus';
}

function clockMinutes(time?: string): number {
  const key = arriveTimeSortKey(time);
  if (key === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return Math.floor(key / 60);
}

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * After the preferred (first) departure has passed on that calendar day,
 * return the next still-usable time from the list. Suggestion only.
 */
export function nextScheduledDeparture(
  dayDate: string,
  departures: string[] | undefined,
  now = new Date(),
): { preferred: string; suggested: string } | null {
  const list = normalizeDepartures(departures);
  if (list.length < 2) return null;
  const day = dayDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const today = localIsoDate(now);
  if (day !== today) return null;

  const preferred = list[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin <= clockMinutes(preferred)) return null;

  const suggested = list.find((t) => clockMinutes(t) >= nowMin);
  if (!suggested || suggested === preferred) return null;
  return { preferred, suggested };
}

/** Prefer arrive time, else leave time — so first stop can sort by avreise. */
export function viaPointTimeSortKey(point: ViaPoint): number {
  const arrive = arriveTimeSortKey(point.arriveTime);
  if (arrive !== Number.POSITIVE_INFINITY) return arrive;
  return arriveTimeSortKey(point.leaveTime);
}

/** Times shown on a via stop: inbound ankomst, outbound avgang. */
export function formatViaStopTimes(
  point: ViaPoint,
  inbound?: RouteLeg,
  outbound?: RouteLeg,
): string {
  // Prefer transport legs; first stop = only avreise, last stop = only ankomst.
  const arrive = inbound
    ? (inbound.endTime || point.arriveTime || '').trim()
    : '';
  const leave = outbound
    ? (outbound.startTime || point.leaveTime || '').trim()
    : '';
  if (arrive && leave && arrive !== leave) return `${arrive} → ${leave}`;
  return leave || arrive;
}

/**
 * Order via-points by stop time when both have times.
 * Untimed stops (e.g. «Hjem») keep their relative place — not pushed to the end.
 */
export function sortViaPointsByArriveTime(viaPoints: ViaPoint[]): ViaPoint[] {
  return [...viaPoints]
    .map((p, i) => ({ p, i, key: viaPointTimeSortKey(p) }))
    .sort((a, b) => {
      const aTimed = a.key !== Number.POSITIVE_INFINITY;
      const bTimed = b.key !== Number.POSITIVE_INFINITY;
      if (aTimed && bTimed && a.key !== b.key) return a.key - b.key;
      return a.i - b.i;
    })
    .map(({ p }, i) => ({ ...p, sortOrder: i }));
}

/** Keep one leg between each consecutive via-point. */
export function syncRouteLegs(viaPoints: ViaPoint[], legs: RouteLeg[]): RouteLeg[] {
  const byPair = new Map<string, RouteLeg>();
  for (const leg of legs) {
    byPair.set(`${leg.fromViaPointId}->${leg.toViaPointId}`, leg);
  }
  const synced: RouteLeg[] = [];
  for (let i = 0; i + 1 < viaPoints.length; i++) {
    const fromId = viaPoints[i].id;
    const toId = viaPoints[i + 1].id;
    const existing = byPair.get(`${fromId}->${toId}`);
    synced.push(
      existing
        ? { ...existing, fromViaPointId: fromId, toViaPointId: toId, sortOrder: i }
        : newRouteLeg(fromId, toId, i),
    );
  }
  return synced;
}

export function summarizeDayItems(items: DayItem[] | undefined): string {
  if (!items?.length) return '';
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = itemTypeLabel(item.type);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, n]) => (n > 1 ? `${n} ${label.toLowerCase()}` : label))
    .join(' · ');
}

export function summarizeViaRoute(viaPoints: ViaPoint[] | undefined): string {
  if (!viaPoints?.length) return '';
  const names = viaPoints.map((p) => p.title.trim()).filter(Boolean);
  if (!names.length) return `${viaPoints.length} via-punkt`;
  if (names.length <= 3) return names.join(' → ');
  return `${names[0]} → … → ${names[names.length - 1]} (${names.length} stopp)`;
}

/** Detailed route with transport between stops, e.g. A → Tog → B → Gå → C */
export function formatViaRouteDetailed(
  viaPoints: ViaPoint[] | undefined,
  legs: RouteLeg[] | undefined,
): string {
  if (!viaPoints?.length) return '';
  const parts: string[] = [];
  for (let i = 0; i < viaPoints.length; i++) {
    parts.push(viaPoints[i].title.trim() || `Via ${i + 1}`);
    const leg = legs?.[i];
    if (leg && i + 1 < viaPoints.length) {
      const mode = legModeLabel(leg.mode);
      parts.push(leg.title?.trim() ? `${mode} (${leg.title.trim()})` : mode);
    }
  }
  return parts.join(' → ');
}

export interface PlaceSuggestion {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  population?: number;
  featureCode?: string;
}

export class ApiError extends Error {
  suggestions: PlaceSuggestion[];

  constructor(message: string, suggestions: PlaceSuggestion[] = []) {
    super(message);
    this.name = 'ApiError';
    this.suggestions = suggestions;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    let suggestions: PlaceSuggestion[] = [];
    try {
      const err = (await response.json()) as {
        error?: string;
        suggestions?: PlaceSuggestion[];
      };
      if (err.error) message = err.error;
      if (Array.isArray(err.suggestions)) suggestions = err.suggestions;
    } catch {
      // ignore
    }
    throw new ApiError(message, suggestions);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  weatherCode: number;
  summary: string;
  icon: string;
  isToday: boolean;
}

export interface WeatherCurrent {
  temperature: number;
  weatherCode: number;
  summary: string;
  icon: string;
}

export interface WeatherReport {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  today?: WeatherDay;
  current?: WeatherCurrent;
  forecast: WeatherDay[];
  days: WeatherDay[];
  requestedDate?: string;
  requested?: WeatherDay;
  requestedInRange: boolean;
  source: string;
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  /**
   * Weather for a city. Always includes today.
   * Pass week=true only when the trip day is within the next 7 days.
   */
  getWeather: (city: string, country = '', opts?: { week?: boolean; date?: string }) => {
    const qs = new URLSearchParams({ city });
    if (country.trim()) qs.set('country', country.trim());
    if (opts?.week) qs.set('week', '1');
    if (opts?.date?.trim()) qs.set('date', opts.date.trim());
    return request<WeatherReport>(`/weather?${qs.toString()}`);
  },

  /** Place suggestions for city spelling / map geocoding (Open-Meteo). */
  searchPlaces: (q: string, country = '') => {
    const qs = new URLSearchParams({ q: q.trim() });
    if (country.trim()) qs.set('country', country.trim());
    return request<{ places: PlaceSuggestion[] }>(`/places?${qs.toString()}`);
  },

  listTrips: () => request<Trip[]>('/trips'),
  getTrip: (id: string) => request<Trip>(`/trips/${id}`),
  createTrip: (trip: TripInput) =>
    request<Trip>('/trips', { method: 'POST', body: JSON.stringify(trip) }),
  updateTrip: (id: string, trip: TripInput) =>
    request<Trip>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(trip) }),
  deleteTrip: (id: string) =>
    request<{ message: string }>(`/trips/${id}`, { method: 'DELETE' }),
  /** Direct download URL for .ics (Gmail, Outlook, Apple Kalender, …). */
  tripCalendarUrl: (id: string) => `${API_BASE}/trips/${encodeURIComponent(id)}/calendar.ics`,

  listDays: (tripId: string) =>
    request<TripDay[]>(`/days?tripId=${encodeURIComponent(tripId)}`),
  getDay: (id: string) => request<TripDay>(`/days/${id}`),
  createDay: (day: TripDayInput) =>
    request<TripDay>('/days', { method: 'POST', body: JSON.stringify(day) }),
  updateDay: (id: string, day: TripDayInput) =>
    request<TripDay>(`/days/${id}`, { method: 'PUT', body: JSON.stringify(day) }),
  deleteDay: (id: string) =>
    request<{ message: string }>(`/days/${id}`, { method: 'DELETE' }),
  reorderDays: (items: { id: string; sortOrder: number }[]) =>
    request<{ message: string }>('/days/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
};

export function emptyDay(tripId: string, date = '', sortOrder = 0): TripDayInput {
  return {
    tripId,
    date,
    sortOrder,
    country: '',
    city: '',
    atSea: false,
    hotelName: '',
    hotelUrl: '',
    address: '',
    checkIn: '',
    checkOut: '',
    transportNext: '',
    notes: '',
    links: [],
    items: [],
    viaPoints: [],
    legs: [],
  };
}

export function tripStats(days: TripDay[]) {
  const countries = new Set(
    days
      .filter((d) => !isAtSeaDay(d))
      .map((d) => d.country.trim())
      .filter(Boolean),
  );
  const cities = new Set(
    days
      .filter((d) => !isAtSeaDay(d))
      .map((d) => `${d.country.trim()}|${d.city.trim()}`)
      .filter((k) => !k.endsWith('|') && k !== '|'),
  );
  return {
    dayCount: days.length,
    countryCount: countries.size,
    cityCount: cities.size,
  };
}

export interface CityGroup {
  key: string;
  country: string;
  city: string;
  days: TripDay[];
  hotels: DayItem[];
  items: DayItem[];
}

/** Shift an ISO date (yyyy-mm-dd) by whole days. */
export function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface HotelStayRef {
  checkInDay: TripDay;
  hotel: DayItem;
  checkInDate: string;
  checkoutDate: string;
}

function hotelStayWindow(
  checkInDate: string,
  hotel: DayItem,
): { checkInDate: string; checkoutDate: string; nights: number } {
  const nights = hotelNights(hotel);
  return {
    checkInDate,
    checkoutDate: addDaysIso(checkInDate, nights),
    nights,
  };
}

/**
 * Hotels with an overnight on `date` (check-in ≤ date < checkout).
 * Check-in 02.09 + 2 nights → staying 02.09 and 03.09.
 */
export function hotelsStayingOnDay(
  days: TripDay[],
  date: string,
): HotelStayRef[] {
  if (!date) return [];
  const out: HotelStayRef[] = [];

  for (const day of days) {
    for (const item of day.items || []) {
      if (item.type !== 'hotel') continue;
      const { checkInDate, checkoutDate } = hotelStayWindow(day.date, item);
      if (date >= checkInDate && date < checkoutDate) {
        out.push({
          checkInDay: day,
          hotel: item,
          checkInDate,
          checkoutDate,
        });
      }
    }
  }
  return out;
}

/**
 * Hotels checking out on `date`: check-in day + nights = checkout morning.
 * 1 night on 02.09 → checkout 03.09; 2 nights on 02.09 → checkout 04.09.
 */
export function hotelsCheckingOutOnDay(
  days: TripDay[],
  date: string,
): HotelStayRef[] {
  if (!date) return [];
  const out: HotelStayRef[] = [];

  for (const day of days) {
    for (const item of day.items || []) {
      if (item.type !== 'hotel') continue;
      const { checkInDate, checkoutDate } = hotelStayWindow(day.date, item);
      if (checkoutDate === date) {
        out.push({
          checkInDay: day,
          hotel: item,
          checkInDate,
          checkoutDate,
        });
      }
    }
    // Legacy hotel fields = 1 night on that day.
    if (
      day.hotelName?.trim() &&
      !(day.items || []).some((i) => i.type === 'hotel') &&
      addDaysIso(day.date, 1) === date
    ) {
      const hotel: DayItem = {
        id: `legacy-checkout-${day.id}`,
        type: 'hotel',
        title: day.hotelName,
        url: day.hotelUrl,
        address: day.address,
        startTime: day.checkIn,
        endTime: day.checkOut,
        nights: 1,
        sortOrder: 0,
      };
      out.push({
        checkInDay: day,
        hotel,
        checkInDate: day.date,
        checkoutDate: date,
      });
    }
  }
  return out;
}

/**
 * Ensure all days from check-in through checkout exist in the DB with same city/country.
 * Example: check-in 02.09 + 2 nights → days 02.09 (existing), 03.09, 04.09 (checkout).
 */
export async function ensureHotelStayDays(
  tripId: string,
  checkInDay: TripDayInput,
  existingDays: TripDay[],
  createDay: (day: TripDayInput) => Promise<TripDay>,
  updateDay: (id: string, day: TripDayInput) => Promise<TripDay>,
): Promise<void> {
  const city = checkInDay.city.trim();
  const country = checkInDay.country.trim();
  if (!checkInDay.date || !city) return;

  const hotels = (checkInDay.items || []).filter((i) => i.type === 'hotel');
  if (!hotels.length) return;

  // Include checkout morning: offset == nights (1 night → +1 day, 2 nights → +1 and +2).
  const maxOffset = Math.max(...hotels.map((h) => hotelNights(h)), 0);
  if (maxOffset < 1) return;

  const byDate = new Map(existingDays.map((d) => [d.date, d]));
  let nextSort =
    existingDays.reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1;

  for (let offset = 1; offset <= maxOffset; offset++) {
    const stayDate = addDaysIso(checkInDay.date, offset);
    const found = byDate.get(stayDate);
    if (found) {
      if (found.city.trim() === city && found.country.trim() === country) {
        continue;
      }
      const { id, createdAt: _c, updatedAt: _u, ...rest } = found;
      await updateDay(id, {
        ...rest,
        city,
        country,
      });
    } else {
      const created = await createDay({
        ...emptyDay(tripId, stayDate, nextSort),
        city,
        country,
      });
      byDate.set(stayDate, created);
      nextSort += 1;
    }
  }
}

export function summarizeCheckoutHotels(stays: HotelStayRef[]): string {
  if (!stays.length) return '';
  return stays
    .map(({ hotel: h }) => {
      const name = h.title.trim() || 'Hotell';
      return h.endTime?.trim() ? `Utsjekk ${name} ${h.endTime}` : `Utsjekk ${name}`;
    })
    .join(' · ');
}

export interface CruiseStayRef {
  embarkDay: TripDay;
  cruise: DayItem;
  embarkDate: string;
  disembarkDate: string;
}

function cruiseStayWindow(
  embarkDate: string,
  cruise: DayItem,
): { embarkDate: string; disembarkDate: string; nights: number } {
  const nights = cruiseNights(cruise);
  return {
    embarkDate,
    disembarkDate: addDaysIso(embarkDate, nights),
    nights,
  };
}

/**
 * Cruises with an overnight on `date` (embark ≤ date < disembark).
 * Embark 02.09 + 7 nights → aboard 02.09 … 08.09; disembark morning 09.09.
 */
export function cruisesCoveringDay(
  days: TripDay[],
  date: string,
): CruiseStayRef[] {
  if (!date) return [];
  const out: CruiseStayRef[] = [];

  for (const day of days) {
    for (const item of day.items || []) {
      if (item.type !== 'cruise') continue;
      const { embarkDate, disembarkDate } = cruiseStayWindow(day.date, item);
      if (date >= embarkDate && date < disembarkDate) {
        out.push({
          embarkDay: day,
          cruise: item,
          embarkDate,
          disembarkDate,
        });
      }
    }
  }
  return out;
}

/** Cruises disembarking on `date` (embark + nights). */
export function cruisesDisembarkingOnDay(
  days: TripDay[],
  date: string,
): CruiseStayRef[] {
  if (!date) return [];
  const out: CruiseStayRef[] = [];

  for (const day of days) {
    for (const item of day.items || []) {
      if (item.type !== 'cruise') continue;
      const { embarkDate, disembarkDate } = cruiseStayWindow(day.date, item);
      if (disembarkDate === date) {
        out.push({
          embarkDay: day,
          cruise: item,
          embarkDate,
          disembarkDate,
        });
      }
    }
  }
  return out;
}

/** Build default itinerary rows for a cruise from existing trip days. */
export function buildCruiseDayPatches(
  embarkDate: string,
  cruise: DayItem,
  tripDays: TripDay[],
  embarkForm?: Pick<TripDay, 'city' | 'country' | 'atSea' | 'date'>,
): CruiseDayPatch[] {
  const nights = cruiseNights(cruise);
  const home = cruiseHomePort(cruise);
  const byDate = new Map(tripDays.map((d) => [d.date, d]));
  const patches: CruiseDayPatch[] = [];

  for (let offset = 0; offset <= nights; offset++) {
    const date = addDaysIso(embarkDate, offset);
    const existing =
      embarkForm && embarkForm.date === date
        ? embarkForm
        : byDate.get(date);
    const isEnd = offset === 0 || offset === nights;
    const atSea = isAtSeaDay(existing || { city: '', atSea: false });
    let city = existing?.city?.trim() || '';
    let country = existing?.country?.trim() || '';
    if (atSea) {
      city = AT_SEA_LABEL;
      country = '';
    } else if (!city && isEnd && home) {
      city = home;
    }
    patches.push({ date, city, country, atSea });
  }
  return patches;
}

/**
 * Ensure cruise calendar days exist. Optionally apply explicit port/at-sea patches
 * from the cruise block editor; otherwise only create missing days and fill empty
 * embark/disembark cities with home port (does not overwrite middle ports).
 */
export async function ensureCruiseDays(
  tripId: string,
  embarkDay: TripDayInput,
  existingDays: TripDay[],
  createDay: (day: TripDayInput) => Promise<TripDay>,
  updateDay: (id: string, day: TripDayInput) => Promise<TripDay>,
  dayPatches?: CruiseDayPatch[],
): Promise<void> {
  if (!embarkDay.date) return;

  const cruises = (embarkDay.items || []).filter((i) => i.type === 'cruise');
  if (!cruises.length) return;

  const maxOffset = Math.max(...cruises.map((c) => cruiseNights(c)), 0);
  if (maxOffset < 1) return;

  const home =
    cruises.map((c) => cruiseHomePort(c)).find((p) => p) || '';
  const patchByDate = new Map(
    (dayPatches || []).map((p) => [p.date, p] as const),
  );

  const byDate = new Map(existingDays.map((d) => [d.date, d]));
  let nextSort =
    existingDays.reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1;

  for (let offset = 0; offset <= maxOffset; offset++) {
    const stayDate = addDaysIso(embarkDay.date, offset);
    const patch = patchByDate.get(stayDate);
    const isEnd = offset === 0 || offset === maxOffset;
    const found = byDate.get(stayDate);

    let nextCity = found?.city || '';
    let nextCountry = found?.country || '';
    let nextAtSea = found ? isAtSeaDay(found) : false;

    if (patch) {
      nextAtSea = patch.atSea;
      nextCity = patch.atSea ? AT_SEA_LABEL : patch.city.trim();
      nextCountry = patch.atSea ? '' : patch.country.trim();
    } else if (isEnd && home) {
      if (!nextAtSea && !nextCity.trim()) {
        nextCity = home;
      }
    }

    if (nextAtSea) {
      nextCity = AT_SEA_LABEL;
      nextCountry = '';
    }

    if (found) {
      const cityChanged = found.city.trim() !== nextCity.trim();
      const countryChanged = found.country.trim() !== nextCountry.trim();
      const atSeaChanged = isAtSeaDay(found) !== nextAtSea;
      if (!cityChanged && !countryChanged && !atSeaChanged) continue;
      // Without patches: never overwrite an already-set middle port.
      if (!patch && offset > 0 && offset < maxOffset) continue;
      if (!patch && isEnd && found.city.trim() && !atSeaChanged) continue;

      const { id, createdAt: _c, updatedAt: _u, ...rest } = found;
      await updateDay(id, {
        ...rest,
        city: nextCity,
        country: nextCountry,
        atSea: nextAtSea,
      });
    } else if (offset > 0) {
      const created = await createDay({
        ...emptyDay(tripId, stayDate, nextSort),
        city: nextCity,
        country: nextCountry,
        atSea: nextAtSea,
      });
      byDate.set(stayDate, created);
      nextSort += 1;
    }
  }
}

export type TripMapStop = {
  /** Day's main city — used when geocoding street/airport vias. */
  contextCity?: string
  kind: 'port' | 'sea' | 'via'
  city: string
  country: string
  date: string
  key: string
  /** Seconds from midnight when known — used for ordering/numbering. */
  timeKey?: number
}

/** Effective sort time for a via stop (prefer leg ankomst/avgang). */
export function viaMapTimeKey(
  point: ViaPoint,
  index: number,
  points: ViaPoint[],
  legs: RouteLeg[],
): number {
  const inbound = index > 0 ? legs[index - 1] : undefined;
  const outbound = index < points.length - 1 ? legs[index] : undefined;
  const arrive = (inbound?.endTime || point.arriveTime || '').trim();
  const leave = (outbound?.startTime || point.leaveTime || '').trim();
  const arriveKey = arriveTimeSortKey(arrive);
  if (arriveKey !== Number.POSITIVE_INFINITY) return arriveKey;
  return arriveTimeSortKey(leave);
}

/** Unique port/cities in chronological order of first visit (skips at-sea days). */
export function tripCitiesInOrder(
  days: TripDay[],
): { city: string; country: string; date: string; key: string }[] {
  return tripMapStopsInOrder(days)
    .filter((s) => s.kind === 'port')
    .map(({ city, country, date, key }) => ({ city, country, date, key }));
}

/**
 * Map route stops in time order across the trip:
 * days by date; within each day vias by arrive/leave, then main city last.
 */
export function tripMapStopsInOrder(days: TripDay[]): TripMapStop[] {
  const sorted = [...days].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortOrder - b.sortOrder;
  });
  const out: TripMapStop[] = [];
  let lastPortKey = '';

  for (const day of sorted) {
    if (isAtSeaDay(day)) {
      out.push({
        kind: 'sea',
        city: AT_SEA_LABEL,
        country: '',
        date: day.date,
        key: `sea|${day.date}`,
      });
      continue;
    }

    const city = day.city.trim();
    const country = day.country.trim();
    const points = sortViaPointsByArriveTime(day.viaPoints || []);
    const legs = syncRouteLegs(points, day.legs || []);

    // Via-punkter først (etter tid), hovedby/havn alltid til slutt den dagen.
    const viaTimed = points.map((p, i) => ({
      p,
      i,
      key: viaMapTimeKey(p, i, points, legs),
    }));
    viaTimed.sort((a, b) => {
      const aTimed = a.key !== Number.POSITIVE_INFINITY;
      const bTimed = b.key !== Number.POSITIVE_INFINITY;
      if (aTimed && bTimed && a.key !== b.key) return a.key - b.key;
      return a.i - b.i;
    });

    let cityViaTime = Number.POSITIVE_INFINITY;
    for (const { p, key: timeKey } of viaTimed) {
      const title = p.title.trim();
      if (!title) continue;
      if (city && title.toLowerCase() === city.toLowerCase()) {
        // Same stop as day city — keep its time for the port, don't list twice.
        if (timeKey < cityViaTime) cityViaTime = timeKey;
        continue;
      }
      out.push({
        kind: 'via',
        city: title,
        country,
        contextCity: city || undefined,
        date: day.date,
        key: `via|${day.id}|${p.id}`,
        timeKey,
      });
    }

    if (city && city.toLowerCase() !== AT_SEA_LABEL.toLowerCase()) {
      const portKey = `${country}|${city}`.toLowerCase();
      if (portKey !== lastPortKey) {
        lastPortKey = portKey;
        const hotel = (day.items || []).find((i) => i.type === 'hotel');
        const hotelTime = arriveTimeSortKey(hotel?.startTime);
        const timeKey =
          cityViaTime !== Number.POSITIVE_INFINITY ? cityViaTime : hotelTime;
        out.push({
          kind: 'port',
          city,
          country,
          date: day.date,
          // Unique per visit — same city later in the trip must not reuse key
          // (duplicate React keys scrambled Genova/Rapallo in the legend).
          key: `port|${day.date}|${portKey}`,
          timeKey,
        });
      }
    }
  }

  return out;
}

export function groupDaysByCity(days: TripDay[]): CityGroup[] {
  const map = new Map<string, CityGroup>();

  for (const day of [...days].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortOrder - b.sortOrder;
  })) {
    const atSea = isAtSeaDay(day);
    const city = atSea ? AT_SEA_LABEL : day.city.trim() || 'Uten by';
    const country = atSea ? AT_SEA_LABEL : day.country.trim() || 'Uten land';
    const key = atSea ? `${AT_SEA_LABEL}|${AT_SEA_LABEL}` : `${country}|${city}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        country,
        city,
        days: [],
        hotels: [],
        items: [],
      };
      map.set(key, group);
    }
    group.days.push(day);
    for (const item of day.items || []) {
      if (!group.items.some((i) => i.id === item.id)) {
        group.items.push(item);
      }
      if (item.type === 'hotel' && !group.hotels.some((h) => h.id === item.id)) {
        group.hotels.push(item);
      }
    }
    // Legacy fallback
    if (!group.hotels.length && day.hotelName) {
      group.hotels.push({
        id: `legacy-${day.id}`,
        type: 'hotel',
        title: day.hotelName,
        url: day.hotelUrl,
        address: day.address,
        startTime: day.checkIn,
        endTime: day.checkOut,
        sortOrder: 0,
      });
    }
  }

  return [...map.values()];
}
