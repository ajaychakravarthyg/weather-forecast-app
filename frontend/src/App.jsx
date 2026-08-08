import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ApiError, fetchInsights, fetchWeatherByCity, fetchWeatherByCoords } from './api'
import CurrentWeather from './components/CurrentWeather'
import DailyForecast from './components/DailyForecast'
import ErrorMessage from './components/ErrorMessage'
import HourlyForecast from './components/HourlyForecast'
import Insights from './components/Insights'
import SearchBar from './components/SearchBar'
import SearchHistory from './components/SearchHistory'
import Spinner from './components/Spinner'
import TempChart from './components/TempChart'
import UnitToggle from './components/UnitToggle'
import WeatherBackground from './components/WeatherBackground'
import useNow from './hooks/useNow'
import { moonPhase } from './utils/celestial'
import * as storage from './utils/storage'
import { METRIC } from './utils/units'
import { formatAge } from './utils/weather'

/** Shown on first paint so the dashboard is never empty. */
const DEFAULT_CITY = 'London'
const HISTORY_LIMIT = 6
/** Re-fetch this often so the dashboard stays live without a manual refresh. */
const AUTO_REFRESH_MS = 10 * 60 * 1000
/** Returning to the tab with data older than this triggers an immediate refetch. */
const STALE_AFTER_MS = 2 * 60 * 1000
/** Past this age the freshness dot turns amber, so stale numbers are obvious. */
const STALE_WARN_MS = 15 * 60 * 1000

/** Stable identity for a place, used for history de-duplication. */
const locationKey = (lat, lon) => `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`

