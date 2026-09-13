import { useState } from 'react'
import type { Trip } from '../api'
import type { Journey } from './journeyModel'
import {
  downloadItineraryPdf,
  type PdfDailyAppendixOptions,
} from './itineraryPdf'

const DEFAULT_APPENDIX: PdfDailyAppendixOptions = {
  expenses: false,
  steps: false,
  transport: false,
  photos: false,
}

export function PdfDownloadSheet({
  trip,
  journey,
  onClose,
}: {
  trip: Trip
  journey: Journey
  onClose: () => void
}) {
  const [appendix, setAppendix] = useState<PdfDailyAppendixOptions>(() => ({
    ...DEFAULT_APPENDIX,
  }))
  const [busy, setBusy] = useState(false)

  function toggle(key: keyof PdfDailyAppendixOptions) {
    setAppendix((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function download() {
    setBusy(true)
    try {
      downloadItineraryPdf(trip, journey, appendix)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true">
      <div className="v2-sheet-panel">
        <div className="v2-sheet-head">
          <div>
            <h2>Last ned PDF</h2>
            <p className="v2-meta">
              Plan og rute som i dag, eller ta med en påfølgende inndeling per
              dag.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Lukk"
            disabled={busy}
            onClick={onClose}
          >
            Lukk
          </button>
        </div>

        <fieldset className="v2-pdf-appendix-fieldset">
          <legend className="v2-meta">Påfølgende per dag</legend>
          <label className="v2-check-row">
            <input
              type="checkbox"
              checked={appendix.expenses}
              disabled={busy}
              onChange={() => toggle('expenses')}
            />
            Utgifter
          </label>
          <label className="v2-check-row">
            <input
              type="checkbox"
              checked={appendix.steps}
              disabled={busy}
              onChange={() => toggle('steps')}
            />
            Skritt
          </label>
          <label className="v2-check-row">
            <input
              type="checkbox"
              checked={appendix.transport}
              disabled={busy}
              onChange={() => toggle('transport')}
            />
            Transport
          </label>
          <label className="v2-check-row">
            <input
              type="checkbox"
              checked={appendix.photos}
              disabled={busy}
              onChange={() => toggle('photos')}
            />
            Bilder
          </label>
        </fieldset>

        <p className="v2-meta">
          Uten avkryssing får du bare kort oversikt og fullversjon av planen.
        </p>

        <div className="v2-sheet-actions">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy}
            onClick={onClose}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={download}
          >
            Last ned
          </button>
        </div>
      </div>
    </div>
  )
}
