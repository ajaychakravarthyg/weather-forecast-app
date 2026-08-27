import { useEffect, useRef, useState } from 'react'

import { resolveSkyPhoto } from '../utils/skyPhoto'

/**
 * The photographic sky layer, behind the animated canvas.
 *
 * Renders nothing at all until a photo is confirmed to exist, so a project with
 * no images in `public/sky/` behaves exactly as before. When conditions change
 * the new photo is decoded first and only then swapped in, cross-fading over
 * the old one — no flash of empty background mid-transition.
 *
 * The treatment (darkening, slight desaturation, and the condition tint the
 * canvas paints on top) is what makes a set of unrelated photographs read as one
 * system rather than twelve stock images.
 */
export default function SkyPhoto({ group, isDay, onResolved }) {
  // Two slots so an outgoing photo can fade while the incoming one fades in.
  const [layers, setLayers] = useState([])
  const seq = useRef(0)

  useEffect(() => {
    let cancelled = false
    const ticket = ++seq.current

    resolveSkyPhoto(group, isDay).then(async (path) => {
      if (cancelled || ticket !== seq.current) return

      onResolved?.(Boolean(path))
      if (!path) {
        setLayers([])
        return
      }

      // Decode before showing, so the cross-fade starts from a painted image.
      try {
        const img = new Image()
        img.src = path
        await img.decode()
      } catch {
        /* decode is a nicety; a failure just means we fade in slightly later */
      }
      if (cancelled || ticket !== seq.current) return

      setLayers((previous) => {
        if (previous[0]?.path === path) return previous
        // Keep only the outgoing layer; older ones have already faded out.
        return [{ path, key: ticket }, ...previous.slice(0, 1)]
      })
    })

    return () => {
      cancelled = true
    }
  }, [group, isDay, onResolved])

  if (!layers.length) return null

  return (
    <div className="skyphoto" aria-hidden="true">
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className={`skyphoto__frame${index === 0 ? ' is-current' : ''}`}
          style={{ backgroundImage: `url("${layer.path}")` }}
        />
      ))}
    </div>
  )
}