export default function App() {
  // Restore the previous session: units, recent cities and the last place you
  // were looking at, so a refresh doesn't drop you back on the default city.
  const [system, setSystem] = useState(() => storage.loadUnits() ?? METRIC)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geolocating, setGeolocating] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(() => storage.loadHistory())
  const [fetchedAt, setFetchedAt] = useState(null)
  const [facts, setFacts] = useState([])
  const [factsLoading, setFactsLoading] = useState(false)

  // Ticks every second: drives the location's live clock and the "updated" label.
  const now = useNow(1000)

  const requestRef = useRef(null)
  const lastRequestRef = useRef(null)
  // Mirrors `fetchedAt` so the visibility listener can read it without being
  // re-subscribed on every fetch.
  const fetchedAtRef = useRef(null)

  const runRequest = useCallback(async (fetcher, descriptor) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    lastRequestRef.current = descriptor

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher(controller.signal)
      if (controller.signal.aborted) return

      setData(result)
      fetchedAtRef.current = Date.now()
      setFetchedAt(fetchedAtRef.current)

      const { location } = result
      // Remember where we are, so the next visit resumes here.
      storage.saveLastLocation(location)

      setHistory((previous) => {
        const entry = {
          key: locationKey(location.latitude, location.longitude),
          name: location.name,
          label: location.label,
          admin1: location.admin1,
          country: location.country,
          country_code: location.country_code,
          latitude: location.latitude,
          longitude: location.longitude,
        }
        const next = [entry, ...previous.filter((item) => item.key !== entry.key)].slice(0, HISTORY_LIMIT)
        storage.saveHistory(next)
        return next
      })
    } catch (caught) {
      if (caught?.name === 'AbortError' || controller.signal.aborted) return
      const kind = caught instanceof ApiError ? caught.kind : 'unknown'
      setError({ kind, message: caught?.message ?? 'Unexpected error.' })
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  const searchCity = useCallback(
    (city) => runRequest((signal) => fetchWeatherByCity(city, { signal }), { type: 'city', city }),
    [runRequest],
  )

  const selectLocation = useCallback(
    (location) =>
      runRequest(
        (signal) => fetchWeatherByCoords(location.latitude, location.longitude, { place: location, signal }),
        { type: 'coords', location },
      ),
    [runRequest],
  )

  /**
   * Fetch weather for the device's position.
   *
   * `quiet` is used for the automatic attempt on a first visit: if permission is
   * refused we silently fall back to the default city rather than greeting a new
   * visitor with an error. A deliberate click on "Use my location" is not quiet.
   */
  const useMyLocation = useCallback(
    ({ quiet = false } = {}) => {
      if (!navigator.geolocation) {
        if (quiet) searchCity(DEFAULT_CITY)
        else
          setError({
            kind: 'geolocation',
            message: "This browser doesn't support geolocation. Try searching for a city instead.",
          })
        return
      }

      setGeolocating(true)
      if (!quiet) setError(null)

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setGeolocating(false)
          runRequest((signal) => fetchWeatherByCoords(coords.latitude, coords.longitude, { signal }), {
            type: 'geo',
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
        },
        (geoError) => {
          setGeolocating(false)
          if (quiet) {
            searchCity(DEFAULT_CITY)
            return
          }
          const messages = {
            1: 'Location permission was denied. You can enable it in your browser settings, or just search for a city.',
            2: "Your location isn't available right now. Try searching for a city instead.",
            3: 'Finding your location took too long. Please try again.',
          }
          setError({
            kind: 'geolocation',
            message: messages[geoError.code] ?? 'Could not determine your location.',
          })
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
      )
    },
    [runRequest, searchCity],
  )

  /** Re-run the last request — used by both the retry button and auto-refresh. */
  const refresh = useCallback(() => {
    const last = lastRequestRef.current
    if (!last) {
      searchCity(DEFAULT_CITY)
      return
    }
    if (last.type === 'city') searchCity(last.city)
    else if (last.type === 'coords') selectLocation(last.location)
    else runRequest((signal) => fetchWeatherByCoords(last.latitude, last.longitude, { signal }), last)
  }, [searchCity, selectLocation, runRequest])

  // Startup: resume the last place you were looking at; on a first visit ask for
  // the device location, falling back to the default city if that's refused.
  useEffect(() => {
    const saved = storage.loadLastLocation()
    if (saved) selectLocation(saved)
    else useMyLocation({ quiet: true })
    return () => requestRef.current?.abort()
    // Intentionally runs once — later changes come from user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the unit choice so °F sticks across reloads too.
  useEffect(() => {
    storage.saveUnits(system)
  }, [system])

  // Keep the data fresh on a timer. Skipped while the tab is hidden so a
  // backgrounded dashboard isn't quietly polling the API all day.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refresh()
    }, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  // ...but a tab that was hidden stops refreshing, so coming back to one left
  // open overnight would otherwise show hours-old numbers until the next tick.
  // Re-fetch immediately whenever the tab becomes visible with stale data.
  useEffect(() => {
    function onVisible() {
      if (document.hidden) return
      const age = fetchedAtRef.current ? Date.now() - fetchedAtRef.current : Infinity
      if (age > STALE_AFTER_MS) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh])

  // Climate context for wherever we've landed. Fetched separately from the
  // forecast: the archive is slower, and a failure here must not affect the
  // rest of the dashboard.
  const latitude = data?.location?.latitude
  const longitude = data?.location?.longitude
  const todayMax = data?.daily?.[0]?.temp_max

  useEffect(() => {
    if (latitude == null || longitude == null) return
    const controller = new AbortController()
    setFactsLoading(true)
    setFacts([])

    fetchInsights(latitude, longitude, { tmax: todayMax, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setFacts(result.facts ?? [])
      })
      .catch(() => {
        // Bonus panel — stay silent and let it hide itself.
      })
      .finally(() => {
        if (!controller.signal.aborted) setFactsLoading(false)
      })

    return () => controller.abort()
  }, [latitude, longitude, todayMax])

  const current = data?.current
  const group = current?.group ?? 'cloudy'
  const isDay = current?.is_day !== false
  // The moon phase shifts imperceptibly minute to minute, so recompute hourly
  // rather than on every one-second tick of `now`.
  const moonHour = Math.floor(now.getTime() / 3_600_000)
  const moon = useMemo(() => moonPhase(new Date(moonHour * 3_600_000)), [moonHour])

  const refreshing = loading && data !== null
  const showSpinner = loading && data === null
  const activeKey = data ? locationKey(data.location.latitude, data.location.longitude) : null

  return (
    <div className="app" data-weather={group} data-daylight={isDay ? 'day' : 'night'}>
      {/* Gradient sky, then the animated canvas scene on top of it. */}
      <div className="app__backdrop" aria-hidden="true">
        <span className="app__glow app__glow--one" />
        <span className="app__glow app__glow--two" />
      </div>
      <WeatherBackground
        group={group}
        isDay={isDay}
        windSpeed={current?.wind_speed ?? 0}
        precipitation={current?.precipitation ?? 0}
        cloudCover={current?.cloud_cover ?? 0}
        sunrise={current?.sunrise ?? null}
        sunset={current?.sunset ?? null}
        timeZone={data?.location?.timezone ?? null}
      />
      {/* A translucent scrim keeps text legible over the busiest scenes. */}
      <div className="app__scrim" aria-hidden="true" />

      {refreshing && <div className="topprogress" role="presentation" />}

      <header className="topbar">
        <div className="topbar__inner">
          <p className="brand">
            <span className="brand__mark" aria-hidden="true">
              ⛅
            </span>
            <span className="brand__text">Weather Dashboard</span>
          </p>

          <div className="topbar__actions">
            {/* Live condition pill — reflects exactly what the scene is showing. */}
            {current && (
              <span className="conditionpill" title={`${current.description} · ${moon.name}`}>
                <span aria-hidden="true">{isDay ? '☀️' : moon.emoji}</span>
                <span className="conditionpill__text">
                  {isDay ? current.description : moon.name}
                </span>
              </span>
            )}
            <UnitToggle system={system} onChange={setSystem} />
          </div>
        </div>
      </header>

      <main className="container">
        <SearchBar
          onSearchCity={searchCity}
          onSelectLocation={selectLocation}
          onUseMyLocation={() => useMyLocation()}
          geolocating={geolocating}
          busy={loading}
        />

        <div className="toolbar">
          <SearchHistory
            history={history}
            activeKey={activeKey}
            onSelect={selectLocation}
            onClear={() => {
              setHistory([])
              storage.clearHistory()
            }}
            disabled={loading}
          />

          {/* How stale the numbers are, plus a manual refresh. */}
          {fetchedAt && (
            <div className="freshness">
              <span
                className={`freshness__dot${refreshing ? ' is-busy' : ''}${
                  !refreshing && now.getTime() - fetchedAt > STALE_WARN_MS ? ' is-stale' : ''
                }`}
                aria-hidden="true"
              />
              <span className="freshness__text">Updated {formatAge(now.getTime() - fetchedAt)}</span>
              <button
                type="button"
                className="btn btn--icon"
                onClick={refresh}
                disabled={loading}
                title="Refresh now"
                aria-label="Refresh weather data"
              >
                <span className={refreshing ? 'spin' : undefined} aria-hidden="true">
                  ⟳
                </span>
              </button>
            </div>
          )}
        </div>

        {error && <ErrorMessage kind={error.kind} message={error.message} onRetry={refresh} />}

        {showSpinner && <Spinner />}

        {data && (
          <div className={`content${refreshing ? ' is-refreshing' : ''}`}>
            <CurrentWeather location={data.location} current={data.current} system={system} now={now} />
            <TempChart daily={data.daily} hourly={data.hourly} system={system} />
            <HourlyForecast hourly={data.hourly} system={system} />
            <DailyForecast daily={data.daily} system={system} />
            <Insights facts={facts} loading={factsLoading} locationName={data.location.name} />
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Weather data by{' '}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer noopener">
            Open-Meteo
          </a>{' '}
          · No API key, no cost
        </p>
      </footer>
    </div>
  )
}
