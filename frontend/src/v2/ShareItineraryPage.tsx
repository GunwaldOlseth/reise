import { useEffect, useState } from 'react'
import { api } from '../api'
import { ShareItineraryView } from './ShareItineraryView'
import type { ShareItinerary } from './shareItinerary'
import './v2.css'

export function ShareItineraryPage({ token }: { token: string }) {
  const [itinerary, setItinerary] = useState<ShareItinerary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    void api
      .getShare(token)
      .then((data) => {
        if (cancelled) return
        setItinerary(data)
        document.title = data.name ? `${data.name} · Reise` : 'Reise'
      })
      .catch(() => {
        if (!cancelled) setError('Fant ikke denne listen.')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="v2-shell v2-share-page">
      {error ? (
        <p className="v2-error">{error}</p>
      ) : itinerary ? (
        <ShareItineraryView itinerary={itinerary} />
      ) : (
        <p className="v2-meta">Henter liste…</p>
      )}
    </div>
  )
}
