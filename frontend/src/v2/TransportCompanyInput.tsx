import { useId, useMemo, useState } from 'react'

function companyChoicesForMode(
  choicesByMode: Record<string, string[]>,
  modeKey: string,
): string[] {
  const key = modeKey.trim() || 'any'
  const merged = new Set<string>()
  for (const company of choicesByMode[key] || []) {
    const normalized = company.trim()
    if (normalized) merged.add(normalized)
  }
  if (key !== 'any') {
    for (const company of choicesByMode.any || []) {
      const normalized = company.trim()
      if (normalized) merged.add(normalized)
    }
  }
  return [...merged].sort((a, b) => a.localeCompare(b, 'nb'))
}

export function TransportCompanyInput({
  value,
  disabled,
  modeKey,
  choicesByMode,
  onChange,
}: {
  value: string
  disabled?: boolean
  modeKey: string
  choicesByMode: Record<string, string[]>
  onChange: (value: string) => void
}) {
  const listId = useId()
  const allChoices = useMemo(
    () => companyChoicesForMode(choicesByMode, modeKey),
    [choicesByMode, modeKey],
  )
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)

  const q = value.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!q) return allChoices
    return allChoices.filter((company) =>
      company.toLowerCase().includes(q),
    )
  }, [allChoices, q])

  const showList = focused && suggestions.length > 0
  const fullTitle = value.trim()

  function pick(company: string) {
    onChange(company)
    setFocused(false)
    setActive(0)
  }

  return (
    <div
      className={`v2-hop-company-wrap${showList ? ' is-open' : ''}`}
    >
      <input
        className="v2-hop-company"
        value={value}
        disabled={disabled}
        placeholder="Sel."
        title={fullTitle || 'Transportselskap'}
        aria-label="Transportselskap"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        onChange={(e) => {
          setActive(0)
          onChange(e.target.value)
        }}
        onFocus={() => {
          setFocused(true)
          setActive(0)
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setFocused(false)
            setActive(0)
          }, 180)
        }}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && suggestions[active]) {
            e.preventDefault()
            pick(suggestions[active])
          } else if (e.key === 'Escape') {
            setFocused(false)
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          className="v2-hop-company-menu"
          role="listbox"
          aria-label="Selskaper"
        >
          {suggestions.map((company, idx) => (
            <li key={company}>
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                className={`v2-hop-company-option${
                  idx === active ? ' is-active' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(company)}
              >
                {company}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
