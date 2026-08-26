import { useEffect, useState } from 'react'
import { api, type BackupMeta, type Trip } from '../api'
import { SharePreviewCard } from './ShareItineraryView'

const ADMIN_TOKEN_KEY = 'reise.adminToken'

function formatBackupWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminBackupPanel() {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(
    () => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '',
  )
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [backupBucket, setBackupBucket] = useState('')
  const [backupGcsCount, setBackupGcsCount] = useState<number | null>(null)
  const [backupLocalCount, setBackupLocalCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (!token) return
    void refresh()
  }, [token])

  async function loadList(nextToken: string) {
    const data = await api.adminListBackups(nextToken)
    setBackups(data.backups || [])
    setBackupBucket(data.bucket || '')
    setBackupGcsCount(data.gcsCount ?? null)
    setBackupLocalCount(data.localCount ?? null)
  }

  async function login() {
    setBusy(true)
    setHint('')
    try {
      const data = await api.adminLogin(password)
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      setToken(data.token)
      setPassword('')
      await loadList(data.token)
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Innlogging feilet')
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    if (!token) return
    setBusy(true)
    setHint('')
    try {
      await loadList(token)
    } catch (err) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      setToken('')
      setHint(err instanceof Error ? err.message : 'Kunne ikke hente backup')
    } finally {
      setBusy(false)
    }
  }

  async function createNow() {
    if (!token) return
    setBusy(true)
    setHint('')
    try {
      await api.adminCreateBackup(token)
      await loadList(token)
      setHint('Ny sikkerhetskopi er tatt.')
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Kunne ikke ta backup')
    } finally {
      setBusy(false)
    }
  }

  async function restore(id: string, label: string) {
    if (
      !confirm(
        `Gjenopprette sikkerhetskopi fra ${label}? Dette erstatter alle turer med innholdet i kopien.`,
      )
    ) {
      return
    }
    setBusy(true)
    setHint('')
    try {
      await api.adminRestoreBackup(token, id)
      setHint('Gjenopprettet. Last siden på nytt for å se turene.')
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Kunne ikke gjenopprette')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v2-settings-card">
      <h2>Sikkerhetskopi</h2>
      <p className="v2-meta">
        Automatisk kl. 08, 14 og 19 (norsk tid). Lokalt lagres i{' '}
        <code>backend/api/backups</code>. I skyen: Google Cloud Storage når{' '}
        <code>BACKUP_BUCKET</code> er satt (standard:{' '}
        <code>&lt;prosjekt&gt;-reise-backups</code>).
      </p>
      {token && backupBucket ? (
        <p className="v2-meta">
          Bucket: <code>gs://{backupBucket}/backups/</code>
          {backupGcsCount != null ? ` · ${backupGcsCount} i sky` : null}
          {backupLocalCount != null && backupLocalCount > 0
            ? ` · ${backupLocalCount} lokalt`
            : null}
        </p>
      ) : null}
      {!token ? (
        <div className="form-grid">
          <label className="full">
            Admin-passord
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void login()
              }}
            />
          </label>
          <div className="v2-settings-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !password.trim()}
              onClick={() => void login()}
            >
              {busy ? 'Logger inn…' : 'Logg inn'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="v2-settings-actions">
            <button
              className="btn btn-soft"
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Oppdater liste
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={() => void createNow()}
            >
              Ta backup nå
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                sessionStorage.removeItem(ADMIN_TOKEN_KEY)
                setToken('')
                setBackups([])
              }}
            >
              Logg ut
            </button>
          </div>
          {backups.length === 0 ? (
            <p className="v2-meta">
              Ingen sikkerhetskopier funnet
              {backupBucket ? ` i gs://${backupBucket}` : ''}. Trykk{' '}
              <strong>Oppdater liste</strong> etter at backend er startet med
              tilgang til bucket, eller <strong>Ta backup nå</strong> for å
              lage en lokal kopi.
            </p>
          ) : (
            <ul className="v2-backup-list">
              {backups.map((b) => {
                const label = formatBackupWhen(b.createdAt)
                const sizeKb =
                  b.bytes != null ? Math.round(b.bytes / 1024) : null
                const counts =
                  b.trips != null
                    ? `${b.trips} turer, ${b.days ?? 0} dager, ${b.journeys ?? 0} reiser`
                    : null
                return (
                  <li key={b.id}>
                    <span>
                      <strong>{label}</strong>
                      {counts ? (
                        <span className="v2-meta"> · {counts}</span>
                      ) : null}
                      {sizeKb != null ? (
                        <span className="v2-meta"> · {sizeKb} KB</span>
                      ) : null}
                    </span>
                    <button
                      className="btn btn-soft btn-sm"
                      type="button"
                      disabled={busy}
                      onClick={() => void restore(b.id, label)}
                    >
                      Hent tilbake
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      {hint ? <p className="v2-meta">{hint}</p> : null}
    </section>
  )
}

export function AdminPage({
  trips,
  previewTripId,
  onBack,
}: {
  trips: Trip[]
  previewTripId?: string
  onBack: () => void
}) {
  return (
    <div className="v2-shell v2-settings v2-admin">
      <header className="v2-hub-top">
        <div className="v2-hub-brand">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Tilbake"
            onClick={onBack}
          >
            ← Tilbake
          </button>
          <div>
            <h1>Admin</h1>
            <p className="v2-meta">Sikkerhetskopi og publisering</p>
          </div>
        </div>
      </header>

      <div className="v2-settings-body">
        <AdminBackupPanel />
        <SharePreviewCard trips={trips} initialTripId={previewTripId} />
      </div>
    </div>
  )
}
