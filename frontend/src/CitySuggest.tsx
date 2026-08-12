import { useEffect, useId, useRef, useState } from 'react'
import { api, type PlaceSuggestion } from './api'

function placeLabel(place: PlaceSuggestion): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ')
}

/**
 * Soft city spelling help: shows place suggestions only while the city
 * field is focused. Free text is always allowed (e.g. «Hjem»).
 * Country is shown as plain text after a place is chosen (not an input).
 */
export function CitySuggestFields({
  city,
  country,
  onCityChange,
  onCountryChange,
  onSelectPlace,
  cityPlaceholder = 'Roma',
  countryPlaceholder: _countryPlaceholder = 'Italia',
  cityLabel = 'By / havn',
  showCountry = true,
  hideHint = false,
  autoFocus = false,
  className = '',
}: {
  city: string
  country: string
  onCityChange: (city: string) => void
  onCountryChange: (country: string) => void
  onSelectPlace: (city: string, country: string) => void
  cityPlaceholder?: string
  countryPlaceholder?: string
  cityLabel?: string
  /** When false, country text is hidden (country still used for ranking). */
  showCountry?: boolean
  /** Hide the helper line under the fields (e.g. cruise itinerary rows). */
  hideHint?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cityFocusedRef = useRef(false)
  const editedSinceFocusRef = useRef(false)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [cityFocused, setCityFocused] = useState(false)
  const [editedSinceFocus, setEditedSinceFocus] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const q = city.trim()
    if (q.length < 2) {
      setSuggestions([])
      setLoading(false)
      setError('')
      return
    }

    // Only fetch after the user edits the field — not on open/focus with
    // an existing city (e.g. «Rediger by»).
    if (!cityFocusedRef.current || !editedSinceFocusRef.current) {
      setSuggestions([])
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      // Search city name first; country is used only to rank hits on the server.
      void api
        .searchPlaces(q, country.trim())
        .then((res) => {
          if (cancelled || !cityFocusedRef.current) return
          setSuggestions(res.places || [])
          setActive(0)
          setError('')
        })
        .catch((err: unknown) => {
          if (cancelled || !cityFocusedRef.current) return
          setSuggestions([])
          setError(
            err instanceof Error
              ? err.message
              : 'Kunne ikke hente stedsforslag',
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [city, country, cityFocused, editedSinceFocus])

  function pick(place: PlaceSuggestion) {
    onSelectPlace(place.name, place.country || country)
    setCityFocused(false)
    cityFocusedRef.current = false
    editedSinceFocusRef.current = false
    setEditedSinceFocus(false)
    setSuggestions([])
  }

  function handleCityChange(value: string) {
    editedSinceFocusRef.current = true
    setEditedSinceFocus(true)
    onCityChange(value)
    // Drop stale country when the city text is edited by hand.
    if (showCountry && country.trim()) {
      onCountryChange('')
    }
  }

  const showList =
    cityFocused &&
    editedSinceFocus &&
    city.trim().length >= 2 &&
    (loading || suggestions.length > 0 || Boolean(error))

  const countryText = country.trim()

  return (
    <div
      className={[
        'city-suggest',
        'city-suggest-city-first',
        showCountry ? '' : 'city-suggest-city-only',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <div className="city-suggest-city">
        <label>
          {cityLabel}
          <input
            value={city}
            autoFocus={autoFocus}
            onChange={(e) => handleCityChange(e.target.value)}
            onFocus={() => {
              cityFocusedRef.current = true
              editedSinceFocusRef.current = false
              setCityFocused(true)
              setEditedSinceFocus(false)
            }}
            onBlur={() => {
              // Delay so click on suggestion registers.
              window.setTimeout(() => {
                cityFocusedRef.current = false
                editedSinceFocusRef.current = false
                setCityFocused(false)
                setEditedSinceFocus(false)
                setSuggestions([])
                setError('')
              }, 180)
            }}
            placeholder={cityPlaceholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            onKeyDown={(e) => {
              if (!showList || !suggestions.length) return
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
                cityFocusedRef.current = false
                setCityFocused(false)
                setSuggestions([])
              }
            }}
          />
        </label>
        {showCountry && countryText && city.trim() && (
          <p className="city-suggest-country-text">{countryText}</p>
        )}
        {showList && (
          <ul id={listId} className="city-suggest-list" role="listbox">
            {loading && suggestions.length === 0 && !error && (
              <li className="city-suggest-empty">Søker…</li>
            )}
            {error && (
              <li className="city-suggest-empty">
                {error === 'HTTP 404'
                  ? 'Stedssøk er ikke tilgjengelig — start API på nytt.'
                  : error}
              </li>
            )}
            {!loading &&
              !error &&
              suggestions.length === 0 &&
              city.trim().length >= 2 && (
                <li className="city-suggest-empty">Ingen treff</li>
              )}
            {suggestions.map((place, idx) => (
              <li key={`${place.name}-${place.country}-${place.latitude}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  className={
                    idx === active
                      ? 'city-suggest-option is-active'
                      : 'city-suggest-option'
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(place)}
                >
                  {placeLabel(place)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!hideHint && (
        <p className="meta city-suggest-hint">
          Velg gjerne et forslag for riktig skrivemåte (vær og kart). Egen
          tekst går også fint.
        </p>
      )}
    </div>
  )
}
