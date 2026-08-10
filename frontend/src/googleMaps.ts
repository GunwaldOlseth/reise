/** Google Maps / Mine kart helpers (places + saved map with markers). */

export type MapsPoint = {
  lat: number
  lng: number
  label?: string
  description?: string
}

/** Open a single place in Google Maps. */
export function googleMapsPlaceUrl(point: {
  lat?: number
  lng?: number
  query?: string
}): string {
  if (
    point.lat != null &&
    point.lng != null &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
  }
  const q = (point.query || '').trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Create a new Google My Maps document (user imports KML there). */
export const GOOGLE_MY_MAPS_CREATE_URL =
  'https://www.google.com/maps/d/u/0/'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function usablePoints(points: MapsPoint[]): MapsPoint[] {
  return points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.label?.trim(),
  )
}

/**
 * KML with placemark per city/stop (+ optional path).
 * Import into Google Mine kart → markører, ikke kjørevei-beskrivelse.
 */
export function buildTripMapKml(
  title: string,
  points: MapsPoint[],
): string | null {
  const list = usablePoints(points)
  if (!list.length) return null

  const placemarks = list
    .map((p, i) => {
      const name = escapeXml(`${i + 1}. ${p.label!.trim()}`)
      const desc = escapeXml((p.description || '').trim())
      return `    <Placemark>
      <name>${name}</name>
      ${desc ? `<description>${desc}</description>` : ''}
      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
    </Placemark>`
    })
    .join('\n')

  const lineCoords = list.map((p) => `${p.lng},${p.lat},0`).join(' ')
  const line =
    list.length >= 2
      ? `    <Placemark>
      <name>${escapeXml('Rute')}</name>
      <Style>
        <LineStyle><color>ff847a14</color><width>3</width></LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${lineCoords}</coordinates>
      </LineString>
    </Placemark>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(title.trim() || 'Reise')}</name>
    <description>Byer og stopp som markører (eksportert fra Reise)</description>
${placemarks}
${line}
  </Document>
</kml>
`
}

/** CSV for Google Mine kart «Importer» (Name, Latitude, Longitude, Description). */
export function buildTripMapCsv(points: MapsPoint[]): string | null {
  const list = usablePoints(points)
  if (!list.length) return null
  const rows = [
    'Name,Latitude,Longitude,Description',
    ...list.map((p, i) => {
      const name = `${i + 1}. ${p.label!.trim()}`.replaceAll('"', '""')
      const desc = (p.description || '').replaceAll('"', '""')
      return `"${name}",${p.lat},${p.lng},"${desc}"`
    }),
  ]
  return `${rows.join('\n')}\n`
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function safeFilename(name: string): string {
  const base = name.trim() || 'reise'
  return base
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export function downloadTripMapKml(title: string, points: MapsPoint[]) {
  const kml = buildTripMapKml(title, points)
  if (!kml) return false
  downloadTextFile(
    `${safeFilename(title)}-kart.kml`,
    kml,
    'application/vnd.google-earth.kml+xml;charset=utf-8',
  )
  return true
}

export function downloadTripMapCsv(title: string, points: MapsPoint[]) {
  const csv = buildTripMapCsv(points)
  if (!csv) return false
  downloadTextFile(
    `${safeFilename(title)}-kart.csv`,
    csv,
    'text/csv;charset=utf-8',
  )
  return true
}
