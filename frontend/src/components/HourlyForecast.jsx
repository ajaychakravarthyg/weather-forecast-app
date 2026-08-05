import { formatPercent, formatTemp } from '../utils/units'
import { formatHour, weatherIcon } from '../utils/weather'

/**
 * Next 24 hours as a horizontally scrollable strip. Like the daily list, every
 * value is printed, so nothing in the chart is hover-gated.
 */
export default function HourlyForecast({ hourly, system }) {
  return (
    <section className="card" aria-label="Hourly forecast">
      <header className="card__header">
        <h2 className="card__title">Next 24 hours</h2>
        <p className="card__hint">Scroll for more →</p>
      </header>

      <ul className="hourly">
        {hourly.map((hour, index) => (
          <li className={`hourly__cell${index === 0 ? ' is-now' : ''}`} key={hour.time}>
            <span className="hourly__time">{formatHour(hour.time, { isNow: index === 0 })}</span>
            <span className="hourly__icon" aria-hidden="true" title={hour.description}>
              {weatherIcon(hour.group, hour.is_day)}
            </span>
            <span className="hourly__temp">{formatTemp(hour.temperature, system)}</span>
            <span className="hourly__pop">
              {hour.precipitation_probability ? `💧${formatPercent(hour.precipitation_probability)}` : ' '}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
