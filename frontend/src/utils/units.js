/**
 * Unit conversion + formatting.
 *
 * The backend always returns metric values (°C, km/h, hPa, mm). Converting on
 * the client means the °C/°F toggle is instant and never triggers a refetch.
 */

export const METRIC = 'metric'
export const IMPERIAL = 'imperial'

export const unitLabels = {
  [METRIC]: { temp: '°C', wind: 'km/h', pressure: 'hPa', precip: 'mm' },
  [IMPERIAL]: { temp: '°F', wind: 'mph', pressure: 'inHg', precip: 'in' },
}

/** Celsius -> the active temperature unit. */
export function convertTemp(celsius, system) {
  if (celsius == null) return null
  return system === IMPERIAL ? celsius * (9 / 5) + 32 : celsius
}

/** km/h -> the active wind unit. */
export function convertWind(kmh, system) {
  if (kmh == null) return null
  return system === IMPERIAL ? kmh * 0.621371 : kmh
}

/** hPa -> the active pressure unit. */
export function convertPressure(hpa, system) {
  if (hpa == null) return null
  return system === IMPERIAL ? hpa * 0.0295299830714 : hpa
}

/** mm -> the active precipitation unit. */
export function convertPrecip(mm, system) {
  if (mm == null) return null
  return system === IMPERIAL ? mm / 25.4 : mm
}

const EM_DASH = '—'

/** Rounded temperature with a degree sign, e.g. "21°". Unit-less by design: the
 *  hero card and axis print the unit once rather than on every number. */
export function formatTemp(celsius, system, { withUnit = false } = {}) {
  const value = convertTemp(celsius, system)
  if (value == null) return EM_DASH
  return `${Math.round(value)}°${withUnit ? unitLabels[system].temp.slice(1) : ''}`
}

/** Bare rounded number — for chart data, where the axis carries the unit. */
export function tempValue(celsius, system) {
  const value = convertTemp(celsius, system)
  return value == null ? null : Math.round(value * 10) / 10
}

export function formatWind(kmh, system) {
  const value = convertWind(kmh, system)
  if (value == null) return EM_DASH
  return `${Math.round(value)} ${unitLabels[system].wind}`
}

export function formatPressure(hpa, system) {
  const value = convertPressure(hpa, system)
  if (value == null) return EM_DASH
  // inHg needs decimals to be meaningful; hPa does not.
  const rounded = system === IMPERIAL ? value.toFixed(2) : Math.round(value)
  return `${rounded} ${unitLabels[system].pressure}`
}

export function formatPrecip(mm, system) {
  const value = convertPrecip(mm, system)
  if (value == null) return EM_DASH
  const rounded = system === IMPERIAL ? value.toFixed(2) : Math.round(value * 10) / 10
  return `${rounded} ${unitLabels[system].precip}`
}

export function formatPercent(value) {
  return value == null ? EM_DASH : `${Math.round(value)}%`
}

/** 0–360° -> a 16-point compass abbreviation. */
export function windDirection(degrees) {
  if (degrees == null) return ''
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return points[Math.round(degrees / 22.5) % 16]
}

/** UV index -> a short qualitative band (WHO scale). */
export function uvBand(uv) {
  if (uv == null) return ''
  if (uv < 3) return 'Low'
  if (uv < 6) return 'Moderate'
  if (uv < 8) return 'High'
  if (uv < 11) return 'Very high'
  return 'Extreme'
}
