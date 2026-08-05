/**
 * Weather-code presentation + date/time formatting.
 *
 * The backend already resolved each WMO code into a `description` and a coarse
 * `group`; this module maps the group to an emoji icon (day/night aware) and to
 * the accent colours the page background uses.
 */

const ICONS = {
  clear: { day: '☀️', night: '🌙' },
  'mainly-clear': { day: '⛅', night: '☁️' },
  cloudy: { day: '☁️', night: '☁️' },
  fog: { day: '🌫️', night: '🌫️' },
  drizzle: { day: '🌦️', night: '🌧️' },
  rain: { day: '🌧️', night: '🌧️' },
  freezing: { day: '🌨️', night: '🌨️' },
  snow: { day: '❄️', night: '❄️' },
  showers: { day: '🌦️', night: '🌧️' },
  thunderstorm: { day: '⛈️', night: '⛈️' },
}

/** Emoji for a weather group. `isDay` picks the day or night variant. */
export function weatherIcon(group, isDay = true) {
  const entry = ICONS[group] ?? ICONS.cloudy
  return isDay ? entry.day : entry.night
}

/**
 * Open-Meteo returns naive local ISO strings ("2026-08-05T14:00") that are
 * already in the location's timezone. Parsing them as UTC and then formatting
 * back in that same timezone would double-shift, so we read the parts directly.
 */
function parseNaiveIso(value) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!match) return null
  const [, y, m, d, hh = '0', mm = '0'] = match
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(hh),
    minute: Number(mm),
    // A Date in the *browser's* zone carrying the location's wall-clock time.
    // Safe to feed to Intl only when no timeZone option is applied.
    date: new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)),
  }
}

/** "Mon" — short weekday for a date string, or "Today" for the first entry. */
export function formatWeekday(isoDate, { isToday = false } = {}) {
  if (isToday) return 'Today'
  const parts = parseNaiveIso(isoDate)
  if (!parts) return ''
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(parts.date)
}

/** "5 Aug" — short day+month. */
export function formatDayMonth(isoDate) {
  const parts = parseNaiveIso(isoDate)
  if (!parts) return ''
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(parts.date)
}

/** "14:00" / "2 PM" — locale hour for an hourly slot. */
export function formatHour(isoTime, { isNow = false } = {}) {
  if (isNow) return 'Now'
  const parts = parseNaiveIso(isoTime)
  if (!parts) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(parts.date)
}

/** Short hour label for chart axes — drops the minutes when they're :00. */
export function formatHourShort(isoTime) {
  const parts = parseNaiveIso(isoTime)
  if (!parts) return ''
  const opts = parts.minute === 0 ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' }
  return new Intl.DateTimeFormat(undefined, opts).format(parts.date)
}

/** "14:32" — sunrise/sunset clock time. */
export function formatClock(isoTime) {
  const parts = parseNaiveIso(isoTime)
  if (!parts) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(parts.date)
}

/** "Tue 5 Aug, 14:00 (Asia/Kolkata)" — the "as of" line on the hero card. */
export function formatObservedAt(isoTime, timeZone) {
  const parts = parseNaiveIso(isoTime)
  if (!parts) return ''
  const stamp = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parts.date)
  const zone = timeZone && timeZone !== 'auto' ? ` · ${timeZone.replace(/_/g, ' ')}` : ''
  return `${stamp}${zone}`
}

/** Flag emoji from an ISO-3166 alpha-2 country code, e.g. "GB" -> 🇬🇧. */
export function countryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return ''
  const base = 0x1f1e6 - 'A'.charCodeAt(0)
  return String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => c.charCodeAt(0) + base))
}
