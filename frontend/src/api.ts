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
  | 'package'
  | 'flight'
  | 'train'
  | 'bus'
  | 'taxi'
  | 'boat'
  | 'attraction';

/** Ship arrive/leave for one cruise port day (stored on the cruise item). */
export interface CruisePortCall {
  date: string;
  arriveTime?: string;
  leaveTime?: string;
}

/** Activity for the whole cruise (stored on the cruise DayItem). */
export interface CruiseActivity {
  id: string;
  title: string;
  startTime?: string;
  notes?: string;
  url?: string;
  sortOrder: number;
}

/** Extra cost on a cruise (whole sailing or one day). */
export interface CruiseCost {
  id: string;
  title: string;
  price?: string;
  notes?: string;
  sortOrder: number;
}

/** Extra costs for one cruise calendar day. */
export interface CruiseDayCosts {
  date: string;
  costs: CruiseCost[];
}

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
  /** Hotel/cruise/transport: expected price as free text, e.g. "4500 kr". */
  price?: string;
  /** Transport: actual cost after travel (overrides price in expense totals). */
  actualPrice?: string;
  /** Cruise: cabin / lugar number. */
  cabinNumber?: string;
  /** Cruise: per-port ship times for list/timeline display. */
  cruisePorts?: CruisePortCall[];
  /** Cruise: activities for the whole sailing (not a single port day). */
  activities?: CruiseActivity[];
  /** Cruise: extra costs for the whole sailing. */
  costs?: CruiseCost[];
  /** Cruise: extra costs per calendar day. */
  dayCosts?: CruiseDayCosts[];
  sortOrder: number;
}

export type LegMode =
  | 'walk'
  | 'taxi'
  | 'bus'
  | 'tram'
  | 'train'
  | 'flight'
  | 'boat'
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

/** Optional modules enabled for a trip (set when creating / in trip settings). */
export interface TripFeatures {
  /** Show cruise on day editor (not on every trip by default). */
  cruise?: boolean;
  /** Show package-tour style content on day editor. */
  packages?: boolean;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  colorByCountry?: Record<string, string>;
  features?: TripFeatures;
  createdAt?: string;
  updatedAt?: string;
}

export function emptyTripFeatures(): TripFeatures {
  return { cruise: false, packages: false };
}

export function tripHasCruise(trip?: Trip | null): boolean {
  return !!trip?.features?.cruise;
}

export function tripHasPackages(trip?: Trip | null): boolean {
  return !!trip?.features?.packages;
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
  /** Ship arrival at port (cruise), HH:mm. */
  arriveTime?: string;
  /** Ship departure from port (cruise), HH:mm. */
  leaveTime?: string;
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
  /** Ship arrival at this port (empty on embark / at sea). */
  arriveTime?: string;
  /** Ship departure from this port (empty on disembark / at sea). */
  leaveTime?: string;
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
  { type: 'package', label: 'Pakketur' },
  { type: 'flight', label: 'Fly' },
  { type: 'train', label: 'Tog' },
  { type: 'bus', label: 'Buss' },
  { type: 'taxi', label: 'Taxi' },
  { type: 'boat', label: 'Båt' },
  { type: 'attraction', label: 'Utflukt' },
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
    price:
      type === 'hotel' ||
      type === 'cruise' ||
      type === 'flight' ||
      type === 'train' ||
      type === 'bus' ||
      type === 'taxi' ||
      type === 'boat'
        ? ''
        : undefined,
    actualPrice:
      type === 'flight' ||
      type === 'train' ||
      type === 'bus' ||
      type === 'taxi' ||
      type === 'boat'
        ? ''
        : undefined,
    cabinNumber: type === 'cruise' ? '' : undefined,
    activities: type === 'cruise' ? [] : undefined,
    costs: type === 'cruise' ? [] : undefined,
    dayCosts: type === 'cruise' ? [] : undefined,
    sortOrder,
  };
}

export function newCruiseActivity(sortOrder = 0): CruiseActivity {
  return {
    id: crypto.randomUUID(),
    title: '',
    startTime: '',
    notes: '',
    url: '',
    sortOrder,
  };
}

export function newCruiseCost(sortOrder = 0): CruiseCost {
  return {
    id: crypto.randomUUID(),
    title: '',
    price: '',
    notes: '',
    sortOrder,
  };
}

export function cleanCruiseCosts(
  costs: CruiseCost[] | undefined,
): CruiseCost[] | undefined {
  if (!costs?.length) return costs?.length === 0 ? [] : undefined;
  const cleaned = costs
    .map((c, i) => ({ ...c, sortOrder: i }))
    .filter(
      (c) => c.title.trim() || c.price?.trim() || c.notes?.trim(),
    );
  return cleaned;
}

export function cleanCruiseDayCosts(
  dayCosts: CruiseDayCosts[] | undefined,
): CruiseDayCosts[] | undefined {
  if (!dayCosts?.length) return dayCosts?.length === 0 ? [] : undefined;
  const cleaned = dayCosts
    .map((row) => ({
      date: row.date,
      costs: cleanCruiseCosts(row.costs) || [],
    }))
    .filter((row) => row.date && row.costs.length > 0);
  return cleaned;
}

export function costsForCruiseDay(
  dayCosts: CruiseDayCosts[] | undefined,
  date: string,
): CruiseCost[] {
  return dayCosts?.find((r) => r.date === date)?.costs || [];
}

