/** Browser-local user settings (not synced to Firestore yet). */

const HOME_KEY = 'reise.homePlace'
const PLANNER_KEY = 'reise.plannerSettings'
const THEME_KEY = 'reise.theme'

export const THEME_IDS = [
  'skog',
  'kyst',
  'sand',
  'lavendel',
  'stein',
  'skog-lys',
  'kyst-lys',
  'sand-lys',
  'lavendel-lys',
  'stein-lys',
] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type ThemeTone = 'dark' | 'light'

export const THEMES: {
  id: ThemeId
  name: string
  blurb: string
  tone: ThemeTone
  swatch: [string, string, string]
}[] = [
  {
    id: 'skog',
    name: 'Skog',
    blurb: 'Dyp mose og stille mint',
    tone: 'dark',
    swatch: ['#162422', '#3dbea5', '#e8f4f2'],
  },
  {
    id: 'kyst',
    name: 'Kyst',
    blurb: 'Nattblått og sjøglass',
    tone: 'dark',
    swatch: ['#1a222c', '#7aa8b8', '#e6eef2'],
  },
  {
    id: 'sand',
    name: 'Sand',
    blurb: 'Varm kveld og dempet gull',
    tone: 'dark',
    swatch: ['#24201a', '#c4a574', '#f3ebe0'],
  },
  {
    id: 'lavendel',
    name: 'Lavendel',
    blurb: 'Dusk og støvet lilla',
    tone: 'dark',
    swatch: ['#1e1c26', '#a89bb8', '#eee8f2'],
  },
  {
    id: 'stein',
    name: 'Stein',
    blurb: 'Grafitt og varm stein',
    tone: 'dark',
    swatch: ['#1c1c1c', '#b8b0a4', '#eceae6'],
  },
  {
    id: 'skog-lys',
    name: 'Skog lys',
    blurb: 'Dugg og blek mose',
    tone: 'light',
    swatch: ['#d4ddd8', '#3d7a6c', '#2a3834'],
  },
  {
    id: 'kyst-lys',
    name: 'Kyst lys',
    blurb: 'Dis og sjøglass',
    tone: 'light',
    swatch: ['#d2dbe1', '#547888', '#2a343c'],
  },
  {
    id: 'sand-lys',
    name: 'Sand lys',
    blurb: 'Lin og varmt papir',
    tone: 'light',
    swatch: ['#e2d6c6', '#8a7048', '#3a3228'],
  },
  {
    id: 'lavendel-lys',
    name: 'Lavendel lys',
    blurb: 'Tåke og støvet lilla',
    tone: 'light',
    swatch: ['#dcd6e2', '#6e6480', '#322e38'],
  },
  {
    id: 'stein-lys',
    name: 'Stein lys',
    blurb: 'Porselen og kalk',
    tone: 'light',
    swatch: ['#d8d4ce', '#6e6a60', '#2e2c28'],
  },
]

export function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId)
}

export function loadTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (isThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'skog'
}

export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = id
}

export function saveTheme(id: ThemeId): ThemeId {
  const next = isThemeId(id) ? id : 'skog'
  localStorage.setItem(THEME_KEY, next)
  applyTheme(next)
  return next
}

applyTheme(loadTheme())

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

/** Copy city / country / street from the settings register onto a home stop. */
export function applyRegisteredHome<
  T extends { city?: string; country?: string; address?: string },
>(target: T, home: HomePlace): T {
  return {
    ...target,
    city: home.city.trim() || target.city || '',
    country: home.country.trim() || target.country || '',
    address: home.address.trim(),
  }
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
