import type { PlacePurpose } from './journeyModel'

export function PurposeToggle({
  value,
  disabled,
  compact,
  onChange,
}: {
  value: PlacePurpose
  disabled?: boolean
  /** Shorter labels for tight rows (via / compact sights). */
  compact?: boolean
  onChange: (next: PlacePurpose) => void
}) {
  return (
    <div className="v2-purpose" role="group" aria-label="Besøk eller bytte">
      <button
        type="button"
        className={`v2-purpose-btn${value === 'visit' ? ' is-on' : ''}`}
        disabled={disabled}
        title="Vi skal se stedet"
        onClick={() => onChange('visit')}
      >
        {compact ? 'Besøk' : 'Besøk byen'}
      </button>
      <button
        type="button"
        className={`v2-purpose-btn${value === 'transfer' ? ' is-on' : ''}`}
        disabled={disabled}
        title="Bare bytte transport her"
        onClick={() => onChange('transfer')}
      >
        {compact ? 'Bytte' : 'Bare bytte'}
      </button>
    </div>
  )
}
