import { countryFlag } from '../utils/weather'

/**
 * Recently searched cities. Clicking a chip re-runs the search using the stored
 * coordinates, so a repeat lookup skips geocoding entirely.
 */
export default function SearchHistory({ history, activeKey, onSelect, onClear, disabled }) {
  if (!history.length) return null

  return (
    <div className="history">
      <span className="history__label">Recent</span>

      <ul className="history__list">
        {history.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`chip${item.key === activeKey ? ' is-active' : ''}`}
              onClick={() => onSelect(item)}
              disabled={disabled}
              title={item.label}
            >
              <span aria-hidden="true">{countryFlag(item.country_code)}</span>
              {item.name}
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="history__clear" onClick={onClear} disabled={disabled}>
        Clear
      </button>
    </div>
  )
}
