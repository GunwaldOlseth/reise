import { useMemo } from 'react'
import {
  formatDateNO,
  liveEntryAppliesToTraveler,
  liveKindLabel,
  normalizeLive,
  type Journey,
  type JourneyLiveEntry,
} from './journeyModel'
import { useConfirmDelete } from './ConfirmDelete'
import { LiveEntryRow } from './JourneyLive'

function hasLiveContent(entry: JourneyLiveEntry): boolean {
  return !!(
    entry.title.trim() ||
    (entry.price || '').trim() ||
    (entry.notes || '').trim() ||
    (entry.rating || 0) > 0 ||
    (entry.photos || []).length > 0
  )
}

function entrySummary(entry: JourneyLiveEntry): string {
  const title = entry.title.trim() || liveKindLabel(entry.kind)
  const price = (entry.price || '').trim()
  return price ? `${title} · ${price}` : title
}

export function JourneyLog({
  journey,
  tripTravelers = [],
  disabled,
  onChange,
}: {
  journey: Journey
  tripTravelers?: string[]
  disabled?: boolean
  onChange: (next: Journey) => void
}) {
  const askDelete = useConfirmDelete()
  const travelers = useMemo(
    () => [...new Set(tripTravelers.map((n) => n.trim()).filter(Boolean))],
    [tripTravelers],
  )

  const groups = useMemo(() => {
    const byDate = new Map<string, JourneyLiveEntry[]>()
    for (const entry of normalizeLive(journey.live)) {
      if (!hasLiveContent(entry)) continue
      const list = byDate.get(entry.date) || []
      list.push(entry)
      byDate.set(entry.date, list)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, rows]) => [
        day,
        [...rows].sort((a, b) => a.sortOrder - b.sortOrder),
      ] as const)
  }, [journey.live])

  function patchJourney(next: Journey) {
    onChange({ ...next, live: normalizeLive(next.live) })
  }

  function setLive(list: JourneyLiveEntry[]) {
    patchJourney({ ...journey, live: normalizeLive(list) })
  }

  function updateEntry(id: string, partial: Partial<JourneyLiveEntry>) {
    setLive(
      normalizeLive(journey.live).map((e) =>
        e.id === id ? { ...e, ...partial } : e,
      ),
    )
  }

  function removeEntry(id: string) {
    setLive(normalizeLive(journey.live).filter((e) => e.id !== id))
  }

  const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0)

  return (
    <div className="v2-live v2-log">
      <header className="v2-log-head">
        <h2>Logg</h2>
        <p className="v2-meta">
          Alt som er logget utenom planen — mat, drikke, kjøp og annet.
          {travelers.length > 0
            ? ' Oversikt dag for dag per deltaker.'
            : ' Legg til hvem som er med under rediger tur for deltaker-visning.'}
        </p>
      </header>

      {total === 0 ? (
        <p className="v2-empty">
          Ingenting logget ennå. Legg til under{' '}
          <strong>Live</strong> på den aktuelle dagen.
        </p>
      ) : (
        groups.map(([day, rows]) => (
          <section key={day} className="v2-live-block">
            <h3>{formatDateNO(day)}</h3>
            {travelers.length > 0 ? (
              <div className="v2-log-traveler-groups">
                {travelers.map((name) => {
                  const personRows = rows.filter((entry) =>
                    liveEntryAppliesToTraveler(entry, name, travelers),
                  )
                  return (
                    <div
                      key={name}
                      className={`v2-log-traveler-group${
                        personRows.length === 0 ? ' is-empty' : ''
                      }`}
                    >
                      <h4>{name}</h4>
                      {personRows.length === 0 ? (
                        <p className="v2-meta">Ingen registrering denne dagen.</p>
                      ) : (
                        <ul className="v2-log-traveler-summary">
                          {personRows.map((entry) => (
                            <li key={entry.id}>{entrySummary(entry)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}
            <ul className="v2-live-log">
              {rows.map((entry) => (
                <LiveEntryRow
                  key={entry.id}
                  entry={entry}
                  tripTravelers={travelers}
                  disabled={disabled}
                  onChange={(partial) => updateEntry(entry.id, partial)}
                  onRemove={() => {
                    const name =
                      entry.title.trim() || liveKindLabel(entry.kind)
                    void askDelete({ title: `Slette ${name}?` }).then((ok) => {
                      if (ok) removeEntry(entry.id)
                    })
                  }}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
