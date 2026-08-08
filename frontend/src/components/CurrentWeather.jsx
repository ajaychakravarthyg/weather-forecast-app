import {
  formatDuration,
  formatPercent,
  formatPrecip,
  formatPressure,
  formatTemp,
  formatVisibility,
  formatWind,
  unitLabels,
  uvBand,
  windDirection,
} from '../utils/units'
import {
  countryFlag,
  formatClock,
  formatZonedClock,
  formatZonedWeekday,
  weatherIcon,
} from '../utils/weather'

/**
 * The hero card: one big current temperature plus the supporting stat grid.
 * This is the view's single hero figure — every other number is secondary.
 *
 * `now` ticks once a second so the location's local clock runs live rather than
 * showing a frozen timestamp from whenever the data was fetched.
 */
export default function CurrentWeather({ location, current, system, now }) {
  const icon = weatherIcon(current.group, current.is_day)
  const tempUnit = unitLabels[system].temp.slice(1)

  // Every tile is driven by a live measurement; nothing here is decorative.
  const stats = [
    {
      label: 'Feels like',
      value: formatTemp(current.apparent_temperature, system, { withUnit: true }),
      hint: feelsLikeHint(current.temperature, current.apparent_temperature),
      icon: '🌡️',
    },
    { label: 'Humidity', value: formatPercent(current.humidity), icon: '💧' },
    {
      label: 'Wind',
      value: formatWind(current.wind_speed, system),
      hint: windDirection(current.wind_direction),
      icon: '💨',
    },
    { label: 'Gusts', value: formatWind(current.wind_gusts, system), icon: '🍃' },
    { label: 'Pressure', value: formatPressure(current.pressure, system), icon: '🧭' },
    {
      label: 'UV index',
      value: current.uv_index_max == null ? '—' : Math.round(current.uv_index_max * 10) / 10,
      hint: uvBand(current.uv_index_max),
      icon: '🔆',
    },
    { label: 'Visibility', value: formatVisibility(current.visibility, system), icon: '👁️' },
    { label: 'Cloud cover', value: formatPercent(current.cloud_cover), icon: '☁️' },
    { label: 'Precipitation', value: formatPrecip(current.precipitation, system), icon: '🌧️' },
    { label: 'Daylight', value: formatDuration(current.daylight_duration), icon: '⏳' },
  ]

  return (
    <section className="card hero" aria-label="Current weather">
      <div className="hero__main">
        <div className="hero__place">
          <h1 className="hero__city">
            <span className="hero__flag" aria-hidden="true">
              {countryFlag(location.country_code)}
            </span>
            {location.name}
          </h1>
          <p className="hero__region">
            {[location.admin1, location.country].filter(Boolean).join(', ')}
          </p>

          {/* Live local time at the searched location, ticking every second. */}
          <p className="hero__clock">
            <span className="hero__time" aria-label="Local time at this location">
              {formatZonedClock(now, location.timezone)}
            </span>
            <span className="hero__zone">
              {formatZonedWeekday(now, location.timezone)}
              {location.timezone && location.timezone !== 'auto'
                ? ` · ${location.timezone.replace(/_/g, ' ')}`
                : ''}
            </span>
          </p>
        </div>

        <div className="hero__reading">
          <span className="hero__icon" aria-hidden="true">
            {icon}
          </span>
          <div className="hero__temps">
            <p className="hero__figure">
              {formatTemp(current.temperature, system)}
              <span className="hero__unit">{tempUnit}</span>
            </p>
            <p className="hero__condition">{current.description}</p>
            <p className="hero__range">
              <span title="Today's high">
                <span aria-hidden="true">↑</span> {formatTemp(current.temp_max, system)}
              </span>
              <span title="Today's low">
                <span aria-hidden="true">↓</span> {formatTemp(current.temp_min, system)}
              </span>
              <span title="Sunrise">
                <span aria-hidden="true">🌅</span> {formatClock(current.sunrise)}
              </span>
              <span title="Sunset">
                <span aria-hidden="true">🌇</span> {formatClock(current.sunset)}
              </span>
            </p>
          </div>
        </div>
      </div>

      <dl className="statgrid">
        {stats.map((stat) => (
          <div className="statgrid__item" key={stat.label}>
            <dt className="statgrid__label">
              <span className="statgrid__icon" aria-hidden="true">
                {stat.icon}
              </span>
              {stat.label}
            </dt>
            <dd className="statgrid__value">
              {/* The number is wrapped so it can be kept on one line while the
                  optional hint beside it is free to wrap away. */}
              <span className="statgrid__num">{stat.value}</span>
              {stat.hint ? <span className="statgrid__hint">{stat.hint}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Explain the "feels like" gap, which is the number people actually ask about. */
function feelsLikeHint(actual, apparent) {
  if (actual == null || apparent == null) return ''
  const delta = apparent - actual
  if (Math.abs(delta) < 1) return 'as it is'
  return delta > 0 ? 'warmer' : 'colder'
}
