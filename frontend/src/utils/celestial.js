/**
 * Sun and moon maths for the animated background.
 *
 * Everything here is computed locally — no extra API calls. The sun's position
 * comes from the location's real sunrise/sunset times, and the moon phase from
 * the date, so the sky matches what you'd actually see out of the window.
 */

/** Mean length of a lunar month (new moon to new moon), in days. */
const SYNODIC_MONTH = 29.530588853

/** A known new moon: 2000-01-06 18:14 UTC. The epoch the phase is measured from. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

const PHASE_NAMES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
]

const PHASE_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

/**
 * Moon phase for a given instant.
 *
 * @returns {{phase: number, illumination: number, name: string, emoji: string, age: number}}
 *   phase        0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
 *   illumination fraction of the disc lit, 0..1
 *   age          days since the last new moon
 */
export function moonPhase(date = new Date()) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH
  const phase = age / SYNODIC_MONTH

  // Lit fraction follows a cosine: 0 at new, 1 at full.
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2

  // Snap to the nearest of the eight traditional phases for the label.
  const index = Math.round(phase * 8) % 8

  return {
    phase,
    illumination,
    age,
    name: PHASE_NAMES[index],
    emoji: PHASE_EMOJI[index],
  }
}

/** Minutes since midnight in a specific IANA timezone. */
function zonedMinutes(date, timeZone) {
  const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      ...options,
      ...(timeZone && timeZone !== 'auto' ? { timeZone } : {}),
    }).format(date)
    const [hours, minutes] = parts.split(':').map(Number)
    return hours * 60 + minutes
  } catch {
    return date.getHours() * 60 + date.getMinutes()
  }
}

/** Minutes since midnight from a naive local ISO string ("2026-08-05T05:30"). */
function isoMinutes(value) {
  if (!value) return null
  const match = /T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Where the sun (or moon) sits in its arc right now.
 *
 * @returns {{isDaylight: boolean, progress: number, altitude: number}}
 *   progress  0 = just risen, 1 = about to set (of whichever body is up)
 *   altitude  0 at the horizon, 1 at its highest — sin of the arc, so the sun
 *             genuinely peaks at solar noon rather than moving linearly.
 */
export function skyPosition(now, { sunrise, sunset, timeZone } = {}) {
  const sunriseMin = isoMinutes(sunrise)
  const sunsetMin = isoMinutes(sunset)
  const nowMin = zonedMinutes(now, timeZone)

  // Without usable sunrise/sunset, fall back to a plain 06:00–18:00 assumption.
  if (sunriseMin == null || sunsetMin == null || sunsetMin <= sunriseMin) {
    const isDaylight = nowMin >= 360 && nowMin < 1080
    const progress = isDaylight ? (nowMin - 360) / 720 : ((nowMin + 1080) % 1440) / 720
    return { isDaylight, progress: clamp01(progress), altitude: Math.sin(clamp01(progress) * Math.PI) }
  }

  if (nowMin >= sunriseMin && nowMin < sunsetMin) {
    const progress = (nowMin - sunriseMin) / (sunsetMin - sunriseMin)
    return { isDaylight: true, progress: clamp01(progress), altitude: Math.sin(clamp01(progress) * Math.PI) }
  }

  // Night: measure from sunset round to the next sunrise.
  const nightLength = 1440 - sunsetMin + sunriseMin
  const elapsed = nowMin >= sunsetMin ? nowMin - sunsetMin : nowMin + 1440 - sunsetMin
  const progress = clamp01(nightLength > 0 ? elapsed / nightLength : 0)
  return { isDaylight: false, progress, altitude: Math.sin(progress * Math.PI) }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}
