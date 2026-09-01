/**
 * Weather-code presentation + date/time formatting.
 *
 * Icons live in components/WeatherIcon.jsx; this module is purely the date and
 * time formatting the cards need.
 */

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

/**
 * The location's *live* wall clock, e.g. "14:32:07".
 *
 * Unlike the formatters above this takes a real instant, so passing the IANA
 * timeZone to Intl is correct here — there's no naive-string double-shift risk.
 */
export function formatZonedClock(date, timeZone) {
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
  try {
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      ...(timeZone && timeZone !== 'auto' ? { timeZone } : {}),
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }
}

/** The location's day name, for the live-clock caption ("Thursday"). */
export function formatZonedWeekday(date, timeZone) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      ...(timeZone && timeZone !== 'auto' ? { timeZone } : {}),
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)
  }
}

/** "just now" / "45s ago" / "3m ago" — how stale the data on screen is. */
export function formatAge(milliseconds) {
  if (milliseconds == null) return ''
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m ago`
}
