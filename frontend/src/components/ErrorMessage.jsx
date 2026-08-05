/**
 * Friendly error panel. The copy is chosen per error kind so "city not found"
 * reads differently from "the backend is asleep".
 */
const PRESETS = {
  notFound: { icon: '🔍', title: "We couldn't find that place" },
  network: { icon: '🔌', title: 'Connection problem' },
  server: { icon: '⚠️', title: 'The weather service hiccuped' },
  badRequest: { icon: '✏️', title: "That search didn't look right" },
  geolocation: { icon: '📍', title: "Couldn't get your location" },
  unknown: { icon: '⚠️', title: 'Something went wrong' },
}

export default function ErrorMessage({ kind = 'unknown', message, onRetry }) {
  const preset = PRESETS[kind] ?? PRESETS.unknown

  return (
    <div className="errorbox" role="alert">
      <span className="errorbox__icon" aria-hidden="true">
        {preset.icon}
      </span>
      <div className="errorbox__body">
        <h2 className="errorbox__title">{preset.title}</h2>
        <p className="errorbox__text">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
