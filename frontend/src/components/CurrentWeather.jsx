import {
  formatPercent,
  formatPrecip,
  formatPressure,
  formatTemp,
  formatWind,
  unitLabels,
  uvBand,
  windDirection,
} from '../utils/units'
import { countryFlag, formatClock, formatObservedAt, weatherIcon } from '../utils/weather'

/**
 * The hero card: one big current temperature plus the supporting stat grid.
 * This is the view's single hero figure — every other number is secondary.
 */
export default function CurrentWeather({ location, current, system }) {
  const icon = weatherIcon(current.group, current.is_day)

  const stats = [
    { label: 'Feels like', value: formatTemp(current.apparent_temperature, system, { withUnit: true }), icon: '🌡️' },
    { label: 'Humidity', value: formatPercent(current.humidity), icon: '💧' },
    {
      label: 'Wind',
      value: formatWind(current.wind_speed, system),
      hint: windDirection(current.wind_direction),
      icon: '💨',
    },
    { label: 'Pressure', value: formatPressure(current.pressure, system), icon: '🧭' },
    {
      label: 'UV index',
      value: current.uv_index_max == null ? '—' : Math.round(current.uv_index_max * 10) / 10,
      hint: uvBand(current.uv_index_max),
      icon: '🔆',
    },
    { label: 'Cloud cover', value: formatPercent(current.cloud_cover), icon: '☁️' },
    { label: 'Precipitation', value: formatPrecip(current.precipitation, system), icon: '🌧️' },
    { label: 'Gusts', value: formatWind(current.wind_gusts, system), icon: '🍃' },
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
          <p className="hero__observed">{formatObservedAt(current.time, location.timezone)}</p>
        </div>

        <div className="hero__reading">
          <span className="hero__icon" aria-hidden="true">
            {icon}
          </span>
          <div className="hero__temps">
            <p className="hero__figure">
              {formatTemp(current.temperature, system)}
              <span className="hero__unit">{unitLabels[system].temp.slice(1)}</span>
            </p>
            <p className="hero__condition">{current.description}</p>
            <p className="hero__range">
              <span title="Today's high">↑ {formatTemp(current.temp_max, system)}</span>
              <span title="Today's low">↓ {formatTemp(current.temp_min, system)}</span>
              <span title="Sunrise">🌅 {formatClock(current.sunrise)}</span>
              <span title="Sunset">🌇 {formatClock(current.sunset)}</span>
            </p>
          </div>
        </div>
      </div>

      <dl className="statgrid">
        {stats.map((stat) => (
          <div className="statgrid__item" key={stat.label}>
            <dt className="statgrid__label">
              <span aria-hidden="true">{stat.icon}</span> {stat.label}
            </dt>
            <dd className="statgrid__value">
              {stat.value}
              {stat.hint ? <span className="statgrid__hint">{stat.hint}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
