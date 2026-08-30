import { useSyncExternalStore, useId } from 'react'
import {
  bookingWhereSuggestionTitles,
  loadUsefulLinks,
  subscribeUsefulLinks,
  usableUsefulLinks,
} from '../userSettings'

function readUsefulLinkCount(): number {
  return usableUsefulLinks(loadUsefulLinks()).length
}

export function BookedWhereSelect({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled?: boolean
  onChange: (next: string) => void
}) {
  const listId = useId()
  const customLinkCount = useSyncExternalStore(
    subscribeUsefulLinks,
    readUsefulLinkCount,
    readUsefulLinkCount,
  )
  const options = bookingWhereSuggestionTitles(value)
  const hasCustomLinks = customLinkCount > 0

  return (
    <>
      <input
        type="text"
        className="v2-booked-where-input"
        list={listId}
        value={value}
        disabled={disabled}
        placeholder="Velg eller skriv nettsted…"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>
      {!hasCustomLinks ? (
        <p className="v2-meta" style={{ margin: '0.25rem 0 0' }}>
          Vanlige nettsteder er foreslått. Legg til egne under Innstillinger →
          Nyttige lenker.
        </p>
      ) : null}
    </>
  )
}
