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
import { formatClock, formatZonedClock, formatZonedWeekday } from '../utils/weather'
import Icon from './Icon'
import WeatherIcon from './WeatherIcon'

/**
 * The hero card: one big current temperature plus the supporting stat grid.
 * This is the view's single hero figure — every other number is secondary.
 *
 * `now` ticks once a second so the location's local clock runs live rather than
 * showing a frozen timestamp from whenever the data was fetched.
 */
export default function CurrentWeather({ location, current, system, now }) {
  const tempUnit = unitLabels[system].temp.slice(1)

  // Every tile is driven by a live measurement; nothing here is decorative.
  const stats = [
    {
      label: 'Feels like',
      value: formatTemp(current.apparent_temperature, system, { withUnit: true }),
      hint: feelsLikeHint(current.temperature, current.apparent_temperature),
      icon: 'thermometer',
    },
    { label: 'Humidity', value: formatPercent(current.humidity), icon: 'droplet' },
    {
      label: 'Wind',
      value: formatWind(current.wind_speed, system),
      hint: windDirection(current.wind_direction),
      icon: 'wind',
    },
    { label: 'Gusts', value: formatWind(current.wind_gusts, system), icon: 'wind' },
    { label: 'Pressure', value: formatPressure(current.pressure, system), icon: 'gauge' },
    {
      label: 'UV index',
      value: current.uv_index_max == null ? '—' : Math.round(current.uv_index_max * 10) / 10,
      hint: uvBand(current.uv_index_max),
      icon: 'uv',
    },
    { label: 'Visibility', value: formatVisibility(current.visibility, system), icon: 'eye' },
    { label: 'Cloud cover', value: formatPercent(current.cloud_cover), icon: 'cloud' },
    { label: 'Precipitation', value: formatPrecip(current.precipitation, system), icon: 'droplet' },
    { label: 'Daylight', value: formatDuration(current.daylight_duration), icon: 'hourglass' },
  ]

  return (
    <section className="card hero" aria-label="Current weather">
      <div className="hero__main">
        <div className="hero__place">
          <h1 className="hero__city">{location.name}</h1>
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
          <WeatherIcon
            group={current.group}
            isDay={current.is_day}
            size={78}
            className="hero__icon"
          />
          <div className="hero__temps">
            <p className="hero__figure">
              {formatTemp(current.temperature, system)}
              <span className="hero__unit">{tempUnit}</span>
            </p>
            <p className="hero__condition">{current.description}</p>
            <p className="hero__range">
              <span title="Today's high">
                <Icon name="arrowUp" size={14} /> {formatTemp(current.temp_max, system)}
              </span>
              <span title="Today's low">
                <Icon name="arrowDown" size={14} /> {formatTemp(current.temp_min, system)}
              </span>
              <span title="Sunrise">
                <Icon name="sunrise" size={15} /> {formatClock(current.sunrise)}
              </span>
              <span title="Sunset">
                <Icon name="sunset" size={15} /> {formatClock(current.sunset)}
              </span>
            </p>
          </div>
        </div>
      </div>

      <dl className="statgrid">
        {stats.map((stat) => (
          <div className="statgrid__item" key={stat.label}>
            <dt className="statgrid__label">
              <Icon name={stat.icon} size={15} className="statgrid__icon" />
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
