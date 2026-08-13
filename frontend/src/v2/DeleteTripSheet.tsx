import { useState } from 'react'
import { api } from '../api'

export function DeleteTripSheet({
  tripId,
  tripName,
  onCancel,
  onDeleted,
}: {
  tripId: string
  tripName: string
  onCancel: () => void
  onDeleted: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (!password.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await api.deleteTrip(tripId, password)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette ferien')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel">
        <div className="v2-sheet-head">
          <div>
            <h2>Slett ferie</h2>
            <p className="v2-meta">
              Fjerner {tripName.trim() || 'ferien'} og alt som hører til —
              byer, reiseplan, dager og utgifter.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Avbryt"
            disabled={busy}
            onClick={onCancel}
          >
            Lukk
          </button>
        </div>

        <p className="v2-error">Dette kan ikke angres.</p>

        <div className="form-grid">
          <label className="full">
            Passord
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              disabled={busy}
              placeholder="Slett-passord"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirm()
              }}
            />
          </label>
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
            className="btn btn-danger"
            disabled={busy || !password.trim()}
            title="Slett ferien og alt innhold"
            onClick={() => void confirm()}
          >
            {busy ? 'Sletter…' : 'Slett alt'}
          </button>
        </div>
      </div>
    </div>
  )
}
