import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, fetchWeatherByCity, fetchWeatherByCoords } from './api'
import CurrentWeather from './components/CurrentWeather'
import DailyForecast from './components/DailyForecast'
import ErrorMessage from './components/ErrorMessage'
import HourlyForecast from './components/HourlyForecast'
import SearchBar from './components/SearchBar'
import SearchHistory from './components/SearchHistory'
import Spinner from './components/Spinner'
import TempChart from './components/TempChart'
import UnitToggle from './components/UnitToggle'
import { METRIC } from './utils/units'

/** Shown on first paint so the dashboard is never empty. */
const DEFAULT_CITY = 'London'
const HISTORY_LIMIT = 6

/** Stable identity for a place, used for history de-duplication. */
const locationKey = (lat, lon) => `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`

export default function App() {
  const [system, setSystem] = useState(METRIC)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geolocating, setGeolocating] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  // Cancels an in-flight request when a newer one starts, so a slow response
  // can never overwrite a fresher one.
  const requestRef = useRef(null)
  // What to re-run when the user clicks "Try again".
  const lastRequestRef = useRef(null)

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

      // Record the resolved location (not the raw query) so history entries
      // always carry usable coordinates.
      const { location } = result
      setHistory((previous) => {
        const entry = {
          key: locationKey(location.latitude, location.longitude),
          name: location.name,
          label: location.label,
          latitude: location.latitude,
          longitude: location.longitude,
          country_code: location.country_code,
        }
        return [entry, ...previous.filter((item) => item.key !== entry.key)].slice(0, HISTORY_LIMIT)
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
        (signal) =>
          fetchWeatherByCoords(location.latitude, location.longitude, {
            label: location.label ?? location.name,
            signal,
          }),
        { type: 'coords', location },
      ),
    [runRequest],
  )

  /** Browser geolocation -> forecast for wherever the user is. */
  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        kind: 'geolocation',
        message: "This browser doesn't support geolocation. Try searching for a city instead.",
      })
      return
    }

    setGeolocating(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeolocating(false)
        // No label — the backend reverse-geocodes to a real place name.
        runRequest(
          (signal) => fetchWeatherByCoords(coords.latitude, coords.longitude, { signal }),
          { type: 'geo', latitude: coords.latitude, longitude: coords.longitude },
        )
      },
      (geoError) => {
        setGeolocating(false)
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
  }, [runRequest])

  /** Re-run whatever failed. */
  const retry = useCallback(() => {
    const last = lastRequestRef.current
    if (!last) {
      searchCity(DEFAULT_CITY)
      return
    }
    if (last.type === 'city') searchCity(last.city)
    else if (last.type === 'coords') selectLocation(last.location)
    else runRequest((signal) => fetchWeatherByCoords(last.latitude, last.longitude, { signal }), last)
  }, [searchCity, selectLocation, runRequest])

  // Initial load.
  useEffect(() => {
    searchCity(DEFAULT_CITY)
    return () => requestRef.current?.abort()
  }, [searchCity])

  // Tint the page background to match the current conditions.
  const group = data?.current?.group ?? 'cloudy'
  const daylight = data?.current?.is_day === false ? 'night' : 'day'

  // While refetching with data already on screen, hold the previous render at
  // reduced opacity instead of flashing a skeleton.
  const refreshing = loading && data !== null
  const showSpinner = loading && data === null
  const activeKey = data ? locationKey(data.location.latitude, data.location.longitude) : null

  return (
    <div className="app" data-weather={group} data-daylight={daylight}>
      <div className="app__backdrop" aria-hidden="true">
        <span className="app__glow app__glow--one" />
        <span className="app__glow app__glow--two" />
      </div>

      {refreshing && <div className="topprogress" role="presentation" />}

      <header className="topbar">
        <div className="topbar__inner">
          <p className="brand">
            <span className="brand__mark" aria-hidden="true">
              ⛅
            </span>
            <span className="brand__text">Weather Dashboard</span>
          </p>
          <UnitToggle system={system} onChange={setSystem} />
        </div>
      </header>

      <main className="container">
        <SearchBar
          onSearchCity={searchCity}
          onSelectLocation={selectLocation}
          onUseMyLocation={useMyLocation}
          geolocating={geolocating}
          busy={loading}
        />

        <SearchHistory
          history={history}
          activeKey={activeKey}
          onSelect={selectLocation}
          onClear={() => setHistory([])}
          disabled={loading}
        />

        {error && <ErrorMessage kind={error.kind} message={error.message} onRetry={retry} />}

        {showSpinner && <Spinner />}

        {data && (
          <div className={`content${refreshing ? ' is-refreshing' : ''}`}>
            <CurrentWeather location={data.location} current={data.current} system={system} />
            <TempChart daily={data.daily} hourly={data.hourly} system={system} />
            <HourlyForecast hourly={data.hourly} system={system} />
            <DailyForecast daily={data.daily} system={system} />
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
