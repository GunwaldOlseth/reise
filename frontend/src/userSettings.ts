/** Browser-local user settings (not synced to Firestore yet). */

const HOME_KEY = 'reise.homePlace'
const PLANNER_KEY = 'reise.plannerSettings'
const THEME_KEY = 'reise.theme'
const LINKS_KEY = 'reise.usefulLinks'
const ALERTS_KEY = 'reise.timeAlerts'

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
  'nordlys',
  'solglod',
  'neonrosa',
  'elektrisk',
  'polarnatt',
  'plasma',
  'nordlys-lys',
  'sepia',
  'blekk',
  'pergament',
  'kobber',
  'bibliotek',
  'bordeaux',
] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type ThemeTone = 'dark' | 'light'
export type ThemeGroup = 'nature' | 'vibrant' | 'vintage'

export const THEME_GROUPS: { id: ThemeGroup; label: string }[] = [
  { id: 'nature', label: 'Natur' },
  { id: 'vibrant', label: 'Sprek farger' },
  { id: 'vintage', label: 'Gammeldags' },
]

export const THEMES: {
  id: ThemeId
  name: string
  blurb: string
  tone: ThemeTone
  group: ThemeGroup
  swatch: [string, string, string]
}[] = [
  {
    id: 'skog',
    name: 'Skog',
    blurb: 'Dyp mose og stille mint',
    tone: 'dark',
    group: 'nature',
    swatch: ['#395a55', '#47c4ac', '#d2e6e3'],
  },
  {
    id: 'kyst',
    name: 'Kyst',
    blurb: 'Nattblått og sjøglass',
    tone: 'dark',
    group: 'nature',
    swatch: ['#3d4e62', '#669bad', '#d1dde4'],
  },
  {
    id: 'sand',
    name: 'Sand',
    blurb: 'Varm kveld og dempet gull',
    tone: 'dark',
    group: 'nature',
    swatch: ['#574d40', '#bb975f', '#e6dac9'],
  },
  {
    id: 'lavendel',
    name: 'Lavendel',
    blurb: 'Dusk og støvet lilla',
    tone: 'dark',
    group: 'nature',
    swatch: ['#474359', '#977eb6', '#ddd3e3'],
  },
  {
    id: 'stein',
    name: 'Stein',
    blurb: 'Grafitt og varm stein',
    tone: 'dark',
    group: 'nature',
    swatch: ['#494949', '#b9a483', '#dcd9d3'],
  },
  {
    id: 'skog-lys',
    name: 'Skog lys',
    blurb: 'Dugg og blek mose',
    tone: 'light',
    group: 'nature',
    swatch: ['#bac9c1', '#316c5f', '#3a4b46'],
  },
  {
    id: 'kyst-lys',
    name: 'Kyst lys',
    blurb: 'Dis og sjøglass',
    tone: 'light',
    group: 'nature',
    swatch: ['#b6c5cf', '#466c7c', '#3a4650'],
  },
  {
    id: 'sand-lys',
    name: 'Sand lys',
    blurb: 'Lin og varmt papir',
    tone: 'light',
    group: 'nature',
    swatch: ['#d4c0a6', '#7d633c', '#4e4438'],
  },
  {
    id: 'lavendel-lys',
    name: 'Lavendel lys',
    blurb: 'Tåke og støvet lilla',
    tone: 'light',
    group: 'nature',
    swatch: ['#c5bbd0', '#5f4f7c', '#443f4b'],
  },
  {
    id: 'stein-lys',
    name: 'Stein lys',
    blurb: 'Porselen og kalk',
    tone: 'light',
    group: 'nature',
    swatch: ['#c4beb4', '#6e6346', '#413e39'],
  },
  {
    id: 'nordlys',
    name: 'Nordlys',
    blurb: 'Elektrisk cyan og midnattslilla',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#26315f', '#51decf', '#b090e0'],
  },
  {
    id: 'solglod',
    name: 'Solglød',
    blurb: 'Het korall og solnedgang',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#5c2c1f', '#e87d41', '#f9d9c7'],
  },
  {
    id: 'neonrosa',
    name: 'Neonrosa',
    blurb: 'Magenta neon og nattby',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#5a205a', '#ea53b6', '#f9c7ea'],
  },
  {
    id: 'elektrisk',
    name: 'Elektrisk',
    blurb: 'Lime og neongrønt lys',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#24592b', '#6de841', '#c7f9c7'],
  },
  {
    id: 'polarnatt',
    name: 'Polarnatt',
    blurb: 'Isblått og elektrisk blå',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#142362', '#4198e8', '#c7e1f9'],
  },
  {
    id: 'plasma',
    name: 'Plasma',
    blurb: 'Fiolett glød og rosa puls',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#4b205a', '#a353ea', '#e1c7f9'],
  },
  {
    id: 'nordlys-lys',
    name: 'Nordlys lys',
    blurb: 'Polarsol og isblå dis',
    tone: 'light',
    group: 'vibrant',
    swatch: ['#b8d1ea', '#247b74', '#282d50'],
  },
  {
    id: 'sepia',
    name: 'Sepia',
    blurb: 'Gammelt foto og varm brun',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#624f39', '#bb925a', '#e3cfb1'],
  },
  {
    id: 'blekk',
    name: 'Blekk',
    blurb: 'Blått blekk og pergament',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#3e475d', '#7594be', '#d8d3c4'],
  },
  {
    id: 'pergament',
    name: 'Pergament',
    blurb: 'Gulnede sider og voks',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#675a38', '#bda66b', '#e3d8b9'],
  },
  {
    id: 'kobber',
    name: 'Kobber',
    blurb: 'Patinert kobber og malakitt',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#594b3c', '#69ab7c', '#ddd3c3'],
  },
  {
    id: 'bibliotek',
    name: 'Bibliotek',
    blurb: 'Mørkt tre og grønn lampe',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#385338', '#5a9a57', '#d8d3c4'],
  },
  {
    id: 'bordeaux',
    name: 'Bordeaux',
    blurb: 'Vinkjeller og dyp rød',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#57303b', '#af5868', '#e2ccc6'],
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
  /** Lines shown in note preview before «les mer» (klikk utvider). */
  notePreviewLines: number
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
    notePreviewLines: 12,
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
    const merged = { ...defaultPlannerSettings(), ...rest }
    merged.notePreviewLines = Math.min(
      30,
      Math.max(3, Math.round(Number(merged.notePreviewLines) || 12)),
    )
    return merged
  } catch {
    return defaultPlannerSettings()
  }
}

