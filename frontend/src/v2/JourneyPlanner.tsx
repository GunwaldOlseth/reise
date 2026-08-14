import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { CitySuggestFields } from '../CitySuggest'
import { PlaceMetaIcon, TrashIcon, TransportModeIcon } from '../TransportModeIcon'
import { PackageWizard, OnwardChoiceSheet } from './CruiseWizard'
import {
  applyRegisteredHome,
  formatHomePlace,
  hasHomePlace,
  type HomePlace,
  type PlannerSettings,
} from '../userSettings'
import {
  activitiesForDay,
  addDaysIso,
  cityStayDays,
  cityDocsOf,
  compactCityDocs,
  compactLive,
  confirmShiftAfterNights,
  emptyJourney,
  formatDateNO,
  freeDaysBetweenStops,
  gapFillPrefill,
  hasPlanGapBetween,
  insertStopBefore,
  journeyWithRegisteredHome,
  keepPlacePurpose,
  isPackageStop,
  isPackageType,
  isViaHopFilled,
  legForGap,
  legModeLabel,
  legTransportGaps,
  moveTransportSegment,
  newJourneyVia,
  newStopId,
  newTransportOption,
  normalizeSights,
  packageFreeDayLabel,
  packageNightsOf,
  packageOf,
  packageDayTableRow,
  packageTypeLabel,
  removeStop,
  replaceDayActivities,
  reorderTransportSegments,
  modeHasPlatform,
  modeIsFlight,
  modeIsOther,
  modeIsWalk,
  sortTransportOptionsByTime,
  samePlaceName,
  scheduleWarnings,
  shiftStopsAfter,
  stayNights,
  stopDepartDate,
  stopShiftLabel,
  showOnwardFromHere,
  stopWarningLabel,
  suggestNextArriveDate,
  summarizeTransport,
  summarizeViaHop,
  syncJourneyLegs,
  transportSegments,
  upsertStop,
  viaPurpose,
  viaTransportOptions,
  stopPurpose,
  warningsForStop,
  withTransportSegments,
  withViaOptions,
  type Journey,
  type JourneyLeg,
  type JourneyLegMode,
  type JourneyPackageType,
  type JourneyStay,
  type JourneyStop,
  type JourneyTransportOption,
  type JourneyVia,
} from './journeyModel'
import { localizeJourneyPlaces } from '../placeNames'
import { CityDocsEditor } from './CityDocsEditor'
import { CityInfoTip } from './CityInfoTip'
import { NoteEditor } from './NoteEditor'
import { compactNoteHtml } from './noteHtml'
import { PurposeToggle } from './PurposeToggle'
import { SightList, SightPreview, PlaceLinkedPreview } from './SightList'
import './v2.css'

type WizardKind = 'onward' | 'home' | 'edit' | 'depart' | 'choose' | 'package'
type WizardStep = 'destination' | 'dates' | 'stay' | 'travel' | 'notes'

const LEG_MODES: { value: JourneyLegMode; label: string }[] = [
  { value: 'flight', label: 'Fly' },
  { value: 'train', label: 'Tog' },
  { value: 'tram', label: 'Bybane/trikk' },
  { value: 'bus', label: 'Buss' },
  { value: 'car', label: 'Bil' },
  { value: 'boat', label: 'Båt/ferge' },
  { value: 'walk', label: 'Til fots' },
  { value: 'other', label: 'Annet' },
]

function wizardSteps(
  settings: PlannerSettings,
  kind: WizardKind,
): WizardStep[] {
  if (kind === 'depart') return ['travel']
  const steps: WizardStep[] = ['destination', 'dates']
  if (settings.askStay && kind !== 'home') steps.push('stay')
  // Travel between cities is edited in the thread TransportBlock (via), not here.
  if (settings.askNotes) steps.push('notes')
  return steps
}

function stepLabel(step: WizardStep): string {
  switch (step) {
    case 'destination':
      return 'Hvor'
    case 'dates':
      return 'Når'
    case 'stay':
      return 'Hotell'
    case 'travel':
      return 'Reise'
    case 'notes':
      return 'Notat'
  }
}

function wizardStepFilled(
  step: WizardStep,
  stop: JourneyStop,
  wantStay: boolean,
  stay: JourneyStay,
): boolean {
  switch (step) {
    case 'destination':
      return !!stop.city.trim()
    case 'dates':
      return !!stop.arriveDate.trim()
    case 'stay':
      return wantStay && Math.floor(stay.nights || 0) >= 1
    case 'travel':
    case 'notes':
      return true
  }
}

