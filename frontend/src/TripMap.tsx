import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  api,
  AT_SEA_LABEL,
  tripMapStopsInOrder,
  type PlaceSuggestion,
  type TripDay,
  type TripMapStop,
} from './api'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markerIcon(kind: TripMapStop['kind'], n: number) {
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
      html: `<span class="trip-map-marker-num is-via">${n}</span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })
  }
  return L.divIcon({
    className: 'trip-map-marker',
    html: `<span class="trip-map-marker-num">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
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
    stop.kind === 'sea' ? AT_SEA_LABEL : stop.city || place?.name || 'Stopp',
  )
  const num =
    stop.kind === 'sea' ? '~' : String(stop.markerNum ?? '')
  const bits = [
    stop.kind === 'via' ? 'Via' : null,
    stop.kind === 'sea' ? place?.admin1 || null : stop.country || place?.country || null,
    formatDateNO(stop.date),
    formatMapTime(stop.timeKey) || null,
  ].filter(Boolean)
  return `<div class="trip-map-stack-row"><span class="trip-map-stack-num">${num}</span><span><strong>${name}</strong>${
    bits.length ? ` · ${escapeHtml(bits.join(' · '))}` : ''
  }</span></div>`
}

function stackPopupHtml(group: ResolvedStop[]): string {
  if (group.length === 1) {
    const stop = group[0]
    const place = stop.place!
    if (stop.kind === 'sea') {
      return `<strong>${AT_SEA_LABEL}</strong><br/>${escapeHtml(
        place.admin1 || 'Mellom havner',
      )}<br/><span class="meta">${formatDateNO(stop.date)}</span>`
    }
    if (stop.kind === 'via') {
      return `<strong>${escapeHtml(place.name)}</strong><br/>Via · ${formatDateNO(
        stop.date,
      )}${
        place.country || stop.country
          ? `<br/>${escapeHtml(place.country || stop.country)}`
          : ''
      }`
    }
    return `<strong>${escapeHtml(place.name)}</strong><br/>${escapeHtml(
      [place.admin1, place.country].filter(Boolean).join(', '),
    )}<br/><span class="meta">Første dag: ${formatDateNO(stop.date)}</span>`
  }

  const placeName = escapeHtml(group[0].place?.name || group[0].city || 'Sted')
  return `<div class="trip-map-stack-popup"><strong>${placeName}</strong><div class="meta">${group.length} stopp samme sted</div>${group
    .map(stopPopupLine)
    .join('')}</div>`
}

function formatDateNO(iso: string) {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  return iso
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
  markerNum?: number
}

export function TripMap({ days }: { days: TripDay[] }) {
  const stops = useMemo(() => tripMapStopsInOrder(days), [days])
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [resolved, setResolved] = useState<ResolvedStop[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle')

  useEffect(() => {
    if (!stops.length) {
      setResolved([])
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    void (async () => {
      const placeCache = new Map<string, PlaceSuggestion | null>()
      const geocoded: ResolvedStop[] = []

      for (const stop of stops) {
        if (cancelled) return
        if (stop.kind === 'sea') {
          geocoded.push({ ...stop })
          continue
        }
        const cacheKey = `${stop.kind}|${stop.city}|${stop.country}`.toLowerCase()
        if (!placeCache.has(cacheKey)) {
          try {
            const { places } = await api.searchPlaces(stop.city, stop.country)
            placeCache.set(cacheKey, places[0] || null)
          } catch {
            placeCache.set(cacheKey, null)
          }
        }
        const place = placeCache.get(cacheKey) || undefined
        geocoded.push(
          place
            ? { ...stop, place }
            : { ...stop, error: 'Fant ikke koordinater' },
        )
      }

      // Number every stop in list order (also without coords), so 1…n matches
      // the legend — missing geocode must not leave gaps that look like wrong order.
      let seq = 0
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
          }
        }

        seq += 1
        return { ...stop, markerNum: seq }
      })

      if (!cancelled) {
        setResolved(next)
        setStatus('ready')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [stops])

  useEffect(() => {
    if (!mapEl.current) return
    if (!mapRef.current) {
      const map = L.map(mapEl.current, {
        scrollWheelZoom: true,
        attributionControl: true,
      }).setView([46.5, 10.5], 4)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    }

    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const withCoords = resolved.filter((r) => r.place)
    const latLngs: L.LatLngExpression[] = withCoords.map((stop) => [
      stop.place!.latitude,
      stop.place!.longitude,
    ])
    const groups = groupStopsByCoord(withCoords)

    for (const group of groups) {
      const place = group[0].place!
      const ll: L.LatLngExpression = [place.latitude, place.longitude]
      const stacked = group.length > 1
      const marker = L.marker(ll, {
        icon: stacked
          ? clusterIcon(group.length)
          : markerIcon(group[0].kind, group[0].markerNum || 0),
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

    if (latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: '#147a84',
        weight: 3,
        opacity: 0.75,
        dashArray: '6 8',
      }).addTo(layer)
    }

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 8)
    } else if (latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36], maxZoom: 8 })
    }

    requestAnimationFrame(() => map.invalidateSize())
  }, [resolved])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  const failed = resolved.filter((r) => !r.place)
  const plotted = resolved.filter((r) => r.place).length

  if (!stops.length) {
    return <p className="empty">Ingen byer eller via-punkter å vise på kartet ennå.</p>
  }

  return (
    <div className="trip-map-wrap stack">
      <p className="section-sub" style={{ marginBottom: 0 }}>
        {status === 'loading'
          ? 'Henter posisjoner…'
          : `${plotted} av ${stops.length} punkt på kartet (by, via og til sjøs)`}
      </p>
      <div
        ref={mapEl}
        className="trip-map"
        role="img"
        aria-label="Kart over byer, via-punkter og til sjøs på turen"
      />
      <ol className="trip-map-legend">
        {resolved.map((stop) => (
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
              {stop.kind === 'sea' ? '~' : stop.markerNum || '·'}
            </span>
            <span>
              <strong>
                {stop.kind === 'sea' ? AT_SEA_LABEL : stop.city}
              </strong>
              {stop.kind === 'via' ? (
                <span className="meta"> · Via</span>
              ) : null}
              {stop.kind === 'sea' && stop.place?.admin1
                ? ` · ${stop.place.admin1}`
                : stop.country
                  ? ` · ${stop.country}`
                  : ''}
              <span className="meta"> · {formatDateNO(stop.date)}</span>
              {formatMapTime(stop.timeKey) ? (
                <span className="meta"> · {formatMapTime(stop.timeKey)}</span>
              ) : null}
              {stop.error && (
                <span className="meta"> · {stop.error}</span>
              )}
            </span>
          </li>
        ))}
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