export function savePlannerSettings(settings: PlannerSettings): PlannerSettings {
  const next = {
    ...defaultPlannerSettings(),
    ...settings,
    notePreviewLines: Math.min(
      30,
      Math.max(3, Math.round(Number(settings.notePreviewLines) || 12)),
    ),
  }
  localStorage.setItem(PLANNER_KEY, JSON.stringify(next))
  return next
}

export interface UsefulLink {
  id: string
  title: string
  url: string
}

export function normalizeUsefulUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return ''
  return `https://${trimmed}`
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function usefulLinkHref(link: Pick<UsefulLink, 'url'>): string {
  return normalizeUsefulUrl(link.url)
}

export function usefulLinkTitle(link: Pick<UsefulLink, 'title' | 'url'>): string {
  const titled = (link.title || '').trim()
  if (titled) return titled
  const href = usefulLinkHref(link)
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return (link.url || '').trim() || 'Lenke'
  }
}

export function usefulLinkHost(link: Pick<UsefulLink, 'url'>): string {
  try {
    return new URL(usefulLinkHref(link)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function readUsefulLink(raw: unknown): UsefulLink | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<UsefulLink>
  const title = String(item.title || '')
  const url = String(item.url || '')
  if (!title.trim() && !url.trim()) return null
  return {
    id: String(item.id || '').trim() || crypto.randomUUID(),
    title,
    url,
  }
}

export function loadUsefulLinks(): UsefulLink[] {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const out: UsefulLink[] = []
    for (const item of parsed) {
      const link = readUsefulLink(item)
      if (!link || seen.has(link.id)) continue
      seen.add(link.id)
      out.push(link)
    }
    return out
  } catch {
    return []
  }
}

export function saveUsefulLinks(links: UsefulLink[]): UsefulLink[] {
  const next: UsefulLink[] = []
  const seen = new Set<string>()
  for (const item of links) {
    const link = readUsefulLink(item)
    if (!link || seen.has(link.id)) continue
    seen.add(link.id)
    next.push(link)
  }
  localStorage.setItem(LINKS_KEY, JSON.stringify(next))
  return next
}

export function usableUsefulLinks(list?: UsefulLink[]): UsefulLink[] {
  return (list ?? loadUsefulLinks()).filter((link) =>
    isSafeHttpUrl(usefulLinkHref(link)),
  )
}

export interface TimeAlertSettings {
  /** Minutes before transport departure or arrival. 0 = off. */
  travelMinutes: number
  /** Minutes before cruise port departure. 0 = off. */
  cruiseMinutes: number
}

export function defaultTimeAlertSettings(): TimeAlertSettings {
  return { travelMinutes: 30, cruiseMinutes: 60 }
}

export function clampAlertMinutes(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(12 * 60, n)
}

export function loadTimeAlertSettings(): TimeAlertSettings {
  const fallback = defaultTimeAlertSettings()
  try {
    const raw = localStorage.getItem(ALERTS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<TimeAlertSettings>
    return {
      travelMinutes: clampAlertMinutes(
        parsed.travelMinutes ?? fallback.travelMinutes,
      ),
      cruiseMinutes: clampAlertMinutes(
        parsed.cruiseMinutes ?? fallback.cruiseMinutes,
      ),
    }
  } catch {
    return fallback
  }
}

export function saveTimeAlertSettings(
  settings: TimeAlertSettings,
): TimeAlertSettings {
  const next: TimeAlertSettings = {
    travelMinutes: clampAlertMinutes(settings.travelMinutes),
    cruiseMinutes: clampAlertMinutes(settings.cruiseMinutes),
  }
  localStorage.setItem(ALERTS_KEY, JSON.stringify(next))
  return next
}

