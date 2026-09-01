import Icon from './Icon'

/**
 * Friendly error panel. The copy is chosen per error kind so "city not found"
 * reads differently from "the backend is asleep".
 */
const PRESETS = {
  notFound: { icon: 'search', title: "We couldn't find that place" },
  network: { icon: 'plug', title: 'Connection problem' },
  server: { icon: 'alert', title: 'The weather service hiccuped' },
  badRequest: { icon: 'pencil', title: "That search didn't look right" },
  geolocation: { icon: 'pin', title: "Couldn't get your location" },
  unknown: { icon: 'alert', title: 'Something went wrong' },
}

export default function ErrorMessage({ kind = 'unknown', message, onRetry }) {
  const preset = PRESETS[kind] ?? PRESETS.unknown

  return (
    <div className="errorbox" role="alert">
      <Icon name={preset.icon} size={24} className="errorbox__icon" />
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
