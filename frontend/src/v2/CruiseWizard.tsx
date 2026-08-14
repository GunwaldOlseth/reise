import { useState } from 'react'
import { ClockTimeInput } from './ClockTimeInput'
import { CitySuggestFields } from '../CitySuggest'
import {
  addDaysIso,
  emptyPackage,
  formatDateNO,
  isPackageStop,
  isPackageType,
  newJourneyCost,
  newStopId,
  packageBaseLabel,
  packageDetailLabel,
  packageEndRoleLabel,
  packageFreeDayLabel,
  packageOf,
  packageNightsOf,
  packagePlaceDayLabel,
  packageStartRoleLabel,
  packageTitleLabel,
  packageTypeLabel,
  suggestNextArriveDate,
  syncPackageDays,
  type Journey,
  type JourneyPackage,
  type JourneyPackageDay,
  type JourneyPackageType,
  type JourneyStop,
} from './journeyModel'

const CHOICES: {
  id: 'place' | JourneyPackageType
  title: string
  blurb: string
}[] = [
  {
    id: 'place',
    title: 'By / sted',
    blurb: 'Hotell og transport hit — ett stopp på ferden',
  },
  {
    id: 'cruise',
    title: 'Cruise',
    blurb: 'Skip og netter — havner eller til sjøs som én pakke',
  },
  {
    id: 'tour',
    title: 'Pakketur',
    blurb: 'Guidet eller organisert tur over flere dager',
  },
  {
    id: 'charter',
    title: 'Charter',
    blurb: 'Fly + hotell / all-inclusive som én blokk',
  },
  {
    id: 'roadtrip',
    title: 'Roadtrip',
    blurb: 'Bilferie med flere stopp uten by-transport mellom dagene',
  },
  {
    id: 'other',
    title: 'Annet (flerdagers)',
    blurb: 'Festival, spa, safari, kurs — egen pakke rundt flere dager',
  },
]

