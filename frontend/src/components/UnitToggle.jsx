import { IMPERIAL, METRIC } from '../utils/units'

/**
 * Segmented °C / °F control. Switching also swaps wind (km/h ↔ mph),
 * pressure (hPa ↔ inHg) and precipitation (mm ↔ in) — the conversion happens
 * client-side, so there's no refetch and no flicker.
 */
export default function UnitToggle({ system, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Temperature units">
      <button
        type="button"
        className={`segmented__btn${system === METRIC ? ' is-active' : ''}`}
        aria-pressed={system === METRIC}
        onClick={() => onChange(METRIC)}
      >
        °C
      </button>
      <button
        type="button"
        className={`segmented__btn${system === IMPERIAL ? ' is-active' : ''}`}
        aria-pressed={system === IMPERIAL}
        onClick={() => onChange(IMPERIAL)}
      >
        °F
      </button>
    </div>
  )
}
