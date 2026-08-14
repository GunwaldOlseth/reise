import { useEffect, useState } from 'react'
import { api } from '../api'
import { localizeJourneyPlaces } from '../placeNames'
import {
  clampAlertMinutes,
  loadTimeAlertSettings,
  saveTimeAlertSettings,
  type TimeAlertSettings,
} from '../userSettings'
import { emptyJourney, type Journey } from './journeyModel'
import {
  alertsDueNow,
  collectTimeAlertEvents,
  fireTimeAlert,
  notificationPermission,
  requestNotificationPermission,
  type TimeAlertEvent,
} from './travelAlerts'

export function TimeAlertsCard() {
  const [draft, setDraft] = useState<TimeAlertSettings>(() =>
    loadTimeAlertSettings(),
  )
  const [permission, setPermission] = useState(() => notificationPermission())
  const [hint, setHint] = useState('')

  function commit(patch: Partial<TimeAlertSettings>) {
    setDraft((prev) => saveTimeAlertSettings({ ...prev, ...patch }))
  }

  async function allowNotifications() {
    const next = await requestNotificationPermission()
    setPermission(next)
    if (next === 'granted') setHint('Varsler er tillatt.')
    else if (next === 'denied') setHint('Varsler er blokkert i nettleseren.')
  }

  return (
    <section className="v2-settings-card">
      <h2>Tidsvarsler</h2>
      <p className="v2-meta">
        Beskjed før transport og ankomst, og en egen tid før skipet går. Varsler
        kommer mens Reise er åpen i nettleseren.
      </p>
      <label>
        Transport og ankomst
        <span className="v2-alert-minutes">
          <input
            type="number"
            min={0}
            max={720}
            step={5}
            inputMode="numeric"
            value={draft.travelMinutes}
            onChange={(e) =>
              commit({ travelMinutes: clampAlertMinutes(e.target.value) })
            }
          />
          <span>minutter før (0 = av)</span>
        </span>
      </label>
      <label>
        Avgang med cruiseskip
        <span className="v2-alert-minutes">
          <input
            type="number"
            min={0}
            max={720}
            step={5}
            inputMode="numeric"
            value={draft.cruiseMinutes}
            onChange={(e) =>
              commit({ cruiseMinutes: clampAlertMinutes(e.target.value) })
            }
          />
          <span>minutter før (0 = av)</span>
        </span>
      </label>
      {permission !== 'granted' && permission !== 'unsupported' ? (
        <div className="v2-settings-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void allowNotifications()}
          >
            Tillat varsler
          </button>
        </div>
      ) : null}
      {permission === 'granted' ? (
        <p className="v2-meta">Nettleservarsler er på.</p>
      ) : null}
      {permission === 'unsupported' ? (
        <p className="v2-meta">
          Denne nettleseren støtter ikke systemvarsler. Du får likevel et varsel
          i appen.
        </p>
      ) : null}
      {hint ? <p className="v2-meta">{hint}</p> : null}
    </section>
  )
}

export function TravelAlertWatcher({ tripIds }: { tripIds: string[] }) {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [toast, setToast] = useState<TimeAlertEvent | null>(null)
  const idsKey = tripIds.join('|')

  useEffect(() => {
    if (!idsKey) {
      setJourneys([])
      return
    }
    const ids = idsKey.split('|').filter(Boolean)
    let cancelled = false
    void Promise.all(
      ids.map((id) =>
        api
          .getJourney(id)
          .then((data) =>
            localizeJourneyPlaces({
              ...emptyJourney(id),
              ...data,
              tripId: id,
            }),
          )
          .catch(() => emptyJourney(id)),
      ),
    ).then((list) => {
      if (!cancelled) setJourneys(list)
    })
    return () => {
      cancelled = true
    }
  }, [idsKey])

  useEffect(() => {
    function tick() {
      const due = alertsDueNow(collectTimeAlertEvents(journeys))
      if (!due.length) return
      const [first, ...rest] = due
      fireTimeAlert(first)
      for (const extra of rest) fireTimeAlert(extra)
      setToast(first)
    }
    tick()
    const id = window.setInterval(tick, 15_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [journeys])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 12_000)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!toast) return null
  return (
    <div className="v2-time-alert" role="status">
      <strong>{toast.title}</strong>
      <span>{toast.body}</span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setToast(null)}
      >
        Lukk
      </button>
    </div>
  )
}