export function setCostsForCruiseDay(
  dayCosts: CruiseDayCosts[] | undefined,
  date: string,
  costs: CruiseCost[],
): CruiseDayCosts[] {
  const rest = (dayCosts || []).filter((r) => r.date !== date);
  const cleaned = costs.map((c, i) => ({ ...c, sortOrder: i }));
  if (!cleaned.length) return rest;
  return [...rest, { date, costs: cleaned }].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Short titles for whole-cruise activities (list / city preview). */
export function summarizeCruiseActivities(
  activities: CruiseActivity[] | undefined,
): string {
  if (!activities?.length) return '';
  return activities
    .map((a) => {
      const title = a.title.trim();
      if (!title) return '';
      const time = a.startTime?.trim();
      return time ? `${time} ${title}` : title;
    })
    .filter(Boolean)
    .join(' · ');
}

/** Short labels for cruise cost rows (list / day expense lines). */
export function summarizeCruiseCosts(
  costs: CruiseCost[] | undefined,
): string {
  if (!costs?.length) return '';
  return costs
    .map((c) => {
      const title = c.title.trim();
      const price = c.price?.trim();
      if (!title && !price) return '';
      if (title && price) return `${title} ${price}`;
      return title || price || '';
    })
    .filter(Boolean)
    .join(' · ');
}

/** Keep hotel/cruise items; replace the rest with `dayItems`. */
export function mergeDayActivityItems(
  existing: DayItem[] | undefined,
  dayItems: DayItem[],
): DayItem[] {
  const keep = (existing || []).filter(
    (i) => i.type === 'hotel' || i.type === 'cruise',
  );
  const cleaned = dayItems
    .map((item, idx) => ({ ...item, sortOrder: keep.length + idx }))
    .filter(
      (item) =>
        item.title.trim() ||
        item.url?.trim() ||
        item.from?.trim() ||
        item.to?.trim() ||
        item.address?.trim() ||
        item.notes?.trim(),
    );
  return [...keep, ...cleaned].map((item, idx) => ({
    ...item,
    sortOrder: idx,
  }));
}

/** Display expected price when set (hotel, buss, tog, …). */
export function formatItemPrice(item: Pick<DayItem, 'price'>): string {
  const p = item.price?.trim();
  return p || '';
}

/** Actual transport cost when set. */
export function formatActualPrice(
  item: Pick<DayItem, 'actualPrice'>,
): string {
  return item.actualPrice?.trim() || '';
}

/**
 * Transport display/expense price: actual if set, otherwise expected.
 */
export function effectiveItemPrice(
  item: Pick<DayItem, 'price' | 'actualPrice' | 'type'>,
): string {
  if (isTransportType(item.type as DayItemType)) {
    return formatActualPrice(item) || formatItemPrice(item);
  }
  return formatItemPrice(item);
}

/** Short label for list/summary: "45 €" or "forv. 40 · faktisk 45". */
export function formatTransportPriceLabel(
  item: Pick<DayItem, 'price' | 'actualPrice'>,
): string {
  const expected = formatItemPrice(item);
  const actual = formatActualPrice(item);
  if (expected && actual) {
    if (expected === actual) return actual;
    return `forv. ${expected} · faktisk ${actual}`;
  }
  if (actual) return `faktisk ${actual}`;
  if (expected) return `forv. ${expected}`;
  return '';
}

/** @deprecated Prefer formatItemPrice */
export function formatHotelPrice(item: Pick<DayItem, 'price'>): string {
  return formatItemPrice(item);
}

/**
 * Parse free-text price to a number ("12 000 kr", "12000", "€45", "1.250,50").
 * Returns null when no usable amount is found.
 */
export function parsePriceAmount(raw: string | undefined): number | null {
  const t = (raw || '').trim();
  if (!t) return null;

  // Prefer a clear decimal with comma: 1250,50 / 1.250,50
  const commaDec = t.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+),(\d{1,2})\b/);
  if (commaDec) {
    const whole = commaDec[1].replace(/[.\s]/g, '');
    const n = Number(`${whole}.${commaDec[2]}`);
    return Number.isFinite(n) ? n : null;
  }

  // Dot decimal when not thousand-grouping: 45.5 / 1200.00
  const dotDec = t.match(/(?:^|[^\d.])(\d+)\.(\d{1,2})\b/);
  if (dotDec) {
    const n = Number(`${dotDec[1]}.${dotDec[2]}`);
    return Number.isFinite(n) ? n : null;
  }

  // Integer with optional thousand separators: 12 000 / 12.000 / 12000
  const intMatch = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)/);
  if (!intMatch) return null;
  const n = Number(intMatch[1].replace(/[.\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Format amount for expense overview (nb-NO, no currency symbol forced). */
export function formatExpenseAmount(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export type ExpenseLine = {
  id: string;
  title: string;
  date?: string;
  rawPrice: string;
  amount: number;
  /** When set, amount comes from actual cost (transport). */
  isActual?: boolean;
  expectedRaw?: string;
};

export type DayExpenseSummary = {
  date: string;
  place: string;
  cruise: number;
  hotel: number;
  transport: number;
  total: number;
  lines: ExpenseLine[];
};

export type TripExpenseSummary = {
  cruise: { total: number; days: number; avgPerDay: number; lines: ExpenseLine[] };
  hotel: { total: number; lines: ExpenseLine[] };
  transport: { total: number; lines: ExpenseLine[] };
  byDay: DayExpenseSummary[];
  total: number;
  pricedCount: number;
  unparsedCount: number;
};

function resolveExpenseAmount(item: DayItem): {
  amount: number;
  raw: string;
  isActual?: boolean;
  expectedRaw?: string;
} | 'empty' | 'unparsed' {
  const expectedRaw = item.price?.trim() || '';
  const actualRaw = isTransportType(item.type)
    ? item.actualPrice?.trim() || ''
    : '';
  const useActual = !!actualRaw;
  const raw = useActual ? actualRaw : expectedRaw;
  if (!raw) return 'empty';
  const amount = parsePriceAmount(raw);
  if (amount === null) return 'unparsed';
  return {
    amount,
    raw,
    isActual: useActual || undefined,
    expectedRaw:
      useActual && expectedRaw && expectedRaw !== actualRaw
        ? expectedRaw
        : undefined,
  };
}

/** Sum cruise / hotel / transport prices across the trip (each item once). */
export function tripExpenseSummary(days: TripDay[]): TripExpenseSummary {
  const sorted = [...days].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortOrder - b.sortOrder;
  });
  const placeByDate = new Map(
    sorted.map((d) => [d.date, dayPlaceLabel(d)] as const),
  );

  const cruiseLines: ExpenseLine[] = [];
  const hotelLines: ExpenseLine[] = [];
  const transportLines: ExpenseLine[] = [];
  let cruiseDays = 0;
  let unparsedCount = 0;
  let pricedCount = 0;

  type DayAcc = {
    cruise: number;
    hotel: number;
    transport: number;
    lines: ExpenseLine[];
  };
  const byDate = new Map<string, DayAcc>();

  function dayAcc(date: string): DayAcc {
    let acc = byDate.get(date);
    if (!acc) {
      acc = { cruise: 0, hotel: 0, transport: 0, lines: [] };
      byDate.set(date, acc);
    }
    return acc;
  }

  function addShare(
    date: string,
    category: 'cruise' | 'hotel' | 'transport',
    share: number,
    line: ExpenseLine,
  ) {
    const acc = dayAcc(date);
    acc[category] += share;
    acc.lines.push(line);
  }

  function addCruiseCostLine(
    embarkDate: string,
    nights: number,
    cost: CruiseCost,
    spread: boolean,
  ) {
    const raw = cost.price?.trim() || '';
    if (!raw) return;
    const amount = parsePriceAmount(raw);
    if (amount === null) {
      unparsedCount += 1;
      return;
    }
    pricedCount += 1;
    const title = cost.title.trim() || 'Kostnad';
    const line: ExpenseLine = {
      id: cost.id,
      title,
      date: embarkDate,
      rawPrice: raw,
      amount,
    };
    cruiseLines.push(line);
    if (!embarkDate) return;
    if (spread && nights > 0) {
      const share = amount / nights;
      for (let i = 0; i < nights; i++) {
        const date = addDaysIso(embarkDate, i);
        addShare(date, 'cruise', share, {
          ...line,
          id: `${line.id}:${date}`,
          date,
          amount: share,
          title: `${title} (andel)`,
        });
      }
      return;
    }
    addShare(embarkDate, 'cruise', amount, line);
  }

  for (const day of sorted) {
    for (const item of day.items || []) {
      if (item.type === 'cruise') {
        const nights = cruiseNights(item);
        const embarkDate = day.date;
        let countedNights = false;

        const resolved = resolveExpenseAmount(item);
        if (resolved === 'unparsed') {
          unparsedCount += 1;
        } else if (resolved !== 'empty') {
          pricedCount += 1;
          const title = item.title.trim() || itemTypeLabel(item.type);
          const line: ExpenseLine = {
            id: item.id,
            title,
            date: embarkDate,
            rawPrice: resolved.raw,
            amount: resolved.amount,
          };
          cruiseLines.push(line);
          cruiseDays += nights;
          countedNights = true;
          if (nights >= 1 && embarkDate) {
            const share = resolved.amount / nights;
            for (let i = 0; i < nights; i++) {
              const date = addDaysIso(embarkDate, i);
              addShare(date, 'cruise', share, {
                ...line,
                id: `${line.id}:${date}`,
                date,
                amount: share,
                title: `${title} (andel)`,
              });
            }
          }
        }

        const wholeCosts = item.costs || [];
        if (wholeCosts.length && !countedNights && nights > 0) {
          cruiseDays += nights;
          countedNights = true;
        }
        for (const cost of wholeCosts) {
          addCruiseCostLine(embarkDate, nights, cost, true);
        }
        for (const row of item.dayCosts || []) {
          for (const cost of row.costs || []) {
            const raw = cost.price?.trim() || '';
            if (!raw) continue;
            const amount = parsePriceAmount(raw);
            if (amount === null) {
              unparsedCount += 1;
              continue;
            }
            pricedCount += 1;
            const title = cost.title.trim() || 'Kostnad';
            const line: ExpenseLine = {
              id: cost.id,
              title,
              date: row.date,
              rawPrice: raw,
              amount,
            };
            cruiseLines.push(line);
            if (row.date) {
              addShare(row.date, 'cruise', amount, line);
            }
          }
        }
        continue;
      }

      const resolved = resolveExpenseAmount(item);
      if (resolved === 'empty') continue;
      if (resolved === 'unparsed') {
        unparsedCount += 1;
        continue;
      }
      pricedCount += 1;
      const title = item.title.trim() || itemTypeLabel(item.type);
      const line: ExpenseLine = {
        id: item.id,
        title,
        date: day.date,
        rawPrice: resolved.raw,
        amount: resolved.amount,
        isActual: resolved.isActual,
        expectedRaw: resolved.expectedRaw,
      };

      if (item.type === 'hotel') {
        hotelLines.push(line);
        const nights = hotelNights(item);
        if (nights < 1 || !day.date) continue;
        const share = resolved.amount / nights;
        for (let i = 0; i < nights; i++) {
          const date = addDaysIso(day.date, i);
          addShare(date, 'hotel', share, {
            ...line,
            id: `${line.id}:${date}`,
            date,
            amount: share,
            title: `${title} (andel)`,
          });
        }
      } else if (isTransportType(item.type)) {
        transportLines.push(line);
        if (!day.date) continue;
        addShare(day.date, 'transport', resolved.amount, line);
      }
    }
  }

  const sum = (lines: ExpenseLine[]) =>
    lines.reduce((acc, l) => acc + l.amount, 0);
  const cruiseTotal = sum(cruiseLines);
  const hotelTotal = sum(hotelLines);
  const transportTotal = sum(transportLines);

  const byDay: DayExpenseSummary[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => ({
      date,
      place: placeByDate.get(date) || '',
      cruise: acc.cruise,
      hotel: acc.hotel,
      transport: acc.transport,
      total: acc.cruise + acc.hotel + acc.transport,
      lines: acc.lines,
    }))
    .filter((d) => d.total > 0);

  return {
    cruise: {
      total: cruiseTotal,
      days: cruiseDays,
      avgPerDay: cruiseDays > 0 ? cruiseTotal / cruiseDays : 0,
      lines: cruiseLines,
    },
    hotel: { total: hotelTotal, lines: hotelLines },
    transport: { total: transportTotal, lines: transportLines },
    byDay,
    total: cruiseTotal + hotelTotal + transportTotal,
    pricedCount,
    unparsedCount,
  };
}

/** Hotels.com search URL for hotel name / city (optional stay dates). */
export function hotelsComSearchUrl(opts: {
  hotelName?: string;
  city?: string;
  country?: string;
  checkIn?: string;
  checkOut?: string;
}): string {
  const destination = [opts.hotelName, opts.city, opts.country]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ');
  const params = new URLSearchParams();
  if (destination) params.set('destination', destination);
  const checkIn = (opts.checkIn || '').trim();
  const checkOut = (opts.checkOut || '').trim();
  if (checkIn) {
    params.set('startDate', checkIn);
    params.set('d1', checkIn);
  }
  if (checkOut) {
    params.set('endDate', checkOut);
    params.set('d2', checkOut);
  }
  const qs = params.toString();
  return qs
    ? `https://www.hotels.com/Hotel-Search?${qs}`
    : 'https://www.hotels.com/';
}

export function isHotelsComUrl(url?: string): boolean {
  const u = (url || '').trim().toLowerCase();
  return u.includes('hotels.com');
}

/** Coerce hotel/cruise nights (API may send number or string). */
export function hotelNights(item: { nights?: number | string }): number {
  const n = item.nights;
  if (typeof n === 'number' && Number.isFinite(n) && n >= 1) {
    return Math.min(60, Math.floor(n));
  }
  if (typeof n === 'string' && n.trim()) {
    const parsed = Number(n);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(60, Math.floor(parsed));
    }
  }
  return 1;
}

/** Check-in date + nights → checkout morning (ISO). */
export function hotelCheckoutDate(
  checkInDate: string,
  hotel: { nights?: number | string } | number,
): string {
  if (!checkInDate.trim()) return '';
  const nights =
    typeof hotel === 'number' ? Math.max(1, hotel) : hotelNights(hotel);
  return addDaysIso(checkInDate, nights);
}

/** Human-readable stay span, e.g. "17.09.2026 → 19.09.2026 (2 netter)". */
export function formatHotelStaySpan(
  checkInDate: string,
  hotel: { nights?: number | string },
  formatDate: (iso: string) => string,
): string {
  if (!checkInDate.trim()) return '';
  const nights = hotelNights(hotel);
  const checkout = hotelCheckoutDate(checkInDate, nights);
  const nightWord = nights === 1 ? 'natt' : 'netter';
  return `${formatDate(checkInDate)} → ${formatDate(checkout)} (${nights} ${nightWord})`;
}

export function cruiseNights(item: DayItem): number {
  return hotelNights(item);
}

export function cruiseHomePort(item: DayItem): string {
  return (item.from || item.to || '').trim();
}

/** Persist itinerary port times onto the cruise item. */
export function cruisePortsFromItinerary(
  rows: CruiseDayPatch[],
): CruisePortCall[] {
  return rows
    .filter((row) => !row.atSea && row.date)
    .map((row) => ({
      date: row.date,
      arriveTime: (row.arriveTime || '').trim(),
      leaveTime: (row.leaveTime || '').trim(),
    }))
    .filter((port) => port.arriveTime || port.leaveTime);
}

export function cruisePortTimesOnDate(
  cruise: DayItem,
  date: string,
): { arriveTime: string; leaveTime: string } {
  const port = (cruise.cruisePorts || []).find((p) => p.date === date);
  return {
    arriveTime: port?.arriveTime?.trim() || '',
    leaveTime: port?.leaveTime?.trim() || '',
  };
}

export function dayPlaceLabel(day: Pick<TripDay, 'city' | 'country' | 'atSea'>): string {
  if (isAtSeaDay(day)) return AT_SEA_LABEL;
  return day.city.trim() || 'Uten by';
}

/** Prefer the day with the most content when several share a date. */
export function dayRichnessScore(day: TripDay): number {
  let score = 0;
  if (isAtSeaDay(day)) score += 1;
  else if (day.city.trim()) score += 3;
  if (day.country.trim()) score += 1;
  if (day.arriveTime?.trim()) score += 1;
  if (day.leaveTime?.trim()) score += 1;
  if (day.notes?.trim()) score += 1;
  score += (day.items?.length || 0) * 10;
  score += (day.viaPoints?.length || 0) * 5;
  score += (day.legs?.length || 0) * 2;
  score += (day.links?.length || 0);
  return score;
}

export function pickDayForDate(
  days: TripDay[],
  date: string,
): TripDay | undefined {
  const matches = days.filter((d) => d.date === date);
  if (!matches.length) return undefined;
  return [...matches].sort((a, b) => {
    const diff = dayRichnessScore(b) - dayRichnessScore(a);
    if (diff !== 0) return diff;
    return a.sortOrder - b.sortOrder;
  })[0];
}

function indexDaysByDate(days: TripDay[]): Map<string, TripDay> {
  const map = new Map<string, TripDay>();
  for (const d of days) {
    const cur = map.get(d.date);
    if (!cur || dayRichnessScore(d) > dayRichnessScore(cur)) {
      map.set(d.date, d);
    }
  }
  return map;
}

/**
 * Merge accidental duplicate calendar days (same date) into one, then delete
 * the extras. Keeps the richest day as base and fills missing ship times /
 * items / via points from the others.
 */
export async function mergeDuplicateTripDays(
  days: TripDay[],
  updateDay: (id: string, day: TripDayInput) => Promise<TripDay>,
  deleteDay: (id: string) => Promise<unknown>,
): Promise<TripDay[]> {
  const byDate = new Map<string, TripDay[]>();
  for (const day of days) {
    const list = byDate.get(day.date) || [];
    list.push(day);
    byDate.set(day.date, list);
  }

  let next = [...days];
  for (const [, group] of byDate) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => {
      const diff = dayRichnessScore(b) - dayRichnessScore(a);
      if (diff !== 0) return diff;
      return a.sortOrder - b.sortOrder;
    });
    const keeper = ordered[0]!;
    const losers = ordered.slice(1);

    let city = keeper.city;
    let country = keeper.country;
    let atSea = isAtSeaDay(keeper);
    let arriveTime = keeper.arriveTime?.trim() || '';
    let leaveTime = keeper.leaveTime?.trim() || '';
    let notes = keeper.notes || '';
    const items = [...(keeper.items || [])];
    const viaPoints = [...(keeper.viaPoints || [])];
    const legs = [...(keeper.legs || [])];
    const links = [...(keeper.links || [])];
    const itemIds = new Set(items.map((i) => i.id));
    const viaIds = new Set(viaPoints.map((p) => p.id));
    const legIds = new Set(legs.map((l) => l.id));

    for (const other of losers) {
      if (!atSea && !city.trim() && other.city.trim()) {
        city = other.city;
        country = other.country;
        atSea = isAtSeaDay(other);
      }
      if (!arriveTime && other.arriveTime?.trim()) {
        arriveTime = other.arriveTime.trim();
      }
      if (!leaveTime && other.leaveTime?.trim()) {
        leaveTime = other.leaveTime.trim();
      }
      if (!notes.trim() && other.notes?.trim()) notes = other.notes;
      for (const item of other.items || []) {
        if (!itemIds.has(item.id)) {
          items.push(item);
          itemIds.add(item.id);
        }
      }
      for (const point of other.viaPoints || []) {
        if (!viaIds.has(point.id)) {
          viaPoints.push(point);
          viaIds.add(point.id);
        }
      }
      for (const leg of other.legs || []) {
        if (!legIds.has(leg.id)) {
          legs.push(leg);
          legIds.add(leg.id);
        }
      }
      for (const link of other.links || []) {
        if (!links.includes(link)) links.push(link);
      }
    }

    const { id, createdAt: _c, updatedAt: _u, ...rest } = keeper;
    const mergedInput: TripDayInput = {
      ...rest,
      city,
      country,
      atSea,
      arriveTime,
      leaveTime,
      notes,
      items,
      viaPoints: sortViaPointsByArriveTime(viaPoints),
      legs: syncRouteLegs(
        sortViaPointsByArriveTime(viaPoints),
        legs,
      ),
      links,
    };
    const updated = await updateDay(id, mergedInput);
    for (const loser of losers) {
      await deleteDay(loser.id);
    }
    next = next
      .filter((d) => d.date !== keeper.date || d.id === keeper.id)
      .map((d) => (d.id === keeper.id ? updated : d));
  }
  return next;
}

