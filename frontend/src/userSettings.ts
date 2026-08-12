/** Browser-local user settings (not synced to Firestore yet). */

const HOME_KEY = 'reise.homePlace'
const PLANNER_KEY = 'reise.plannerSettings'

export interface HomePlace {
  city: string
  country: string
  /** Street / full address (optional). */
  address: string
}

/** Which steps appear when adding a stop in the v2 wizard. */
export interface PlannerSettings {
  /** Ask for lodging (can still skip). */
  askStay: boolean
  /** Ask for day notes. */
  askNotes: boolean
  /** Show ! when a stop has no lodging. */
  warnMissingStay: boolean
  /** Show ! when the via-path from start to goal is incomplete. */
  warnMissingTravel: boolean
  /**
   * When true, each via-hop needs a transport mode (bus/train/…).
   * When false, you can sketch the main place line without modes.
   */
  requireTransportMode: boolean
}

export function emptyHomePlace(): HomePlace {
  return { city: '', country: '', address: '' }
}

export function defaultPlannerSettings(): PlannerSettings {
  return {
    askStay: true,
    askNotes: true,
    warnMissingStay: true,
    warnMissingTravel: true,
    requireTransportMode: true,
  }
}

export function loadHomePlace(): HomePlace {
  try {
    const raw = localStorage.getItem(HOME_KEY)
    if (!raw) return emptyHomePlace()
    const parsed = JSON.parse(raw) as Partial<HomePlace>
    return {
      city: (parsed.city || '').trim(),
      country: (parsed.country || '').trim(),
      address: (parsed.address || '').trim(),
    }
  } catch {
    return emptyHomePlace()
  }
}

export function saveHomePlace(place: HomePlace): HomePlace {
  const next: HomePlace = {
    city: place.city.trim(),
    country: place.country.trim(),
    address: place.address.trim(),
  }
  localStorage.setItem(HOME_KEY, JSON.stringify(next))
  return next
}

export function hasHomePlace(place?: HomePlace | null): boolean {
  return !!(place ?? loadHomePlace()).city.trim()
}

export function formatHomePlace(place: HomePlace): string {
  const cityCountry = [place.city.trim(), place.country.trim()]
    .filter(Boolean)
    .join(', ')
  if (place.address.trim() && cityCountry) {
    return `${place.address.trim()}, ${cityCountry}`
  }
  return place.address.trim() || cityCountry
}

export function loadPlannerSettings(): PlannerSettings {
  try {
    const raw = localStorage.getItem(PLANNER_KEY)
    if (!raw) return defaultPlannerSettings()
    const parsed = JSON.parse(raw) as Partial<PlannerSettings> & {
      askTravel?: boolean
    }
    const { askTravel: _ignored, ...rest } = parsed
    return { ...defaultPlannerSettings(), ...rest }
  } catch {
    return defaultPlannerSettings()
  }
}

export function savePlannerSettings(settings: PlannerSettings): PlannerSettings {
  const next = { ...defaultPlannerSettings(), ...settings }
  localStorage.setItem(PLANNER_KEY, JSON.stringify(next))
  return next
}
