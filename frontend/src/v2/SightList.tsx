import { useEffect, useRef, useState } from 'react'
import { ClockTimeInput } from './ClockTimeInput'
import { CitySuggestFields } from '../CitySuggest'
import { TrashIcon } from '../TransportModeIcon'
import {
  activityKindLabel,
  newSight,
  normalizeSights,
  STAY_WITHOUT_HOTEL_LABEL,
  type JourneyActivity,
  type JourneyActivityKind,
} from './journeyModel'
import { useConfirmDelete } from './ConfirmDelete'

function ordered(list: JourneyActivity[]): JourneyActivity[] {
  return list.map((s, i) => ({ ...s, sortOrder: i }))
}

function isBlank(s: JourneyActivity): boolean {
  return (
    !s.title.trim() &&
    !(s.notes || '').trim() &&
    !(s.url || '').trim() &&
    !(s.startTime || '').trim() &&
    !(s.endTime || '').trim()
  )
}

function normalizeKind(kind?: string): JourneyActivityKind {
  if (kind === 'excursion') return 'excursion'
  if (kind === 'other') return 'other'
  return 'sight'
}

export function SightList({
  sights,
  disabled,
  compact,
  heading = 'På programmet',
  suggestCountry = '',
  dayOffset = 0,
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
              notes: (s.notes || '').trim(),
              url: (s.url || '').trim(),
            }
          : s,
      ),
      true,
    )
  }

  function nameField(
    sight: JourneyActivity,
    idx: number,
    kind: JourneyActivityKind,
    compactField: boolean,
  ) {
    const placeholder = compactField
      ? activityKindLabel(kind)
      : kind === 'excursion'
        ? 'F.eks. Cinque Terre-tur'
        : kind === 'other'
          ? 'F.eks. Middag, billetter…'
          : 'F.eks. Castello'
    return (
      <CitySuggestFields
        city={sight.title || ''}
        country={suggestCountry}
        cityLabel="Navn"
        cityPlaceholder={placeholder}
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

  function add(kind: JourneyActivityKind) {
    const row = newSight(draft.length, kind, dayOffset)
    setDraft((prev) => ordered([...prev, row]))
    setOpenId(row.id)
  }

  function remove(idx: number) {
    const row = draft[idx]
    const id = row?.id
    const name = row?.title.trim() || activityKindLabel(row?.kind)
    void askDelete({ title: `Slette ${name}?` }).then((ok) => {
      if (!ok) return
      emit(
        draft.filter((_, i) => i !== idx),
        true,
      )
      if (id && openId === id) setOpenId(null)
    })
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
          const title = sight.title.trim() || activityKindLabel(kind)
          const timeBits = [sight.startTime, sight.endTime]
            .filter(Boolean)
            .join('–')
          if (compact) {
            return (
              <div key={sight.id} className="v2-sight-row">
                <span
                  className={`v2-activity-kind is-${kind}`}
                  title={activityKindLabel(kind)}
                >
                  {kind === 'excursion' ? 'U' : kind === 'other' ? 'A' : 'S'}
                </span>
                {nameField(sight, idx, kind, true)}
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
                  {(timeBits || sight.notes?.trim()) && (
                    <span className="v2-meta">
                      {[timeBits, sight.notes?.trim()]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </button>
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
              {expanded && (
                <div className="v2-activity-body">
                  {nameField(sight, idx, kind, false)}
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
                  <label>
                    Notat
                    <input
                      value={sight.notes || ''}
                      disabled={disabled}
                      placeholder="Møtested, billett, tips…"
                      title="Notat"
                      onChange={(e) => update(idx, { notes: e.target.value })}
                      onBlur={() => commit(idx)}
                    />
                  </label>
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
          className={
            s.kind === 'excursion'
              ? 'is-excursion'
              : s.kind === 'other'
                ? 'is-other'
                : 'is-sight'
          }
          title={activityKindLabel(s.kind)}
        >
          {s.title}
        </li>
      ))}
    </ul>
  )
}

/** Collapsed preview of hotel + program linked to a city. */
export function PlaceLinkedPreview({
  hotel,
  lodgingKind = 'hotel',
  nights,
  warnMissingStay,
  sights,
}: {
  hotel?: string
  lodgingKind?: 'hotel' | 'airbnb'
  nights?: number
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
        <li className={itemClass} title={kindLabel}>
          {hotel!.trim()}
        </li>
      ) : hasStay ? (
        <li className={`${itemClass} is-empty`} title={kindLabel}>
          {unsetLabel}
        </li>
      ) : warnMissingStay ? (
        <li className={`${itemClass} is-empty`} title={kindLabel}>
          Uten {kindLabel.toLowerCase()}
        </li>
      ) : null}
      {list.map((s) => (
        <li
          key={s.id}
          className={
            s.kind === 'excursion'
              ? 'is-excursion'
              : s.kind === 'other'
                ? 'is-other'
                : 'is-sight'
          }
          title={activityKindLabel(s.kind)}
        >
          {s.title}
        </li>
      ))}
    </ul>
  )
}
