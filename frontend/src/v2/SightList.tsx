import { useEffect, useRef, useState } from 'react'
import { TrashIcon } from '../TransportModeIcon'
import {
  activityKindLabel,
  newSight,
  normalizeSights,
  type JourneyActivity,
  type JourneyActivityKind,
} from './journeyModel'

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
  onChange,
}: {
  sights?: JourneyActivity[] | null
  disabled?: boolean
  /** Tighter layout inside via accordion (no notes / times). */
  compact?: boolean
  onChange: (sights: JourneyActivity[]) => void
}) {
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
        dayOffset: 0,
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

  function add(kind: JourneyActivityKind) {
    const row = newSight(draft.length, kind, 0)
    setDraft((prev) => ordered([...prev, row]))
    setOpenId(row.id)
  }

  function remove(idx: number) {
    const id = draft[idx]?.id
    emit(
      draft.filter((_, i) => i !== idx),
      true,
    )
    if (id && openId === id) setOpenId(null)
  }

  return (
    <div className={`v2-sights${compact ? ' is-compact' : ''}`}>
      <div className="v2-sights-head">
        <span>På programmet</span>
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
                <input
                  value={sight.title || ''}
                  disabled={disabled}
                  placeholder={activityKindLabel(kind)}
                  aria-label={activityKindLabel(kind)}
                  title={activityKindLabel(kind)}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  onBlur={() => emit(draftRef.current, true)}
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
                  <label>
                    Navn
                    <input
                      value={sight.title || ''}
                      disabled={disabled}
                      placeholder={
                        kind === 'excursion'
                          ? 'F.eks. Cinque Terre-tur'
                          : kind === 'other'
                            ? 'F.eks. Middag, billetter…'
                            : 'F.eks. Castello'
                      }
                      title="Navn"
                      onChange={(e) => update(idx, { title: e.target.value })}
                      onBlur={() => emit(draftRef.current, true)}
                    />
                  </label>
                  <div className="v2-activity-times">
                    <label>
                      Fra
                      <input
                        type="time"
                        value={sight.startTime || ''}
                        disabled={disabled}
                        title="Fra klokkeslett"
                        onChange={(e) =>
                          update(idx, { startTime: e.target.value })
                        }
                        onBlur={() => emit(draftRef.current, true)}
                      />
                    </label>
                    <label>
                      Til
                      <input
                        type="time"
                        value={sight.endTime || ''}
                        disabled={disabled}
                        title="Til klokkeslett"
                        onChange={(e) =>
                          update(idx, { endTime: e.target.value })
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
                      onBlur={() => emit(draftRef.current, true)}
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
                      onBlur={() => emit(draftRef.current, true)}
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
