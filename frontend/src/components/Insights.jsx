/**
 * Climate context for the current location — how this month compares with the
 * same stretch last year, where it sits in the local rainfall year, and how
 * today measures against the seasonal normal.
 *
 * Every line is derived from several years of ERA5 history for these exact
 * coordinates, so it says something true about *here* rather than generic
 * weather trivia. The card hides itself entirely when there's nothing to show.
 */
export default function Insights({ facts, loading, locationName }) {
  if (loading) {
    return (
      <section className="card" aria-label="Local climate insights">
        <header className="card__header">
          <h2 className="card__title">Local climate</h2>
        </header>
        <ul className="insights">
          {[0, 1, 2].map((i) => (
            <li className="insights__item is-loading" key={i}>
              <span className="insights__icon skeleton skeleton--dot" />
              <span className="insights__body">
                <span className="skeleton skeleton--line" />
                <span className="skeleton skeleton--line skeleton--short" />
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (!facts?.length) return null

  return (
    <section className="card" aria-label="Local climate insights">
      <header className="card__header">
        <div>
          <h2 className="card__title">Local climate</h2>
          <p className="card__hint">
            How {locationName} compares with its own history
          </p>
        </div>
      </header>

      <ul className="insights">
        {facts.map((fact) => (
          <li className="insights__item" key={fact.id}>
            <span className="insights__icon" aria-hidden="true">
              {fact.icon}
            </span>
            <span className="insights__body">
              <span className="insights__headline">{fact.headline}</span>
              <span className="insights__detail">{fact.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
