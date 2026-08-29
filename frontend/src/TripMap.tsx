import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  api,
  AT_SEA_LABEL,
  tripMapRouteKey,
  tripMapStopsInOrder,
  type PlaceSuggestion,
  type TripDay,
  type TripMapStop,
} from './api'
import { uploadKmlToDrive, useGoogleAuth } from './googleAuth'
import {
  buildTripMapKml,
  downloadTripMapKml,
  GOOGLE_MY_MAPS_CREATE_URL,
  googleMapsPlaceUrl,
} from './googleMaps'
import { localizeCity, localizeCountry } from './placeNames'
import { formatDateNO, formatDurationHM, samePlaceName } from './v2/journeyModel'

const MAP_TIME_KEY = 'reise.mapShowTravelTime'

function loadShowTravelTime(): boolean {
  try {
    return localStorage.getItem(MAP_TIME_KEY) === '1'
  } catch {
    return false
  }
}

function saveShowTravelTime(on: boolean) {
  try {
    localStorage.setItem(MAP_TIME_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function durationMarkerIcon(text: string) {
  return L.divIcon({
    className: 'trip-map-duration-wrap',
    html: `<span class="trip-map-duration">${escapeHtml(text)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function midLatLng(
  a: L.LatLngExpression,
  b: L.LatLngExpression,
): L.LatLngExpression {
  const [alat, alng] = a as [number, number]
  const [blat, blng] = b as [number, number]
  return [(alat + blat) / 2, (alng + blng) / 2]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markerIcon(kind: TripMapStop['kind'], label: string) {
  if (kind === 'sea') {
    return L.divIcon({
      className: 'trip-map-marker is-sea',
      html: '<span class="trip-map-marker-num is-sea">~</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
  }
  if (kind === 'via') {
    return L.divIcon({
      className: 'trip-map-marker is-via',
      html: `<span class="trip-map-marker-num is-via">${escapeHtml(label)}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
  }
  return L.divIcon({
    className: 'trip-map-marker',
    html: `<span class="trip-map-marker-num">${escapeHtml(label)}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  italia: ['italia', 'italy', 'italien'],
  italy: ['italia', 'italy', 'italien'],
  spania: ['spania', 'spain', 'spanien', 'españa'],
  spain: ['spania', 'spain', 'spanien', 'españa'],
  frankrike: ['frankrike', 'france', 'frankreich'],
  france: ['frankrike', 'france', 'frankreich'],
  norge: ['norge', 'norway', 'norwegen'],
  norway: ['norge', 'norway', 'norwegen'],
}

function countriesMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const ax = COUNTRY_ALIASES[x] || [x]
  const ay = COUNTRY_ALIASES[y] || [y]
  return ax.some((v) => ay.includes(v))
}

/** Prefer major city / same country — avoids tiny namesakes scrambling the route. */
function pickBestPlace(
  places: PlaceSuggestion[],
  query: string,
  country: string,
): PlaceSuggestion | undefined {
  if (!places.length) return undefined
  const q = query.trim().toLowerCase()
  let best = places[0]
  let bestScore = -1
  for (const p of places) {
    let score = p.population || 0
    if (p.name.trim().toLowerCase() === q) score += 2_000_000
    else if (p.name.trim().toLowerCase().startsWith(q)) score += 400_000
    else if (q && p.name.trim().toLowerCase().includes(q.split(/\s+\d/)[0] || q))
      score += 200_000
    if (country && countriesMatch(country, p.country)) score += 1_500_000
    const fc = (p.featureCode || '').toUpperCase()
    if (fc === 'ADDR') score += 3_000_000
    else if (fc === 'PPLC') score += 5_000_000
    else if (fc === 'PPLA') score += 1_000_000
    else if (fc === 'PPLA2' || fc === 'PPLA3') score += 200_000
    else if (fc === 'AIRP' || fc === 'AIRH') score += 800_000
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return best
}

function clusterIcon(count: number) {
  return L.divIcon({
    className: 'trip-map-marker is-cluster',
    html: `<span class="trip-map-marker-cluster" aria-label="${count} stopp samme sted"><span class="trip-map-marker-star">★</span><span class="trip-map-marker-count">${count}</span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

/** ~100 m grid — same city/airport visits stack into one marker. */
function coordBucket(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

function groupStopsByCoord(stops: ResolvedStop[]): ResolvedStop[][] {
  const buckets = new Map<string, ResolvedStop[]>()
  const order: string[] = []
  for (const stop of stops) {
    if (!stop.place) continue
    const key = coordBucket(stop.place.latitude, stop.place.longitude)
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(stop)
  }
  return order.map((key) => buckets.get(key)!)
}

function stopPopupLine(stop: ResolvedStop): string {
  const place = stop.place
  const name = escapeHtml(
    stop.kind === 'sea'
      ? AT_SEA_LABEL
      : localizeCity(stop.city) || localizeCity(place?.name) || 'Stopp',
  )
  const num =
    stop.kind === 'sea' ? '~' : String(stop.markerLabel ?? '')
  const bits = [
    stop.kind === 'via' ? 'Reise' : null,
    stop.kind === 'sea'
      ? localizeCity(place?.admin1) || null
      : localizeCountry(stop.country) ||
        localizeCountry(place?.country) ||
        null,
    formatDateNO(stop.date),
    formatMapTime(stop.timeKey) || null,
  ].filter(Boolean)
  return `<div class="trip-map-stack-row"><span class="trip-map-stack-num">${num}</span><span><strong>${name}</strong>${
    bits.length ? ` · ${escapeHtml(bits.join(' · '))}` : ''
  }</span></div>`
}

function mapsLinkHtml(lat: number, lng: number, label: string): string {
  const href = googleMapsPlaceUrl({ lat, lng, query: label })
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Åpne i Google Maps</a>`
}

function stackPopupHtml(group: ResolvedStop[]): string {
  if (group.length === 1) {
    const stop = group[0]
    const place = stop.place!
    const maps = mapsLinkHtml(
      place.latitude,
      place.longitude,
      stop.kind === 'sea'
        ? AT_SEA_LABEL
        : localizeCity(stop.city) || localizeCity(place.name),
    )
    if (stop.kind === 'sea') {
      return `<strong>${AT_SEA_LABEL}</strong><br/>${escapeHtml(
        place.admin1 || 'Mellom havner',
      )}<br/><span class="meta">${formatDateNO(stop.date)}</span><br/>${maps}`
    }
    if (stop.kind === 'via') {
      return `<strong>${escapeHtml(localizeCity(place.name))}</strong><br/>Via · ${formatDateNO(
        stop.date,
      )}${
        place.country || stop.country
          ? `<br/>${escapeHtml(localizeCountry(place.country || stop.country))}`
          : ''
      }<br/>${maps}`
    }
    return `<strong>${escapeHtml(localizeCity(place.name))}</strong><br/>${escapeHtml(
      [localizeCity(place.admin1), localizeCountry(place.country)]
        .filter(Boolean)
        .join(', '),
    )}<br/><span class="meta">Første dag: ${formatDateNO(stop.date)}</span><br/>${maps}`
  }

  const place = group[0].place!
  const placeName = escapeHtml(
    localizeCity(place?.name) || localizeCity(group[0].city) || 'Sted',
  )
  const maps = mapsLinkHtml(
    place.latitude,
    place.longitude,
    group[0].city || place.name,
  )
  return `<div class="trip-map-stack-popup"><strong>${placeName}</strong><div class="meta">${group.length} stopp samme sted</div>${group
    .map(stopPopupLine)
    .join('')}<div style="margin-top:0.35rem">${maps}</div></div>`
}

function formatMapTime(timeKey?: number): string {
  if (
    timeKey == null ||
    !Number.isFinite(timeKey) ||
    timeKey === Number.POSITIVE_INFINITY
  ) {
    return ''
  }
  const h = Math.floor(timeKey / 3600)
  const m = Math.floor((timeKey % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function midpointPlace(
  a: PlaceSuggestion,
  b: PlaceSuggestion,
  label: string,
): PlaceSuggestion {
  return {
    name: label,
    country: '',
    admin1: [a.name, b.name].filter(Boolean).join(' → '),
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  }
}

type ResolvedStop = TripMapStop & {
  place?: PlaceSuggestion
  error?: string
  /** Main city/sea: "1"; vias under that city: "1a", "1b". */
  markerLabel?: string
}

/** Survives tab remounts so Kart does not re-geocode the same cities. */
const placeGeocodeCache = new Map<string, PlaceSuggestion | null>()

function storedPlaceOf(stop: TripMapStop): PlaceSuggestion | null {
  if (
    typeof stop.latitude === 'number' &&
    typeof stop.longitude === 'number' &&
    Number.isFinite(stop.latitude) &&
    Number.isFinite(stop.longitude) &&
    !(stop.latitude === 0 && stop.longitude === 0)
  ) {
    return {
      name: stop.city,
      country: stop.country || '',
      latitude: stop.latitude,
      longitude: stop.longitude,
    }
  }
  return null
}

function placeCacheKey(stop: TripMapStop): string {
  return `${stop.kind}|${stop.city}|${stop.country}|${stop.contextCity || ''}`.toLowerCase()
}

async function geocodeMapStop(
  stop: TripMapStop,
): Promise<PlaceSuggestion | null> {
  const looksStreet = /\d|gate|gata|gaten|vei|street|strada/i.test(stop.city)
  // Streets/airports: search without day-country first (Bergen-gate
  // on an Italia-day must not be forced into Italy / Rapallo).
  let places = (
    await api.searchPlaces(
      stop.city,
      stop.kind === 'via' && looksStreet ? '' : stop.country,
    )
  ).places
  let picked = pickBestPlace(
    places,
    stop.city,
    looksStreet ? '' : stop.country,
  )
  if (!picked && stop.kind === 'via' && stop.country) {
    places = (await api.searchPlaces(stop.city, stop.country)).places
    picked = pickBestPlace(places, stop.city, stop.country)
  }
  if (
    !picked &&
    stop.kind === 'via' &&
    stop.contextCity &&
    stop.contextCity.toLowerCase() !== stop.city.toLowerCase()
  ) {
    places = (
      await api.searchPlaces(`${stop.city}, ${stop.contextCity}`, '')
    ).places
    picked = pickBestPlace(places, stop.city, '')
  }
  if (!picked && stop.kind === 'via' && !looksStreet) {
    places = (await api.searchPlaces(stop.city, '')).places
    picked = pickBestPlace(places, stop.city, '')
  }
  if (!picked && stop.kind === 'port') {
    places = (await api.searchPlaces(stop.city, '')).places
    picked = pickBestPlace(places, stop.city, '')
  }
  return picked || null
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const i = next
      next += 1
      await worker(items[i])
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: n }, () => run()))
}

/** Fill sea midpoints + marker labels (1, 1a, 1b…). */
function finalizeResolvedStops(geocoded: ResolvedStop[]): ResolvedStop[] {
  let portSeq = 0
  const next: ResolvedStop[] = geocoded.map((stop, idx) => {
    if (stop.kind === 'sea') {
      let prev: PlaceSuggestion | undefined
      for (let i = idx - 1; i >= 0; i--) {
        if (geocoded[i].place && geocoded[i].kind !== 'sea') {
          prev = geocoded[i].place
          break
        }
      }
      let after: PlaceSuggestion | undefined
      for (let i = idx + 1; i < geocoded.length; i++) {
        if (geocoded[i].place && geocoded[i].kind !== 'sea') {
          after = geocoded[i].place
          break
        }
      }
      if (!prev || !after) {
        return {
          ...stop,
          error: 'Mangler by før/etter for midtpunkt',
        }
      }
      return {
        ...stop,
        place: midpointPlace(prev, after, AT_SEA_LABEL),
        markerLabel: '~',
      }
    }
    return stop
  })

  let i = 0
  while (i < next.length) {
    if (next[i].kind === 'sea') {
      i += 1
      continue
    }
    if (next[i].kind === 'port') {
      portSeq += 1
      next[i] = { ...next[i], markerLabel: String(portSeq) }
      i += 1
      continue
    }
    const viaStart = i
    while (i < next.length && next[i].kind === 'via') i += 1
    const viaEnd = i
    let portIdx = -1
    if (
      i < next.length &&
      next[i].kind === 'port' &&
      next[i].date === next[viaStart].date
    ) {
      portIdx = i
      portSeq += 1
      next[portIdx] = { ...next[portIdx], markerLabel: String(portSeq) }
    } else {
      portSeq += 1
    }
    const base = portSeq
    let viaOrd = 0
    for (let v = viaStart; v < viaEnd; v++) {
      const letter =
        viaOrd < 26 ? String.fromCharCode(97 + viaOrd) : `-${viaOrd + 1}`
      next[v] = { ...next[v], markerLabel: `${base}${letter}` }
      viaOrd += 1
    }
    if (portIdx >= 0) i = portIdx + 1
  }
  return next
}

function userLocationIcon() {
  return L.divIcon({
    className: 'trip-map-marker is-user',
    html: '<span class="trip-map-user-dot" aria-hidden="true"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

export function TripMap({
  days,
  stops: stopsProp,
  routeKey: routeKeyProp,
  tripName = 'Reise',
  onRefresh,
}: {
  days?: TripDay[]
  /** Prefer explicit stops (v2 journey). Falls back to days. */
  stops?: TripMapStop[]
  routeKey?: string
  tripName?: string
  /** Reload journey data (optional — also remounts geocode). */
  onRefresh?: () => void
}) {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const routeKey = useMemo(
    () =>
      `${
        routeKeyProp ||
        (days ? tripMapRouteKey(days) : (stopsProp || []).map((s) => s.key).join('|'))
      }#${refreshNonce}`,
    [routeKeyProp, days, stopsProp, refreshNonce],
  )
  const stops = useMemo(
    () => stopsProp || (days ? tripMapStopsInOrder(days) : []),
    [stopsProp, days, routeKey],
  )
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const userLayerRef = useRef<L.LayerGroup | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const gpsFollowRef = useRef(false)
  const [resolved, setResolved] = useState<ResolvedStop[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [gps, setGps] = useState<'off' | 'locating' | 'on' | 'denied' | 'error'>(
    'off',
  )
  const [gpsHint, setGpsHint] = useState('')
  const [mapSaveHint, setMapSaveHint] = useState('')
  const [savingMap, setSavingMap] = useState(false)
  const [showTravelTime, setShowTravelTime] = useState(loadShowTravelTime)
  const { user, configured, getAccessToken } = useGoogleAuth()

  useEffect(() => {
    if (!stops.length) {
      setResolved([])
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    void (async () => {
      const geocoded: ResolvedStop[] = stops.map((stop) => {
        if (stop.kind === 'sea') return { ...stop }
        const stored = storedPlaceOf(stop)
        if (stored) return { ...stop, place: stored }
        const cached = placeGeocodeCache.get(placeCacheKey(stop))
        if (cached) return { ...stop, place: cached }
        if (cached === null) {
          return { ...stop, error: 'Fant ikke koordinater' }
        }
        return { ...stop }
      })

      // Paint known positions immediately (saved coords / session cache).
      if (!cancelled) {
        setResolved(finalizeResolvedStops(geocoded))
      }

      const pendingKeys = new Map<string, TripMapStop>()
      for (const stop of stops) {
        if (stop.kind === 'sea') continue
        if (storedPlaceOf(stop)) continue
        const key = placeCacheKey(stop)
        if (placeGeocodeCache.has(key) || pendingKeys.has(key)) continue
        pendingKeys.set(key, stop)
      }

      await mapPool([...pendingKeys.entries()], 6, async ([key, stop]) => {
        if (cancelled) return
        try {
          placeGeocodeCache.set(key, await geocodeMapStop(stop))
        } catch {
          placeGeocodeCache.set(key, null)
        }
      })

      if (cancelled) return

      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i]
        if (stop.kind === 'sea' || storedPlaceOf(stop)) continue
        const place = placeGeocodeCache.get(placeCacheKey(stop)) || undefined
        geocoded[i] = place
          ? { ...stop, place }
          : { ...stop, error: 'Fant ikke koordinater' }
      }

      setResolved(finalizeResolvedStops(geocoded))
      setStatus('ready')
    })()

    return () => {
      cancelled = true
    }
  }, [stops, routeKey])

  // Recreate the Leaflet map when itinerary order changes so polylines
  // cannot linger from the previous route.
  useEffect(() => {
    const el = mapEl.current
    if (!el) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      layerRef.current = null
      userLayerRef.current = null
    }

    const map = L.map(el, {
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView([46.5, 10.5], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    userLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      map.remove()
      if (mapRef.current === map) {
        mapRef.current = null
        layerRef.current = null
        userLayerRef.current = null
      }
    }
  }, [routeKey])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    if (!userLayerRef.current) {
      userLayerRef.current = L.layerGroup().addTo(map)
    }

    layer.clearLayers()
    const withCoords = resolved.filter((r) => r.place)
    // Main route = byer/havner + til sjøs. Skip direct city→city when that
    // arrival day already has a via-chain (avoids Genova──Trieste on top of
    // Genoa→Milano→Trieste).
    const mainStops = withCoords.filter(
      (r) => r.kind === 'port' || r.kind === 'sea',
    )
    const portHasInboundVias = new Set<string>()
    for (let i = 0; i < resolved.length; i++) {
      const stop = resolved[i]
      if (stop.kind !== 'port' || !stop.place) continue
      let j = i - 1
      while (j >= 0 && resolved[j].kind === 'via' && resolved[j].date === stop.date) {
        if (resolved[j].place) {
          portHasInboundVias.add(stop.key)
          break
        }
        j -= 1
      }
    }
    const mainSegments: L.LatLngExpression[][] = []
    let mainSeg: L.LatLngExpression[] = []
    const durationMarks: { at: L.LatLngExpression; text: string }[] = []
    const addDuration = (
      from: L.LatLngExpression,
      to: L.LatLngExpression,
      minutes?: number,
    ) => {
      if (!showTravelTime || minutes == null || minutes <= 0) return
      const [alat, alng] = from as [number, number]
      const [blat, blng] = to as [number, number]
      if (alat === blat && alng === blng) return
      durationMarks.push({
        at: midLatLng(from, to),
        text: formatDurationHM(minutes),
      })
    }
    const flushMain = () => {
      if (mainSeg.length >= 2) mainSegments.push(mainSeg)
      mainSeg = []
    }
    for (let i = 0; i < mainStops.length; i++) {
      const stop = mainStops[i]
      const ll: L.LatLngExpression = [
        stop.place!.latitude,
        stop.place!.longitude,
      ]
      if (
        i > 0 &&
        stop.kind === 'port' &&
        portHasInboundVias.has(stop.key)
      ) {
        // Break before this city — via-leg owns the inbound path.
        flushMain()
        mainSeg = [ll]
        continue
      }
      if (mainSeg.length) {
        addDuration(mainSeg[mainSeg.length - 1], ll, stop.inboundMinutes)
      }
      mainSeg.push(ll)
    }
    flushMain()

    const latLngs: L.LatLngExpression[] = mainStops.map((stop) => [
      stop.place!.latitude,
      stop.place!.longitude,
    ])
    // Via-etapper: forrige by → via → via → ankomstby (hovedlinjen brytes
    // før byer med inbound-via, så uten forrige by mangler f.eks. Trieste→Ljubljana).
    const viaLegs: L.LatLngExpression[][] = []
    let leg: L.LatLngExpression[] = []
    let lastPortLl: L.LatLngExpression | null = null
    const flushViaLeg = () => {
      if (leg.length >= 2) viaLegs.push(leg)
      leg = []
    }
    for (const stop of resolved) {
      if (!stop.place) {
        // Broken geocode in the middle — keep chain, just skip the point.
        if (stop.kind !== 'via') {
          flushViaLeg()
          if (stop.kind === 'port') lastPortLl = null
        }
        continue
      }
      const ll: L.LatLngExpression = [
        stop.place.latitude,
        stop.place.longitude,
      ]
      if (stop.kind === 'via') {
        if (!leg.length && lastPortLl) leg.push(lastPortLl)
        if (leg.length) addDuration(leg[leg.length - 1], ll, stop.inboundMinutes)
        leg.push(ll)
        continue
      }
      if (stop.kind === 'port') {
        if (leg.length) {
          addDuration(leg[leg.length - 1], ll, stop.inboundMinutes)
          leg.push(ll)
          flushViaLeg()
        }
        lastPortLl = ll
        continue
      }
      // sea / other — end current via chain; sea midpoint can bridge packages.
      flushViaLeg()
      lastPortLl = ll
    }
    flushViaLeg()
    const groups = groupStopsByCoord(withCoords)

    for (const group of groups) {
      const place = group[0].place!
      const ll: L.LatLngExpression = [place.latitude, place.longitude]
      const stacked = group.length > 1
      const marker = L.marker(ll, {
        icon: stacked
          ? clusterIcon(group.length)
          : markerIcon(group[0].kind, group[0].markerLabel || '·'),
        zIndexOffset: stacked ? 200 : group[0].kind === 'via' ? 0 : 50,
      })
      const html = stackPopupHtml(group)
      marker.bindPopup(html)
      if (stacked) {
        marker.bindTooltip(html, {
          direction: 'top',
          offset: [0, -14],
          opacity: 1,
          sticky: false,
          className: 'trip-map-cluster-tooltip',
        })
      }
      marker.addTo(layer)
    }

    // Draw via legs above the basemap, under main city route.
    for (const pts of viaLegs) {
      L.polyline(pts, {
        color: '#c45c26',
        weight: 3,
        opacity: 0.9,
        dashArray: '4 6',
        lineJoin: 'round',
      }).addTo(layer)
    }

    for (const pts of mainSegments) {
      L.polyline(pts, {
        color: '#147a84',
        weight: 4,
        opacity: 0.9,
        dashArray: '8 10',
        lineJoin: 'round',
      }).addTo(layer)
    }

    for (const mark of durationMarks) {
      L.marker(mark.at, {
        icon: durationMarkerIcon(mark.text),
        interactive: false,
        keyboard: false,
        zIndexOffset: 400,
      }).addTo(layer)
    }

    // Don't yank the view away while the user is following GPS.
    if (!gpsFollowRef.current) {
      if (latLngs.length === 1) {
        map.setView(latLngs[0], 8)
      } else if (latLngs.length > 1) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36], maxZoom: 8 })
      }
    }

    // Tab mounts can leave Leaflet with 0 size until layout settles.
    requestAnimationFrame(() => map.invalidateSize())
    const t = window.setTimeout(() => map.invalidateSize(), 120)
    return () => window.clearTimeout(t)
  }, [resolved, routeKey, showTravelTime])

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      userLayerRef.current = null
    }
  }, [])

  function stopGps() {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    gpsFollowRef.current = false
    userLayerRef.current?.clearLayers()
    setGps('off')
    setGpsHint('')
  }

  function showUserPosition(
    lat: number,
    lng: number,
    accuracy: number,
    center: boolean,
  ) {
    const map = mapRef.current
    const userLayer = userLayerRef.current
    if (!map || !userLayer) return

    userLayer.clearLayers()
    const ll: L.LatLngExpression = [lat, lng]
    if (Number.isFinite(accuracy) && accuracy > 0) {
      L.circle(ll, {
        radius: Math.min(accuracy, 2000),
        color: '#1f6feb',
        weight: 1,
        fillColor: '#1f6feb',
        fillOpacity: 0.12,
      }).addTo(userLayer)
    }
    L.marker(ll, {
      icon: userLocationIcon(),
      zIndexOffset: 500,
    })
      .bindPopup('<strong>Du er her</strong>')
      .addTo(userLayer)

    if (center) {
      const zoom = Math.max(map.getZoom(), 14)
      map.setView(ll, zoom, { animate: true })
    }
  }

  function startGps() {
    if (!navigator.geolocation) {
      setGps('error')
      setGpsHint('GPS støttes ikke i denne nettleseren.')
      return
    }
    if (!window.isSecureContext) {
      setGps('error')
      setGpsHint('GPS krever HTTPS (eller localhost).')
      return
    }

    if (gps === 'on' || gps === 'locating') {
      stopGps()
      return
    }

    setGps('locating')
    setGpsHint('Henter posisjon…')
    let firstFix = true

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        gpsFollowRef.current = true
        showUserPosition(latitude, longitude, accuracy, firstFix)
        firstFix = false
        setGps('on')
        setGpsHint(
          accuracy
            ? `Posisjon aktiv (±${Math.round(accuracy)} m). Trykk igjen for å slå av.`
            : 'Posisjon aktiv. Trykk igjen for å slå av.',
        )
      },
      (err) => {
        gpsFollowRef.current = false
        if (err.code === err.PERMISSION_DENIED) {
          setGps('denied')
          setGpsHint('Tillat posisjon i nettleseren for å se deg på kartet.')
        } else {
          setGps('error')
          setGpsHint('Kunne ikke hente GPS-posisjon.')
        }
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    )
  }

  const failed = resolved.filter((r) => !r.place)
  const markerPoints = useMemo(
    () =>
      resolved
        .filter((r) => r.place && r.kind !== 'sea')
        .map((r) => ({
          lat: r.place!.latitude,
          lng: r.place!.longitude,
          label: r.city,
          description: [
            r.kind === 'via' ? 'Reise' : null,
            r.country || null,
            formatDateNO(r.date),
            formatMapTime(r.timeKey) || null,
          ]
            .filter(Boolean)
            .join(' · '),
        })),
    [resolved],
  )

  const legendStops = useMemo(() => {
    const rows: typeof resolved = []
    for (const stop of resolved) {
      const last = rows[rows.length - 1]
      if (
        last &&
        last.kind !== 'sea' &&
        stop.kind !== 'sea' &&
        samePlaceName(last.city, stop.city)
      ) {
        continue
      }
      rows.push(stop)
    }
    return rows
  }, [resolved])

  if (!stops.length) {
    return <p className="empty">Ingen byer eller reisestopp å vise på kartet ennå.</p>
  }

  return (
    <div className="trip-map-wrap stack">
      <div className="trip-map-toolbar">
        <div className="trip-map-actions">
          <button
            type="button"
            className={`btn btn-soft btn-sm${
              showTravelTime ? ' is-active' : ''
            }`}
            aria-pressed={showTravelTime}
            title={
              showTravelTime
                ? 'Skjul reisetid på linjene'
                : 'Vis reisetid som boks på linjene mellom byene'
            }
            onClick={() => {
              setShowTravelTime((on) => {
                const next = !on
                saveShowTravelTime(next)
                return next
              })
            }}
          >
            {showTravelTime ? 'Skjul reisetid' : 'Vis reisetid'}
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={status === 'loading'}
            title="Hent reisen på nytt og tegn kartet"
            onClick={() => {
              if (onRefresh) onRefresh()
              else setRefreshNonce((n) => n + 1)
            }}
          >
            Oppdater kart
          </button>
          {user && markerPoints.length > 0 && (
            <button
              type="button"
              className="btn btn-soft btn-sm"
              disabled={savingMap}
              title={
                configured
                  ? 'Lagre markører til Google Drive og åpne Mine kart'
                  : 'Last ned KML og importer i Google Mine kart'
              }
              onClick={() => {
                void (async () => {
                  setMapSaveHint('')
                  setSavingMap(true)
                  try {
                    if (configured) {
                      const kml = buildTripMapKml(tripName, markerPoints)
                      if (!kml) return
                      const token = await getAccessToken()
                      const file = await uploadKmlToDrive(
                        token,
                        `${tripName.trim() || 'reise'}-kart.kml`,
                        kml,
                      )
                      setMapSaveHint(
                        `Lagret på Google-kontoen${
                          user.email ? ` (${user.email})` : ''
                        }. Åpne Mine kart → Importer → Google Drive → velg «${
                          tripName.trim() || 'reise'
                        }-kart.kml».`,
                      )
                      window.open(
                        GOOGLE_MY_MAPS_CREATE_URL,
                        '_blank',
                        'noopener,noreferrer',
                      )
                      if (file.webViewLink) {
                        window.open(
                          file.webViewLink,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                      return
                    }
                    const ok = downloadTripMapKml(tripName, markerPoints)
                    if (ok) {
                      setMapSaveHint(
                        'KML lastet ned. I Mine kart: Importer → velg filen.',
                      )
                      window.open(
                        GOOGLE_MY_MAPS_CREATE_URL,
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  } catch (err) {
                    setMapSaveHint(
                      err instanceof Error
                        ? err.message
                        : 'Kunne ikke lagre til Google',
                    )
                  } finally {
                    setSavingMap(false)
                  }
                })()
              }}
            >
              {savingMap ? 'Lagrer…' : 'Lagre i Mine kart'}
            </button>
          )}
          <button
            type="button"
            className={`btn btn-soft btn-sm trip-map-gps-btn${
              gps === 'on' || gps === 'locating' ? ' is-active' : ''
            }`}
            onClick={startGps}
            aria-pressed={gps === 'on' || gps === 'locating'}
          >
            {gps === 'locating'
              ? 'Henter GPS…'
              : gps === 'on'
                ? 'Slå av GPS'
                : 'Min posisjon'}
          </button>
        </div>
      </div>
      {gpsHint && <p className="meta trip-map-gps-hint">{gpsHint}</p>}
      {mapSaveHint && <p className="meta trip-map-gps-hint">{mapSaveHint}</p>}
      <div className="trip-map-frame">
        <div
          ref={mapEl}
          className="trip-map"
          role="img"
          aria-label="Kart over byer, reisestopp og til sjøs på turen"
        />
      </div>
      <ol className="trip-map-legend">
        {legendStops.map((stop) => {
          const mapsUrl =
            stop.place && stop.kind !== 'sea'
              ? googleMapsPlaceUrl({
                  lat: stop.place.latitude,
                  lng: stop.place.longitude,
                  query: [stop.city, stop.country].filter(Boolean).join(', '),
                })
              : stop.kind !== 'sea' && stop.city
                ? googleMapsPlaceUrl({
                    query: [stop.city, stop.country].filter(Boolean).join(', '),
                  })
                : ''
          return (
            <li key={stop.key}>
              <span
                className={`trip-map-legend-num${
                  stop.kind === 'sea'
                    ? ' is-sea'
                    : stop.kind === 'via'
                      ? ' is-via'
                      : ''
                }`}
              >
                {stop.kind === 'sea' ? '~' : stop.markerLabel || '·'}
              </span>
              <span className="trip-map-legend-body">
                <strong>
                  {stop.kind === 'sea'
                    ? AT_SEA_LABEL
                    : localizeCity(stop.city)}
                </strong>
                {stop.kind === 'via' ? (
                  <span className="meta"> · Via</span>
                ) : null}
                {stop.kind === 'sea' && stop.place?.admin1
                  ? ` · ${localizeCity(stop.place.admin1)}`
                  : stop.country
                    ? ` · ${localizeCountry(stop.country)}`
                    : ''}
                <span className="meta"> · {formatDateNO(stop.date)}</span>
                {formatMapTime(stop.timeKey) ? (
                  <span className="meta"> · {formatMapTime(stop.timeKey)}</span>
                ) : null}
                {stop.error && (
                  <span className="meta"> · {stop.error}</span>
                )}
                {mapsUrl ? (
                  <>
                    {' '}
                    <a
                      className="trip-map-gmaps-link"
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Maps
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
      {failed.length > 0 && (
        <p className="meta">
          Punkt uten treff får ikke markør — bruk stedsforslag for by/via når
          du redigerer dagen.
        </p>
      )}
    </div>
  )
}
