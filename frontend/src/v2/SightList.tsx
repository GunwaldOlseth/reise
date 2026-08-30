import { useEffect, useRef, useState } from 'react'
import { ClockTimeInput } from './ClockTimeInput'
import { CityDocsEditor } from './CityDocsEditor'
import { CityInfoTip, CityLinkedChip } from './CityInfoTip'
import { HotelLinkedChip } from './HotelInfoTip'
import { CitySuggestFields } from '../CitySuggest'
import { TrashIcon, PlaceMetaIcon } from '../TransportModeIcon'
import {
  activityDisplayName,
  activityKindLabel,
  activityPurpose,
  cityDocsOf,
  formatDateNO,
  newSight,
  normalizeSights,
  STAY_WITHOUT_HOTEL_LABEL,
  type JourneyActivity,
  type JourneyActivityKind,
  type JourneyStay,
} from './journeyModel'
import { useConfirmDelete } from './ConfirmDelete'
import { PurposeToggle, PaidToggle } from './PurposeToggle'
import { noteHasContent } from './noteHtml'

function hasActivityContent(s: JourneyActivity): boolean {
  return cityDocsOf(s).some((d) => noteHasContent(d.body))
}

function ordered(list: JourneyActivity[]): JourneyActivity[] {
  return list.map((s, i) => ({ ...s, sortOrder: i }))
}

function isBlank(s: JourneyActivity): boolean {
  return (
    !s.title.trim() &&
    !(s.place || '').trim() &&
    !hasActivityContent(s) &&
    !(s.url || '').trim() &&
    !(s.startTime || '').trim() &&
    !(s.endTime || '').trim() &&
    !(s.price || '').trim()
  )
}

function normalizeKind(kind?: string): JourneyActivityKind {
  if (kind === 'excursion') return 'excursion'
  if (kind === 'other') return 'other'
  return 'sight'
}

type CityDayOption = {
  offset: number
  date: string
  label?: string
}

function MoveDatePicker({
  activityId,
  disabled,
  calendarMin,
  calendarMax,
  onMoveToDate,
}: {
  activityId: string
  disabled?: boolean
  calendarMin?: string
  calendarMax?: string
  onMoveToDate?: (activityId: string, date: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!onMoveToDate || !calendarMin || !calendarMax) return null
  return (
    <span className="v2-activity-move-date-wrap">
      <button
        type="button"
        className="v2-activity-move v2-activity-move-date"
        disabled={disabled}
        title="Flytt til annen dag på reisen"
        aria-label="Flytt til annen dag på reisen"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === 'function') {
            el.showPicker()
          } else {
            el.click()
          }
        }}
      >
        <PlaceMetaIcon name="dates" size={14} />
      </button>
      <input
        ref={inputRef}
        type="date"
        className="v2-activity-move-input"
        min={calendarMin}
        max={calendarMax}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const v = e.target.value
          if (!v) return
          onMoveToDate(activityId, v)
          e.target.value = ''
        }}
      />
    </span>
  )
}

function MoveDaySelect({
  activityId,
  dayOffset,
  cityDays,
  disabled,
  onMoveToDay,
}: {
  activityId: string
  dayOffset: number
  cityDays?: CityDayOption[]
  disabled?: boolean
  onMoveToDay?: (activityId: string, targetOffset: number) => void
}) {
  if (!cityDays || cityDays.length <= 1 || !onMoveToDay) return null
  const options = cityDays.filter((d) => d.offset !== dayOffset)
  if (!options.length) return null
  return (
    <select
      className="v2-activity-move"
      disabled={disabled}
      value=""
      title="Flytt til annen dag"
      aria-label="Flytt til annen dag"
      onChange={(e) => {
        const raw = e.target.value
        if (!raw) return
        const target = parseInt(raw, 10)
        if (!Number.isFinite(target)) return
        onMoveToDay(activityId, target)
        e.target.value = ''
      }}
    >
      <option value="" disabled hidden>↔</option>
      {options.map((d) => {
        const dateLabel = d.date
          ? formatDateNO(d.date)
          : `Dag ${d.offset + 1}`
        const label = d.label?.trim()
        return (
          <option key={d.offset} value={d.offset}>
            {label ? `${dateLabel} · ${label}` : dateLabel}
          </option>
        )
      })}
    </select>
  )
}

