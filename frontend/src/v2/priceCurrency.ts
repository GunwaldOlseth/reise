import {
  countryCurrencyKey,
  customRateToNok,
  loadCustomCurrencyRate,
  loadCustomCurrencyRates,
} from '../userSettings'
import { api, formatExpenseAmount, parsePriceAmount } from '../api'
import {
  journeyVisitPlaces,
  type Journey,
} from './journeyModel'

export const DEFAULT_PRICE_CURRENCY = 'NOK'

export const PRICE_CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'NOK', label: 'NOK' },
  { code: 'EUR', label: 'EUR' },
  { code: 'USD', label: 'USD' },
  { code: 'GBP', label: 'GBP' },
  { code: 'CHF', label: 'CHF' },
  { code: 'SEK', label: 'SEK' },
  { code: 'DKK', label: 'DKK' },
  { code: 'PLN', label: 'PLN' },
  { code: 'CZK', label: 'CZK' },
  { code: 'HUF', label: 'HUF' },
  { code: 'THB', label: 'THB' },
  { code: 'JPY', label: 'JPY' },
]

const ratesToNok: Record<string, number> = { NOK: 1 }

export function normalizePriceCurrency(raw?: string | null): string {
  const code = (raw || '').trim().toUpperCase()
  if (!code) return DEFAULT_PRICE_CURRENCY
  if (PRICE_CURRENCY_OPTIONS.some((o) => o.code === code)) return code
  if (/^[A-Z]{3}$/.test(code)) return code
  return DEFAULT_PRICE_CURRENCY
}

export function setCurrencyRateToNok(code: string, rate: number): void {
  const c = normalizePriceCurrency(code)
  if (!Number.isFinite(rate) || rate <= 0) return
  ratesToNok[c] = rate
}

