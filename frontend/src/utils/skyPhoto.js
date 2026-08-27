/**
 * Resolves which background photograph to show for the current conditions.
 *
 * Photos are optional. Drop files into `frontend/public/sky/` and they get
 * picked up; supply none and the app falls back to the procedural canvas sky,
 * so nothing breaks either way.
 *
 * Because the browser can't list a directory, each candidate is probed by
 * actually loading it and seeing whether it decodes. Results are cached, so a
 * given path is probed at most once per session.
 *
 * The fallback chain means you can supply two files or twelve:
 *
 *   1. sky/<group>-<day|night>.jpg   most specific   e.g. thunderstorm-night.jpg
 *   2. sky/<group>.jpg                                e.g. thunderstorm.jpg
 *   3. sky/<family>-<day|night>.jpg  grouped          e.g. storm-night.jpg
 *   4. sky/<family>.jpg                               e.g. storm.jpg
 *   5. sky/default-<day|night>.jpg   catch-all
 *   6. sky/default.jpg
 *   7. null -> procedural canvas sky
 */

const BASE = 'sky'
// Tried in this order, so a .webp wins over a .jpg of the same name. Kept short
// on purpose: every extension multiplies the number of 404 probes in the
// worst case, where nothing matches until the last fallback.
const EXTENSIONS = ['webp', 'jpg', 'png']

/** Weather groups collapsed into the handful of skies they can share. */
const FAMILY = {
  clear: 'clear',
  'mainly-clear': 'clear',
  cloudy: 'cloudy',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  showers: 'rain',
  freezing: 'snow',
  snow: 'snow',
  thunderstorm: 'storm',
}

/** path -> Promise<boolean>, so each candidate is only ever probed once. */
const probeCache = new Map()

function probe(path) {
  if (probeCache.has(path)) return probeCache.get(path)
  const result = new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0)
    img.onerror = () => resolve(false)
    img.src = path
  })
  probeCache.set(path, result)
  return result
}

/** Every candidate path for these conditions, most specific first. */
export function candidatePaths(group, isDay) {
  const family = FAMILY[group] ?? 'cloudy'
  const suffix = isDay ? 'day' : 'night'
  const stems = [
    `${group}-${suffix}`,
    group,
    `${family}-${suffix}`,
    family,
    `default-${suffix}`,
    'default',
  ]
  // De-duplicate: when group and family are the same word the list collapses.
  const seen = new Set()
  const paths = []
  for (const stem of stems) {
    if (seen.has(stem)) continue
    seen.add(stem)
    for (const ext of EXTENSIONS) paths.push(`/${BASE}/${stem}.${ext}`)
  }
  return paths
}

/**
 * First candidate that actually loads, or null if the user supplied no photos.
 * Probes sequentially so a hit on the most specific name costs one request.
 */
export async function resolveSkyPhoto(group, isDay) {
  for (const path of candidatePaths(group, isDay)) {
    if (await probe(path)) return path
  }
  return null
}