export function OnwardChoiceSheet({
  onClose,
  onPlace,
  onPackage,
  onHome,
}: {
  onClose: () => void
  onPlace: () => void
  onPackage: (type: JourneyPackageType) => void
  onHome?: () => void
}) {
  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel">
        <div className="v2-sheet-head">
          <div>
            <h2>Reise videre</h2>
            <p className="v2-meta">
              Neste by, en flerdagers pakke, eller hjem når turen er over.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Lukk"
            onClick={onClose}
          >
            Lukk
          </button>
        </div>
        <div className="v2-choice-grid">
          {CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="v2-choice-card"
              title={c.title}
              onClick={() =>
                c.id === 'place' ? onPlace() : onPackage(c.id)
              }
            >
              <strong>{c.title}</strong>
              <span>{c.blurb}</span>
            </button>
          ))}
          {onHome ? (
            <button
              type="button"
              className="v2-choice-card is-home"
              title="Reise hjem"
              onClick={onHome}
            >
              <strong>Reise hjem</strong>
              <span>Avslutt ferden — tilbake til hjemmeadressen</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function PackageWizard({
  journey,
  packageType,
  stopId,
  fromStopId,
  tripStartDate = '',
  saving,
  onClose,
  onSave,
}: {
  journey: Journey
  packageType: JourneyPackageType
  stopId?: string
  fromStopId?: string
  tripStartDate?: string
  saving: boolean
  onClose: () => void
  onSave: (stop: JourneyStop) => Promise<void>
}) {
  const existing = stopId
    ? journey.stops.find(
        (s) => s.id === stopId && isPackageStop(s) && s.kind === packageType,
      )
    : undefined
  const type: JourneyPackageType =
    existing && isPackageType(existing.kind) ? existing.kind : packageType

  const [arriveDate, setArriveDate] = useState(
    () =>
      existing?.arriveDate ||
      suggestNextArriveDate(journey, tripStartDate, fromStopId),
  )
  const [pack, setPack] = useState<JourneyPackage>(() =>
    syncPackageDays(
      packageOf(existing) || emptyPackage(type, type === 'cruise' ? 7 : 5),
      type,
    ),
  )
  const [localError, setLocalError] = useState('')
  const [openDayId, setOpenDayId] = useState<string | null>(null)

  const freeLabel = packageFreeDayLabel(type)
  const placeLabel = packagePlaceDayLabel(type)

  function patchPack(partial: Partial<JourneyPackage>) {
    setPack((prev) => syncPackageDays({ ...prev, ...partial }, type))
  }

  function updateDay(dayId: string, partial: Partial<JourneyPackageDay>) {
    setPack((prev) =>
      syncPackageDays(
        {
          ...prev,
          days: (prev.days || []).map((d) =>
            d.id === dayId ? { ...d, ...partial } : d,
          ),
        },
        type,
      ),
    )
  }

  function toggleDay(dayId: string) {
    setOpenDayId((prev) => (prev === dayId ? null : dayId))
  }

  function daySummary(day: JourneyPackageDay): string {
    if (day.atSea) return freeLabel
    const place = day.city?.trim() || `${placeLabel} ikke satt`
    const home = (pack.basePlace || '').trim().toLowerCase()
    const nights = pack.nights || 1
    const atHome =
      type === 'cruise' &&
      !!home &&
      place.toLowerCase() === home &&
      day.offset !== nights
    const isLast = day.offset === nights
    const times = [
      atHome ? '' : day.arriveTime?.trim(),
      type === 'cruise' && isLast ? '' : day.leaveTime?.trim(),
    ].filter(Boolean)
    return times.length ? `${place} · ${times.join('–')}` : place
  }

  function dayRoleLabel(day: JourneyPackageDay, nights: number): string {
    if (day.offset === 0) return packageStartRoleLabel(type)
    if (day.offset === nights) return packageEndRoleLabel(type)
    return ''
  }

  async function finish() {
    setLocalError('')
    const nextPack = {
      ...syncPackageDays(pack, type),
      title: (pack.title || '').trim(),
      detail: (pack.detail || '').trim(),
      price: (pack.price || '').trim(),
      basePlace: (pack.basePlace || '').trim(),
      baseCountry: (pack.baseCountry || '').trim(),
      costs: (pack.costs || [])
        .map((c, i) => ({
          ...c,
          title: (c.title || '').trim(),
          price: (c.price || '').trim(),
          notes: (c.notes || '').trim(),
          sortOrder: i,
        }))
        .filter((c) => c.title || c.price),
    }
    const base = (nextPack.basePlace || '').trim()
    if (!base) {
      setLocalError(`Sett ${packageBaseLabel(type).toLowerCase()}`)
      return
    }
    if (!arriveDate.trim()) {
      setLocalError('Velg startdato')
      return
    }
    const stop: JourneyStop = {
      id: existing?.id || newStopId(),
      city: base,
      country: (nextPack.baseCountry || '').trim(),
      latitude: nextPack.baseLatitude,
      longitude: nextPack.baseLongitude,
      address: '',
      arriveDate: arriveDate.trim(),
      kind: type,
      stay: null,
      pack: nextPack,
      cruise: null,
      notes: (existing?.notes || '').trim(),
      sortOrder: existing?.sortOrder ?? journey.stops.length,
    }
    try {
      await onSave(stop)
    } catch {
      /* parent */
    }
  }

  const days = [...(pack.days || [])].sort((a, b) => a.offset - b.offset)
  const typeName = packageTypeLabel(type)

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel v2-cruise-form">
        <div className="v2-sheet-head">
          <div>
            <h2>
              {existing ? `Rediger ${typeName.toLowerCase()}` : typeName}
            </h2>
            <p className="v2-meta">
              Én pakke for flere dager — uten hotell og by-transport mellom
              dagene.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Lukk"
            onClick={onClose}
          >
            Lukk
          </button>
        </div>

        <div className="form-grid v2-cruise-fields">
          <label className="v2-cruise-ship">
            {packageTitleLabel(type)}
            <input
              value={pack.title || ''}
              onChange={(e) => patchPack({ title: e.target.value })}
              placeholder={
                type === 'cruise'
                  ? 'MSC Euribia'
                  : type === 'tour'
                    ? 'Tuscany walking'
                    : type === 'charter'
                      ? 'Rhodos all-inclusive'
                      : type === 'roadtrip'
                        ? 'Ring of Kerry'
                        : 'Navn på opplegget'
              }
            />
          </label>
          <label className="v2-cruise-nights">
            Netter
            <input
              inputMode="numeric"
              value={packageNightsOf(pack)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^\d]/g, '') || '1')
                patchPack({ nights: Math.max(1, Math.min(30, n)) })
              }}
            />
          </label>
          <label className="v2-cruise-date">
            Startdato
            <input
              type="date"
              value={arriveDate}
              onChange={(e) => setArriveDate(e.target.value)}
            />
          </label>
          <div className="v2-cruise-home">
            <CitySuggestFields
              city={pack.basePlace || ''}
              country={pack.baseCountry || ''}
              cityLabel={packageBaseLabel(type)}
              cityPlaceholder={
                type === 'cruise' ? 'Genova…' : 'Startby / base…'
              }
              hideHint
              onCityChange={(city) =>
                patchPack({
                  basePlace: city,
                  baseLatitude: undefined,
                  baseLongitude: undefined,
                })
              }
              onCountryChange={(country) =>
                patchPack({ baseCountry: country })
              }
              onSelectPlace={(city, country, place) =>
                patchPack({
                  basePlace: city,
                  baseCountry: country || '',
                  baseLatitude: place?.latitude,
                  baseLongitude: place?.longitude,
                })
              }
            />
          </div>
          <label className="v2-cruise-cabin">
            {packageDetailLabel(type)}
            <input
              value={pack.detail || ''}
              onChange={(e) => patchPack({ detail: e.target.value })}
              placeholder={type === 'cruise' ? '8234' : 'Valgfritt'}
            />
          </label>
          <label className="v2-cruise-price">
            Pris
            <input
              value={pack.price || ''}
              onChange={(e) => patchPack({ price: e.target.value })}
              placeholder="12 000 kr"
              inputMode="decimal"
            />
          </label>
        </div>

        <div className="v2-cruise-costs">
          <div className="v2-cruise-costs-head">
            <h3>Ekstra kostnader</h3>
            <button
              type="button"
              className="btn btn-soft btn-sm"
              title="Legg til kostnad"
              onClick={() =>
                patchPack({
                  costs: [
                    ...(pack.costs || []),
                    newJourneyCost((pack.costs || []).length),
                  ],
                })
              }
            >
              + Kostnad
            </button>
          </div>
          {(pack.costs || []).length === 0 ? (
            <p className="v2-meta">Valgfritt — drikkepakke, tips, utflukter…</p>
          ) : (
            <div className="v2-cruise-cost-list">
              {(pack.costs || []).map((cost) => (
                <div key={cost.id} className="v2-cruise-cost-row">
                  <label>
                    Kostnad
                    <input
                      value={cost.title}
                      placeholder="Drikkepakke…"
                      onChange={(e) =>
                        patchPack({
                          costs: (pack.costs || []).map((c) =>
                            c.id === cost.id
                              ? { ...c, title: e.target.value }
                              : c,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Pris
                    <input
                      value={cost.price || ''}
                      placeholder="500 kr"
                      inputMode="decimal"
                      onChange={(e) =>
                        patchPack({
                          costs: (pack.costs || []).map((c) =>
                            c.id === cost.id
                              ? { ...c, price: e.target.value }
                              : c,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title="Fjern kostnad"
                    onClick={() =>
                      patchPack({
                        costs: (pack.costs || []).filter(
                          (c) => c.id !== cost.id,
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="v2-cruise-edit">
          <h3>Dager</h3>
          <div className="v2-cruise-edit-list">
            {days.map((day) => {
              const date = arriveDate
                ? addDaysIso(arriveDate, day.offset)
                : ''
              const nights = pack.nights || 1
              const isStart = day.offset === 0
              const isLast = day.offset === nights
              const isEnd = isStart || isLast
              const expanded = openDayId === day.id
              const role = dayRoleLabel(day, nights)
              const homePort = pack.basePlace?.trim() || ''
              const startLocked = isStart && type === 'cruise'
              return (
                <div
                  key={day.id}
                  className={`v2-cruise-edit-row${day.atSea ? ' is-sea' : ''}${
                    expanded ? ' is-open' : ''
                  }`}
                >
                  <div className="v2-cruise-edit-head">
                    <button
                      type="button"
                      className="v2-cruise-edit-summary"
                      aria-expanded={expanded}
                      title={expanded ? 'Skjul dag' : 'Vis dag'}
                      onClick={() => toggleDay(day.id)}
                    >
                      <span className="v2-cruise-edit-title">
                        {date ? formatDateNO(date) : `Dag ${day.offset + 1}`}
                        {role ? ` · ${role}` : ''}
                      </span>
                      <span className="v2-cruise-edit-meta">
                        {startLocked
                          ? homePort || packageBaseLabel(type)
                          : daySummary(day)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="v2-cruise-edit-toggle"
                      aria-label={expanded ? 'Skjul dag' : 'Vis dag'}
                      title={expanded ? 'Skjul dag' : 'Vis dag'}
                      onClick={() => toggleDay(day.id)}
                    >
                      {expanded ? '▴' : '▾'}
                    </button>
                  </div>
                  {expanded && (
                    <div className="v2-cruise-edit-body">
                      {!startLocked && (
                        <label className="v2-cruise-sea">
                          <input
                            type="checkbox"
                            checked={day.atSea}
                            disabled={isEnd}
                            onChange={(e) =>
                              updateDay(day.id, {
                                atSea: e.target.checked,
                                city: e.target.checked ? freeLabel : '',
                                country: '',
                                arriveTime: '',
                                leaveTime: '',
                              })
                            }
                          />
                          {freeLabel}
                        </label>
                      )}
                      {startLocked ? (
                        <>
                          <p className="v2-meta" style={{ margin: 0 }}>
                            Havn er {packageBaseLabel(type).toLowerCase()}
                            {homePort ? ` (${homePort})` : ''}. Endre i feltet
                            over. Ingen ankomst — skipet starter her.
                          </p>
                          <div className="v2-cruise-times">
                            <ClockTimeInput
                              placeholder="Avg."
                              aria-label="Avgang"
                              value={day.leaveTime || ''}
                              onChange={(value) =>
                                updateDay(day.id, {
                                  arriveTime: '',
                                  leaveTime: value,
                                })
                              }
                            />
                          </div>
                        </>
                      ) : (
                        !day.atSea && (
                          <div className="v2-cruise-edit-port">
                            <CitySuggestFields
                              city={day.city || ''}
                              country={day.country || ''}
                              cityLabel={placeLabel}
                              cityPlaceholder={`${placeLabel}…`}
                              showCountry={false}
                              hideHint
                              onCityChange={(city) =>
                                updateDay(day.id, {
                                  city,
                                  latitude: undefined,
                                  longitude: undefined,
                                  ...(type === 'cruise' &&
                                  homePort &&
                                  !isLast &&
                                  city.trim().toLowerCase() ===
                                    homePort.toLowerCase()
                                    ? { arriveTime: '' }
                                    : {}),
                                })
                              }
                              onCountryChange={(country) =>
                                updateDay(day.id, { country })
                              }
                              onSelectPlace={(city, country, place) =>
                                updateDay(day.id, {
                                  city,
                                  country: country || '',
                                  latitude: place?.latitude,
                                  longitude: place?.longitude,
                                  ...(type === 'cruise' &&
                                  homePort &&
                                  !isLast &&
                                  city.trim().toLowerCase() ===
                                    homePort.toLowerCase()
                                    ? { arriveTime: '' }
                                    : {}),
                                })
                              }
                              className="city-suggest-via"
                            />
                            <div className="v2-cruise-times">
                              {!(
                                type === 'cruise' &&
                                homePort &&
                                !isLast &&
                                (day.city || '').trim().toLowerCase() ===
                                  homePort.toLowerCase()
                              ) && (
                                <ClockTimeInput
                                  placeholder="Ank."
                                  aria-label="Ankomst"
                                  value={day.arriveTime || ''}
                                  onChange={(value) =>
                                    updateDay(day.id, {
                                      arriveTime: value,
                                    })
                                  }
                                />
                              )}
                              {!(type === 'cruise' && isLast) && (
                                <ClockTimeInput
                                  placeholder="Avg."
                                  aria-label="Avgang"
                                  value={day.leaveTime || ''}
                                  onChange={(value) =>
                                    updateDay(day.id, {
                                      leaveTime: value,
                                    })
                                  }
                                />
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {localError && <p className="v2-error">{localError}</p>}

        <div className="v2-sheet-actions">
          <button
            type="button"
            className="btn btn-soft"
            disabled={saving}
            title="Avbryt"
            onClick={onClose}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            title={`Lagre ${typeName.toLowerCase()}`}
            onClick={() => void finish()}
          >
            {saving ? 'Lagrer…' : `Lagre ${typeName.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/** @deprecated use PackageWizard */
export function CruiseWizard(
  props: Omit<Parameters<typeof PackageWizard>[0], 'packageType'> & {
    packageType?: JourneyPackageType
  },
) {
  return <PackageWizard {...props} packageType={props.packageType || 'cruise'} />
}
