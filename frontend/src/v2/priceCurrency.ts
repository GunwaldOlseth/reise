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