/** City/country values to persist for an at-sea day (visible in liste/tidslinje). */
export function atSeaPlaceFields(): Pick<TripDay, 'city' | 'country' | 'atSea'> {
  return { city: AT_SEA_LABEL, country: '', atSea: true };
}

export function isTransportType(type: DayItemType): boolean {
  return (
    type === 'flight' ||
    type === 'train' ||
    type === 'bus' ||
    type === 'taxi' ||
    type === 'boat'
  );
}

export const LEG_MODES: { mode: LegMode; label: string }[] = [
  { mode: 'walk', label: 'Gå' },
  { mode: 'taxi', label: 'Taxi' },
  { mode: 'bus', label: 'Buss' },
  { mode: 'tram', label: 'Bane/trikk' },
  { mode: 'train', label: 'Tog' },
  { mode: 'flight', label: 'Fly' },
  { mode: 'boat', label: 'Båt' },
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

/**
 * Normalize a clock time to HH:mm.
 * Accepts "1800", "930", "18:00", "18.00", "9:5" → "18:00" / "09:30" / …
 * Invalid input is returned trimmed unchanged.
 */
export function normalizeClockTime(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';

  let m = t.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h <= 23 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    return t;
  }

  const digits = t.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, '0');
    const h = Number(padded.slice(0, 2));
    const min = Number(padded.slice(2, 4));
    if (h <= 23 && min <= 59) {
      return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
    }
  }

  return t;
}

