import { useEffect, useState } from 'react'
import { api, type CurrencyReport } from '../api'
import {
  customRateToNok,
  loadCustomCurrencyRate,
  subscribeCustomCurrencyRates,
} from '../userSettings'
import {
  formatKrPerUnit,
  formatUnitPerKr,
  joinCurrencyParts,
} from './currencyFormat'

const cache = new Map<string, CurrencyReport | 'loading' | 'error'>()
const inflight = new Map<string, Promise<CurrencyReport>>()

function cacheKey(country: string, countrySearch?: string) {
  return `${country.trim().toLowerCase()}|${(countrySearch || '').trim().toLowerCase()}`
}

function loadCurrency(country: string, countrySearch?: string): Promise<CurrencyReport> {
  const key = cacheKey(country, countrySearch)
  const hit = cache.get(key)
  if (hit && hit !== 'loading' && hit !== 'error') {
    return Promise.resolve(hit)
  }
  const pending = inflight.get(key)
  if (pending) return pending
  const p = api
    .getCurrency(country, countrySearch)
    .then((report) => {
      cache.set(key, report)
      inflight.delete(key)
      return report
    })
    .catch(() => {
      cache.set(key, 'error')
      inflight.delete(key)
      throw new Error('currency')
    })
  inflight.set(key, p)
  return p
}

function currencyLines(
  report: CurrencyReport,
  nation: string,
): { main: string; inverse?: string } | null {
  const code = (report.currencyCode || '').trim()
  if (!code) return null
  const name = (report.currencyName || code).trim()
  const label = name.toLowerCase() === code.toLowerCase()
    ? code
    : `${name} (${code})`
  if (report.isNok) {
    return { main: `Valuta: ${label}` }
  }

  const custom = loadCustomCurrencyRate(nation)
  const customRate = custom ? customRateToNok(custom) : null
  const marketRate =
    report.rateToNok && report.rateToNok > 0 ? report.rateToNok : null
  const rate = customRate ?? marketRate

  if (!rate) {
    return { main: `Valuta: ${label}` }
  }

  const krLine = formatKrPerUnit(code, rate, { custom: !!customRate })
  const inverseLine = formatUnitPerKr(code, rate)
  return {
    main: joinCurrencyParts([`Valuta: ${label}`, krLine]),
    inverse: inverseLine || undefined,
  }
}

export function LiveCityCurrency({
  country,
  countrySearch,
}: {
  country?: string
  countrySearch?: string
}) {
  const nation = (country || '').trim()
  const [lines, setLines] = useState<{ main: string; inverse?: string } | null>(
    null,
  )

  useEffect(() => {
    if (!nation) {
      setLines(null)
      return
    }
    let cancelled = false
    const refresh = () => {
      loadCurrency(nation, countrySearch)
        .then((report) => {
          if (cancelled) return
          setLines(currencyLines(report, nation))
        })
        .catch(() => {
          if (!cancelled) setLines(null)
        })
    }
    refresh()
    const unsub = subscribeCustomCurrencyRates(() => {
      loadCurrency(nation, countrySearch)
        .then((report) => {
          if (cancelled) return
          setLines(currencyLines(report, nation))
        })
        .catch(() => {
          if (!cancelled) setLines(null)
        })
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [nation, countrySearch])

  if (!lines) return null
  return (
    <span className="v2-meta v2-live-currency">
      <span>{lines.main}</span>
      {lines.inverse ? (
        <span className="v2-live-currency-inverse">{lines.inverse}</span>
      ) : null}
    </span>
  )
}
