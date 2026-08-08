import { formatPercent, formatVisibility, formatWind, formatTemp } from '../utils/units'
import { formatHour, weatherIcon } from '../utils/weather'

/**
 * Next 24 hours as a horizontally scrollable strip. Like the daily list, every
 * value is printed, so nothing in the chart is hover-gated.
 *
 * Each cell's tooltip carries the extra hourly readings (humidity, wind,
 * visibility) that would clutter the strip if shown inline.
 */
export default function HourlyForecast({ hourly, system }) {
  return (
    <section className="card" aria-label="Hourly forecast">
      <header className="card__header">
        <div>
          <h2 className="card__title">Next 24 hours</h2>
          <p className="card__hint">Hover a cell for humidity, wind and visibility</p>
        </div>
        <p className="card__hint card__hint--nowrap">Scroll for more →</p>
      </header>

      <ul className="hourly">
        {hourly.map((hour, index) => (
          <li
            className={`hourly__cell${index === 0 ? ' is-now' : ''}`}
            key={hour.time}
            title={[
              hour.description,
              `Humidity ${formatPercent(hour.humidity)}`,
              `Wind ${formatWind(hour.wind_speed, system)}`,
              `Visibility ${formatVisibility(hour.visibility, system)}`,
            ].join(' · ')}
          >
            <span className="hourly__time">{formatHour(hour.time, { isNow: index === 0 })}</span>
            <span className="hourly__icon" aria-hidden="true">
              {weatherIcon(hour.group, hour.is_day)}
            </span>
            <span className="hourly__temp">{formatTemp(hour.temperature, system)}</span>
            <span className="hourly__wind">{formatWind(hour.wind_speed, system)}</span>
            <span className="hourly__pop">
              {hour.precipitation_probability ? `💧${formatPercent(hour.precipitation_probability)}` : ' '}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
