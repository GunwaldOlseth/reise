import { useEffect, useState } from 'react'
import { api, type CurrencyReport } from '../api'

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

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return ''
  const digits = rate >= 100 ? 0 : rate >= 10 ? 2 : 3
  return new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(rate)
}

function currencyLine(report: CurrencyReport): string | null {
  const code = (report.currencyCode || '').trim()
  if (!code) return null
  const name = (report.currencyName || code).trim()
  const label = name.toLowerCase() === code.toLowerCase()
    ? code
    : `${name} (${code})`
  if (report.isNok) {
    return `Valuta: ${label}`
  }
  if (report.rateToNok && report.rateToNok > 0) {
    const rate = formatRate(report.rateToNok)
    const unit = code === 'EUR' ? 'euro' : `1 ${code}`
    return `Valuta: ${label} · ca. ${rate} kr per ${unit}`
  }
  return `Valuta: ${label}`
}

export function LiveCityCurrency({
  country,
  countrySearch,
}: {
  country?: string
  countrySearch?: string
}) {
  const nation = (country || '').trim()
  const [line, setLine] = useState<string | null>(null)

  useEffect(() => {
    if (!nation) {
      setLine(null)
      return
    }
    let cancelled = false
    loadCurrency(nation, countrySearch)
      .then((report) => {
        if (cancelled) return
        setLine(currencyLine(report))
      })
      .catch(() => {
        if (!cancelled) setLine(null)
      })
    return () => {
      cancelled = true
    }
  }, [nation, countrySearch])

  if (!line) return null
  return <span className="v2-meta v2-live-currency">{line}</span>
}
