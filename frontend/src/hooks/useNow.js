import { useEffect, useState } from 'react'

/**
 * A Date that re-renders on an interval, for anything that must tick on its own:
 * the location's live local clock and the "updated 30s ago" label.
 *
 * The timer is cleared on unmount and re-created if the interval changes.
 */
export default function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
