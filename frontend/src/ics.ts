import {
  itemTypeLabel,
  isTransportType,
  legModeLabel,
  type Trip,
  type TripDay,
} from './api'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function stampUtc(d = new Date()) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function dateOnly(iso: string) {
  return iso.replaceAll('-', '')
}

function nextDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse "15:00", "1500", "15.00" → HHmmss or null. */
function parseTime(raw?: string): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d{1,2})[:.]?(\d{2})?/)
  if (!m) return null
  const h = Math.min(23, Number(m[1]))
  const min = Math.min(59, Number(m[2] || '0'))
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  return `${pad(h)}${pad(min)}00`
}

function escapeText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function foldLine(line: string) {
  const limit = 75
  if (line.length <= limit) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, limit))
  rest = rest.slice(limit)
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, limit - 1))
    rest = rest.slice(limit - 1)
  }
  return parts.join('\r\n')
}

function lines(...rows: string[]) {
  return rows.filter(Boolean).map(foldLine).join('\r\n')
}

function dayDescription(day: TripDay) {
  const parts: string[] = []
  if (day.city || day.country) {
    parts.push([day.city, day.country].filter(Boolean).join(', '))
  }
  if (day.notes?.trim()) parts.push(day.notes.trim())
  if (day.viaPoints?.length) {
    const route: string[] = []
    for (let i = 0; i < day.viaPoints.length; i++) {
      const point = day.viaPoints[i]
      route.push(point.title || `Via ${i + 1}`)
      const leg = day.legs?.[i]
      if (leg && i + 1 < day.viaPoints.length) {
        route.push(`[${legModeLabel(leg.mode)}${leg.title ? ` ${leg.title}` : ''}]`)
      }
    }
    parts.push(`Rute: ${route.join(' → ')}`)
  }
  for (const item of day.items || []) {
    const bits = [`${itemTypeLabel(item.type)}: ${item.title || itemTypeLabel(item.type)}`]
    if (isTransportType(item.type) && (item.from || item.to)) {
      bits.push(`${item.from || '?'} → ${item.to || '?'}`)
    }
    if (item.address) bits.push(item.address)
    if (item.startTime || item.endTime) {
      bits.push([item.startTime, item.endTime].filter(Boolean).join('–'))
    }
    if (item.url) bits.push(item.url)
    if (item.notes) bits.push(item.notes)
    parts.push(bits.join(' · '))
  }
  return parts.join('\n')
}

function itemSummary(day: TripDay, item: TripDay['items'][number]) {
  const label = itemTypeLabel(item.type)
  const title = item.title?.trim() || label
  if (isTransportType(item.type) && (item.from || item.to)) {
    return `${label}: ${title} (${[item.from, item.to].filter(Boolean).join(' → ')})`
  }
  if (day.city) return `${label}: ${title} · ${day.city}`
  return `${label}: ${title}`
}

function itemDescription(item: TripDay['items'][number]) {
  const parts: string[] = []
  if (item.address) parts.push(item.address)
  if (item.from || item.to) parts.push(`${item.from || ''} → ${item.to || ''}`.trim())
  if (item.notes) parts.push(item.notes)
  if (item.url) parts.push(item.url)
  return parts.join('\n')
}

export function buildTripIcs(trip: Trip, days: TripDay[]): string {
  const dtstamp = stampUtc()
  const events: string[] = []

  for (const day of [...days].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.sortOrder - b.sortOrder
  })) {
    if (!day.date) continue

    const dayTitle = [trip.name, day.city || day.country || 'Reisedag']
      .filter(Boolean)
      .join(': ')
    const desc = dayDescription(day)

    events.push(
      lines(
        ...[
          'BEGIN:VEVENT',
          `UID:day-${day.id}@reise.app`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${dateOnly(day.date)}`,
          `DTEND;VALUE=DATE:${dateOnly(nextDate(day.date))}`,
          `SUMMARY:${escapeText(dayTitle)}`,
          desc ? `DESCRIPTION:${escapeText(desc)}` : '',
          day.city || day.country
            ? `LOCATION:${escapeText([day.city, day.country].filter(Boolean).join(', '))}`
            : '',
          'CATEGORIES:Reise',
          'END:VEVENT',
        ].filter(Boolean),
      ),
    )

    for (const item of day.items || []) {
      const start = parseTime(item.startTime)
      if (!start && item.type !== 'hotel') continue

      const end = parseTime(item.endTime) || start
      const summary = itemSummary(day, item)
      const itemDesc = itemDescription(item)

      if (start) {
        const startDt = `${dateOnly(day.date)}T${start}`
        let endDt = end ? `${dateOnly(day.date)}T${end}` : startDt
        // If end is before/equal start, bump to next day for overnight trains/flights
        if (end && end <= start) {
          endDt = `${dateOnly(nextDate(day.date))}T${end}`
        } else if (!end) {
          // default 1 hour
          const h = Number(start.slice(0, 2))
          const m = Number(start.slice(2, 4))
          const d = new Date(`${day.date}T${pad(h)}:${pad(m)}:00`)
          d.setHours(d.getHours() + 1)
          endDt = `${dateOnly(day.date)}T${pad(d.getHours())}${pad(d.getMinutes())}00`
          if (d.getDate() !== Number(day.date.slice(8))) {
            endDt = `${dateOnly(nextDate(day.date))}T${pad(d.getHours())}${pad(d.getMinutes())}00`
          }
        }

        events.push(
          lines(
            ...[
              'BEGIN:VEVENT',
              `UID:item-${item.id || day.id}-${item.sortOrder}@reise.app`,
              `DTSTAMP:${dtstamp}`,
              `DTSTART:${startDt}`,
              `DTEND:${endDt}`,
              `SUMMARY:${escapeText(summary)}`,
              itemDesc ? `DESCRIPTION:${escapeText(itemDesc)}` : '',
              item.address || day.city
                ? `LOCATION:${escapeText(
                    item.address ||
                      [day.city, day.country].filter(Boolean).join(', '),
                  )}`
                : '',
              `CATEGORIES:Reise,${escapeText(itemTypeLabel(item.type))}`,
              'END:VEVENT',
            ].filter(Boolean),
          ),
        )
      } else if (item.type === 'hotel' && (item.title || item.address)) {
        events.push(
          lines(
            ...[
              'BEGIN:VEVENT',
              `UID:hotel-${item.id || day.id}@reise.app`,
              `DTSTAMP:${dtstamp}`,
              `DTSTART;VALUE=DATE:${dateOnly(day.date)}`,
              `DTEND;VALUE=DATE:${dateOnly(nextDate(day.date))}`,
              `SUMMARY:${escapeText(`Hotell: ${item.title || 'Overnatting'}`)}`,
              itemDesc ? `DESCRIPTION:${escapeText(itemDesc)}` : '',
              item.address ? `LOCATION:${escapeText(item.address)}` : '',
              'CATEGORIES:Reise,Hotell',
              'END:VEVENT',
            ].filter(Boolean),
          ),
        )
      }
    }
  }

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reise//Reiseplanlegger//NO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(trip.name)}`,
    `X-WR-CALDESC:${escapeText(`Reiseplan: ${trip.name}`)}`,
    ...events,
    'END:VCALENDAR',
  ]

  return cal.join('\r\n') + '\r\n'
}

export function downloadTripIcs(trip: Trip, days: TripDay[]) {
  const ics = buildTripIcs(trip, days)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = (trip.name || 'reise')
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, '-')
    .replace(/^-|-$/g, '')
  a.href = url
  a.download = `${safe || 'reise'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
