/** Full-panel loading state, used only when there's nothing on screen yet. */
export default function Spinner({ message = 'Fetching the forecast…' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading__ring" aria-hidden="true" />
      <p className="loading__text">{message}</p>
    </div>
  )
}
