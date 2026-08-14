import {
  formatExpenseAmount,
  parsePriceAmount,
  type DayExpenseSummary,
  type ExpenseLine,
  type TripExpenseSummary,
} from '../api'
import {
  compactLive,
  isPackageStop,
  liveKindLabel,
  packageFreeDayLabel,
  packageOf,
  packageTypeLabel,
  stayNights,
  chosenTransportOption,
  type Journey,
  type JourneyCost,
  type JourneyStop,
} from './journeyModel'

function emptySummary(): TripExpenseSummary {
  return {
    cruise: { total: 0, days: 0, avgPerDay: 0, lines: [] },
    hotel: { total: 0, lines: [] },
    transport: { total: 0, lines: [] },
    live: { total: 0, lines: [] },
    byDay: [],
    total: 0,
    pricedCount: 0,
    unparsedCount: 0,
  }
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Expense overview from the v2 journey (hotel, package, transport prices). */
export function journeyExpenseSummary(journey: Journey): TripExpenseSummary {
  const stops = [...(journey.stops || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  if (!stops.length) return emptySummary()

  const cruiseLines: ExpenseLine[] = []
  const hotelLines: ExpenseLine[] = []
  const transportLines: ExpenseLine[] = []
  const liveLines: ExpenseLine[] = []
  let cruiseDays = 0
  let unparsedCount = 0
  let pricedCount = 0

  type DayAcc = {
    cruise: number
    hotel: number
    transport: number
    live: number
    lines: ExpenseLine[]
    place: string
    ship: string
  }
  const byDate = new Map<string, DayAcc>()

  function dayAcc(date: string, place: string, ship = ''): DayAcc {
    let acc = byDate.get(date)
    if (!acc) {
      acc = { cruise: 0, hotel: 0, transport: 0, live: 0, lines: [], place, ship }
      byDate.set(date, acc)
    } else {
      if (!acc.place && place) acc.place = place
      if (!acc.ship && ship) acc.ship = ship
    }
    return acc
  }

  function addShare(
    date: string,
    place: string,
    category: 'cruise' | 'hotel' | 'transport' | 'live',
    share: number,
    line: ExpenseLine,
    ship = '',
  ) {
    if (!date) return
    const acc = dayAcc(date, place, ship)
    if (category === 'cruise') {
      // Cruise day place/ship is more specific than hotel/transport fallbacks.
      if (place) acc.place = place
      if (ship) acc.ship = ship
    }
    acc[category] += share
    acc.lines.push(line)
  }

  function packageDayPlace(
    stop: JourneyStop,
    dayOffset: number,
  ): { place: string; ship: string } {
    const pack = packageOf(stop)
    const ship = (pack?.title || '').trim()
    const day = (pack?.days || []).find((d) => d.offset === dayOffset)
    if (day?.atSea) {
      return {
        place: packageFreeDayLabel(stop.kind),
        ship,
      }
    }
    const place =
      day?.city?.trim() ||
      (dayOffset === 0
        ? pack?.basePlace?.trim() || stop.city || ''
        : stop.city || pack?.basePlace?.trim() || '')
    return { place, ship }
  }

  function takeAmount(
    raw: string,
  ): { amount: number; raw: string } | 'empty' | 'unparsed' {
    const t = raw.trim()
    if (!t) return 'empty'
    const amount = parsePriceAmount(t)
    if (amount === null) return 'unparsed'
    return { amount, raw: t }
  }

  function addPackageCost(
    stop: JourneyStop,
    cost: JourneyCost,
    nights: number,
    spread: boolean,
  ) {
    const resolved = takeAmount(cost.price || '')
    if (resolved === 'empty') return
    if (resolved === 'unparsed') {
      unparsedCount += 1
      return
    }
    pricedCount += 1
    const title = cost.title.trim() || 'Kostnad'
    const line: ExpenseLine = {
      id: cost.id,
      title,
      date: stop.arriveDate,
      rawPrice: resolved.raw,
      amount: resolved.amount,
    }
    cruiseLines.push(line)
    if (spread && nights > 0 && stop.arriveDate) {
      const share = resolved.amount / nights
      for (let i = 0; i < nights; i++) {
        const date = addDaysIso(stop.arriveDate, i)
        const ctx = packageDayPlace(stop, i)
        addShare(
          date,
          ctx.place,
          'cruise',
          share,
          {
            ...line,
            id: `${line.id}:${date}`,
            date,
            amount: share,
            title: `${title} (andel)`,
          },
          ctx.ship,
        )
      }
      return
    }
    const ctx = packageDayPlace(stop, 0)
    addShare(
      stop.arriveDate,
      ctx.place || stop.city,
      'cruise',
      resolved.amount,
      line,
      ctx.ship,
    )
  }

  for (const stop of stops) {
    if (isPackageStop(stop)) {
      const pack = packageOf(stop)
      const nights = Math.max(1, Math.floor(pack?.nights || 1))
      const ticket = takeAmount(pack?.price || '')
      if (ticket === 'unparsed') unparsedCount += 1
      else if (ticket !== 'empty') {
        pricedCount += 1
        const title = `${packageTypeLabel(stop.kind)} · ${
          pack?.title?.trim() || stop.city || 'Pakke'
        }`
        const line: ExpenseLine = {
          id: `${stop.id}:ticket`,
          title,
          date: stop.arriveDate,
          rawPrice: ticket.raw,
          amount: ticket.amount,
        }
        cruiseLines.push(line)
        cruiseDays += nights
        if (stop.arriveDate) {
          const share = ticket.amount / nights
          for (let i = 0; i < nights; i++) {
            const date = addDaysIso(stop.arriveDate, i)
            const ctx = packageDayPlace(stop, i)
            addShare(
              date,
              ctx.place,
              'cruise',
              share,
              {
                ...line,
                id: `${line.id}:${date}`,
                date,
                amount: share,
                title: `${title} (andel)`,
              },
              ctx.ship,
            )
          }
        }
      }
      for (const cost of pack?.costs || []) {
        addPackageCost(stop, cost, nights, true)
      }
      continue
    }

    const stay = stop.stay
    if (stay) {
      const resolved = takeAmount(stay.price || '')
      if (resolved === 'unparsed') unparsedCount += 1
      else if (resolved !== 'empty') {
        pricedCount += 1
        const nights = stayNights(stop)
        const title = stay.hotelName?.trim()
          ? `Hotell · ${stay.hotelName}`
          : `Hotell · ${stop.city || 'Opphold'}`
        const line: ExpenseLine = {
          id: `${stop.id}:hotel`,
          title,
          date: stop.arriveDate,
          rawPrice: resolved.raw,
          amount: resolved.amount,
          nights: Math.max(1, nights || 1),
          place: stop.city?.trim() || undefined,
        }
        hotelLines.push(line)
        if (nights >= 1 && stop.arriveDate) {
          const share = resolved.amount / nights
          for (let i = 0; i < nights; i++) {
            const date = addDaysIso(stop.arriveDate, i)
            addShare(date, stop.city, 'hotel', share, {
              ...line,
              id: `${line.id}:${date}`,
              date,
              amount: share,
              title: `${title} (andel)`,
            })
          }
        } else {
          addShare(
            stop.arriveDate,
            stop.city,
            'hotel',
            resolved.amount,
            line,
          )
        }
      }
    }
  }

  for (const leg of journey.legs || []) {
    const to = stops.find((s) => s.id === leg.toStopId)
    const date = to?.arriveDate || ''
    const place = to?.city || ''
    const vias = [...(leg.vias || [])].sort((a, b) => a.sortOrder - b.sortOrder)
    for (const via of vias) {
      const opt = chosenTransportOption(via)
      if (!opt) continue
      const expected = (opt.price || '').trim()
      const actual = (opt.actualPrice || '').trim()
      const useActual = !!actual
      const raw = useActual ? actual : expected
      const resolved = takeAmount(raw)
      if (resolved === 'empty') continue
      if (resolved === 'unparsed') {
        unparsedCount += 1
        continue
      }
      pricedCount += 1
      const mode = opt.mode || 'transport'
      const title = [
        via.title?.trim() || 'Transport',
        opt.title?.trim() || mode,
      ]
        .filter(Boolean)
        .join(' · ')
      const line: ExpenseLine = {
        id: `${via.id}:${opt.id}`,
        title,
        date,
        rawPrice: resolved.raw,
        amount: resolved.amount,
        isActual: useActual || undefined,
        expectedRaw:
          useActual && expected && expected !== actual
            ? expected
            : undefined,
      }
      transportLines.push(line)
      addShare(date, place, 'transport', resolved.amount, line)
    }
  }

  for (const entry of compactLive(journey.live)) {
    const resolved = takeAmount(entry.price || '')
    if (resolved === 'empty') continue
    if (resolved === 'unparsed') {
      unparsedCount += 1
      continue
    }
    pricedCount += 1
    const kind = liveKindLabel(entry.kind)
    const title = entry.title.trim()
      ? `${kind} · ${entry.title.trim()}`
      : kind
    const place =
      [...byDate.entries()].find(([d]) => d === entry.date)?.[1].place || ''
    const line: ExpenseLine = {
      id: entry.id,
      title,
      date: entry.date,
      rawPrice: resolved.raw,
      amount: resolved.amount,
      isActual: true,
    }
    liveLines.push(line)
    addShare(entry.date, place, 'live', resolved.amount, line)
  }

  const cruiseTotal = cruiseLines.reduce((s, l) => s + l.amount, 0)
  const hotelTotal = hotelLines.reduce((s, l) => s + l.amount, 0)
  const transportTotal = transportLines.reduce((s, l) => s + l.amount, 0)
  const liveTotal = liveLines.reduce((s, l) => s + l.amount, 0)

  const byDay: DayExpenseSummary[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => ({
      date,
      place: acc.place,
      ship: acc.ship || undefined,
      cruise: acc.cruise,
      hotel: acc.hotel,
      transport: acc.transport,
      live: acc.live,
      total: acc.cruise + acc.hotel + acc.transport + acc.live,
      lines: acc.lines,
    }))

  return {
    cruise: {
      total: cruiseTotal,
      days: cruiseDays,
      avgPerDay: cruiseDays > 0 ? cruiseTotal / cruiseDays : 0,
      lines: cruiseLines,
    },
    hotel: { total: hotelTotal, lines: hotelLines },
    transport: { total: transportTotal, lines: transportLines },
    live: { total: liveTotal, lines: liveLines },
    byDay,
    total: cruiseTotal + hotelTotal + transportTotal + liveTotal,
    pricedCount,
    unparsedCount,
  }
}

export { formatExpenseAmount }