export function JourneyPlanner({
  tripId,
  tripName,
  tripStartDate = '',
  homePlace,
  settings,
  autoOnward = false,
  embedded = false,
  onBack,
  onOpenSettings,
  onJourneySaved,
}: {
  tripId: string
  tripName: string
  /** Trip start — first «Reise videre» opens in this month. */
  tripStartDate?: string
  homePlace: HomePlace
  settings: PlannerSettings
  /** After create «starter hjemmefra»: open Reise videre immediately. */
  autoOnward?: boolean
  /** Hide own top bar when hosted inside TripHub. */
  embedded?: boolean
  onBack: () => void
  onOpenSettings: () => void
  onJourneySaved?: () => void
}) {
  const [journey, setJourney] = useState<Journey>(() => emptyJourney(tripId))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [wizard, setWizard] = useState<null | {
    kind: WizardKind
    stopId?: string
    packageType?: JourneyPackageType
    /** Insert new place before this stop (gap fill). */
    insertBeforeId?: string
    /** Previous stop id when filling a calendar gap. */
    gapFromId?: string
    /** Continue journey from this stop (date suggestion). */
    fromStopId?: string
  }>(null)
  const [didAutoOnward, setDidAutoOnward] = useState(false)
  /** Expanded place-stop accordion on the thread. */
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null)
  /** Expanded package/cruise card on the thread. */
  const [openPackId, setOpenPackId] = useState<string | null>(null)
  const journeyRef = useRef(journey)
  journeyRef.current = journey
  const placeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transportSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (placeSaveTimer.current) clearTimeout(placeSaveTimer.current)
      if (transportSaveTimer.current) clearTimeout(transportSaveTimer.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void api
      .getJourney(tripId)
      .then((data) => {
        if (cancelled) return
        const next = journeyWithRegisteredHome(
          localizeJourneyPlaces(
            syncJourneyLegs({
              ...emptyJourney(tripId),
              ...data,
              tripId,
            }),
          ),
          homePlace,
        )
        setJourney(next)
        if (
          autoOnward &&
          !didAutoOnward &&
          next.stops.length === 1 &&
          next.stops[0]?.kind === 'home'
        ) {
          setDidAutoOnward(true)
          setWizard({ kind: 'choose' })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunne ikke hente reisen')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tripId, autoOnward, didAutoOnward, homePlace])

  async function persist(
    next: Journey,
    opts?: { quiet?: boolean },
  ) {
    if (!opts?.quiet) setSaving(true)
    setError('')
    try {
      const withSights: Journey = {
        ...next,
        live: compactLive(next.live),
        stops: next.stops.map((s) => {
          const docs = compactCityDocs(cityDocsOf(s))
          return {
            ...s,
            sights: normalizeSights(s.sights),
            docs,
            notes: docs[0]?.body || compactNoteHtml(s.notes || ''),
          }
        }),
        legs: next.legs.map((l) => ({
          ...l,
          vias: (l.vias || []).map((v) => ({
            ...v,
            sights: normalizeSights(v.sights),
          })),
        })),
      }
      const saved = await api.saveJourney(
        tripId,
        localizeJourneyPlaces(
          journeyWithRegisteredHome(syncJourneyLegs(withSights), homePlace),
        ),
      )
      // Quiet saves keep optimistic UI — applying the response would steal
      // focus / overwrite newer keystrokes still in flight.
      if (!opts?.quiet) {
        const synced = syncJourneyLegs(
          keepPlacePurpose(withSights, { ...saved, tripId }),
        )
        journeyRef.current = synced
        setJourney(synced)
      }
      onJourneySaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre')
      throw err
    } finally {
      if (!opts?.quiet) setSaving(false)
    }
  }

  /** Optimistic place edits — debounce API save so inputs keep focus. */
  function patchPlaceStop(
    nextStop: JourneyStop,
    opts?: { immediate?: boolean; nightsDelta?: number },
  ) {
    let base = {
      ...journeyRef.current,
      stops: journeyRef.current.stops.map((s) =>
        s.id === nextStop.id ? nextStop : s,
      ),
    }
    const delta = opts?.immediate ? opts.nightsDelta || 0 : 0
    if (delta) {
      const idx = base.stops.findIndex((s) => s.id === nextStop.id)
      const later = idx >= 0 ? base.stops.slice(idx + 1) : []
      if (
        later.some((s) => (s.arriveDate || '').trim()) &&
        confirmShiftAfterNights(stopShiftLabel(nextStop), delta, later)
      ) {
        base = shiftStopsAfter(base, nextStop.id, delta)
      }
    }
    const next = syncJourneyLegs(base)
    journeyRef.current = next
    setJourney(next)
    if (placeSaveTimer.current) {
      clearTimeout(placeSaveTimer.current)
      placeSaveTimer.current = null
    }
    if (opts?.immediate) {
      void persist(next, { quiet: true })
      return
    }
    placeSaveTimer.current = setTimeout(() => {
      placeSaveTimer.current = null
      void persist(journeyRef.current, { quiet: true })
    }, 450)
  }

  /** Optimistic transport edits — same quiet debounce as place fields. */
  function patchTransportLeg(nextLeg: JourneyLeg) {
    const next = syncJourneyLegs({
      ...journeyRef.current,
      legs: journeyRef.current.legs.map((l) =>
        l.id === nextLeg.id ? nextLeg : l,
      ),
    })
    journeyRef.current = next
    setJourney(next)
    if (transportSaveTimer.current) {
      clearTimeout(transportSaveTimer.current)
      transportSaveTimer.current = null
    }
    transportSaveTimer.current = setTimeout(() => {
      transportSaveTimer.current = null
      void persist(journeyRef.current, { quiet: true })
    }, 450)
  }

  function openOnward(fromStopId?: string) {
    setWizard({ kind: 'choose', fromStopId })
  }

  function openHome(fromStopId?: string) {
    if (!hasHomePlace(homePlace)) {
      setError('Sett hjemmeadresse under Innstillinger først.')
      onOpenSettings()
      return
    }
    setWizard({ kind: 'home', fromStopId })
  }

  return (
    <div className={`v2-shell${embedded ? ' is-embedded' : ''}`}>
      {!embedded && (
        <header className="v2-top">
          <div>
            <h1>{tripName || 'Reise'}</h1>
            <p>Planlegger · reisen som én tråd</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Lukk"
            onClick={onBack}
          >
            Lukk
          </button>
        </header>
      )}

      <div className="v2-thread">
        {error && <p className="v2-error">{error}</p>}
        {loading && <p className="v2-meta">Henter reisen…</p>}
        {!loading && journey.stops.length === 0 && (
          <div className="v2-empty">
            <p>
              Start med neste sted, en flerdagers pakke (cruise, charter …),
              eller hjem når turen er over.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              title="Legg til neste sted, pakke — eller reis hjem"
              onClick={() => openOnward()}
            >
              Reise videre
            </button>
          </div>
        )}

        {journey.stops.map((stop, index) => {
          const warnings = warningsForStop(journey, index, settings)
          const scheduleNotes = scheduleWarnings(journey, index)
          const prev = index > 0 ? journey.stops[index - 1] : null
          const nextStop = journey.stops[index + 1]
          const inboundLeg = prev
            ? legForGap(journey, prev.id, stop.id)
            : null
          const nights = stayNights(stop)
          const depart = stopDepartDate(stop)
          const isHome = stop.kind === 'home'
          const isHomeStart = isHome && index === 0
          const isHomeReturn = isHome && index > 0
          const isPack = isPackageStop(stop)
          const pack = isPack ? packageOf(stop) : null
          const packType = isPackageType(stop.kind) ? stop.kind : 'other'
          const freeDayLabel = packageFreeDayLabel(packType)

          return (
            <div key={stop.id} className="v2-thread-item">
              {prev && inboundLeg && !isPack && (
                <TransportBlock
                  from={prev}
                  to={stop}
                  leg={inboundLeg}
                  warn={warnings.includes('travel')}
                  requireTransportMode={settings.requireTransportMode}
                  disabled={loading}
                  onChange={patchTransportLeg}
                />
              )}

              <div className="v2-stop">
                <div
                  className={`v2-dot${
                    stop.kind === 'home'
                      ? ' is-home'
                      : isPack
                        ? ` is-pack is-${packType}`
                        : ''
                  }`}
                  aria-hidden
                />
                <div>
                  {!isHome && !isPack ? (
                    <PlaceStopPanel
                      stop={stop}
                      warnings={warnings}
                      scheduleNotes={scheduleNotes}
                      nights={nights}
                      depart={depart}
                      warnMissingStay={settings.warnMissingStay}
                      open={openPlaceId === stop.id}
                      disabled={loading}
                      onToggle={() =>
                        setOpenPlaceId((id) =>
                          id === stop.id ? null : stop.id,
                        )
                      }
                      onChange={(nextStop, opts) => {
                        patchPlaceStop(nextStop, opts)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`v2-stop-card${
                        !isHomeStart && warnings.length ? ' is-warn' : ''
                      }${isPack ? ` is-pack is-${packType}` : ''}${
                        isPack && openPackId === stop.id ? ' is-open' : ''
                      }`}
                      title={
                        isPack
                          ? openPackId === stop.id
                            ? 'Skjul pakke'
                            : 'Åpne pakke'
                          : isHomeReturn
                            ? 'Hjemkomst — adresse fra innstillinger'
                            : 'Rediger hjem'
                      }
                      onClick={() => {
                        if (isPack && isPackageType(stop.kind)) {
                          setOpenPackId((id) =>
                            id === stop.id ? null : stop.id,
                          )
                          return
                        }
                        setWizard({ kind: 'edit', stopId: stop.id })
                      }}
                    >
                      <div className="v2-stop-head">
                        <span className="v2-stop-title">
                          {isHome
                            ? `Hjem · ${stop.city || 'Hjem'}`
                            : [
                                pack?.title?.trim()
                                  ? pack.title.trim()
                                  : `${packageTypeLabel(packType)} · ${
                                      stop.city || 'Pakke'
                                    }`,
                                stop.arriveDate && nights > 0
                                  ? `${formatDateNO(stop.arriveDate)}–${formatDateNO(depart)} (${nights}n)`
                                  : stop.arriveDate
                                    ? formatDateNO(stop.arriveDate)
                                    : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                        {!isHomeStart && warnings.length > 0 && (
                          <span
                            className="v2-warn-badge"
                            title={warnings.map(stopWarningLabel).join(', ')}
                          >
                            !
                          </span>
                        )}
                      </div>
                      <div className="v2-meta">
                        {isHome
                          ? [
                              stop.address,
                              stop.country,
                              isHomeStart
                                ? stop.arriveDate
                                  ? `Startdato ${formatDateNO(stop.arriveDate)}`
                                  : ''
                                : stop.arriveDate
                                  ? formatDateNO(stop.arriveDate)
                                  : '',
                              isHomeStart
                                ? 'Startpunkt — uten reise'
                                : 'Hjemkomst',
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : [
                              stop.city,
                              stop.country,
                              `${(pack?.days || []).filter((d) => d.atSea).length} ${freeDayLabel.toLowerCase()}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                      </div>
                      {scheduleNotes.length > 0 && (
                        <ul className="v2-schedule-warn">
                          {scheduleNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </button>
                  )}
                  {isPack && (pack?.days || []).length > 0 && (
                    <table className="v2-cruise-day-table">
                      <thead>
                        <tr>
                          <th scope="col">Dato</th>
                          <th scope="col">
                            {packType === 'cruise' ? 'Havn' : 'Sted'}
                          </th>
                          <th scope="col">Ank.</th>
                          <th scope="col">Avg.</th>
                          <th scope="col">
                            {packType === 'cruise' ? 'I havn' : 'Tid'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pack?.days || []).map((day) => {
                          const row = packageDayTableRow(day, {
                            type: packType,
                            nights: nights || pack?.nights || 1,
                            basePlace: pack?.basePlace,
                            freeLabel: freeDayLabel,
                            placeFallback:
                              packType === 'cruise' ? 'Havn' : 'Sted',
                          })
                          const date = stop.arriveDate
                            ? formatDateNO(
                                addDaysIso(stop.arriveDate, day.offset),
                              )
                            : `Dag ${day.offset + 1}`
                          return (
                            <tr
                              key={day.id}
                              className={row.atSea ? 'is-sea' : undefined}
                            >
                              <td className="v2-cruise-day-date">{date}</td>
                              <td>{row.place}</td>
                              <td>{row.arrive || '—'}</td>
                              <td>{row.leave || '—'}</td>
                              <td>{row.portHours || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {isPack && openPackId === stop.id && (pack?.days || []).length > 0 && (
                    <div className="v2-pack-day-programs">
                      {(pack?.days || []).map((day) => {
                        const place =
                          day.atSea
                            ? freeDayLabel
                            : day.city?.trim() ||
                              pack?.basePlace?.trim() ||
                              stop.city ||
                              'Dag'
                        const date = stop.arriveDate
                          ? formatDateNO(
                              addDaysIso(stop.arriveDate, day.offset),
                            )
                          : `Dag ${day.offset + 1}`
                        return (
                          <div key={day.id} className="v2-city-day">
                            <div className="v2-city-day-head">
                              <span className="v2-cruise-day-date">{date}</span>
                              <span>{place}</span>
                            </div>
                            <SightList
                              sights={activitiesForDay(stop.sights, day.offset)}
                              dayOffset={day.offset}
                              disabled={loading}
                              heading="Utflukter og severdigheter"
                              suggestCountry={
                                day.country || pack?.baseCountry || stop.country
                              }
                              onChange={(dayList) =>
                                patchPlaceStop(
                                  {
                                    ...stop,
                                    sights: replaceDayActivities(
                                      stop.sights,
                                      day.offset,
                                      dayList,
                                    ),
                                  },
                                  { immediate: true },
                                )
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="v2-stop-actions">
                    {isHomeStart && !nextStop && (
                      <button
                        type="button"
                        className="v2-chip-btn"
                        disabled={saving}
                        title="Legg til neste sted eller pakke"
                        onClick={() => openOnward()}
                      >
                        Reise videre
                      </button>
                    )}
                    {isHomeReturn && (
                      <button
                        type="button"
                        className="v2-chip-btn is-danger"
                        disabled={saving}
                        title="Slett hjemkomst"
                        onClick={() => {
                          if (!confirm('Slette hjemkomst?')) return
                          void persist(removeStop(journey, stop.id))
                        }}
                      >
                        Slett
                      </button>
                    )}
                    {!isHomeStart &&
                      showOnwardFromHere(stop, nextStop) && (
                      <button
                        type="button"
                        className="v2-chip-btn"
                        disabled={saving}
                        title="Reise videre herfra"
                        onClick={() => {
                          if (nextStop) {
                            setWizard({ kind: 'depart', stopId: stop.id })
                          } else {
                            openOnward(stop.id)
                          }
                        }}
                      >
                        Reise videre herfra
                      </button>
                    )}
                    {isPack && openPackId === stop.id && (
                      <button
                        type="button"
                        className="v2-chip-btn"
                        disabled={saving}
                        title="Rediger pakke"
                        onClick={() =>
                          setWizard({
                            kind: 'package',
                            stopId: stop.id,
                            packageType: packType,
                          })
                        }
                      >
                        Rediger
                      </button>
                    )}
                    {!isHome &&
                      (openPlaceId === stop.id || openPackId === stop.id) && (
                      <>
                        <button
                          type="button"
                          className="v2-chip-btn is-danger"
                          disabled={saving}
                          title="Slett"
                          onClick={() => {
                            if (!confirm(`Slette ${stop.city || 'stoppet'}?`))
                              return
                            void persist(removeStop(journey, stop.id))
                            setOpenPackId((id) =>
                              id === stop.id ? null : id,
                            )
                          }}
                        >
                          Slett
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {nextStop && hasPlanGapBetween(stop, nextStop) && (
                <GapMarker
                  from={stop}
                  to={nextStop}
                  disabled={saving}
                  onFill={() =>
                    setWizard({
                      kind: 'onward',
                      insertBeforeId: nextStop.id,
                      gapFromId: stop.id,
                    })
                  }
                />
              )}
            </div>
          )
        })}
      </div>

      {wizard && wizard.kind === 'choose' && (
        <OnwardChoiceSheet
          onClose={() => setWizard(null)}
          onPlace={() =>
            setWizard({ kind: 'onward', fromStopId: wizard.fromStopId })
          }
          onPackage={(packageType) =>
            setWizard({
              kind: 'package',
              packageType,
              fromStopId: wizard.fromStopId,
            })
          }
          onHome={() => openHome(wizard.fromStopId)}
        />
      )}

      {wizard && wizard.kind === 'package' && wizard.packageType && (
        <PackageWizard
          journey={journey}
          packageType={wizard.packageType}
          stopId={wizard.stopId}
          fromStopId={wizard.fromStopId}
          tripStartDate={tripStartDate}
          saving={saving}
          onClose={() => setWizard(null)}
          onSave={async (stop) => {
            const existing = journey.stops.find((s) => s.id === stop.id)
            let next = upsertStop(journey, stop, null)
            if (existing) {
              const delta =
                packageNightsOf(packageOf(stop)) -
                packageNightsOf(packageOf(existing))
              const idx = next.stops.findIndex((s) => s.id === stop.id)
              const later = idx >= 0 ? next.stops.slice(idx + 1) : []
              if (
                delta &&
                later.some((s) => (s.arriveDate || '').trim()) &&
                confirmShiftAfterNights(stopShiftLabel(stop), delta, later)
              ) {
                next = shiftStopsAfter(next, stop.id, delta)
              }
            }
            await persist(next)
            setOpenPackId(stop.id)
            setWizard(null)
          }}
        />
      )}

      {wizard && wizard.kind === 'depart' && wizard.stopId && (
        <DepartLegSheet
          journey={journey}
          fromStopId={wizard.stopId}
          saving={saving}
          onClose={() => setWizard(null)}
          onSave={async (fromId, toId, patch) => {
            const next = {
              ...journey,
              legs: journey.legs.map((l) =>
                l.fromStopId === fromId && l.toStopId === toId
                  ? { ...l, ...patch, fromStopId: fromId, toStopId: toId }
                  : l,
              ),
            }
            await persist(syncJourneyLegs(next))
            setWizard(null)
          }}
          onNeedDestination={() => {
            setWizard({ kind: 'choose', fromStopId: wizard.stopId })
          }}
        />
      )}

      {wizard &&
        wizard.kind !== 'depart' &&
        wizard.kind !== 'choose' &&
        wizard.kind !== 'package' && (
        <StopWizard
          journey={journey}
          settings={settings}
          kind={wizard.kind}
          stopId={wizard.stopId}
          insertBeforeId={wizard.insertBeforeId}
          gapFromId={wizard.gapFromId}
          fromStopId={wizard.fromStopId}
          tripStartDate={tripStartDate}
          homePlace={homePlace}
          saving={saving}
          onClose={() => setWizard(null)}
          onSave={async (stop, inboundLeg) => {
            const next = wizard.insertBeforeId
              ? insertStopBefore(journey, stop, wizard.insertBeforeId)
              : upsertStop(journey, stop, inboundLeg)
            await persist(next)
            if (stop.kind === 'place') setOpenPlaceId(stop.id)
            setWizard(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Place city after creation: accordion with stay basics + per-day
 * severdigheter / utflukter. The step wizard is create-only.
 */
function PlaceStopPanel({
  stop,
  warnings,
  scheduleNotes,
  nights,
  depart,
  warnMissingStay,
  open,
  disabled,
  onToggle,
  onChange,
}: {
  stop: JourneyStop
  warnings: ReturnType<typeof warningsForStop>
  scheduleNotes: string[]
  nights: number
  depart: string
  warnMissingStay: boolean
  open: boolean
  disabled?: boolean
  onToggle: () => void
  onChange: (
    stop: JourneyStop,
    opts?: { immediate?: boolean; nightsDelta?: number },
  ) => void
}) {
  const [editingBasics, setEditingBasics] = useState(false)
  const [editingHotel, setEditingHotel] = useState(false)
  const nightsAtEditStart = useRef(nights)
  const activityCount = normalizeSights(stop.sights).length
  const stay: JourneyStay = stop.stay || {
    nights: 1,
    hotelName: '',
    address: '',
  }

  useEffect(() => {
    if (!open) {
      setEditingBasics(false)
      setEditingHotel(false)
    }
  }, [open])

  useEffect(() => {
    if (editingHotel) nightsAtEditStart.current = nights
  }, [editingHotel])

  function patchStop(
    partial: Partial<JourneyStop>,
    opts?: { immediate?: boolean },
  ) {
    onChange({ ...stop, ...partial }, opts)
  }

  function patchStay(
    partial: Partial<JourneyStay>,
    withStay = true,
    opts?: { immediate?: boolean },
  ) {
    if (!withStay) {
      patchStop({ stay: null, sights: normalizeSights(stop.sights) }, opts)
      return
    }
    const nextStay: JourneyStay = {
      ...stay,
      ...partial,
      nights: Math.max(
        1,
        Math.min(60, Math.floor(partial.nights ?? stay.nights ?? 1)),
      ),
      hotelName: (partial.hotelName ?? stay.hotelName ?? '').trim(),
      address: (partial.address ?? stay.address ?? '').trim(),
      price: (partial.price ?? stay.price ?? '').trim(),
    }
    patchStop(
      {
        stay: nextStay,
        sights: normalizeSights(stop.sights),
        purpose: nextStay.hotelName ? 'visit' : stop.purpose,
      },
      opts,
    )
  }

  function startAddHotel() {
    if (!stop.stay) {
      const added: JourneyStop = {
        ...stop,
        stay: { nights: 1, hotelName: '', address: '', price: '' },
        sights: normalizeSights(stop.sights),
      }
      onChange(added, { immediate: true, nightsDelta: 1 - nights })
    }
    setEditingHotel(true)
  }

  function removeHotel() {
    onChange(
      { ...stop, stay: null, sights: normalizeSights(stop.sights) },
      { immediate: true, nightsDelta: 0 - nights },
    )
    setEditingHotel(false)
  }

  const city = stop.city?.trim() || 'Uten by'
  const hotel = stay.hotelName?.trim() || ''
  const hotelAddress = stay.address?.trim() || ''
  const hotelPrice = stay.price?.trim() || ''
  const visiting = stopPurpose(stop) === 'visit'
  const hasStay = stayNights(stop) >= 1
  const daysInCity = cityStayDays(stop)
  const dateSpan =
    stop.arriveDate && nights > 0
      ? `${formatDateNO(stop.arriveDate)}–${formatDateNO(depart)} (${nights}n)`
      : stop.arriveDate
        ? `Ankomst ${formatDateNO(stop.arriveDate)}`
        : nights > 0
          ? `Utsjekk ${formatDateNO(depart)}`
          : visiting && warnMissingStay
            ? 'Uten hotell'
            : ''

  return (
    <div
      className={`v2-transport v2-place-panel${open ? ' is-open' : ''}${
        warnings.length ? ' is-warn' : ''
      }`}
    >
      <div className="v2-transport-bar">
        <button
          type="button"
          className="v2-transport-summary v2-place-summary"
          disabled={disabled}
          onClick={onToggle}
          aria-expanded={open}
          title={open ? 'Skjul by' : 'Åpne by'}
        >
          <span className="v2-place-bits">
            <span className="v2-place-bit">
              <PlaceMetaIcon name="city" size={16} />
              <span className="v2-place-bit-text">{city}</span>
            </span>
            {dateSpan ? (
              <span className="v2-place-bit">
                <PlaceMetaIcon name="dates" size={16} />
                <span className="v2-place-bit-text">{dateSpan}</span>
              </span>
            ) : null}
            {warnings.length > 0 && (
              <span
                className="v2-warn-badge"
                title={warnings.map(stopWarningLabel).join(', ')}
              >
                !
              </span>
            )}
          </span>
          {(activityCount > 0 || stop.country?.trim() || hotel) && (
            <span className="v2-place-bits is-meta">
              {stop.country?.trim() ? (
                <span className="v2-place-bit-text">{stop.country.trim()}</span>
              ) : null}
              {stopPurpose(stop) === 'transfer' ? (
                <span className="v2-place-bit-text">Bare bytte</span>
              ) : hotel ? (
                <span className="v2-place-bit">
                  <PlaceMetaIcon name="hotel" size={13} />
                  <span className="v2-place-bit-text">{hotel}</span>
                </span>
              ) : null}
              {activityCount > 0 ? (
                <span className="v2-place-bit">
                  <PlaceMetaIcon name="plan" size={13} />
                  <span className="v2-place-bit-text">{activityCount}</span>
                </span>
              ) : null}
            </span>
          )}
        </button>
        <CityInfoTip
          text={stop.notes}
          docs={stop.docs}
          disabled={disabled}
        />
        <button
          type="button"
          className="v2-transport-toggle"
          disabled={disabled}
          aria-label={open ? 'Skjul by' : 'Vis by'}
          title={open ? 'Skjul by' : 'Vis by'}
          onClick={onToggle}
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {scheduleNotes.length > 0 && (
        <ul className="v2-schedule-warn">
          {scheduleNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {!open && (
        <PlaceLinkedPreview
          hotel={hotel}
          nights={nights}
          warnMissingStay={visiting && warnMissingStay}
          sights={stop.sights}
        />
      )}

      {open && (
        <div className="v2-transport-body v2-place-body">
          <div className="v2-place-basics">
            <div className="v2-sights-head">
              <span>By og dato</span>
              <button
                type="button"
                className="v2-chip-btn"
                disabled={disabled}
                title={editingBasics ? 'Ferdig' : 'Endre by og dato'}
                onClick={() => setEditingBasics((v) => !v)}
              >
                {editingBasics ? 'Ferdig' : 'Endre'}
              </button>
            </div>
            {editingBasics && (
              <div className="form-grid">
                <PurposeToggle
                  value={stopPurpose(stop)}
                  disabled={disabled}
                  onChange={(purpose) =>
                    patchStop({ purpose }, { immediate: true })
                  }
                />
                <CitySuggestFields
                  city={stop.city}
                  country={stop.country}
                  cityLabel="By"
                  showCountry
                  hideHint
                  onCityChange={(city) =>
                    patchStop({
                      city,
                      latitude: undefined,
                      longitude: undefined,
                    })
                  }
                  onCountryChange={(country) => patchStop({ country })}
                  onSelectPlace={(city, country, place) =>
                    patchStop({
                      city,
                      country: country || stop.country,
                      latitude: place?.latitude,
                      longitude: place?.longitude,
                    })
                  }
                />
                <label>
                  Ankomstdato
                  <input
                    type="date"
                    value={stop.arriveDate}
                    disabled={disabled}
                    onChange={(e) => patchStop({ arriveDate: e.target.value })}
                  />
                </label>
              </div>
            )}
            <CityDocsEditor
              stop={stop}
              disabled={disabled}
              onChange={(next, opts) => onChange(next, opts)}
            />
          </div>

          {daysInCity.length > 0 && (
            <ul className="v2-cruise-days v2-city-days">
              {daysInCity.map((day) => (
                <li key={day.offset} className="v2-city-day">
                  <div className="v2-city-day-head">
                    <span className="v2-cruise-day-date">
                      {formatDateNO(day.date)}
                    </span>
                    <span>{day.label}</span>
                  </div>
                  <SightList
                    sights={activitiesForDay(stop.sights, day.offset)}
                    dayOffset={day.offset}
                    disabled={disabled}
                    heading="Utflukter og severdigheter"
                    suggestCountry={stop.country}
                    onChange={(dayList) =>
                      patchStop(
                        {
                          sights: replaceDayActivities(
                            stop.sights,
                            day.offset,
                            dayList,
                          ),
                        },
                        { immediate: true },
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="v2-linked">
            {stopPurpose(stop) === 'visit' && (
            <>
            <div className="v2-sights-head">
              <span>Hotell / Overnatting</span>
              {!editingHotel && !(hotel || hasStay) && (
                <button
                  type="button"
                  className="v2-chip-btn"
                  disabled={disabled}
                  title="Legg til hotell / overnatting"
                  onClick={startAddHotel}
                >
                  + Hotell
                </button>
              )}
              {!editingHotel && (hotel || hasStay) && (
                <button
                  type="button"
                  className="v2-chip-btn"
                  disabled={disabled}
                  title="Endre hotell"
                  onClick={() => setEditingHotel(true)}
                >
                  Endre
                </button>
              )}
              {editingHotel && (
                <button
                  type="button"
                  className="v2-chip-btn"
                  disabled={disabled}
                  title="Ferdig"
                  onClick={() => {
                    patchStay({}, true, { immediate: true })
                    setEditingHotel(false)
                  }}
                >
                  Ferdig
                </button>
              )}
            </div>

            <div
              className={`v2-hotel-card${editingHotel ? ' is-open' : ''}${
                !hotel && !hasStay ? ' is-empty' : ''
              }`}
            >
              {!editingHotel && (
                <div className="v2-hotel-card-head">
                  <button
                    type="button"
                    className="v2-hotel-summary"
                    disabled={disabled}
                    aria-expanded={false}
                    title={
                      hotel || hasStay
                        ? 'Endre hotell'
                        : 'Legg til hotell / overnatting'
                    }
                    onClick={() => {
                      if (hotel || hasStay) setEditingHotel(true)
                      else startAddHotel()
                    }}
                  >
                    <span className="v2-activity-kind is-hotel" aria-hidden>
                      <PlaceMetaIcon name="hotel" size={12} />
                    </span>
                    <span className="v2-hotel-row-text">
                      {hotel ? (
                        <>
                          <span className="v2-hotel-row-name">{hotel}</span>
                          {(hotelAddress || hotelPrice || nights > 0) && (
                            <span className="v2-hotel-row-addr">
                              {[
                                hotelAddress,
                                nights > 0
                                  ? `${nights} ${nights === 1 ? 'natt' : 'netter'}`
                                  : '',
                                hotelPrice,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </>
                      ) : hasStay ? (
                        <>
                          <span className="v2-hotel-row-name">
                            Hotell ikke satt
                          </span>
                          <span className="v2-hotel-row-addr">
                            {nights} {nights === 1 ? 'natt' : 'netter'} · trykk
                            for å legge inn navn
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="v2-hotel-row-name">
                            Ingen hotell ennå
                          </span>
                          <span className="v2-hotel-row-addr">
                            Trykk her eller + Hotell for å legge til
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              )}

              {editingHotel && (
                <div className="v2-hotel-card-body form-grid">
                  <label>
                    Hotell
                    <input
                      value={stay.hotelName || ''}
                      disabled={disabled}
                      placeholder="Hotellnavn"
                      autoFocus
                      onChange={(e) =>
                        onChange({
                          ...stop,
                          stay: {
                            ...stay,
                            nights: stay.nights || 1,
                            hotelName: e.target.value,
                          },
                        })
                      }
                      onBlur={(e) =>
                        patchStay(
                          { hotelName: e.target.value },
                          true,
                          { immediate: true },
                        )
                      }
                    />
                  </label>
                  <label>
                    Antall netter
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={disabled}
                      value={String(stay.nights || '')}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw !== '' && !/^\d+$/.test(raw)) return
                        const n = raw === '' ? 0 : Number(raw)
                        onChange({
                          ...stop,
                          stay: {
                            ...stay,
                            nights: n,
                          },
                        })
                      }}
                      onBlur={(e) => {
                        const n = Math.max(
                          1,
                          Number(e.target.value.replace(/[^\d]/g, '') || '1'),
                        )
                        const nextStay = {
                          ...stay,
                          nights: n,
                          hotelName: (stay.hotelName || '').trim(),
                          address: (stay.address || '').trim(),
                          price: (stay.price || '').trim(),
                        }
                        onChange(
                          {
                            ...stop,
                            stay: nextStay,
                            sights: normalizeSights(stop.sights),
                            purpose: nextStay.hotelName
                              ? 'visit'
                              : stop.purpose,
                          },
                          {
                            immediate: true,
                            nightsDelta: n - nightsAtEditStart.current,
                          },
                        )
                        nightsAtEditStart.current = n
                      }}
                    />
                  </label>
                  <label>
                    Adresse
                    <input
                      value={stay.address || ''}
                      disabled={disabled}
                      placeholder="Gateadresse"
                      onChange={(e) =>
                        onChange({
                          ...stop,
                          stay: {
                            ...stay,
                            nights: stay.nights || 1,
                            address: e.target.value,
                          },
                        })
                      }
                      onBlur={(e) =>
                        patchStay(
                          { address: e.target.value },
                          true,
                          { immediate: true },
                        )
                      }
                    />
                  </label>
                  <label>
                    Pris
                    <input
                      value={stay.price || ''}
                      disabled={disabled}
                      placeholder="4500 kr"
                      inputMode="decimal"
                      onChange={(e) =>
                        onChange({
                          ...stop,
                          stay: {
                            ...stay,
                            nights: stay.nights || 1,
                            price: e.target.value,
                          },
                        })
                      }
                      onBlur={(e) =>
                        patchStay(
                          { price: e.target.value },
                          true,
                          { immediate: true },
                        )
                      }
                    />
                  </label>
                  {(hotel || hasStay) && (
                    <div className="v2-hotel-remove-row">
                      <button
                        type="button"
                        className="v2-chip-btn is-danger"
                        disabled={disabled}
                        title="Fjern hotell / overnatting fra byen"
                        onClick={removeHotel}
                      >
                        Fjern hotell
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            </>
            )}

            {daysInCity.length === 0 && (
              <SightList
                sights={stop.sights}
                disabled={disabled}
                heading="Aktiviteter"
                suggestCountry={stop.country}
                onChange={(sights) =>
                  patchStop({ sights }, { immediate: true })
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GapMarker({
  from,
  to,
  disabled,
  onFill,
}: {
  from: JourneyStop
  to: JourneyStop
  disabled?: boolean
  onFill: () => void
}) {
  const days = freeDaysBetweenStops(from, to)
  const prefill = gapFillPrefill(from, to)
  const packLabel = isPackageStop(to)
    ? packageTypeLabel(to.kind)
    : to.kind === 'home'
      ? to.address?.trim() || to.city || 'hjem'
      : to.city || 'neste stopp'

  return (
    <div className="v2-gap-marker">
      <div className="v2-rail v2-gap-rail" aria-hidden>
        <div className="v2-rail-line is-gap" />
      </div>
      <div className="v2-gap-card">
        <div className="v2-gap-text">
          <strong>
            {days} {days === 1 ? 'dag' : 'dager'} uten plan
          </strong>
          <span className="v2-meta">
            {prefill.city
              ? `Siste dag(er) i ${prefill.city} før ${packLabel.toLowerCase()}`
              : `Mellomrom før ${packLabel}`}
          </span>
        </div>
        <button
          type="button"
          className="v2-chip-btn"
          disabled={disabled}
          title="Fyll gap"
          onClick={onFill}
        >
          Fyll gap
        </button>
      </div>
    </div>
  )
}

/**
 * Path of cities/airports to the main destination.
 * Between each pair: one or more transport options (bus AND/OR train, …).
 */
function TransportBlock({
  from,
  to,
  leg,
  warn,
  requireTransportMode = true,
  disabled,
  onChange,
}: {
  from: JourneyStop
  to: JourneyStop
  leg: JourneyLeg
  warn: boolean
  requireTransportMode?: boolean
  disabled?: boolean
  onChange: (leg: JourneyLeg) => void
}) {
  const [open, setOpen] = useState(false)
  /** Only one city-step open at a time. */
  const [openSegId, setOpenSegId] = useState<string | null>(null)
  const [dragSegId, setDragSegId] = useState<string | null>(null)
  const [overSegId, setOverSegId] = useState<string | null>(null)
  /** Which departure-row mode menu is open (`placeIdx-optIdx`). */
  const [modeMenuKey, setModeMenuKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<JourneyLeg>(() =>
    withTransportSegments(leg, transportSegments(leg)),
  )
  const segments = transportSegments(draft)
  const gaps = legTransportGaps(draft, to, { requireTransportMode })
  const filled = gaps.length === 0
  const missingModes =
    requireTransportMode &&
    (gaps.some((g) => g.kind === 'missing_ride') ||
      gaps.some((g) => g.kind === 'empty'))
  const summary = filled
    ? summarizeTransport(draft)
    : isPackageStop(from)
      ? `Transport etter ${packageTypeLabel(from.kind).toLowerCase()} til ${
          to.kind === 'home'
            ? to.address?.trim() || to.city || 'hjem'
            : to.city || 'neste sted'
        }`
      : `Transport til ${
          to.kind === 'home'
            ? to.address?.trim() || to.city || 'hjem'
            : to.city || 'hovedmål'
        }`
  const showWarn = warn || missingModes
  const homeAddress = to.kind === 'home' ? (to.address || '').trim() : ''
  const goalName =
    (to.kind === 'home' && homeAddress) || to.city.trim() || 'Hovedmål'
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSegs = useRef(segments)
  latestSegs.current = segments

  function cleanSegments(list: JourneyVia[]): JourneyVia[] {
    return list
      .map((v, i) => {
        let opts: JourneyTransportOption[] = viaTransportOptions(v)
          .map((o) => {
            const walk = modeIsWalk(o.mode)
            const flight = modeIsFlight(o.mode)
            return {
              ...o,
              title: walk ? '' : (o.title || '').trim(),
              startTime: walk ? '' : (o.startTime || '').trim(),
              endTime: walk ? '' : (o.endTime || '').trim(),
              platform:
                !walk && !flight && modeHasPlatform(o.mode)
                  ? (o.platform || '').trim()
                  : '',
              gate: flight ? (o.gate || '').trim() : '',
              minutes: walk ? (o.minutes || '').trim() : '',
              info: modeIsOther(o.mode) ? (o.info || '').trim() : '',
              price: (o.price || '').trim(),
              actualPrice: (o.actualPrice || '').trim(),
              departures: [] as string[],
            }
          })
          .filter(
            (o) =>
              o.mode?.trim() ||
              o.title ||
              o.startTime ||
              o.endTime ||
              o.platform ||
              o.gate ||
              o.minutes ||
              o.info ||
              o.price ||
              o.actualPrice,
          )
        const flight = opts.find((o) => o.mode === 'flight')
        if (flight) opts = [flight]
        else opts = sortTransportOptionsByTime(opts)
        return withViaOptions(
          {
            ...v,
            title: (v.title || '').trim(),
            country: (v.country || '').trim(),
            sights: normalizeSights(v.sights),
            purpose: viaPurpose(v),
            sortOrder: i,
          },
          opts,
        )
      })
      .filter((v) => v.title.trim() || viaTransportOptions(v).length > 0)
  }

  function persistNow(list: JourneyVia[]) {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current)
      persistTimer.current = null
    }
    onChange(withTransportSegments(leg, cleanSegments(list)))
  }

  function schedulePersist(list: JourneyVia[]) {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null
      onChange(withTransportSegments(leg, cleanSegments(list)))
    }, 450)
  }

  useEffect(() => {
    if (!open) {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current)
        persistTimer.current = null
        onChange(withTransportSegments(leg, cleanSegments(latestSegs.current)))
      }
      setDraft(withTransportSegments(leg, transportSegments(leg)))
      setOpenSegId(null)
    }
  }, [leg, open])

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [])

  function isSegOpen(id: string): boolean {
    return openSegId === id
  }

  function toggleSeg(id: string) {
    setModeMenuKey(null)
    setOpenSegId((prev) => (prev === id ? null : id))
  }

  function setSegments(next: JourneyVia[], immediate = false) {
    setDraft(withTransportSegments(draft, next))
    if (immediate) persistNow(next)
    else schedulePersist(next)
  }

  function addPlace(asGoal = false) {
    setOpen(true)
    const place = newJourneyVia(segments.length)
    if (asGoal && (to.city.trim() || homeAddress)) {
      place.title = homeAddress || to.city
      place.country = to.country || ''
      place.latitude = to.latitude
      place.longitude = to.longitude
    }
    setSegments([...segments, place], true)
    // Nytt by-steg åpnes alene.
    setOpenSegId(place.id)
  }

  function updateSegment(
    idx: number,
    partial: Partial<JourneyVia>,
    immediate = false,
  ) {
    setSegments(
      segments.map((v, i) => (i === idx ? { ...v, ...partial } : v)),
      immediate,
    )
  }

  function setOptions(
    idx: number,
    options: JourneyTransportOption[],
    immediate = true,
  ) {
    const via = segments[idx]
    if (!via) return
    updateSegment(idx, withViaOptions(via, options), immediate)
  }

  function addOption(idx: number, mode: JourneyLegMode | string = '') {
    const via = segments[idx]
    if (!via) return
    const next = newTransportOption(mode)
    // Fly er eksklusivt: erstatter andre reisemåter på samme hopp.
    if (mode === 'flight') {
      setOptions(idx, [next], true)
      return
    }
    const existing = viaTransportOptions(via).filter((o) => o.mode !== 'flight')
    // Nye rader uten tid nederst; sorteres når tid er satt.
    setOptions(idx, [...existing, next], true)
  }

  function updateOption(
    placeIdx: number,
    optIdx: number,
    partial: Partial<JourneyTransportOption>,
    resort = false,
  ) {
    const via = segments[placeIdx]
    if (!via) return
    const current = viaTransportOptions(via)
    const merged = current.map((o, i) =>
      i === optIdx ? { ...o, ...partial } : o,
    )
    const chosen = merged[optIdx]
    // Velger du fly, faller alle andre alternativer bort.
    if (chosen?.mode === 'flight') {
      setOptions(placeIdx, [chosen], true)
      return
    }
    const next = merged.filter((o) => o.mode !== 'flight')
    const modeChange = Object.prototype.hasOwnProperty.call(partial, 'mode')
    setOptions(
      placeIdx,
      resort ? sortTransportOptionsByTime(next) : next,
      modeChange || resort,
    )
  }

  function resortOptions(placeIdx: number) {
    const via = segments[placeIdx]
    if (!via) return
    setOptions(
      placeIdx,
      sortTransportOptionsByTime(viaTransportOptions(via)),
      true,
    )
  }

  function removeOption(placeIdx: number, optIdx: number) {
    const via = segments[placeIdx]
    if (!via) return
    setOptions(
      placeIdx,
      viaTransportOptions(via).filter((_, i) => i !== optIdx),
      true,
    )
  }

  function removeSegment(idx: number) {
    setSegments(
      segments.filter((_, i) => i !== idx),
      true,
    )
  }

  function moveSegment(idx: number, direction: -1 | 1) {
    setSegments(moveTransportSegment(segments, idx, direction), true)
  }

  function dropSegmentOn(targetId: string) {
    if (!dragSegId || dragSegId === targetId) {
      setDragSegId(null)
      setOverSegId(null)
      return
    }
    const from = segments.findIndex((s) => s.id === dragSegId)
    const toIdx = segments.findIndex((s) => s.id === targetId)
    setSegments(reorderTransportSegments(segments, from, toIdx), true)
    setDragSegId(null)
    setOverSegId(null)
  }

  function prevLabel(idx: number): string {
    if (idx === 0) {
      return from.kind === 'home' ? 'Start' : from.city.trim() || 'Fra'
    }
    return segments[idx - 1]?.title.trim() || `Punkt ${idx}`
  }

  function isGoal(seg: JourneyVia): boolean {
    const t = seg.title.trim()
    if (!t) return false
    return (
      samePlaceName(t, to.city) ||
      (!!homeAddress && samePlaceName(t, homeAddress))
    )
  }

  return (
    <div className="v2-transport-wrap">
      <div className="v2-rail v2-transport-rail" aria-hidden>
        <div className="v2-rail-line" />
      </div>
      <div
        className={`v2-transport${showWarn ? ' is-warn' : ''}${
          open ? ' is-open' : ''
        }`}
      >
        <div className="v2-transport-bar">
          <button
            type="button"
            className="v2-transport-summary"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title={open ? 'Skjul liste' : 'Vis liste'}
          >
            <span className="v2-transport-label-row">
              <span className="v2-transport-label">{summary}</span>
              {showWarn && (
                <span
                  className="v2-warn-badge"
                  title={
                    missingModes
                      ? 'Mangler transportmiddel'
                      : 'Transport fra start til mål er ufullstendig'
                  }
                >
                  !
                </span>
              )}
            </span>
            <span className="v2-transport-route">
              {from.kind === 'home' ? 'Start' : from.city || 'Fra'} → {goalName}
              {segments.length
                ? ` · ${segments.length} ${
                    segments.length === 1 ? 'sted' : 'steder'
                  }`
                : ''}
            </span>
          </button>
          <button
            type="button"
            className="v2-transport-toggle"
            disabled={disabled}
            aria-label={open ? 'Skjul liste' : 'Vis liste'}
            title={open ? 'Skjul liste' : 'Vis liste'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '▴' : '▾'}
          </button>
        </div>

        {open && (
          <div className="v2-transport-body">
            <p className="v2-meta" style={{ margin: 0 }}>
              Sti fra{' '}
              <strong>
                {from.kind === 'home' ? 'start' : from.city || 'fra'}
              </strong>{' '}
              til <strong>{goalName}</strong>
              {requireTransportMode
                ? '. Hvert sted trenger navn og minst én reise (buss, tog, fly …).'
                : '. Du kan legge hovedlinjen med bare steder; reisemåte er valgfritt.'}
            </p>

            <div className="v2-via-list">
              <div className="v2-via-head">
                <span>Steder på veien</span>
                <div className="v2-via-head-actions">
                  {!segments.some((s) => isGoal(s)) && (
                    <>
                      {to.city.trim() && (
                        <button
                          type="button"
                          className="v2-chip-btn"
                          disabled={disabled}
                          title={`Legg til ${goalName}`}
                          onClick={() => addPlace(true)}
                        >
                          + {goalName}
                        </button>
                      )}
                      <button
                        type="button"
                        className="v2-transport-plus is-inline"
                        disabled={disabled}
                        onClick={() => addPlace(false)}
                        aria-label="Legg til by eller flyplass"
                        title="Legg til by eller flyplass"
                      >
                        +
                      </button>
                    </>
                  )}
                </div>
              </div>

              {segments.length === 0 && (
                <p className="v2-meta">
                  Eksempel: Bergamo flyplass → Milano → {goalName}. Trykk + for
                  første sted.
                </p>
              )}

              {segments.map((seg, idx) => {
                const options = viaTransportOptions(seg)
                const fromLabel = prevLabel(idx)
                const goal = isGoal(seg)
                const expanded = isSegOpen(seg.id)
                const hopSummary = summarizeViaHop(seg, fromLabel)
                const missingRide =
                  requireTransportMode && !isViaHopFilled(seg)
                const hopIncomplete = !seg.title.trim() || missingRide
                const hasFlight = options.some((o) => o.mode === 'flight')
                const dragging = dragSegId === seg.id
                const dragOver = overSegId === seg.id && dragSegId !== seg.id
                const sightCount = normalizeSights(seg.sights).length

                return (
                  <div
                    key={seg.id}
                    className={`v2-seg-card${goal ? ' is-goal' : ''}${
                      expanded ? ' is-open' : ''
                    }${hopIncomplete ? ' is-warn' : ''}${
                      dragging ? ' is-dragging' : ''
                    }${dragOver ? ' is-drag-over' : ''}`}
                    onDragOver={(e) => {
                      if (disabled || !dragSegId) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (overSegId !== seg.id) setOverSegId(seg.id)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      dropSegmentOn(seg.id)
                    }}
                    onDragEnd={() => {
                      setDragSegId(null)
                      setOverSegId(null)
                    }}
                  >
                    <div className="v2-seg-order">
                      <button
                        type="button"
                        className="v2-seg-drag"
                        disabled={disabled || segments.length < 2}
                        title="Dra for å endre rekkefølge"
                        aria-label={`Dra for å flytte sted ${idx + 1}`}
                        draggable={!disabled && segments.length > 1}
                        onDragStart={(e) => {
                          setDragSegId(seg.id)
                          setOverSegId(null)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', seg.id)
                          e.dataTransfer.setDragImage(
                            e.currentTarget.parentElement?.parentElement ||
                              e.currentTarget,
                            24,
                            24,
                          )
                        }}
                      >
                        <span className="v2-seg-drag-icon" aria-hidden>
                          ⋮⋮
                        </span>
                        <span className="v2-seg-num">{idx + 1}</span>
                      </button>
                      {expanded && (
                        <>
                          <button
                            type="button"
                            className="v2-seg-move"
                            disabled={disabled || idx === 0}
                            title="Flytt sted opp"
                            aria-label="Flytt sted opp"
                            onClick={() => moveSegment(idx, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="v2-seg-move"
                            disabled={disabled || idx >= segments.length - 1}
                            title="Flytt sted ned"
                            aria-label="Flytt sted ned"
                            onClick={() => moveSegment(idx, 1)}
                          >
                            ↓
                          </button>
                        </>
                      )}
                    </div>

                    <div className="v2-seg-main">
                      <div className="v2-seg-head">
                        <button
                          type="button"
                          className="v2-seg-summary"
                          disabled={disabled}
                          aria-expanded={expanded}
                          title={expanded ? 'Skjul sted' : 'Vis sted'}
                          onClick={() => toggleSeg(seg.id)}
                        >
                          <span className="v2-seg-summary-title-row">
                            <span className="v2-seg-summary-title">
                              {seg.title.trim() ||
                                (goal ? 'Hovedmål' : `Sted ${idx + 1}`)}
                              {goal ? ' ★' : ''}
                              {viaPurpose(seg) === 'transfer'
                                ? ' · bytte'
                                : ' · besøk'}
                            </span>
                            {missingRide && (
                              <span
                                className="v2-warn-badge"
                                title="Mangler transportmiddel"
                              >
                                !
                              </span>
                            )}
                          </span>
                          <span className="v2-seg-summary-meta">
                            {hopSummary}
                            {sightCount > 0
                              ? ` · ${sightCount} severdighet${
                                  sightCount === 1 ? '' : 'er'
                                }`
                              : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="v2-seg-toggle"
                          disabled={disabled}
                          aria-label={expanded ? 'Skjul sted' : 'Vis sted'}
                          title={expanded ? 'Skjul sted' : 'Vis sted'}
                          onClick={() => toggleSeg(seg.id)}
                        >
                          {expanded ? '▴' : '▾'}
                        </button>
                        <button
                          type="button"
                          className="v2-via-remove"
                          disabled={disabled}
                          aria-label="Fjern sted"
                          title="Fjern sted"
                          onClick={() => {
                            removeSegment(idx)
                            setOpenSegId((prev) =>
                              prev === seg.id ? null : prev,
                            )
                          }}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>

                      {!expanded && <SightPreview sights={seg.sights} />}

                      {expanded && (
                        <div className="v2-seg-fields">
                          <div className="v2-seg-place">
                            <PurposeToggle
                              value={viaPurpose(seg)}
                              disabled={disabled}
                              onChange={(purpose) =>
                                updateSegment(idx, { purpose }, true)
                              }
                            />
                            <CitySuggestFields
                              city={seg.title}
                              country={seg.country || ''}
                              cityLabel={
                                goal
                                  ? 'Hovedmål (by / flyplass)'
                                  : 'By / flyplass'
                              }
                              cityPlaceholder="Bergamo, Milano, Genova…"
                              showCountry={false}
                              hideHint
                              onCityChange={(city) =>
                                updateSegment(idx, {
                                  title: city,
                                  latitude: undefined,
                                  longitude: undefined,
                                })
                              }
                              onCountryChange={(country) =>
                                updateSegment(idx, { country })
                              }
                              onSelectPlace={(city, country, place) => {
                                updateSegment(
                                  idx,
                                  {
                                    title: city,
                                    country: country || '',
                                    latitude: place?.latitude,
                                    longitude: place?.longitude,
                                  },
                                  true,
                                )
                                setOpenSegId(null)
                              }}
                              className="city-suggest-via"
                            />
                          </div>

                          <div className="v2-hop">
                            <div className="v2-hop-title">
                              {fromLabel} → {seg.title.trim() || '…'}
                            </div>
                            <p className="v2-meta" style={{ margin: 0 }}>
                              {hasFlight
                                ? 'Fly er valgt — andre avganger på dette hoppet er fjernet.'
                                : 'Legg inn avganger som egne rader. Bland gjerne buss og tog — de sorteres etter klokkeslett.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {expanded &&
                      options.map((opt, oi) => {
                        const showPlatform = modeHasPlatform(opt.mode)
                        const isWalk = modeIsWalk(opt.mode)
                        const isFlight = modeIsFlight(opt.mode)
                        const isOther = modeIsOther(opt.mode)
                        const menuKey = `${idx}-${oi}`
                        const menuOpen = modeMenuKey === menuKey
                        const modeLabel =
                          legModeLabel(opt.mode) || 'Reisemåte'
                        return (
                          <div key={opt.id} className="v2-hop-row">
                            <div className="v2-hop-mode">
                              <button
                                type="button"
                                className={`v2-hop-mode-btn mode-${opt.mode || 'other'}`}
                                disabled={disabled}
                                title={`${modeLabel} — bytt`}
                                aria-label={modeLabel}
                                aria-expanded={menuOpen}
                                aria-haspopup="listbox"
                                onClick={() =>
                                  setModeMenuKey(menuOpen ? null : menuKey)
                                }
                              >
                                <TransportModeIcon
                                  mode={opt.mode || 'other'}
                                  size={18}
                                />
                              </button>
                              {menuOpen && (
                                <div
                                  className="v2-hop-mode-menu"
                                  role="listbox"
                                  aria-label="Velg reisemåte"
                                >
                                  {LEG_MODES.filter((m) => m.value).map(
                                    (m) => (
                                      <button
                                        key={m.value}
                                        type="button"
                                        role="option"
                                        aria-selected={opt.mode === m.value}
                                        className={`v2-hop-mode-option${
                                          opt.mode === m.value
                                            ? ' is-selected'
                                            : ''
                                        }`}
                                        title={m.label}
                                        onClick={() => {
                                          const walk = modeIsWalk(m.value)
                                          const flight = modeIsFlight(m.value)
                                          updateOption(idx, oi, {
                                            mode: m.value,
                                            departures: [],
                                            platform: modeHasPlatform(m.value)
                                              ? opt.platform || ''
                                              : '',
                                            gate: flight ? opt.gate || '' : '',
                                            minutes: walk
                                              ? opt.minutes || ''
                                              : '',
                                            info: modeIsOther(m.value)
                                              ? opt.info || ''
                                              : '',
                                            title: walk ? '' : opt.title || '',
                                            startTime: walk
                                              ? ''
                                              : opt.startTime || '',
                                            endTime: walk
                                              ? ''
                                              : opt.endTime || '',
                                          })
                                          setModeMenuKey(null)
                                        }}
                                      >
                                        <TransportModeIcon
                                          mode={m.value}
                                          size={16}
                                        />
                                        <span>{m.label}</span>
                                      </button>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="v2-hop-opt">
                              <div
                                className={`v2-hop-opt-fields${
                                  isWalk
                                    ? ' is-walk'
                                    : isFlight
                                      ? ' is-flight'
                                      : isOther
                                        ? ' is-other'
                                        : showPlatform
                                          ? ' has-platform'
                                          : ''
                                }`}
                              >
                                {isWalk ? (
                                  <label className="v2-hop-minutes">
                                    <input
                                      inputMode="numeric"
                                      placeholder="Minutter"
                                      value={opt.minutes || ''}
                                      disabled={disabled}
                                      onChange={(e) =>
                                        updateOption(idx, oi, {
                                          minutes: e.target.value.replace(
                                            /[^\d]/g,
                                            '',
                                          ),
                                        })
                                      }
                                      aria-label="Gåtid i minutter"
                                    />
                                    <span>min</span>
                                  </label>
                                ) : (
                                  <>
                                    <div className="v2-hop-opt-row is-main">
                                      <input
                                        value={opt.title || ''}
                                        disabled={disabled}
                                        placeholder={
                                          isFlight
                                            ? 'Flightnr'
                                            : isOther
                                              ? 'Type'
                                              : 'Linje / nr'
                                        }
                                        onChange={(e) =>
                                          updateOption(idx, oi, {
                                            title: e.target.value,
                                          })
                                        }
                                        aria-label={
                                          isFlight
                                            ? 'Flightnummer'
                                            : isOther
                                              ? 'Type'
                                              : 'Linje / nr'
                                        }
                                      />
                                      {isOther && (
                                        <input
                                          className="v2-hop-info"
                                          value={opt.info || ''}
                                          disabled={disabled}
                                          placeholder="Info"
                                          onChange={(e) =>
                                            updateOption(idx, oi, {
                                              info: e.target.value,
                                            })
                                          }
                                          aria-label="Info"
                                        />
                                      )}
                                      {isFlight && (
                                        <input
                                          className="v2-hop-gate"
                                          value={opt.gate || ''}
                                          disabled={disabled}
                                          placeholder="Gate"
                                          onChange={(e) =>
                                            updateOption(idx, oi, {
                                              gate: e.target.value,
                                            })
                                          }
                                          aria-label="Gate"
                                        />
                                      )}
                                      {showPlatform && (
                                        <input
                                          className="v2-hop-platform"
                                          value={opt.platform || ''}
                                          disabled={disabled}
                                          placeholder="Perong"
                                          onChange={(e) =>
                                            updateOption(idx, oi, {
                                              platform: e.target.value,
                                            })
                                          }
                                          aria-label="Perong"
                                        />
                                      )}
                                      <input
                                        inputMode="numeric"
                                        placeholder="Avgang"
                                        value={opt.startTime || ''}
                                        disabled={disabled}
                                        onChange={(e) =>
                                          updateOption(idx, oi, {
                                            startTime: e.target.value,
                                            departures: [],
                                          })
                                        }
                                        onBlur={() => resortOptions(idx)}
                                      />
                                      <input
                                        inputMode="numeric"
                                        placeholder="Ankomst"
                                        value={opt.endTime || ''}
                                        disabled={disabled}
                                        onChange={(e) =>
                                          updateOption(idx, oi, {
                                            endTime: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="v2-hop-opt-row is-prices">
                                      <input
                                        className="v2-hop-price"
                                        inputMode="decimal"
                                        placeholder="Forv. pris"
                                        value={opt.price || ''}
                                        disabled={disabled}
                                        title="Forventet pris"
                                        onChange={(e) =>
                                          updateOption(idx, oi, {
                                            price: e.target.value,
                                          })
                                        }
                                      />
                                      <input
                                        className="v2-hop-price"
                                        inputMode="decimal"
                                        placeholder="Faktisk"
                                        value={opt.actualPrice || ''}
                                        disabled={disabled}
                                        title="Faktisk kostnad"
                                        onChange={(e) =>
                                          updateOption(idx, oi, {
                                            actualPrice: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                className="v2-via-remove"
                                disabled={disabled}
                                aria-label="Fjern avgang"
                                title="Fjern avgang"
                                onClick={() => removeOption(idx, oi)}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                    {expanded && !hasFlight && (
                      <div className="v2-hop-add-wrap">
                        <button
                          type="button"
                          className="v2-transport-plus is-inline"
                          disabled={disabled}
                          title="Legg til avgang"
                          aria-label="Legg til avgang"
                          onClick={() => addOption(idx)}
                        >
                          +
                        </button>
                      </div>
                    )}

                    {expanded && (
                      <div className="v2-via-program">
                        <SightList
                          sights={seg.sights}
                          compact
                          disabled={disabled}
                          suggestCountry={seg.country || to.country}
                          onChange={(sights) =>
                            updateSegment(idx, { sights }, true)
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              {!segments.some((s) => isGoal(s)) && (
                <div className="v2-via-foot">
                  <button
                    type="button"
                    className="v2-transport-plus is-inline"
                    disabled={disabled}
                    onClick={() => addPlace(false)}
                    aria-label="Legg til by eller flyplass"
                    title="Legg til by eller flyplass"
                  >
                    +
                  </button>
                  {to.city.trim() && (
                    <button
                      type="button"
                      className="v2-chip-btn"
                      disabled={disabled}
                      title={`Legg til ${goalName}`}
                      onClick={() => addPlace(true)}
                    >
                      + {goalName}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DepartLegSheet({
  journey,
  fromStopId,
  saving,
  onClose,
  onSave,
  onNeedDestination,
}: {
  journey: Journey
  fromStopId: string
  saving: boolean
  onClose: () => void
  onSave: (
    fromId: string,
    toId: string,
    patch: Partial<JourneyLeg>,
  ) => Promise<void>
  onNeedDestination: () => void
}) {
  const fromIdx = journey.stops.findIndex((s) => s.id === fromStopId)
  const from = fromIdx >= 0 ? journey.stops[fromIdx] : null
  const to = fromIdx >= 0 ? journey.stops[fromIdx + 1] : null
  const existing =
    from && to ? legForGap(journey, from.id, to.id) : undefined
  const [leg, setLeg] = useState<Partial<JourneyLeg>>(() => ({
    mode: (existing?.mode as JourneyLegMode) || '',
    title: existing?.title || '',
    startTime: existing?.startTime || '',
    endTime: existing?.endTime || '',
    notes: existing?.notes || '',
  }))

  useEffect(() => {
    if (!to) onNeedDestination()
    // Only when this stop has no next destination yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open onward once
  }, [to])

  if (!from || !to) return null

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel">
        <div className="v2-sheet-head">
          <div>
            <h2>Reise til {to.city || 'neste stopp'}</h2>
            <p className="v2-meta">
              {from.kind === 'home' ? 'Fra start' : from.city || 'Fra'} →{' '}
              {to.city || 'Til'}
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
        <div className="form-grid">
          <label>
            Reisemåte
            <select
              value={leg.mode || ''}
              onChange={(e) =>
                setLeg((p) => ({
                  ...p,
                  mode: e.target.value as JourneyLegMode,
                }))
              }
            >
              <option value="">Velg…</option>
              {LEG_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Avgang
            <input
              inputMode="numeric"
              placeholder="10:40"
              value={leg.startTime || ''}
              onChange={(e) =>
                setLeg((p) => ({ ...p, startTime: e.target.value }))
              }
            />
          </label>
          <label>
            Ankomst
            <input
              inputMode="numeric"
              placeholder="14:10"
              value={leg.endTime || ''}
              onChange={(e) =>
                setLeg((p) => ({ ...p, endTime: e.target.value }))
              }
            />
          </label>
          <label>
            Merke / nr (valgfritt)
            <input
              value={leg.title || ''}
              onChange={(e) =>
                setLeg((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="VY 72 / Ryanair"
            />
          </label>
        </div>
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
            title="Lagre reise"
            onClick={() => void onSave(from.id, to.id, leg)}
          >
            {saving ? 'Lagrer…' : 'Lagre reise'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StopWizard({
  journey,
  settings,
  kind,
  stopId,
  insertBeforeId,
  gapFromId,
  fromStopId,
  tripStartDate = '',
  homePlace,
  saving,
  onClose,
  onSave,
}: {
  journey: Journey
  settings: PlannerSettings
  kind: WizardKind
  stopId?: string
  insertBeforeId?: string
  gapFromId?: string
  fromStopId?: string
  tripStartDate?: string
  homePlace: HomePlace
  saving: boolean
  onClose: () => void
  onSave: (
    stop: JourneyStop,
    inboundLeg?: Partial<JourneyLeg> | null,
  ) => Promise<void>
}) {
  const editing = kind === 'edit' && stopId
  const existing = editing
    ? journey.stops.find((s) => s.id === stopId)
    : undefined
  const gapFrom = gapFromId
    ? journey.stops.find((s) => s.id === gapFromId)
    : undefined
  const gapTo = insertBeforeId
    ? journey.stops.find((s) => s.id === insertBeforeId)
    : undefined
  const gapPrefill =
    gapFrom && gapTo ? gapFillPrefill(gapFrom, gapTo) : null
  const dateFromId = fromStopId || gapFromId

  const initialStop: JourneyStop = useMemo(() => {
    if (existing) return { ...existing, stay: existing.stay ? { ...existing.stay } : null }
    if (kind === 'home') {
      return applyRegisteredHome(
        {
          id: newStopId(),
          city: '',
          country: '',
          address: '',
          arriveDate: suggestNextArriveDate(journey, tripStartDate, dateFromId),
          kind: 'home' as const,
          stay: null,
          notes: '',
          sortOrder: journey.stops.length,
        },
        homePlace,
      )
    }
    if (gapPrefill) {
      return {
        id: newStopId(),
        city: gapPrefill.city,
        country: gapPrefill.country,
        address: '',
        arriveDate: gapPrefill.arriveDate,
        kind: 'place',
        stay: {
          nights: gapPrefill.nights,
          hotelName: '',
          address: '',
          checkInTime: '15:00',
          checkOutTime: '11:00',
        },
        notes: '',
        sortOrder: journey.stops.length,
      }
    }
    return {
      id: newStopId(),
      city: '',
      country: '',
      address: '',
      arriveDate: suggestNextArriveDate(journey, tripStartDate, dateFromId),
      kind: 'place',
      stay: null,
      notes: '',
      sortOrder: journey.stops.length,
    }
  }, [existing, kind, homePlace, journey, tripStartDate, gapPrefill, dateFromId])

  const [stop, setStop] = useState<JourneyStop>(initialStop)
  const [stay, setStay] = useState<JourneyStay>(() =>
    initialStop.stay || {
      nights: 1,
      hotelName: '',
      address: '',
      checkInTime: '15:00',
      checkOutTime: '11:00',
    },
  )
  const hasHotel = !!(stay.hotelName || '').trim()
  const [wantStay, setWantStay] = useState(
    () => hasHotel || !!initialStop.stay,
  )

  useEffect(() => {
    if (hasHotel) setWantStay(true)
  }, [hasHotel])

  const isGoingHome =
    kind === 'home' || (kind === 'edit' && existing?.kind === 'home')
  const steps = wizardSteps(
    settings,
    isGoingHome ? 'home' : kind === 'edit' ? 'onward' : kind,
  )
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex] || 'destination'
  const [localError, setLocalError] = useState('')

  async function finish() {
    setLocalError('')
    if (!stop.city.trim()) {
      setLocalError('Velg by først')
      setStepIndex(0)
      return
    }
    if (!stop.arriveDate.trim()) {
      setLocalError('Velg ankomstdato')
      const di = steps.indexOf('dates')
      if (di >= 0) setStepIndex(di)
      return
    }
    const drafted: JourneyStop = {
      ...stop,
      city: stop.city.trim(),
      country: stop.country.trim(),
      address: (stop.address || '').trim(),
      stay:
        isGoingHome || !wantStay
          ? null
          : {
              ...stay,
              nights: Math.max(1, Math.min(60, Math.floor(stay.nights || 1))),
              hotelName: (stay.hotelName || '').trim(),
              address: (stay.address || '').trim(),
            },
      notes: compactNoteHtml(stop.notes || ''),
      docs: compactCityDocs(cityDocsOf(stop)),
    }
    const nextStop: JourneyStop = isGoingHome
      ? applyRegisteredHome(drafted, homePlace)
      : drafted
    try {
      // Transport between cities is edited in the thread via-block, not here.
      await onSave(nextStop, null)
    } catch {
      /* parent sets error */
    }
  }

  function next() {
    setLocalError('')
    if (step === 'destination' && !stop.city.trim()) {
      setLocalError('Velg by')
      return
    }
    if (step === 'dates' && !stop.arriveDate.trim()) {
      setLocalError('Velg dato')
      return
    }
    if (stepIndex >= steps.length - 1) {
      void finish()
      return
    }
    setStepIndex((i) => i + 1)
  }

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel">
        <div className="v2-sheet-head">
          <div>
            <h2>
              {kind === 'home'
                ? 'Reise hjem'
                : kind === 'edit'
                  ? 'Rediger hjem'
                  : gapPrefill
                    ? 'Fyll gap — ny by'
                    : 'Ny by'}
            </h2>
            <p className="v2-meta">
              {gapPrefill
                ? gapPrefill.hint
                : kind === 'edit'
                  ? 'Oppdater hjemmepunktet'
                  : `Opprettelse · steg ${stepIndex + 1} av ${steps.length} · ${stepLabel(step)}`}
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

        <div className="v2-steps" aria-hidden>
          {steps.map((s, i) => {
            const filled = wizardStepFilled(s, stop, wantStay, stay)
            return (
              <span
                key={s}
                className={`v2-step-pill${
                  i === stepIndex ? ' is-active' : ''
                }${filled ? ' is-done' : ' is-warn'}`}
              >
                {stepLabel(s)}
                {!filled ? ' !' : ''}
              </span>
            )
          })}
        </div>

        {localError && <p className="v2-error">{localError}</p>}

        {step === 'destination' && isGoingHome && (
          <div className="form-grid">
            <p className="v2-meta" style={{ margin: 0 }}>
              Adresse hentes fra innstillinger.
            </p>
            <p className="v2-home-register">
              <strong>{formatHomePlace(homePlace) || 'Hjem'}</strong>
            </p>
          </div>
        )}

        {step === 'destination' && !isGoingHome && (
          <div className="form-grid">
            <CitySuggestFields
              city={stop.city}
              country={stop.country}
              cityLabel="Hvor skal du?"
              autoFocus={kind === 'onward'}
              onCityChange={(city) =>
                setStop((p) => ({
                  ...p,
                  city,
                  latitude: undefined,
                  longitude: undefined,
                }))
              }
              onCountryChange={(country) => setStop((p) => ({ ...p, country }))}
              onSelectPlace={(city, country, place) =>
                setStop((p) => ({
                  ...p,
                  city,
                  country: country || p.country,
                  latitude: place?.latitude,
                  longitude: place?.longitude,
                }))
              }
            />
          </div>
        )}

        {step === 'dates' && (
          <div className="form-grid">
            <label>
              Ankomstdato
              <input
                type="date"
                value={stop.arriveDate}
                onChange={(e) =>
                  setStop((p) => ({ ...p, arriveDate: e.target.value }))
                }
              />
            </label>
            <p className="v2-meta">
              Fylt inn fra dagen etter forrige stopp (eller utsjekk/slutt hvis
              det finnes overnatting). Du kan endre datoen.
            </p>
          </div>
        )}

        {step === 'stay' && (
          <div className="form-grid">
            <label className="v2-check-row">
              <input
                type="checkbox"
                checked={wantStay || hasHotel}
                disabled={hasHotel}
                onChange={(e) => {
                  if (hasHotel) return
                  setWantStay(e.target.checked)
                }}
              />
              Jeg har overnatting her
            </label>
            {wantStay && (
              <>
                <label>
                  Antall netter
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(stay.nights || '')}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw !== '' && !/^\d+$/.test(raw)) return
                      setStay((p) => ({
                        ...p,
                        nights: raw === '' ? 0 : Number(raw),
                      }))
                    }}
                    onBlur={() =>
                      setStay((p) => ({
                        ...p,
                        nights: Math.max(1, Math.min(60, p.nights || 1)),
                      }))
                    }
                  />
                </label>
                <label>
                  Hotellnavn (valgfritt)
                  <input
                    value={stay.hotelName || ''}
                    onChange={(e) =>
                      setStay((p) => ({ ...p, hotelName: e.target.value }))
                    }
                    placeholder="Hotel Navn"
                  />
                </label>
                <label>
                  Hotelladresse
                  <input
                    value={stay.address || ''}
                    onChange={(e) =>
                      setStay((p) => ({ ...p, address: e.target.value }))
                    }
                  />
                </label>
              </>
            )}
            {!wantStay && (
              <p className="v2-meta">
                Greit å hoppe over — du kan legge til hotell senere under byen
                (Hotell / Overnatting → + Hotell).
              </p>
            )}
          </div>
        )}

        {step === 'notes' && (
          <div className="form-grid">
            <div className="v2-note-field">
              <span>Notater</span>
              <NoteEditor
                value={stop.notes || ''}
                placeholder="Tips, møtested, billetter…"
                onChange={(html) =>
                  setStop((p) => ({ ...p, notes: html }))
                }
                onBlur={(html) =>
                  setStop((p) => ({ ...p, notes: compactNoteHtml(html) }))
                }
              />
            </div>
          </div>
        )}

        <div className="v2-sheet-actions">
          {stepIndex > 0 && (
            <button
              type="button"
              className="btn btn-soft"
              disabled={saving}
              title="Tilbake"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              Tilbake
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            title={
              stepIndex >= steps.length - 1 ? 'Lagre' : 'Neste'
            }
            onClick={() => next()}
          >
            {stepIndex >= steps.length - 1
              ? saving
                ? 'Lagrer…'
                : 'Lagre'
              : 'Neste'}
          </button>
        </div>
        {(step === 'stay' || step === 'notes') &&
          stepIndex < steps.length - 1 && (
            <button
              type="button"
              className="v2-skip"
              disabled={saving}
              title="Hopp over dette steget"
              onClick={() => {
                if (step === 'stay' && !hasHotel) setWantStay(false)
                setStepIndex((i) => i + 1)
              }}
            >
              Hopp over dette steget
            </button>
          )}
        {stepIndex >= steps.length - 1 &&
          (step === 'stay' || step === 'notes') && (
            <button
              type="button"
              className="v2-skip"
              disabled={saving}
              title="Lagre uten dette"
              onClick={() => {
                if (step === 'stay' && !hasHotel) setWantStay(false)
                void finish()
              }}
            >
              Lagre uten dette
            </button>
          )}
      </div>
    </div>
  )
}
