import { formatDuration, formatPercent, formatTemp, formatWind } from '../utils/units'
import { formatClock, formatDayMonth, formatWeekday, weatherIcon } from '../utils/weather'

/**
 * 7-day outlook. Each row carries its own min/max numbers, which is also what
 * keeps the temperature chart honest — every plotted value is readable here
 * without hovering (the chart's "table view").
 *
 * The mini range bar shows each day's span against the week's overall span, so
 * you can see at a glance which days run warm or cold.
 */
export default function DailyForecast({ daily, system }) {
  const mins = daily.map((d) => d.temp_min).filter((v) => v != null)
  const maxes = daily.map((d) => d.temp_max).filter((v) => v != null)
  const weekMin = mins.length ? Math.min(...mins) : 0
  const weekMax = maxes.length ? Math.max(...maxes) : 1
  const span = weekMax - weekMin || 1

  return (
    <section className="card" aria-label="7-day forecast">
      <header className="card__header">
        <h2 className="card__title">7-day forecast</h2>
      </header>

      <ul className="daily">
        {daily.map((day, index) => {
          // Position/size of this day's bar within the week's full range.
          const left = ((day.temp_min - weekMin) / span) * 100
          const width = ((day.temp_max - day.temp_min) / span) * 100

          return (
            <li
              className="daily__row"
              key={day.date}
              title={[
                day.description,
                `Sunrise ${formatClock(day.sunrise)} · Sunset ${formatClock(day.sunset)}`,
                `Daylight ${formatDuration(day.daylight_duration)}`,
                `Max wind ${formatWind(day.wind_speed_max, system)}`,
                day.uv_index_max == null ? null : `UV ${Math.round(day.uv_index_max * 10) / 10}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <div className="daily__day">
                <span className="daily__weekday">{formatWeekday(day.date, { isToday: index === 0 })}</span>
                <span className="daily__date">{formatDayMonth(day.date)}</span>
              </div>

              <span className="daily__icon" aria-hidden="true">
                {weatherIcon(day.group, true)}
              </span>

              <span className="daily__desc">{day.description}</span>

              <span className="daily__pop" title="Chance of precipitation">
                {day.precipitation_probability ? `💧 ${formatPercent(day.precipitation_probability)}` : ''}
              </span>

              <span className="daily__min">{formatTemp(day.temp_min, system)}</span>

              <span className="daily__bar" aria-hidden="true">
                <span
                  className="daily__bar-fill"
                  style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(6, width)}%` }}
                />
              </span>

              <span className="daily__max">{formatTemp(day.temp_max, system)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
