import { useEffect, useMemo, useState } from 'react'
import { api, type CurrencyReport, type Trip } from '../api'
import {
  countryCurrencyKey,
  customRateToNok,
  loadCustomCurrencyRates,
  saveCustomCurrencyRate,
  type CustomCurrencySample,
} from '../userSettings'
import { cacheJourney, cachedJourney } from './journeyCache'
import { journeyVisitPlaces } from './journeyModel'
import {
  formatKrPerUnit,
  formatUnitPerKr,
  joinCurrencyParts,
} from './currencyFormat'

type CountryRow = {
  country: string
  key: string
}

function parseDraftAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? n : null
}

function CountryCurrencyEditor({
  country,
  report,
  sample,
  onSampleChange,
}: {
  country: string
  report: CurrencyReport | null
  sample: CustomCurrencySample | null
  onSampleChange: (next: CustomCurrencySample | null) => void
}) {
  const code = (report?.currencyCode || '').trim()
  const [foreignDraft, setForeignDraft] = useState(
    sample ? String(sample.foreignAmount) : '',
  )
  const [nokDraft, setNokDraft] = useState(
    sample ? String(sample.nokCharged) : '',
  )

  useEffect(() => {
    setForeignDraft(sample ? String(sample.foreignAmount) : '')
    setNokDraft(sample ? String(sample.nokCharged) : '')
  }, [sample?.foreignAmount, sample?.nokCharged])

  function commit() {
    const foreignAmount = parseDraftAmount(foreignDraft)
    const nokCharged = parseDraftAmount(nokDraft)
    if (foreignAmount && nokCharged) {
      onSampleChange({ foreignAmount, nokCharged })
    } else if (!foreignDraft.trim() && !nokDraft.trim()) {
      onSampleChange(null)
    }
  }

  const customRate = sample ? customRateToNok(sample) : null
  const marketRate =
    report?.rateToNok && report.rateToNok > 0 ? report.rateToNok : null

  const marketLine =
    code && marketRate && !report?.isNok
      ? joinCurrencyParts([
          formatKrPerUnit(code, marketRate),
          formatUnitPerKr(code, marketRate),
        ])
      : report?.isNok
        ? 'Norske kroner — ingen veksling'
        : code
          ? 'Markedskurs ikke tilgjengelig'
          : 'Ukjent valuta for landet'

  const customLine =
    code && customRate
      ? joinCurrencyParts([
          formatKrPerUnit(code, customRate, { custom: true }),
          formatUnitPerKr(code, customRate),
        ])
      : ''

  return (
    <li className="v2-currency-rate-row">
      <div className="v2-currency-rate-head">
        <strong>{country}</strong>
        {code ? <span className="v2-meta">{report?.currencyName || code}</span> : null}
      </div>
      <p className="v2-meta v2-currency-rate-market">{marketLine}</p>
      <div className="v2-currency-rate-fields">
        <label>
          Beløp i valuta
          <input
            type="text"
            inputMode="decimal"
            placeholder={code ? `f.eks. 100 ${code}` : 'Beløp'}
            value={foreignDraft}
            onChange={(e) => setForeignDraft(e.target.value)}
            onBlur={commit}
          />
        </label>
        <label>
          Trukket på konto (kr)
          <input
            type="text"
            inputMode="decimal"
            placeholder="f.eks. 1150"
            value={nokDraft}
            onChange={(e) => setNokDraft(e.target.value)}
            onBlur={commit}
          />
        </label>
      </div>
      {customLine ? (
        <p className="v2-meta v2-currency-rate-custom">{customLine}</p>
      ) : (
        <p className="v2-meta">
          Fyll inn begge felt for å lagre egen kurs (brukes i Live).
        </p>
      )}
      {sample ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm v2-currency-rate-clear"
          onClick={() => {
            setForeignDraft('')
            setNokDraft('')
            onSampleChange(null)
          }}
        >
          Fjern egen kurs
        </button>
      ) : null}
    </li>
  )
}

export function CurrencyRatesCard({
  trips,
  focusTripId,
}: {
  trips: Trip[]
  focusTripId?: string
}) {
  const [journeysReady, setJourneysReady] = useState(false)
  const [rates, setRates] = useState(() => loadCustomCurrencyRates())
  const [reports, setReports] = useState<Record<string, CurrencyReport | 'loading' | 'error'>>(
    {},
  )

  const tripIds = useMemo(
    () =>
      focusTripId
        ? trips.filter((t) => t.id === focusTripId).map((t) => t.id)
        : trips.map((t) => t.id),
    [trips, focusTripId],
  )

  const countries = useMemo(() => {
    const out: CountryRow[] = []
    const seen = new Set<string>()
    for (const tripId of tripIds) {
      const journey = cachedJourney(tripId)
      if (!journey) continue
      for (const country of journeyVisitPlaces(journey).countries) {
        const key = countryCurrencyKey(country)
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push({ country, key })
      }
    }
    return out
  }, [tripIds, journeysReady])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      for (const id of tripIds) {
        if (cachedJourney(id)) continue
        try {
          const journey = await api.getJourney(id)
          cacheJourney(journey)
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setJourneysReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [tripIds])

  useEffect(() => {
    if (!countries.length) return
    let cancelled = false
    for (const row of countries) {
      setReports((prev) => ({ ...prev, [row.key]: 'loading' }))
      void api
        .getCurrency(row.country)
        .then((report) => {
          if (cancelled) return
          setReports((prev) => ({ ...prev, [row.key]: report }))
        })
        .catch(() => {
          if (cancelled) return
          setReports((prev) => ({ ...prev, [row.key]: 'error' }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [countries])

  function updateSample(country: string, sample: CustomCurrencySample | null) {
    setRates(saveCustomCurrencyRate(country, sample))
  }

  return (
    <section className="v2-settings-card">
      <h2>Vekslingskurs</h2>
      <p className="v2-meta">
        Land fra {focusTripId ? 'denne reisen' : 'åpne reiser'}. Legg inn hva du
        betalte i valuta og hva som faktisk ble trukket i kroner — da brukes din
        kurs i Live i stedet for markedskursen.
      </p>
      {!journeysReady && tripIds.length > 0 ? (
        <p className="v2-meta">Laster reiser …</p>
      ) : countries.length === 0 ? (
        <p className="v2-meta">
          Ingen land i planen ennå. Åpne Innstillinger fra en reise for kun
          land på den turen.
        </p>
      ) : (
        <ul className="v2-currency-rate-list">
          {countries.map((row) => {
            const hit = reports[row.key]
            const report =
              hit && hit !== 'loading' && hit !== 'error' ? hit : null
            return (
              <CountryCurrencyEditor
                key={row.key}
                country={row.country}
                report={report}
                sample={rates[row.key] ?? null}
                onSampleChange={(sample) => updateSample(row.country, sample)}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}
