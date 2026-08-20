import type { PlacePurpose, RideConnection, StayKind } from './journeyModel'

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
    <div className="v2-purpose" role="group" aria-label="Besøk eller via">
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
        title="Vi reiser gjennom — ofte inkludert i billetten, uten å stoppe"
        onClick={() => onChange('transfer')}
      >
        {compact ? 'Via' : 'Ikke stopp'}
      </button>
    </div>
  )
}

export function ConnectionToggle({
  value,
  disabled,
  onChange,
}: {
  value: RideConnection
  disabled?: boolean
  onChange: (next: RideConnection) => void
}) {
  const checked = value === 'change'
  return (
    <label
      className="v2-change-check"
      title={
        checked
          ? 'Bytte til annet tog eller annen buss (samme type)'
          : 'Linjebytte på samme type — ikke buss til tog. Da legger du til et sted på veien.'
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked ? 'change' : 'direct')}
      />
      Linjebytte
    </label>
  )
}

export function StayKindToggle({
  value,
  disabled,
  onChange,
}: {
  value: StayKind
  disabled?: boolean
  onChange: (next: StayKind) => void
}) {
  return (
    <div className="v2-purpose" role="group" aria-label="Type overnatting">
      <button
        type="button"
        className={`v2-purpose-btn${value === 'hotel' ? ' is-on' : ''}`}
        disabled={disabled}
        title="Hotell eller lignende"
        onClick={() => onChange('hotel')}
      >
        Hotell
      </button>
      <button
        type="button"
        className={`v2-purpose-btn${value === 'airbnb' ? ' is-on' : ''}`}
        disabled={disabled}
        title="Airbnb eller feriebolig"
        onClick={() => onChange('airbnb')}
      >
        Airbnb
      </button>
    </div>
  )
}

export function TicketToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className="v2-change-check"
      title={checked ? 'Billett er kjøpt' : 'Merk at billetten er kjøpt'}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Billett
    </label>
  )
}
