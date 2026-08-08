/**
 * Tiny fetch wrapper around our FastAPI backend.
 *
 * In development VITE_API_BASE_URL is left unset and Vite proxies "/api/*" to
 * http://127.0.0.1:8000 (see vite.config.js). In production set
 * VITE_API_BASE_URL to your Render URL, e.g. https://my-api.onrender.com
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

/** Whether we're talking to a remote backend (relevant for cold-start hints). */
export const usesRemoteBackend = API_BASE !== ''

/** An error with a `kind` the UI can branch on for friendlier messaging. */
export class ApiError extends Error {
  constructor(message, kind = 'unknown', status = 0) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind // 'notFound' | 'network' | 'server' | 'badRequest' | 'unknown'
    this.status = status
  }
}

function buildUrl(path, params) {
  // A relative base resolves against the current origin, which is what we want
  // for the dev proxy and for same-origin deployments.
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function request(path, params, { signal } = {}) {
  let response
  try {
    response = await fetch(buildUrl(path, params), { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    // Re-throw aborts untouched so callers can ignore superseded requests.
    if (error?.name === 'AbortError') throw error
    const hint = usesRemoteBackend
      ? "Couldn't reach the weather service. If it's hosted on a free tier it may be waking up — try again in a few seconds."
      : "Couldn't reach the weather service. Is the backend running on port 8000?"
    throw new ApiError(hint, 'network')
  }

  if (!response.ok) {
    // FastAPI errors come back as {"detail": "..."}; validation errors as a list.
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body?.detail === 'string' ? body.detail : ''
    } catch {
      /* non-JSON error body — fall through to a generic message */
    }

    if (response.status === 404) {
      throw new ApiError(detail || 'City not found. Try a different spelling.', 'notFound', 404)
    }
    if (response.status === 422) {
      throw new ApiError(detail || 'That search looks invalid. Try a city name.', 'badRequest', 422)
    }
    throw new ApiError(
      detail || 'The weather service is having trouble. Please try again shortly.',
      'server',
      response.status,
    )
  }

  return response.json()
}

/** Autocomplete: city name -> candidate locations. */
export function geocode(query, { count = 5, signal } = {}) {
  return request('/api/geocode', { q: query, count }, { signal })
}

/** Full forecast for a city name (backend picks the best geocoding match). */
export function fetchWeatherByCity(city, { signal } = {}) {
  return request('/api/weather', { city }, { signal })
}

/**
 * Full forecast for explicit coordinates.
 *
 * Pass the place's parts when you already know them (from the search dropdown or
 * from the saved last location) so the card renders exactly as it did the first
 * time. With coordinates alone the backend reverse-geocodes a name.
 */
export function fetchWeatherByCoords(lat, lon, { place, signal } = {}) {
  return request(
    '/api/weather/coords',
    {
      lat,
      lon,
      name: place?.name,
      admin1: place?.admin1,
      country: place?.country,
      country_code: place?.country_code,
      label: place?.label,
    },
    { signal },
  )
}

/**
 * Climate context (year-on-year comparisons, season, seasonal normals).
 * Backed by the historical archive, so it's slower than the forecast — fetch it
 * separately rather than blocking the main view on it.
 */
export function fetchInsights(lat, lon, { tmax, signal } = {}) {
  return request('/api/insights', { lat, lon, tmax }, { signal })
}
