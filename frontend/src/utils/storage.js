/**
 * Small localStorage wrapper.
 *
 * Every call is guarded: Safari private mode and some embedded webviews throw on
 * access rather than simply being unavailable, and a dashboard shouldn't break
 * because it can't remember your last city.
 */

const LOCATION_KEY = 'weather-dashboard:last-location'
const HISTORY_KEY = 'weather-dashboard:history'
const UNITS_KEY = 'weather-dashboard:units'

function read(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked — carry on without persistence */
  }
}

/** A location is only usable if it still has coordinates to re-fetch with. */
function isValidLocation(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  )
}

export function loadLastLocation() {
  const saved = read(LOCATION_KEY)
  return isValidLocation(saved) ? saved : null
}

export function saveLastLocation(location) {
  if (!isValidLocation(location)) return
  // Store the structured parts, not just the label, so restoring renders the
  // card identically instead of collapsing into one run-on city name.
  write(LOCATION_KEY, {
    name: location.name,
    label: location.label,
    admin1: location.admin1,
    country: location.country,
    country_code: location.country_code,
    latitude: location.latitude,
    longitude: location.longitude,
  })
}

export function loadHistory() {
  const saved = read(HISTORY_KEY)
  return Array.isArray(saved) ? saved.filter(isValidLocation) : []
}

export function saveHistory(history) {
  write(HISTORY_KEY, history)
}

export function loadUnits() {
  const saved = read(UNITS_KEY)
  return saved === 'metric' || saved === 'imperial' ? saved : null
}

export function saveUnits(system) {
  write(UNITS_KEY, system)
}

export function clearHistory() {
  write(HISTORY_KEY, [])
}
