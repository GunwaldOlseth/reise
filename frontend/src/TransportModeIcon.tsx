/** Shared transport mode SVG icons. Clear at 16–20px. */

export function TransportModeIcon({
  mode,
  size = 18,
}: {
  mode: string
  size?: number
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (mode) {
    case 'walk':
      return (
        <svg {...props}>
          <circle cx="12" cy="4.2" r="2" fill="currentColor" stroke="none" />
          <path d="M12 7.2v5" />
          <path d="M8.2 21.2 11 13.2l2.4 3.4L16 21.2" />
          <path d="M7.8 12.2 12 10.6l4 2" />
          <path d="M10 9 7.6 11.4" />
        </svg>
      )
    case 'taxi':
    case 'car':
      return (
        <svg {...props}>
          <path d="M4 13h16l-1.4-3.6A2.2 2.2 0 0 0 16.5 8H7.5a2.2 2.2 0 0 0-2.1 1.4L4 13Z" />
          <path d="M3 13h18v4.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 17.4V13Z" />
          <circle cx="7.2" cy="17.2" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="16.8" cy="17.2" r="1.35" fill="currentColor" stroke="none" />
          <path d="M9 8.2h6" />
          {mode === 'taxi' ? <path d="M10.5 5.6h3v2.2h-3z" /> : null}
        </svg>
      )
    case 'bus':
      return (
        <svg {...props}>
          <rect x="4.5" y="3" width="15" height="15.5" rx="2.5" />
          <path d="M4.5 12.2h15" />
          <path d="M7.5 6.2h3.4v3.2H7.5z" fill="currentColor" fillOpacity="0.22" />
          <path d="M13.1 6.2h3.4v3.2h-3.4z" fill="currentColor" fillOpacity="0.22" />
          <path d="M7.5 6.2h3.4v3.2H7.5z" />
          <path d="M13.1 6.2h3.4v3.2h-3.4z" />
          <circle cx="8" cy="15.6" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="16" cy="15.6" r="1.15" fill="currentColor" stroke="none" />
          <path d="M8 18.5v2.2" />
          <path d="M16 18.5v2.2" />
          <path d="M10.2 20.7h3.6" />
        </svg>
      )
    case 'tram':
      // Streetcar: boxy body + overhead wire (clear vs train).
      return (
        <svg {...props}>
          <path d="M4 3.2h16" />
          <path d="M8 3.2 12 6.2" />
          <path d="M16 3.2 12 6.2" />
          <path d="M12 6.2v1.3" />
          <rect x="5" y="7.5" width="14" height="10" rx="2.2" />
          <path d="M5 13.2h14" />
          <path d="M7.4 9.2h3.2v2.4H7.4z" fill="currentColor" fillOpacity="0.22" />
          <path d="M13.4 9.2h3.2v2.4h-3.2z" fill="currentColor" fillOpacity="0.22" />
          <path d="M7.4 9.2h3.2v2.4H7.4z" />
          <path d="M13.4 9.2h3.2v2.4h-3.2z" />
          <circle cx="8.4" cy="15.4" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="15.6" cy="15.4" r="1.1" fill="currentColor" stroke="none" />
          <path d="M7.8 17.5 6.2 21" />
          <path d="M16.2 17.5 17.8 21" />
          <path d="M4.5 21.2h15" />
        </svg>
      )
    case 'train':
      return (
        <svg {...props}>
          <path d="M7.2 3.2h9.6a2.4 2.4 0 0 1 2.4 2.4v9.2a3 3 0 0 1-3 3H7.8a3 3 0 0 1-3-3V5.6a2.4 2.4 0 0 1 2.4-2.4Z" />
          <path d="M4.8 11.2h14.4" />
          <path d="M8.4 5.8h7.2v3.4H8.4z" fill="currentColor" fillOpacity="0.22" />
          <path d="M8.4 5.8h7.2v3.4H8.4z" />
          <circle cx="9" cy="13.8" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13.8" r="1.2" fill="currentColor" stroke="none" />
          <path d="M9.2 17.8 7 21.2" />
          <path d="M14.8 17.8 17 21.2" />
          <path d="M8 21.2h8" />
        </svg>
      )
    case 'flight':
      return (
        <svg {...props}>
          <path
            d="M3.2 14.2 12 11.6l8.8-4.2a1.15 1.15 0 0 1 1.15 2L13.4 14.4l-1.2 5.6-2.3-.75.9-4.2-5.2 1.15-1.55 2.55-1.85-.55 1.15-2.95-1.95-1.35Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      )
    case 'boat':
      return (
        <svg {...props}>
          <path d="M12 4.2v8.2" />
          <path d="M12 4.2h5.2L15.6 8.6" />
          <path d="M4.2 14.8 12 10.6l7.8 4.2" />
          <path d="M3.2 16h17.6l-1.5 2.7a2.1 2.1 0 0 1-1.8 1.05H6.5a2.1 2.1 0 0 1-1.8-1.05L3.2 16Z" />
          <path d="M5 21.2c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 3.2-1.2 4.8 0" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.4" />
          <path d="M8.2 12h7.6" />
          <path d="M12 8.2v7.6" />
        </svg>
      )
  }
}

/** Compact place-stop meta icons (city, hotel, dates, plan). */
export function PlaceMetaIcon({
  name,
  size = 14,
}: {
  name: 'city' | 'hotel' | 'airbnb' | 'dates' | 'plan'
  size?: number
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'hotel':
      return (
        <svg {...props}>
          <path d="M3 20V9.5A2.5 2.5 0 0 1 5.5 7H14v13" />
          <path d="M14 20V5.5A2.5 2.5 0 0 1 16.5 3H20v17" />
          <path d="M3 20h18" />
          <path d="M7 11h2" />
          <path d="M7 14h2" />
        </svg>
      )
    case 'airbnb':
      return (
        <svg {...props}>
          <path d="M4 20V10.5l8-6.5 8 6.5V20" />
          <path d="M4 20h16" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    case 'dates':
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M3.5 10h17" />
          <path d="M8 3.5v4" />
          <path d="M16 3.5v4" />
        </svg>
      )
    case 'plan':
      return (
        <svg {...props}>
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <path d="M4.5 6.2 5.8 7.5 8 5" />
          <path d="M4.5 12.2 5.8 13.5 8 11" />
          <path d="M4.5 18.2 5.8 19.5 8 17" />
        </svg>
      )
    case 'city':
    default:
      return (
        <svg {...props}>
          <path d="M12 21s6.5-5.2 6.5-11a6.5 6.5 0 1 0-13 0c0 5.8 6.5 11 6.5 11Z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      )
  }
}

/** Pencil / edit icon. */
export function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.5 6.5 17.5 11.5" />
      <path d="M4 20.5 5.8 14.2 16.2 3.8a2.1 2.1 0 0 1 3 3L8.8 18.2 4 20.5Z" />
    </svg>
  )
}

/** Small check for “done editing”. */
export function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5 10 17.5 19 7.5" />
    </svg>
  )
}

/** Trash / delete icon for remove buttons. */
export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
      <path d="M6.5 7 7.4 19.2A1.6 1.6 0 0 0 9 20.6h6a1.6 1.6 0 0 0 1.6-1.4L17.5 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

