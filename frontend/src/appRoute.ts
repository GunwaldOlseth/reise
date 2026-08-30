/** Hash routes so refresh stays on the same screen (works on static Cloud Run). */

export type AppTripTab =
  | 'plan'
  | 'live'
  | 'log'
  | 'overview'
  | 'map'
  | 'weather'
  | 'expenses'

export type AppView =
  | { name: 'home' }
  | { name: 'settings'; returnTo?: AppView }
  | { name: 'admin'; returnTo?: AppView }
  | { name: 'appearance'; returnTo?: AppView }
  | { name: 'links'; returnTo?: AppView }
  | {
      name: 'trip'
      tripId: string
      autoOnward?: boolean
      tab?: AppTripTab
    }

const TRIP_TABS: AppTripTab[] = [
  'plan',
  'live',
  'log',
  'overview',
  'map',
  'weather',
  'expenses',
]

const PAGES = ['settings', 'admin', 'appearance', 'links'] as const

function isTripTab(value: string | undefined): value is AppTripTab {
  return !!value && (TRIP_TABS as string[]).includes(value)
}

function isPage(
  value: string | undefined,
): value is (typeof PAGES)[number] {
  return !!value && (PAGES as readonly string[]).includes(value)
}

function normalizeHash(hash: string): string {
  const raw = (hash || '').replace(/^#/, '')
  const path = raw.split('?')[0] || '/'
  const trimmed = path.replace(/\/+$/, '') || '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function parseTripParts(parts: string[]): AppView | null {
  if (parts[0] !== 't' || !parts[1]) return null
  const tripId = decodeURIComponent(parts[1])
  if (!tripId) return null
  const tab = isTripTab(parts[2]) ? parts[2] : 'plan'
  return { name: 'trip', tripId, tab }
}

/** Share itinerary hashes are owned by `readShareToken`, not app screens. */
export function isShareHash(hash: string): boolean {
  return /^#\/d\/[A-Za-z0-9_-]+$/.test(hash || '')
}

/** Parse location.hash. Share links `#/d/…` are handled separately. */
export function parseAppHash(hash: string): AppView {
  if (isShareHash(hash.startsWith('#') ? hash : `#${hash}`)) {
    return { name: 'home' }
  }
  const path = normalizeHash(hash)
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'd') return { name: 'home' }

  const trip = parseTripParts(parts)
  if (trip) return trip

  if (isPage(parts[0])) {
    const returnTo = parseTripParts(parts.slice(1)) || { name: 'home' as const }
    return { name: parts[0], returnTo }
  }

  return { name: 'home' }
}

function tripHash(tripId: string, tab?: AppTripTab): string {
  return `#/t/${encodeURIComponent(tripId)}/${tab || 'plan'}`
}

export function viewToHash(view: AppView): string {
  switch (view.name) {
    case 'home':
      return '#/'
    case 'trip':
      return tripHash(view.tripId, view.tab || 'plan')
    case 'settings':
    case 'admin':
    case 'appearance':
    case 'links': {
      const back = view.returnTo
      if (back?.name === 'trip' && back.tripId) {
        return `#/${view.name}/t/${encodeURIComponent(back.tripId)}/${
          back.tab || 'plan'
        }`
      }
      return `#/${view.name}`
    }
    default:
      return '#/'
  }
}

export function hashesEqual(a: string, b: string): boolean {
  return normalizeHash(a) === normalizeHash(b)
}

/** Keep trip flags that are not stored in the hash (e.g. autoOnward). */
export function mergeAppView(prev: AppView, next: AppView): AppView {
  if (
    prev.name === 'trip' &&
    next.name === 'trip' &&
    prev.tripId === next.tripId
  ) {
    return {
      ...next,
      tab: next.tab || 'plan',
      autoOnward: next.autoOnward ?? prev.autoOnward,
    }
  }
  return next
}

export function sameAppRoute(a: AppView, b: AppView): boolean {
  return hashesEqual(viewToHash(a), viewToHash(b))
}
