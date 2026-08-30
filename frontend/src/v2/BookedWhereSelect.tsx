import {
  loadUsefulLinks,
  usableUsefulLinks,
  usefulLinkTitle,
} from '../userSettings'

function bookedWhereOptions(current: string): string[] {
  const titles = usableUsefulLinks(loadUsefulLinks()).map((link) =>
    usefulLinkTitle(link),
  )
  const unique = [...new Set(titles.filter(Boolean))]
  const trimmed = current.trim()
  if (trimmed && !unique.includes(trimmed)) {
    unique.unshift(trimmed)
  }
  return unique
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
  const options = bookedWhereOptions(value)
  const hasLinks = usableUsefulLinks(loadUsefulLinks()).length > 0

  return (
    <>
      <select
        value={value}
        disabled={disabled || !hasLinks}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Velg nettsted…</option>
        {options.map((title) => (
          <option key={title} value={title}>
            {title}
          </option>
        ))}
      </select>
      {!hasLinks ? (
        <p className="v2-meta" style={{ margin: '0.25rem 0 0' }}>
          Legg til nettsteder under Innstillinger → Nyttige lenker.
        </p>
      ) : null}
    </>
  )
}
