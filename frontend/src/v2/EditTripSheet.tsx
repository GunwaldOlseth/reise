import { useState } from 'react'
import {
  api,
  emptyTripFeatures,
  normalizeTravelers,
  type Trip,
} from '../api'

export function TravelerEditor({
  travelers,
  disabled,
  onChange,
}: {
  travelers: string[]
  disabled?: boolean
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const name = draft.trim()
    if (!name) return
    onChange(normalizeTravelers([...travelers, name]))
    setDraft('')
  }

  return (
    <div className="v2-travelers">
      <span className="v2-travelers-label">Hvem er med</span>
      {travelers.length > 0 && (
        <ul className="v2-traveler-chips">
          {travelers.map((name) => (
            <li key={name}>
              <span>{name}</span>
              <button
                type="button"
                disabled={disabled}
                title={`Fjern ${name}`}
                aria-label={`Fjern ${name}`}
                onClick={() =>
                  onChange(travelers.filter((n) => n !== name))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="v2-traveler-add">
        <input
          value={draft}
          disabled={disabled}
          placeholder="Navn"
          title="Legg til person"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          className="v2-chip-btn"
          disabled={disabled || !draft.trim()}
          title="Legg til"
          onClick={add}
        >
          + Legg til
        </button>
      </div>
    </div>
  )
}

export function EditTripSheet({
  trip,
  onCancel,
  onSaved,
}: {
  trip: Trip
  onCancel: () => void
  onSaved: (trip: Trip) => void
}) {
  const [name, setName] = useState(trip.name)
  const [startDate, setStartDate] = useState(trip.startDate || '')
  const [endDate, setEndDate] = useState(trip.endDate || '')
  const [travelers, setTravelers] = useState(() =>
    normalizeTravelers(trip.travelers),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const nextName = name.trim()
    if (!nextName || busy) return
    setBusy(true)
    setError('')
    try {
      const saved = await api.updateTrip(trip.id, {
        name: nextName,
        startDate,
        endDate: !endDate || (startDate && endDate < startDate) ? startDate : endDate,
        colorByCountry: trip.colorByCountry || {},
        features: {
          ...emptyTripFeatures(),
          ...trip.features,
        },
        travelers: normalizeTravelers(travelers),
      })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre turen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel">
        <div className="v2-sheet-head">
          <div>
            <h2>Rediger tur</h2>
            <p className="v2-meta">Navn, datoer og hvem som er med.</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Lukk"
            disabled={busy}
            onClick={onCancel}
          >
            Lukk
          </button>
        </div>

        <div className="form-grid">
          <label className="full">
            Navn
            <input
              autoFocus
              value={name}
              disabled={busy}
              placeholder="Italia våren 2026"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Startdato
            <input
              type="date"
              value={startDate}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value
                setStartDate(next)
                if (!endDate || endDate < next) setEndDate(next)
              }}
            />
          </label>
          <label>
            Sluttdato
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              disabled={busy}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <div className="full">
            <TravelerEditor
              travelers={travelers}
              disabled={busy}
              onChange={setTravelers}
            />
          </div>
        </div>
        {error ? <p className="v2-error">{error}</p> : null}

        <div className="v2-sheet-actions">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy}
            title="Avbryt"
            onClick={onCancel}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !name.trim()}
            title="Lagre tur"
            onClick={() => void save()}
          >
            {busy ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}