/** Minutes from midnight for HH:mm / HH:mm:ss; empty/invalid sorts last. */
export function arriveTimeSortKey(time?: string): number {
  const t = normalizeClockTime(time || '');
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

/** Parse compact timetable text like "14:05 14.50, 16:10, 1800" into HH:mm list. */
export function parseDepartureTimes(raw: string): string[] {
  const parts = raw.split(/[\s,;|]+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const norm = normalizeClockTime(part);
    if (!/^\d{2}:\d{2}$/.test(norm)) continue;
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

/** Titles for attractions / non-transport day items (list overview). */
export function summarizeAttractionTitles(
  items: DayItem[] | undefined,
): string {
  if (!items?.length) return '';
  return items
    .map((item) => {
      const title = item.title.trim();
      if (!title) return '';
      const time = item.startTime?.trim();
      return time ? `${time} ${title}` : title;
    })
    .filter(Boolean)
    .join(' · ');
}

/** One transport item as via-style route: Rapallo → Buss → Genova */
export function formatTransportRoute(item: DayItem): string {
  const mode = itemTypeLabel(item.type);
  const from = (item.from || '').trim();
  const to = (item.to || '').trim();
  const title = (item.title || '').trim();
  const times = [item.startTime, item.endTime].filter(Boolean).join('–');
  const price = formatTransportPriceLabel(item);
  const modeBit = [mode, title && title !== mode ? title : '', times, price]
    .filter(Boolean)
    .join(' · ');
  if (from && to) return `${from} → ${modeBit} → ${to}`;
  if (from || to) return [from, modeBit, to].filter(Boolean).join(' → ');
  return modeBit || mode;
}

/** Legacy day-item transports (prefer Via for city-to-city travel). */
export function summarizeTransportItems(items: DayItem[] | undefined): string {
  const transports = (items || []).filter((i) => isTransportType(i.type));
  if (!transports.length) return '';
  return transports.map(formatTransportRoute).join(' · ');
}

export function summarizeViaRoute(viaPoints: ViaPoint[] | undefined): string {
  if (!viaPoints?.length) return '';
  const names = viaPoints.map((p) => p.title.trim()).filter(Boolean);
  if (!names.length) return `${viaPoints.length} reisestopp`;
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
    parts.push(viaPoints[i].title.trim() || `Stopp ${i + 1}`);
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

  /** V2 trip thread (stops + legs). */
  getJourney: (tripId: string) =>
    request<import('./v2/journeyModel').Journey>(
      `/trips/${encodeURIComponent(tripId)}/journey`,
    ),
  saveJourney: (
    tripId: string,
    journey: import('./v2/journeyModel').Journey,
  ) =>
    request<import('./v2/journeyModel').Journey>(
      `/trips/${encodeURIComponent(tripId)}/journey`,
      { method: 'PUT', body: JSON.stringify(journey) },
    ),
};

export function emptyDay(tripId: string, date = '', sortOrder = 0): TripDayInput {
  return {
    tripId,
    date,
    sortOrder,
    country: '',
    city: '',
    atSea: false,
    arriveTime: '',
    leaveTime: '',
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

/** How a new day is created from the trip list. */
export type TravelIntent = 'onward' | 'home';

/**
 * Draft for «Reise videre» / «Reise hjem»: next calendar day with a from→to
 * leg prefilled from the previous place (and home place when intent is home).
 */
export function buildTravelDayDraft(
  tripId: string,
  date: string,
  sortOrder: number,
  days: TripDay[],
  intent: TravelIntent,
  home?: { city: string; country: string; address?: string } | null,
): TripDayInput {
  const day = emptyDay(tripId, date, sortOrder);
  const dep = departurePlaceForDay(days, date);
  if (intent === 'home' && home?.city?.trim()) {
    day.city = home.city.trim();
    day.country = (home.country || '').trim();
  }
  const fromCity = dep?.city?.trim() || '';
  const toCity = day.city.trim();
  if (fromCity || toCity) {
    const from = { ...newViaPoint(0), title: fromCity };
    const to = {
      ...newViaPoint(1),
      title: toCity,
      address: intent === 'home' ? (home?.address || '').trim() : '',
    };
    day.viaPoints = [from, to];
    day.legs = syncRouteLegs(day.viaPoints, []);
  }
  return day;
}

function shiftDatedList<T extends { date: string }>(
  rows: T[] | undefined,
  delta: number,
  fromDate: string,
): T[] | undefined {
  if (!rows?.length) return rows;
  return rows.map((row) =>
    row.date >= fromDate
      ? { ...row, date: addDaysIso(row.date, delta) }
      : row,
  );
}

/** Shift cruise port/cost dates when the calendar moves. */
function shiftCruiseItemDates(
  item: DayItem,
  delta: number,
  fromDate: string,
  opts?: { bumpNights?: boolean },
): DayItem {
  if (item.type !== 'cruise') return item;
  const next: DayItem = {
    ...item,
    cruisePorts: shiftDatedList(item.cruisePorts, delta, fromDate),
    dayCosts: shiftDatedList(item.dayCosts, delta, fromDate),
  };
  if (opts?.bumpNights) {
    next.nights = cruiseNights(item) + delta;
  }
  return next;
}

/**
 * Insert a blank calendar day after `afterDate`. Every day on/after the new
 * date is moved +1 day; hotel/cruise stays that span the insert gain a night.
 * New day inherits city from the day you insert after (handy when delayed).
 */
export async function insertCalendarDayAfter(
  tripId: string,
  afterDate: string,
  existingDays: TripDay[],
  createDay: (day: TripDayInput) => Promise<TripDay>,
  updateDay: (id: string, day: TripDayInput) => Promise<TripDay>,
): Promise<TripDay> {
  if (!afterDate) {
    throw new Error('Mangler dato å sette inn etter');
  }
  const insertDate = addDaysIso(afterDate, 1);
  const afterDay = [...existingDays]
    .filter((d) => d.date === afterDate)
    .sort((a, b) => dayRichnessScore(b) - dayRichnessScore(a))[0];

  // Move later days last→first so dates never collide mid-update.
  const toShift = [...existingDays]
    .filter((d) => d.date >= insertDate)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.sortOrder - a.sortOrder;
    });

  for (const day of toShift) {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = day;
    const items = (day.items || []).map((item) =>
      item.type === 'cruise'
        ? shiftCruiseItemDates(item, 1, insertDate)
        : item,
    );
    await updateDay(id, {
      ...rest,
      date: addDaysIso(day.date, 1),
      items,
    });
  }

  // Stays that started before the insert and still cover it → +1 night.
  const earlier = existingDays.filter((d) => d.date < insertDate);
  for (const day of earlier) {
    let changed = false;
    const items = (day.items || []).map((item) => {
      if (item.type === 'hotel' || item.type === 'package') {
        const nights = hotelNights(item);
        const checkout = addDaysIso(day.date, nights);
        if (insertDate > day.date && insertDate <= checkout) {
          changed = true;
          return { ...item, nights: nights + 1 };
        }
        return item;
      }
      if (item.type === 'cruise') {
        const nights = cruiseNights(item);
        const disembark = addDaysIso(day.date, nights);
        if (insertDate > day.date && insertDate <= disembark) {
          changed = true;
          return shiftCruiseItemDates(item, 1, insertDate, { bumpNights: true });
        }
      }
      return item;
    });
    if (!changed) continue;
    const { id, createdAt: _c, updatedAt: _u, ...rest } = day;
    await updateDay(id, { ...rest, items });
  }

  const nextSort =
    existingDays.reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1;
  return createDay({
    ...emptyDay(tripId, insertDate, nextSort),
    city: afterDay && !isAtSeaDay(afterDay) ? afterDay.city : '',
    country: afterDay && !isAtSeaDay(afterDay) ? afterDay.country : '',
    atSea: afterDay ? isAtSeaDay(afterDay) : false,
  });
}

/** Latest calendar date among trip days (YYYY-MM-DD), or ''. */
export function latestTripDayDate(days: TripDay[]): string {
  if (!days.length) return '';
  return [...days]
    .map((d) => d.date)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .at(-1)!;
}

/** Stable trip list order: date, then sortOrder. */
export function sortTripDays(days: TripDay[]): TripDay[] {
  return [...days].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortOrder - b.sortOrder;
  });
}

function swapDateToken(date: string, a: string, b: string): string {
  if (date === a) return b;
  if (date === b) return a;
  return date;
}

function remapCruiseDatesOnItems(
  items: DayItem[] | undefined,
  dateA: string,
  dateB: string,
): DayItem[] {
  return (items || []).map((item) => {
    if (item.type !== 'cruise') return item;
    return {
      ...item,
      cruisePorts: (item.cruisePorts || []).map((p) => ({
        ...p,
        date: swapDateToken(p.date, dateA, dateB),
      })),
      dayCosts: (item.dayCosts || []).map((c) => ({
        ...c,
        date: swapDateToken(c.date, dateA, dateB),
      })),
    };
  });
}

/**
 * Swap calendar dates of two days (content keeps its day id).
 * Cruise port/cost dates on the whole trip are remapped for those two dates.
 */
export async function swapTripDayDates(
  dayA: TripDay,
  dayB: TripDay,
  allDays: TripDay[],
  updateDay: (id: string, day: TripDayInput) => Promise<TripDay>,
): Promise<TripDay[]> {
  if (dayA.id === dayB.id || !dayA.date || !dayB.date) {
    return allDays;
  }
  const dateA = dayA.date;
  const dateB = dayB.date;

  const nextById = new Map(allDays.map((d) => [d.id, d]));

  for (const day of allDays) {
    const isSwapPartner = day.id === dayA.id || day.id === dayB.id;
    let nextDate = day.date;
    if (day.id === dayA.id) nextDate = dateB;
    if (day.id === dayB.id) nextDate = dateA;

    const items = remapCruiseDatesOnItems(day.items, dateA, dateB);
    const itemsChanged =
      JSON.stringify(items) !== JSON.stringify(day.items || []);
    if (!isSwapPartner && !itemsChanged) continue;

    const { id, createdAt: _c, updatedAt: _u, ...rest } = day;
    const updated = await updateDay(id, {
      ...rest,
      date: nextDate,
      items,
    });
    nextById.set(id, updated);
  }

  return sortTripDays([...nextById.values()]);
}

/** Short label for ship port times, e.g. "Ankomst 08:00 · Avgang 18:00". */
export function formatShipPortTimes(
  day: Pick<TripDay, 'arriveTime' | 'leaveTime' | 'atSea' | 'city'>,
): string {
  if (isAtSeaDay(day)) return '';
  const parts = [
    day.arriveTime?.trim() ? `Ankomst ${day.arriveTime.trim()}` : '',
    day.leaveTime?.trim() ? `Avgang ${day.leaveTime.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Effective ship times for a day: day fields, then cruisePorts on the cruise
 * item, then embark/disembark times on the cruise item.
 * `city` is the ship port when known (may differ from overnight `day.city`).
 */
export function resolveShipPortTimes(
  day: TripDay,
  allDays: TripDay[],
): Pick<TripDay, 'arriveTime' | 'leaveTime' | 'atSea' | 'city'> {
  if (isAtSeaDay(day)) {
    return {
      city: day.city,
      atSea: true,
      arriveTime: '',
      leaveTime: '',
    };
  }
  let arriveTime = day.arriveTime?.trim() || '';
  let leaveTime = day.leaveTime?.trim() || '';
  let shipPort = '';

  const stays = [
    ...cruisesCoveringDay(allDays, day.date),
    ...cruisesDisembarkingOnDay(allDays, day.date),
  ];
  for (const stay of stays) {
    const port = cruisePortTimesOnDate(stay.cruise, day.date);
    if (!arriveTime && port.arriveTime) arriveTime = port.arriveTime;
    if (!leaveTime && port.leaveTime) leaveTime = port.leaveTime;
  }

  if (!leaveTime) {
    for (const stay of stays) {
      if (stay.embarkDate === day.date && stay.cruise.startTime?.trim()) {
        leaveTime = stay.cruise.startTime.trim();
        break;
      }
    }
  }
  if (!arriveTime) {
    for (const stay of stays) {
      if (
        stay.disembarkDate === day.date &&
        stay.cruise.endTime?.trim()
      ) {
        arriveTime = stay.cruise.endTime.trim();
        break;
      }
    }
  }

  for (const stay of stays) {
    if (stay.disembarkDate === day.date || stay.embarkDate === day.date) {
      shipPort = cruiseHomePort(stay.cruise);
      if (shipPort) break;
    }
    // Middle port days: overnight city is usually the ship port.
    if (stay.embarkDate < day.date && day.date < stay.disembarkDate) {
      shipPort = day.city.trim();
      break;
    }
  }

  return {
    city: shipPort || day.city,
    atSea: false,
    arriveTime,
    leaveTime,
  };
}

/** List label for ship arrival, e.g. "Ankomst Genova 09:00" when overnight differs. */
export function formatShipArriveLabel(
  day: TripDay,
  allDays: TripDay[],
): string {
  const ship = resolveShipPortTimes(day, allDays);
  const time = ship.arriveTime?.trim();
  if (!time) return '';
  const port = ship.city.trim();
  const overnight = day.city.trim();
  if (
    port &&
    overnight &&
    port.toLowerCase() !== overnight.toLowerCase()
  ) {
    return `Ankomst ${port} ${time}`;
  }
  return `Ankomst ${time}`;
}

/** List label for ship departure. */
export function formatShipDepartLabel(
  day: TripDay,
  allDays: TripDay[],
): string {
  const ship = resolveShipPortTimes(day, allDays);
  const time = ship.leaveTime?.trim();
  if (!time) return '';
  const port = ship.city.trim();
  const overnight = day.city.trim();
  if (
    port &&
    overnight &&
    port.toLowerCase() !== overnight.toLowerCase()
  ) {
    return `Avgang ${port} ${time}`;
  }
  return `Avgang ${time}`;
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

/** Last day before `date` that has a non-empty city (skips at-sea). */
export function previousDayPlace(
  days: TripDay[],
  date: string,
): { city: string; country: string } | null {
  if (!date) return null;
  const prior = [...days]
    .filter((d) => d.date && d.date < date && !isAtSeaDay(d) && d.city.trim())
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.sortOrder - a.sortOrder;
    });
  const day = prior[0];
  if (!day) return null;
  return { city: day.city.trim(), country: day.country.trim() };
}

/**
 * Where you leave from on `date`: checkout hotel city, else previous day's city.
 */
export function departurePlaceForDay(
  days: TripDay[],
  date: string,
): { city: string; country: string; kind: 'checkout' | 'previous' } | null {
  const checkouts = hotelsCheckingOutOnDay(days, date);
  if (checkouts.length) {
    const hotelDay = checkouts[0].checkInDay;
    const city = hotelDay.city.trim();
    if (city) {
      return {
        city,
        country: hotelDay.country.trim(),
        kind: 'checkout',
      };
    }
  }
  const prev = previousDayPlace(days, date);
  if (!prev) return null;
  return { ...prev, kind: 'previous' };
}

/**
 * Ensure overnight + checkout-morning days exist.
 * Overnight days (before checkout) inherit hotel city; checkout morning is left
 * without a city so the user chooses the arrival / next destination.
 * Example: check-in 02.09 + 2 nights → 03.09 (same city), 04.09 (empty city).
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

  const byDate = indexDaysByDate(existingDays);
  let nextSort =
    existingDays.reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1;

  for (let offset = 1; offset <= maxOffset; offset++) {
    const stayDate = addDaysIso(checkInDay.date, offset);
    const found = byDate.get(stayDate);

    // Stay + checkout morning keep hotel city until the user changes it
    // (e.g. land in Genova, overnight Trieste, checkout still Trieste).
    if (found) {
      if (found.city.trim() === city && found.country.trim() === country) {
        continue;
      }
      // Do not overwrite a deliberately different overnight / onward city.
      if (found.city.trim() && found.city.trim().toLowerCase() !== city.toLowerCase()) {
        continue;
      }
      const { id, createdAt: _c, updatedAt: _u, ...rest } = found;
      await updateDay(id, {
        ...rest,
        city,
        country,
        arriveTime: found.arriveTime || '',
        leaveTime: found.leaveTime || '',
      });
      byDate.set(stayDate, {
        ...found,
        city,
        country,
      });
    } else {
      const created = await createDay({
        ...emptyDay(tripId, stayDate, nextSort),
        city,
        country,
        arriveTime: '',
        leaveTime: '',
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
      // Price belongs on check-in — not repeated on checkout morning.
      return h.endTime?.trim()
        ? `Utsjekk ${name} ${h.endTime}`
        : `Utsjekk ${name}`;
    })
    .join(' · ');
}

/** Hotels currently stayed in (not the check-in day itself). */
export function summarizeStayingHotels(stays: HotelStayRef[]): string {
  if (!stays.length) return '';
  return stays
    .map(({ hotel: h }) => {
      const name = h.title.trim() || 'Hotell';
      // Price only on check-in day — avoid repeating full stay cost every night.
      return `Hotell ${name}`;
    })
    .join(' · ');
}

/** Check-in hotels on this day (destination / «kommende»). */
export function summarizeCheckInHotels(items: DayItem[] | undefined): string {
  const hotels = (items || []).filter((i) => i.type === 'hotel');
  if (!hotels.length) return '';
  return hotels
    .map((h) => {
      const name = h.title.trim() || 'Hotell';
      const time = h.startTime?.trim();
      const price = formatHotelPrice(h);
      const base = time ? `Kommende ${name} ${time}` : `Kommende ${name}`;
      return price ? `${base} · ${price}` : base;
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
  embarkForm?: Pick<
    TripDay,
    'city' | 'country' | 'atSea' | 'date' | 'arriveTime' | 'leaveTime'
  >,
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
    const isEmbark = offset === 0;
    const isDisembark = offset === nights;
    const isEnd = isEmbark || isDisembark;
    const atSea = isAtSeaDay(existing || { city: '', atSea: false });
    let city = existing?.city?.trim() || '';
    let country = existing?.country?.trim() || '';
    let arriveTime = existing?.arriveTime?.trim() || '';
    let leaveTime = existing?.leaveTime?.trim() || '';
    const storedPort = cruisePortTimesOnDate(cruise, date);
    if (!arriveTime && storedPort.arriveTime) {
      arriveTime = storedPort.arriveTime;
    }
    if (!leaveTime && storedPort.leaveTime) {
      leaveTime = storedPort.leaveTime;
    }
    if (atSea) {
      city = AT_SEA_LABEL;
      country = '';
      arriveTime = '';
      leaveTime = '';
    } else if (!city && isEnd && home) {
      city = home;
    }
    // Seed embark/disembark from cruise item times when day has none yet.
    if (!atSea && isEmbark && !leaveTime && cruise.startTime?.trim()) {
      leaveTime = cruise.startTime.trim();
    }
    if (!atSea && isDisembark && !arriveTime && cruise.endTime?.trim()) {
      arriveTime = cruise.endTime.trim();
    }
    patches.push({ date, city, country, atSea, arriveTime, leaveTime });
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

  /** Fallback ship times from cruisePorts + embark/disembark clocks. */
  const timeHints = new Map<string, { arrive: string; leave: string }>();
  for (const cruise of cruises) {
    const nights = cruiseNights(cruise);
    const emb = embarkDay.date;
    const dis = addDaysIso(emb, nights);
    const touch = (date: string, arrive: string, leave: string) => {
      const cur = timeHints.get(date) || { arrive: '', leave: '' };
      if (arrive) cur.arrive = arrive;
      if (leave) cur.leave = leave;
      timeHints.set(date, cur);
    };
    if (cruise.startTime?.trim()) touch(emb, '', cruise.startTime.trim());
    if (cruise.endTime?.trim()) touch(dis, cruise.endTime.trim(), '');
    for (const port of cruise.cruisePorts || []) {
      touch(
        port.date,
        (port.arriveTime || '').trim(),
        (port.leaveTime || '').trim(),
      );
    }
  }

  const byDate = indexDaysByDate(existingDays);
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
    let nextArrive = found?.arriveTime?.trim() || '';
    let nextLeave = found?.leaveTime?.trim() || '';

    const isDisembark = offset === maxOffset;
    if (patch) {
      nextAtSea = patch.atSea;
      nextArrive = patch.atSea ? '' : (patch.arriveTime || '').trim();
      nextLeave = patch.atSea ? '' : (patch.leaveTime || '').trim();
      if (patch.atSea) {
        nextCity = AT_SEA_LABEL;
        nextCountry = '';
      } else if (isDisembark) {
        // Disembark port lives on the cruise (hjemhavn / ankomst).
        // day.city is overnight destination and may be further inland
        // the same day (e.g. ship→Genova, continue to Trieste).
        const existingCity = (found?.city || '').trim();
        if (
          existingCity &&
          existingCity.toLowerCase() !== AT_SEA_LABEL.toLowerCase()
        ) {
          nextCity = existingCity;
          nextCountry = (found?.country || '').trim();
        } else {
          nextCity = patch.city.trim() || home || '';
          nextCountry = patch.country.trim();
        }
      } else {
        nextCity = patch.city.trim();
        nextCountry = patch.country.trim();
        // Embark with empty city — fill home port.
        if (!nextCity && isEnd && home) {
          nextCity = home;
        }
      }
    } else if (isEnd && home) {
      if (!nextAtSea && !nextCity.trim()) {
        nextCity = home;
      }
    }

    if (nextAtSea) {
      nextCity = AT_SEA_LABEL;
      nextCountry = '';
      nextArrive = '';
      nextLeave = '';
    } else {
      // Fill gaps from cruisePorts / embark-disembark clocks on the cruise item.
      const hint = timeHints.get(stayDate);
      if (hint) {
        if (!nextArrive && hint.arrive) nextArrive = hint.arrive;
        if (!nextLeave && hint.leave) nextLeave = hint.leave;
      }
    }

    if (found) {
      const cityChanged = found.city.trim() !== nextCity.trim();
      const countryChanged = found.country.trim() !== nextCountry.trim();
      const atSeaChanged = isAtSeaDay(found) !== nextAtSea;
      const arriveChanged = (found.arriveTime || '').trim() !== nextArrive;
      const leaveChanged = (found.leaveTime || '').trim() !== nextLeave;
      if (
        !cityChanged &&
        !countryChanged &&
        !atSeaChanged &&
        !arriveChanged &&
        !leaveChanged
      ) {
        continue;
      }
      // Without patches: never overwrite an already-set middle port city,
      // but always allow ship-time updates from cruisePorts / clocks.
      if (
        !patch &&
        offset > 0 &&
        offset < maxOffset &&
        !arriveChanged &&
        !leaveChanged
      ) {
        continue;
      }
      if (
        !patch &&
        isEnd &&
        found.city.trim() &&
        !atSeaChanged &&
        !arriveChanged &&
        !leaveChanged
      ) {
        continue;
      }

      const { id, createdAt: _c, updatedAt: _u, ...rest } = found;
      await updateDay(id, {
        ...rest,
        city: nextCity,
        country: nextCountry,
        atSea: nextAtSea,
        arriveTime: nextArrive || '',
        leaveTime: nextLeave || '',
      });
      byDate.set(stayDate, {
        ...found,
        city: nextCity,
        country: nextCountry,
        atSea: nextAtSea,
        arriveTime: nextArrive || '',
        leaveTime: nextLeave || '',
      });
    } else if (offset > 0) {
      const created = await createDay({
        ...emptyDay(tripId, stayDate, nextSort),
        city: nextCity,
        country: nextCountry,
        atSea: nextAtSea,
        arriveTime: nextArrive || '',
        leaveTime: nextLeave || '',
      });
      byDate.set(stayDate, created);
      nextSort += 1;
    } else if (patch) {
      // Embark day missing from existingDays (race) — still apply times via create skip;
      // caller already saved the embark day payload separately.
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
 * Fingerprint of calendar route order — changes when days are reordered or
 * cities/via stops change, so the map can remount and redraw lines.
 */
export function tripMapRouteKey(days: TripDay[]): string {
  return sortTripDays(days)
    .map((d) => {
      const vias = sortViaPointsByArriveTime(d.viaPoints || [])
        .map((p) => p.title.trim())
        .filter(Boolean)
        .join('>');
      const place = isAtSeaDay(d) ? AT_SEA_LABEL : d.city.trim();
      return `${d.id}:${d.date}:${place}:${vias}`;
    })
    .join('|');
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
