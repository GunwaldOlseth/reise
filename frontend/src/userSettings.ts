/** Browser-local user settings (not synced to Firestore yet). */

const HOME_KEY = 'reise.homePlace'
const PLANNER_KEY = 'reise.plannerSettings'
const THEME_KEY = 'reise.theme'
const LINKS_KEY = 'reise.usefulLinks'
const ALERTS_KEY = 'reise.timeAlerts'
const TRANSPORT_SORT_KEY = 'reise.transportOptionSort'

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
    swatch: ['#162422', '#3dbea5', '#e8f4f2'],
  },
  {
    id: 'kyst',
    name: 'Kyst',
    blurb: 'Nattblått og sjøglass',
    tone: 'dark',
    group: 'nature',
    swatch: ['#1a222c', '#7aa8b8', '#e6eef2'],
  },
  {
    id: 'sand',
    name: 'Sand',
    blurb: 'Varm kveld og dempet gull',
    tone: 'dark',
    group: 'nature',
    swatch: ['#24201a', '#c4a574', '#f3ebe0'],
  },
  {
    id: 'lavendel',
    name: 'Lavendel',
    blurb: 'Dusk og støvet lilla',
    tone: 'dark',
    group: 'nature',
    swatch: ['#1e1c26', '#a89bb8', '#eee8f2'],
  },
  {
    id: 'stein',
    name: 'Stein',
    blurb: 'Grafitt og varm stein',
    tone: 'dark',
    group: 'nature',
    swatch: ['#1c1c1c', '#b8b0a4', '#eceae6'],
  },
  {
    id: 'skog-lys',
    name: 'Skog lys',
    blurb: 'Dugg og blek mose',
    tone: 'light',
    group: 'nature',
    swatch: ['#d4ddd8', '#3d7a6c', '#2a3834'],
  },
  {
    id: 'kyst-lys',
    name: 'Kyst lys',
    blurb: 'Dis og sjøglass',
    tone: 'light',
    group: 'nature',
    swatch: ['#d2dbe1', '#547888', '#2a343c'],
  },
  {
    id: 'sand-lys',
    name: 'Sand lys',
    blurb: 'Lin og varmt papir',
    tone: 'light',
    group: 'nature',
    swatch: ['#e2d6c6', '#8a7048', '#3a3228'],
  },
  {
    id: 'lavendel-lys',
    name: 'Lavendel lys',
    blurb: 'Tåke og støvet lilla',
    tone: 'light',
    group: 'nature',
    swatch: ['#dcd6e2', '#6e6480', '#322e38'],
  },
  {
    id: 'stein-lys',
    name: 'Stein lys',
    blurb: 'Porselen og kalk',
    tone: 'light',
    group: 'nature',
    swatch: ['#d8d4ce', '#6e6a60', '#2e2c28'],
  },
  {
    id: 'nordlys',
    name: 'Nordlys',
    blurb: 'Elektrisk cyan og midnattslilla',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#0c1020', '#5ef0e0', '#c478ff'],
  },
  {
    id: 'solglod',
    name: 'Solglød',
    blurb: 'Het korall og solnedgang',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#1a0c08', '#ff8a48', '#ffd060'],
  },
  {
    id: 'neonrosa',
    name: 'Neonrosa',
    blurb: 'Magenta neon og nattby',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#180818', '#ff5ec8', '#ffa0e8'],
  },
  {
    id: 'elektrisk',
    name: 'Elektrisk',
    blurb: 'Lime og neongrønt lys',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#0a1a0c', '#78ff48', '#c8ff80'],
  },
  {
    id: 'polarnatt',
    name: 'Polarnatt',
    blurb: 'Isblått og elektrisk blå',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#040818', '#48a8ff', '#80d0ff'],
  },
  {
    id: 'plasma',
    name: 'Plasma',
    blurb: 'Fiolett glød og rosa puls',
    tone: 'dark',
    group: 'vibrant',
    swatch: ['#140818', '#b868ff', '#ff68c8'],
  },
  {
    id: 'nordlys-lys',
    name: 'Nordlys lys',
    blurb: 'Polarsol og isblå dis',
    tone: 'light',
    group: 'vibrant',
    swatch: ['#dce8f4', '#1a9e94', '#2a2858'],
  },
  {
    id: 'sepia',
    name: 'Sepia',
    blurb: 'Gammelt foto og varm brun',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#2a2218', '#c4a070', '#f0e0c8'],
  },
  {
    id: 'blekk',
    name: 'Blekk',
    blurb: 'Blått blekk og pergament',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#1a1e28', '#8aa4c8', '#e8e4d8'],
  },
  {
    id: 'pergament',
    name: 'Pergament',
    blurb: 'Gulnede sider og voks',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#2e2818', '#b8a060', '#f0e8d0'],
  },
  {
    id: 'kobber',
    name: 'Kobber',
    blurb: 'Patinert kobber og malakitt',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#241e18', '#6a9a78', '#c89060'],
  },
  {
    id: 'bibliotek',
    name: 'Bibliotek',
    blurb: 'Mørkt tre og grønn lampe',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#141e14', '#5a8a58', '#d8c8a0'],
  },
  {
    id: 'bordeaux',
    name: 'Bordeaux',
    blurb: 'Vinkjeller og dyp rød',
    tone: 'dark',
    group: 'vintage',
    swatch: ['#1e1014', '#a85060', '#e8c8c0'],
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

export const TRANSPORT_OPTION_SORTS = ['depart', 'arrive', 'duration'] as const
export type TransportOptionSort = (typeof TRANSPORT_OPTION_SORTS)[number]

export function isTransportOptionSort(
  value: unknown,
): value is TransportOptionSort {
  return TRANSPORT_OPTION_SORTS.includes(value as TransportOptionSort)
}

export function loadTransportOptionSort(): TransportOptionSort {
  try {
    const raw = localStorage.getItem(TRANSPORT_SORT_KEY)
    if (isTransportOptionSort(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'depart'
}

export function saveTransportOptionSort(
  by: TransportOptionSort,
): TransportOptionSort {
  const next = isTransportOptionSort(by) ? by : 'depart'
  localStorage.setItem(TRANSPORT_SORT_KEY, next)
  return next
}
