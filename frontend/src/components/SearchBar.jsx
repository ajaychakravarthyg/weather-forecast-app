import { useEffect, useId, useRef, useState } from 'react'
import { geocode } from '../api'
import { countryFlag } from '../utils/weather'

/**
 * City search with a debounced suggestion dropdown.
 *
 * Typing hits /api/geocode for matches (so "London" can disambiguate between
 * the UK, Ontario and Ohio). Picking a suggestion reports exact coordinates;
 * pressing Enter without picking falls back to a plain city-name search.
 *
 * Keyboard: ↑/↓ move through matches, Enter selects, Escape closes.
 */
export default function SearchBar({ onSearchCity, onSelectLocation, onUseMyLocation, geolocating, busy }) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loadingMatches, setLoadingMatches] = useState(false)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()

  // --- Debounced suggestion lookup -----------------------------------------
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setMatches([])
      setLoadingMatches(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoadingMatches(true)
      try {
        const data = await geocode(trimmed, { count: 5, signal: controller.signal })
        setMatches(data.results ?? [])
        setOpen(true)
        setActiveIndex(-1)
      } catch (error) {
        // A 404 just means "no matches yet" while typing — not worth shouting about.
        if (error?.name !== 'AbortError') setMatches([])
      } finally {
        if (!controller.signal.aborted) setLoadingMatches(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // --- Close on outside click ----------------------------------------------
  useEffect(() => {
    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function choose(location) {
    setQuery('')
    setMatches([])
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
    onSelectLocation(location)
  }

  function submit(event) {
    event.preventDefault()
    // If the user has arrowed onto a suggestion, honour that over the raw text.
    if (activeIndex >= 0 && matches[activeIndex]) {
      choose(matches[activeIndex])
      return
    }
    const trimmed = query.trim()
    if (!trimmed) return
    setQuery('')
    setMatches([])
    setOpen(false)
    inputRef.current?.blur()
    onSearchCity(trimmed)
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!matches.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index + 1) % matches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index <= 0 ? matches.length - 1 : index - 1))
    }
  }

  const showDropdown = open && (matches.length > 0 || (loadingMatches && query.trim().length >= 2))

  return (
    <div className="searchbar" ref={containerRef}>
      <form className="searchbar__form" onSubmit={submit} role="search">
        <div className="searchbar__field">
          <span className="searchbar__icon" aria-hidden="true">
            🔎
          </span>
          <input
            ref={inputRef}
            className="searchbar__input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => matches.length && setOpen(true)}
            placeholder="Search for a city…"
            aria-label="Search for a city"
            autoComplete="off"
            spellCheck="false"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          />
          {loadingMatches && <span className="searchbar__spinner" aria-hidden="true" />}
        </div>

        <button className="btn btn--primary" type="submit" disabled={busy || !query.trim()}>
          Search
        </button>

        <button
          className="btn btn--ghost"
          type="button"
          onClick={onUseMyLocation}
          disabled={busy || geolocating}
          title="Use your current location"
        >
          <span aria-hidden="true">📍</span>
          <span className="btn__label">{geolocating ? 'Locating…' : 'Use my location'}</span>
        </button>
      </form>

      {showDropdown && (
        <ul className="suggestions" id={listboxId} role="listbox" aria-label="City matches">
          {matches.map((location, index) => (
            <li
              key={`${location.latitude},${location.longitude}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`suggestions__item${index === activeIndex ? ' is-active' : ''}`}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(location)}
            >
              <span className="suggestions__flag" aria-hidden="true">
                {countryFlag(location.country_code)}
              </span>
              <span className="suggestions__text">
                <strong>{location.name}</strong>
                <small>
                  {[location.admin1, location.country].filter(Boolean).join(', ')}
                </small>
              </span>
            </li>
          ))}
          {!matches.length && loadingMatches && <li className="suggestions__empty">Searching…</li>}
        </ul>
      )}
    </div>
  )
}