export function SightList({
  sights,
  disabled,
  compact,
  heading = 'På programmet',
  suggestCountry = '',
  dayOffset = 0,
  cityDays,
  onMoveToDay,
  calendarMin,
  calendarMax,
  onMoveToDate,
  previewLines,
  onChange,
}: {
  sights?: JourneyActivity[] | null
  disabled?: boolean
  /** Tighter layout inside via accordion (no notes / times). */
  compact?: boolean
  /** Section title above the list. */
  heading?: string
  /** Rank place suggestions by this country (from the stop / via). */
  suggestCountry?: string
  /** Calendar day from stop.arriveDate (0 = ankomstdag). */
  dayOffset?: number
  /** Other days in the same city / package (enables “flytt til dag”). */
  cityDays?: CityDayOption[]
  onMoveToDay?: (activityId: string, targetOffset: number) => void
  /** Min/max ISO dates for journey-wide move picker. */
  calendarMin?: string
  calendarMax?: string
  onMoveToDate?: (activityId: string, date: string) => void
  previewLines?: number
  onChange: (sights: JourneyActivity[]) => void
}) {
  const askDelete = useConfirmDelete()
  const [draft, setDraft] = useState<JourneyActivity[]>(() =>
    ordered([...(sights || [])].sort((a, b) => a.sortOrder - b.sortOrder)),
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    const incoming = ordered(
      [...(sights || [])].sort((a, b) => a.sortOrder - b.sortOrder),
    )
    setDraft((prev) => {
      const blanks = prev.filter(isBlank)
      if (!blanks.length) return incoming
      const ids = new Set(incoming.map((s) => s.id))
      const keep = blanks.filter((s) => !ids.has(s.id))
      return ordered([...incoming, ...keep])
    })
  }, [sights])

  function emit(next: JourneyActivity[], immediate = false) {
    const nextOrdered = ordered(
      next.map((s) => ({
        ...s,
        dayOffset:
          typeof s.dayOffset === 'number' && s.dayOffset >= 0
            ? Math.floor(s.dayOffset)
            : dayOffset,
        kind: normalizeKind(s.kind),
      })),
    )
    setDraft(nextOrdered)
    draftRef.current = nextOrdered
    const cleaned = normalizeSights(nextOrdered)
    if (immediate) {
      if (timer.current) clearTimeout(timer.current)
      onChange(cleaned)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      onChange(normalizeSights(draftRef.current))
    }, 350)
  }

  function update(idx: number, partial: Partial<JourneyActivity>) {
    emit(draft.map((s, i) => (i === idx ? { ...s, ...partial } : s)))
  }

  function commit(idx: number) {
    const row = draftRef.current[idx]
    if (!row) return
    emit(
      draftRef.current.map((s, i) =>
        i === idx
          ? {
              ...s,
              title: s.title.trim(),
              place: (s.place || '').trim(),
              notes: (s.notes || '').trim(),
              url: (s.url || '').trim(),
              price: (s.price || '').trim(),
            }
          : s,
      ),
      true,
    )
  }

  function cityField(
    sight: JourneyActivity,
    idx: number,
    compactField: boolean,
  ) {
    return (
      <CitySuggestFields
        city={sight.title || ''}
        country={suggestCountry}
        cityLabel="By"
        cityPlaceholder="F.eks. Roma"
        showCountry={false}
        hideHint
        hideLabel={compactField}
        disabled={disabled}
        onCityChange={(city) => update(idx, { title: city })}
        onCountryChange={() => {}}
        onSelectPlace={(city) => {
          emit(
            draftRef.current.map((s, i) =>
              i === idx ? { ...s, title: city } : s,
            ),
            true,
          )
        }}
        className={compactField ? 'city-suggest-sight-inline' : 'city-suggest-sight'}
      />
    )
  }

  function placeField(
    sight: JourneyActivity,
    idx: number,
    kind: JourneyActivityKind,
    compactField: boolean,
  ) {
    const placeholder = compactField
      ? 'Sted'
      : kind === 'excursion'
        ? 'F.eks. Cinque Terre-tur'
        : kind === 'other'
          ? 'F.eks. Middag, billetter…'
          : 'F.eks. Castello'
    if (compactField) {
      return (
        <input
          className="v2-activity-place-inline"
          value={sight.place || ''}
          disabled={disabled}
          placeholder={placeholder}
          title="Sted"
          onChange={(e) => update(idx, { place: e.target.value })}
          onBlur={() => commit(idx)}
        />
      )
    }
    return (
      <label>
        Sted
        <input
          value={sight.place || ''}
          disabled={disabled}
          placeholder={placeholder}
          title="Sted"
          onChange={(e) => update(idx, { place: e.target.value })}
          onBlur={() => commit(idx)}
        />
      </label>
    )
  }

  function add(kind: JourneyActivityKind) {
    const row = newSight(draft.length, kind, dayOffset)
    setDraft((prev) => ordered([...prev, row]))
    setOpenId(row.id)
  }

  function remove(idx: number) {
    const row = draft[idx]
    const id = row?.id
    const name = activityDisplayName(row) || activityKindLabel(row?.kind)
    void askDelete({ title: `Slette ${name}?` }).then((ok) => {
      if (!ok) return
      emit(
        draft.filter((_, i) => i !== idx),
        true,
      )
      if (id && openId === id) setOpenId(null)
    })
  }

  function move(idx: number, direction: -1 | 1) {
    const list = draftRef.current
    const toIdx = idx + direction
    if (toIdx < 0 || toIdx >= list.length) return
    const next = [...list]
    const [item] = next.splice(idx, 1)
    next.splice(toIdx, 0, item)
    emit(next, true)
  }

  function reorderButtons(idx: number) {
    if (draft.length <= 1) return null
    return (
      <>
        <button
          type="button"
          className="v2-seg-move v2-activity-reorder"
          disabled={disabled || idx === 0}
          title="Flytt opp"
          aria-label="Flytt opp"
          onClick={() => move(idx, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="v2-seg-move v2-activity-reorder"
          disabled={disabled || idx >= draft.length - 1}
          title="Flytt ned"
          aria-label="Flytt ned"
          onClick={() => move(idx, 1)}
        >
          ↓
        </button>
      </>
    )
  }

  return (
    <div className={`v2-sights${compact ? ' is-compact' : ''}`}>
      <div className="v2-sights-head">
        <span>{heading}</span>
        <div className="v2-sights-add">
          <button
            type="button"
            className="v2-chip-btn"
            disabled={disabled}
            title="Legg til severdighet"
            onClick={() => add('sight')}
          >
            + Severdighet
          </button>
          <button
            type="button"
            className="v2-chip-btn"
            disabled={disabled}
            title="Legg til utflukt"
            onClick={() => add('excursion')}
          >
            + Utflukt
          </button>
          <button
            type="button"
            className="v2-chip-btn"
            disabled={disabled}
            title="Legg til annet"
            onClick={() => add('other')}
          >
            + Annet
          </button>
        </div>
      </div>
      {draft.length === 0 && (
        <p className="v2-meta" style={{ margin: 0 }}>
          Museum, utflukt eller annet…
        </p>
      )}
      <div className="v2-sights-list">
        {draft.map((sight, idx) => {
          const kind = normalizeKind(sight.kind)
          const expanded = openId === sight.id
          const title = activityDisplayName(sight)
          const timeBits = [sight.startTime, sight.endTime]
            .filter(Boolean)
            .join('–')
          const purpose = activityPurpose(sight)
          if (compact) {
            return (
              <div key={sight.id} className="v2-sight-row">
                <div className="v2-sight-row-main">
                  <span
                    className={`v2-activity-kind is-${kind}`}
                    title={activityKindLabel(kind)}
                  >
                    {kind === 'excursion' ? 'U' : kind === 'other' ? 'A' : 'S'}
                  </span>
                  {cityField(sight, idx, true)}
                  {placeField(sight, idx, kind, true)}
                  <input
                    className="v2-hop-price"
                    inputMode="decimal"
                    placeholder="Pris"
                    value={sight.price || ''}
                    disabled={disabled}
                    title="Pris"
                    onChange={(e) => update(idx, { price: e.target.value })}
                    onBlur={() => emit(draftRef.current, true)}
                  />
                  <PaidToggle
                    compact
                    checked={sight.paid || false}
                    disabled={disabled}
                    onChange={(paid) =>
                      emit(
                        draftRef.current.map((s, i) =>
                          i === idx ? { ...s, paid } : s,
                        ),
                        true,
                      )
                    }
                  />
                  <div className="v2-sight-row-actions">
                    {reorderButtons(idx)}
                    <MoveDaySelect
                      activityId={sight.id}
                      dayOffset={dayOffset}
                      cityDays={cityDays}
                      disabled={disabled}
                      onMoveToDay={onMoveToDay}
                    />
                    <MoveDatePicker
                      activityId={sight.id}
                      disabled={disabled}
                      calendarMin={calendarMin}
                      calendarMax={calendarMax}
                      onMoveToDate={onMoveToDate}
                    />
                    <button
                      type="button"
                      className="v2-via-remove"
                      disabled={disabled}
                      aria-label="Slett"
                      title="Slett"
                      onClick={() => remove(idx)}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
                <div className="v2-sight-row-purpose">
                  <PurposeToggle
                    compact
                    value={purpose}
                    disabled={disabled}
                    onChange={(next) =>
                      emit(
                        draftRef.current.map((s, i) =>
                          i === idx ? { ...s, purpose: next } : s,
                        ),
                        true,
                      )
                    }
                  />
                </div>
              </div>
            )
          }
          return (
            <div
              key={sight.id}
              className={`v2-activity-card${expanded ? ' is-open' : ''} is-${kind}`}
            >
              <div className="v2-activity-head">
                <button
                  type="button"
                  className="v2-activity-summary"
                  disabled={disabled}
                  aria-expanded={expanded}
                  title={
                    expanded
                      ? `Skjul ${activityKindLabel(kind).toLowerCase()}`
                      : `Vis ${activityKindLabel(kind).toLowerCase()}`
                  }
                  onClick={() =>
                    setOpenId((prev) => (prev === sight.id ? null : sight.id))
                  }
                >
                  <span className={`v2-activity-kind is-${kind}`}>
                    {activityKindLabel(kind)}
                  </span>
                  <span className="v2-activity-title">{title}</span>
                  {(timeBits ||
                    hasActivityContent(sight) ||
                    sight.price?.trim() ||
                    purpose === 'transfer') && (
                    <span className="v2-meta">
                      {[
                        timeBits,
                        sight.price?.trim(),
                        purpose === 'transfer' ? 'Ikke stopp' : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </button>
                <div className="v2-activity-actions">
                  {reorderButtons(idx)}
                  <CityInfoTip
                    text={sight.notes}
                    docs={sight.docs}
                    disabled={disabled}
                  />
                  <MoveDaySelect
                    activityId={sight.id}
                    dayOffset={dayOffset}
                    cityDays={cityDays}
                    disabled={disabled}
                    onMoveToDay={onMoveToDay}
                  />
                  <MoveDatePicker
                    activityId={sight.id}
                    disabled={disabled}
                    calendarMin={calendarMin}
                    calendarMax={calendarMax}
                    onMoveToDate={onMoveToDate}
                  />
                  <button
                    type="button"
                    className="v2-seg-toggle"
                    disabled={disabled}
                    aria-label={expanded ? 'Skjul' : 'Vis'}
                    title={expanded ? 'Skjul' : 'Vis detaljer'}
                    onClick={() =>
                      setOpenId((prev) => (prev === sight.id ? null : sight.id))
                    }
                  >
                    {expanded ? '▴' : '▾'}
                  </button>
                  <button
                    type="button"
                    className="v2-via-remove"
                    disabled={disabled}
                    aria-label="Slett"
                    title="Slett"
                    onClick={() => remove(idx)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="v2-activity-body">
                  <PurposeToggle
                    value={purpose}
                    disabled={disabled}
                    onChange={(next) =>
                      emit(
                        draftRef.current.map((s, i) =>
                          i === idx ? { ...s, purpose: next } : s,
                        ),
                        true,
                      )
                    }
                  />
                  {cityField(sight, idx, false)}
                  {placeField(sight, idx, kind, false)}
                  <div className="v2-activity-times">
                    <label>
                      Fra
                      <ClockTimeInput
                        value={sight.startTime || ''}
                        disabled={disabled}
                        placeholder="08:00"
                        title="Fra klokkeslett"
                        onChange={(value) =>
                          update(idx, { startTime: value })
                        }
                        onBlur={() => emit(draftRef.current, true)}
                      />
                    </label>
                    <label>
                      Til
                      <ClockTimeInput
                        value={sight.endTime || ''}
                        disabled={disabled}
                        placeholder="16:00"
                        title="Til klokkeslett"
                        onChange={(value) =>
                          update(idx, { endTime: value })
                        }
                        onBlur={() => emit(draftRef.current, true)}
                      />
                    </label>
                  </div>
                  <CityDocsEditor
                    value={sight}
                    disabled={disabled}
                    heading=""
                    firstTitlePlaceholder="Notat"
                    firstBodyPlaceholder="Møtested, billett, tips…"
                    previewLines={previewLines}
                    onChange={(next, opts) =>
                      emit(
                        draftRef.current.map((s, i) =>
                          i === idx ? { ...s, ...next } : s,
                        ),
                        opts?.immediate ?? true,
                      )
                    }
                  />
                  <label>
                    Lenke
                    <input
                      value={sight.url || ''}
                      disabled={disabled}
                      placeholder="https://…"
                      title="Lenke"
                      onChange={(e) => update(idx, { url: e.target.value })}
                      onBlur={() => commit(idx)}
                    />
                  </label>
                  <div className="v2-activity-prices">
                    <label>
                      Pris
                      <input
                        value={sight.price || ''}
                        disabled={disabled}
                        placeholder="500 kr"
                        inputMode="decimal"
                        title="Pris"
                        onChange={(e) =>
                          update(idx, { price: e.target.value })
                        }
                        onBlur={() => commit(idx)}
                      />
                    </label>
                    <PaidToggle
                      checked={sight.paid || false}
                      disabled={disabled}
                      onChange={(paid) =>
                        emit(
                          draftRef.current.map((s, i) =>
                            i === idx ? { ...s, paid } : s,
                          ),
                          true,
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SightPreview({ sights }: { sights?: JourneyActivity[] | null }) {
  const list = normalizeSights(sights)
  if (!list.length) return null
  return (
    <ul className="v2-sights-preview">
      {list.map((s) => (
        <li
          key={s.id}
          className={[
            s.kind === 'excursion'
              ? 'is-excursion'
              : s.kind === 'other'
                ? 'is-other'
                : 'is-sight',
            activityPurpose(s) === 'transfer' ? 'is-transfer' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={
            activityPurpose(s) === 'transfer'
              ? `${activityKindLabel(s.kind)} · Ikke stopp`
              : activityKindLabel(s.kind)
          }
        >
          {activityDisplayName(s)}
        </li>
      ))}
    </ul>
  )
}

/** Collapsed preview of hotel + program linked to a city. */
export function PlaceLinkedPreview({
  hotel,
  stay,
  lodgingKind = 'hotel',
  nights,
  arriveDate,
  departDate,
  warnMissingStay,
  sights,
}: {
  hotel?: string
  stay?: JourneyStay | null
  lodgingKind?: 'hotel' | 'airbnb'
  nights?: number
  arriveDate?: string
  departDate?: string
  warnMissingStay?: boolean
  sights?: JourneyActivity[] | null
}) {
  const list = normalizeSights(sights)
  const hasHotel = !!(hotel || '').trim()
  const hasStay = (nights || 0) >= 1
  const kindLabel = lodgingKind === 'airbnb' ? 'Airbnb' : 'Hotell'
  const unsetLabel = STAY_WITHOUT_HOTEL_LABEL
  const itemClass =
    lodgingKind === 'airbnb' ? 'is-airbnb' : 'is-hotel'
  if (!hasHotel && !hasStay && !list.length && !warnMissingStay) return null
  return (
    <ul className="v2-sights-preview v2-linked-preview">
      {hasHotel ? (
        <HotelLinkedChip
          stay={stay}
          label={hotel!.trim()}
          lodgingKind={lodgingKind}
          nights={nights}
          arriveDate={arriveDate}
          departDate={departDate}
        />
      ) : hasStay ? (
        <HotelLinkedChip
          stay={stay}
          label={unsetLabel}
          lodgingKind={lodgingKind}
          empty
          nights={nights}
          arriveDate={arriveDate}
          departDate={departDate}
        />
      ) : warnMissingStay ? (
        <li className={`${itemClass} is-empty`} title={kindLabel}>
          Uten {kindLabel.toLowerCase()}
        </li>
      ) : null}
      {list.map((s) => (
        <CityLinkedChip
          key={s.id}
          label={activityDisplayName(s)}
          text={s.notes}
          docs={s.docs}
          className={[
            s.kind === 'excursion'
              ? 'is-excursion'
              : s.kind === 'other'
                ? 'is-other'
                : 'is-sight',
            activityPurpose(s) === 'transfer' ? 'is-transfer' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          hint={
            activityPurpose(s) === 'transfer'
              ? `${activityKindLabel(s.kind)} · Ikke stopp`
              : activityKindLabel(s.kind)
          }
        />
      ))}
    </ul>
  )
}