export function getCurrencyRateToNok(code?: string | null): number | null {
  const c = normalizePriceCurrency(code)
  const rate = ratesToNok[c]
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

export function applyCustomCountryRates(
  countries: string[],
  currencyByCountry: Record<string, string>,
): void {
  const customs = loadCustomCurrencyRates()
  for (const country of countries) {
    const key = countryCurrencyKey(country)
    const sample = customs[key]
    const rate = sample ? customRateToNok(sample) : null
    if (!rate) continue
    const code = currencyByCountry[key]
    if (code) setCurrencyRateToNok(code, rate)
  }
}

export function suggestPriceCurrencyForCountry(
  country: string,
  currencyByCountry: Record<string, string>,
): string {
  const key = countryCurrencyKey(country)
  const code = currencyByCountry[key]
  if (code && code !== 'NOK') return code
  if (loadCustomCurrencyRate(country)) {
    return code || DEFAULT_PRICE_CURRENCY
  }
  return DEFAULT_PRICE_CURRENCY
}

async function fetchFrankfurterRateToNok(code: string): Promise<number | null> {
  const c = normalizePriceCurrency(code)
  if (c === DEFAULT_PRICE_CURRENCY) return 1
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(c)}&to=NOK`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { rates?: { NOK?: number } }
    const rate = data.rates?.NOK
    return rate && rate > 0 ? rate : null
  } catch {
    return null
  }
}

/** Load rate for one currency if missing (Frankfurter). */
export async function ensureCurrencyRate(code: string): Promise<boolean> {
  const c = normalizePriceCurrency(code)
  if (c === DEFAULT_PRICE_CURRENCY) return true
  if (getCurrencyRateToNok(c)) return true
  const rate = await fetchFrankfurterRateToNok(c)
  if (!rate) return false
  setCurrencyRateToNok(c, rate)
  return true
}

export async function ensureCurrencyRates(codes: string[]): Promise<void> {
  const unique = [
    ...new Set(
      codes
        .map((c) => normalizePriceCurrency(c))
        .filter((c) => c !== DEFAULT_PRICE_CURRENCY),
    ),
  ]
  await Promise.all(unique.map((c) => ensureCurrencyRate(c)))
}

export function amountInNok(
  amount: number,
  currency?: string | null,
): number | null {
  const code = normalizePriceCurrency(currency)
  if (code === DEFAULT_PRICE_CURRENCY) return amount
  const rate = getCurrencyRateToNok(code)
  if (!rate) return null
  return amount * rate
}

export type ResolvedPrice =
  | 'empty'
  | 'unparsed'
  | {
      amountNok: number
      foreignAmount: number
      currency: string
      raw: string
    }

export function resolvePriceInNok(
  raw: string | undefined,
  currency?: string | null,
): ResolvedPrice {
  const t = (raw || '').trim()
  if (!t) return 'empty'
  const foreignAmount = parsePriceAmount(t)
  if (foreignAmount === null) return 'unparsed'
  const code = normalizePriceCurrency(currency)
  const amountNok = amountInNok(foreignAmount, code)
  if (amountNok === null) return 'unparsed'
  return {
    amountNok,
    foreignAmount,
    currency: code,
    raw: formatPriceDisplay(foreignAmount, code),
  }
}

export function formatPriceDisplay(
  amount: number,
  currency?: string | null,
): string {
  const code = normalizePriceCurrency(currency)
  const formatted = formatExpenseAmount(amount)
  if (code === DEFAULT_PRICE_CURRENCY) return `${formatted} kr`
  return `${formatted} ${code}`
}

export function formatPriceLabel(
  raw: string | undefined,
  currency?: string | null,
): string {
  const t = (raw || '').trim()
  if (!t) return ''
  const amount = parsePriceAmount(t)
  if (amount !== null) return formatPriceDisplay(amount, currency)
  return t
}

export async function prefetchJourneyCurrencyRates(
  journey: Journey,
): Promise<void> {
  await ensureCurrencyRates(
    PRICE_CURRENCY_OPTIONS.map((o) => o.code),
  )
  const { countries } = journeyVisitPlaces(journey)
  const currencyByCountry: Record<string, string> = {}
  await Promise.all(
    countries.map(async (country) => {
      try {
        const report = await api.getCurrency(country)
        const code = (report.currencyCode || '').trim().toUpperCase()
        if (code && report.rateToNok && report.rateToNok > 0) {
          setCurrencyRateToNok(code, report.rateToNok)
          currencyByCountry[countryCurrencyKey(country)] = code
        }
      } catch {
        /* ignore */
      }
    }),
  )
  applyCustomCountryRates(countries, currencyByCountry)
}

export type NokStoredPrice = {
  price: string
  foreignPrice?: string
  currency?: string
}

export function convertPriceToNokStorage(
  raw: string | undefined,
  currency?: string | null,
): NokStoredPrice | 'empty' | 'no-rate' {
  const t = (raw || '').trim()
  if (!t) return 'empty'
  const code = normalizePriceCurrency(currency)
  const amount = parsePriceAmount(t)
  if (amount === null) return { price: t }
  if (code === DEFAULT_PRICE_CURRENCY) {
    return { price: formatExpenseAmount(amount) }
  }
  const nok = amountInNok(amount, code)
  if (nok === null) return 'no-rate'
  return {
    price: formatExpenseAmount(nok),
    foreignPrice: formatExpenseAmount(amount),
    currency: code,
  }
}

export type StoredPriceView = { primary: string; secondary?: string }

/** NOK on top, original foreign currency below when both are stored. */
export function formatStoredPriceView(
  price?: string | null,
  foreignPrice?: string | null,
  currency?: string | null,
): StoredPriceView | null {
  const nokRaw = (price || '').trim()
  if (!nokRaw) return null
  const code = normalizePriceCurrency(currency)
  const foreignRaw = (foreignPrice || '').trim()
  if (foreignRaw && code !== DEFAULT_PRICE_CURRENCY) {
    const nokAmt = parsePriceAmount(nokRaw)
    const primary =
      nokAmt !== null
        ? `${formatExpenseAmount(nokAmt)} kr`
        : `${nokRaw} kr`
    const foreignAmt = parsePriceAmount(foreignRaw)
    const secondary =
      foreignAmt !== null
        ? formatPriceDisplay(foreignAmt, code)
        : `${foreignRaw} ${code}`
    return { primary, secondary }
  }
  const label = formatPriceLabel(nokRaw, currency)
  return label ? { primary: label } : { primary: nokRaw }
}

/** Parse, convert foreign currency to NOK, return value for Firestore/local save. */
export async function persistPriceAsNok(
  raw: string | undefined,
  currency?: string | null,
): Promise<NokStoredPrice | 'empty' | 'failed'> {
  const code = normalizePriceCurrency(currency)
  if (code !== DEFAULT_PRICE_CURRENCY) {
    const ok = await ensureCurrencyRate(code)
    if (!ok) return 'failed'
  }
  let result = convertPriceToNokStorage(raw, currency)
  if (result === 'no-rate' && code !== DEFAULT_PRICE_CURRENCY) {
    const ok = await ensureCurrencyRate(code)
    if (!ok) return 'failed'
    result = convertPriceToNokStorage(raw, currency)
  }
  if (result === 'no-rate') return 'failed'
  return result
}

export function formatNokWithForeignHint(
  amountNok: number,
  foreignAmount?: number,
  currency?: string | null,
): string {
  const code = normalizePriceCurrency(currency)
  const nok = `${formatExpenseAmount(amountNok)} kr`
  if (
    code === DEFAULT_PRICE_CURRENCY ||
    foreignAmount == null ||
    !Number.isFinite(foreignAmount)
  ) {
    return nok
  }
  return `${nok} (${formatPriceDisplay(foreignAmount, code)})`
}
