import {
  convertPriceToNokStorage,
  normalizePriceCurrency,
  DEFAULT_PRICE_CURRENCY,
} from './priceCurrency'
import {
  type Journey,
  type JourneyActivity,
  type JourneyCityTransport,
  type JourneyLiveEntry,
  type JourneyTransportOption,
} from './journeyModel'

function persistField(
  price?: string,
  currency?: string,
): { price: string; currency?: string } {
  const raw = (price || '').trim()
  if (!raw) return { price: '' }
  const code = normalizePriceCurrency(currency)
  if (code === DEFAULT_PRICE_CURRENCY) return { price: raw }
  const converted = convertPriceToNokStorage(raw, currency)
  if (converted === 'empty') return { price: '' }
  if (converted === 'no-rate') return { price: raw, currency: code }
  return { price: converted.price }
}

function persistOption(opt: JourneyTransportOption): JourneyTransportOption {
  const currency = opt.currency
  const pricePatch = persistField(opt.price, currency)
  const actualPatch = persistField(opt.actualPrice, currency)
  const nextCurrency =
    pricePatch.currency === undefined && actualPatch.currency === undefined
      ? undefined
      : currency
  return {
    ...opt,
    price: pricePatch.price,
    actualPrice: actualPatch.price,
    currency: nextCurrency,
  }
}

function persistCityTransport(row: JourneyCityTransport): JourneyCityTransport {
  const raw = (row.actualPrice || row.price || '').trim()
  const patch = persistField(raw, row.currency)
  return {
    ...row,
    price: '',
    actualPrice: patch.price,
    currency: patch.currency,
  }
}

function persistActivity(a: JourneyActivity): JourneyActivity {
  const patch = persistField(a.price, a.currency)
  return { ...a, price: patch.price, currency: patch.currency }
}

function persistLiveEntry(e: JourneyLiveEntry): JourneyLiveEntry {
  const patch = persistField(e.price, e.currency)
  return { ...e, price: patch.price, currency: patch.currency }
}

/** Convert foreign-currency price fields to NOK before save (when rate is known). */
export function normalizeJourneyPricesToNok(journey: Journey): Journey {
  const stops = (journey.stops || []).map((stop) => ({
    ...stop,
    sights: (stop.sights || []).map(persistActivity),
    cityTransport: (stop.cityTransport || []).map(persistCityTransport),
    stay: stop.stay
      ? (() => {
          const patch = persistField(stop.stay.price, stop.stay.currency)
          return {
            ...stop.stay,
            price: patch.price,
            currency: patch.currency,
          }
        })()
      : stop.stay,
    pack: stop.pack
      ? (() => {
          const ticket = persistField(stop.pack.price, stop.pack.currency)
          return {
            ...stop.pack,
            price: ticket.price,
            currency: ticket.currency,
            costs: (stop.pack.costs || []).map((c) => {
              const patch = persistField(c.price, c.currency)
              return { ...c, price: patch.price, currency: patch.currency }
            }),
          }
        })()
      : stop.pack,
  }))

  const legs = (journey.legs || []).map((leg) => ({
    ...leg,
    vias: (leg.vias || []).map((via) => ({
      ...via,
      options: (via.options || []).map(persistOption),
      sights: (via.sights || []).map(persistActivity),
    })),
  }))

  return {
    ...journey,
    stops,
    legs,
    live: (journey.live || []).map(persistLiveEntry),
  }
}
