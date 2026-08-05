import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_SURFACE, GRID_LINE, INK_MUTED, SERIES_COOL, SERIES_WARM } from '../theme'
import { tempValue, unitLabels } from '../utils/units'
import { formatDayMonth, formatHourShort, formatWeekday } from '../utils/weather'

const DAILY = 'daily'
const HOURLY = 'hourly'

/**
 * Temperature over time, as a two-series area chart.
 *
 * Colour follows the *entity*, never its rank: "Temperature"/"High" is always
 * the warm hue and "Feels like"/"Low" always the cool one, so a series never
 * changes colour when the lines cross. A single shared y-axis (never a second
 * scale) keeps the two comparable by eye.
 *
 * Every plotted value is also printed in the hourly strip and the 7-day list, so
 * the tooltip enhances rather than gates the data.
 */
export default function TempChart({ daily, hourly, system }) {
  const [range, setRange] = useState(DAILY)
  const unit = unitLabels[system].temp

  const { data, warmKey, coolKey, warmLabel, coolLabel, tickInterval } = useMemo(() => {
    if (range === HOURLY) {
      return {
        warmKey: 'temp',
        coolKey: 'feels',
        warmLabel: 'Temperature',
        coolLabel: 'Feels like',
        // ~8 labels across 24 points keeps the axis readable on mobile.
        tickInterval: 2,
        data: hourly.map((hour, index) => ({
          key: hour.time,
          axisLabel: index === 0 ? 'Now' : formatHourShort(hour.time),
          tooltipLabel: formatHourShort(hour.time),
          temp: tempValue(hour.temperature, system),
          feels: tempValue(hour.apparent_temperature, system),
        })),
      }
    }

    return {
      warmKey: 'temp',
      coolKey: 'feels',
      warmLabel: 'High',
      coolLabel: 'Low',
      tickInterval: 0,
      data: daily.map((day, index) => ({
        key: day.date,
        axisLabel: formatWeekday(day.date, { isToday: index === 0 }),
        tooltipLabel: `${formatWeekday(day.date, { isToday: index === 0 })}, ${formatDayMonth(day.date)}`,
        temp: tempValue(day.temp_max, system),
        feels: tempValue(day.temp_min, system),
      })),
    }
  }, [range, daily, hourly, system])

  // Pad the domain so the lines never graze the frame, then snap the bounds to a
  // round step. Ticks are passed explicitly: with an unsnapped domain Recharts
  // always draws a tick at each bound, which crowds the top label.
  const { domain, ticks } = useMemo(() => {
    const values = data.flatMap((point) => [point[warmKey], point[coolKey]]).filter((v) => v != null)
    if (!values.length) return { domain: ['auto', 'auto'], ticks: undefined }

    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = Math.max(1, (hi - lo) * 0.12)
    // Pick the smallest round step that keeps the axis to ~6 labels or fewer.
    const step = [1, 2, 5, 10, 20].find((candidate) => (hi + pad - (lo - pad)) / candidate <= 6) ?? 20
    const min = Math.floor((lo - pad) / step) * step
    const max = Math.ceil((hi + pad) / step) * step

    const tickValues = []
    for (let value = min; value <= max + 1e-9; value += step) tickValues.push(Math.round(value))
    return { domain: [min, max], ticks: tickValues }
  }, [data, warmKey, coolKey])

  return (
    <section className="card chart" aria-label="Temperature chart">
      <header className="card__header">
        <div>
          <h2 className="card__title">
            {range === DAILY ? 'Temperature trend — next 7 days' : 'Temperature trend — next 24 hours'}
          </h2>
          <p className="card__hint">Shown in {unit}</p>
        </div>

        {/* Only one chart on the page, so its range switch lives in its header. */}
        <div className="segmented" role="group" aria-label="Chart range">
          <button
            type="button"
            className={`segmented__btn${range === DAILY ? ' is-active' : ''}`}
            aria-pressed={range === DAILY}
            onClick={() => setRange(DAILY)}
          >
            7 days
          </button>
          <button
            type="button"
            className={`segmented__btn${range === HOURLY ? ' is-active' : ''}`}
            aria-pressed={range === HOURLY}
            onClick={() => setRange(HOURLY)}
          >
            24 hours
          </button>
        </div>
      </header>

      {/* Legend is always present for two series — identity never rests on colour alone. */}
      <ul className="legend">
        <li className="legend__item">
          <span className="legend__key" style={{ background: SERIES_WARM }} aria-hidden="true" />
          {warmLabel}
        </li>
        <li className="legend__item">
          <span className="legend__key" style={{ background: SERIES_COOL }} aria-hidden="true" />
          {coolLabel}
        </li>
      </ul>

      <div className="chart__canvas">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <defs>
              {/* Area fills are a ~10% wash, never a saturated block. */}
              <linearGradient id="fillWarm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_WARM} stopOpacity={0.18} />
                <stop offset="100%" stopColor={SERIES_WARM} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillCool" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COOL} stopOpacity={0.18} />
                <stop offset="100%" stopColor={SERIES_COOL} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Recessive hairline gridlines — horizontal only, solid, never dashed. */}
            <CartesianGrid stroke={GRID_LINE} strokeWidth={1} vertical={false} />

            <XAxis
              dataKey="axisLabel"
              interval={tickInterval}
              tick={{ fill: INK_MUTED, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={4}
            />
            <YAxis
              domain={domain}
              ticks={ticks}
              tick={{ fill: INK_MUTED, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}°`}
              width={56}
            />

            <Tooltip
              content={<ChartTooltip warmLabel={warmLabel} coolLabel={coolLabel} unit={unit} />}
              // The crosshair finds the X so readers aim at a time, not at a 2px line.
              cursor={{ stroke: 'rgba(255,255,255,0.28)', strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey={coolKey}
              name={coolLabel}
              stroke={SERIES_COOL}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#fillCool)"
              dot={false}
              // 2px ring in the surface colour keeps the marker legible where lines cross.
              activeDot={{ r: 4.5, fill: SERIES_COOL, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive
              animationDuration={550}
            />
            <Area
              type="monotone"
              dataKey={warmKey}
              name={warmLabel}
              stroke={SERIES_WARM}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#fillWarm)"
              dot={false}
              activeDot={{ r: 4.5, fill: SERIES_WARM, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive
              animationDuration={550}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

/**
 * One tooltip listing every series at the hovered X. The value leads (strong,
 * high-contrast) and the series name follows, keyed by a short line of its colour.
 */
function ChartTooltip({ active, payload, warmLabel, coolLabel, unit }) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload
  const rows = [
    { label: warmLabel, value: point.temp, color: SERIES_WARM },
    { label: coolLabel, value: point.feels, color: SERIES_COOL },
  ]

  return (
    <div className="tooltip">
      <p className="tooltip__title">{point.tooltipLabel}</p>
      {rows.map((row) => (
        <p className="tooltip__row" key={row.label}>
          <span className="tooltip__key" style={{ background: row.color }} aria-hidden="true" />
          <strong className="tooltip__value">{row.value == null ? '—' : `${row.value}${unit}`}</strong>
          <span className="tooltip__label">{row.label}</span>
        </p>
      ))}
    </div>
  )
}
