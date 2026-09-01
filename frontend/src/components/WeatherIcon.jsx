import { useId } from 'react'

/**
 * Weather condition icons, drawn from the WMO group the backend resolves.
 *
 * These carry the most visual weight in the UI, so unlike the monochrome
 * interface set they are two-tone: the sun is warm, precipitation is cool, and
 * cloud bodies are near-white. Colours are CSS custom properties, so the whole
 * set retints from one place.
 *
 * Built from shared primitives (`Sun`, `Moon`, `Cloud`, …) rather than a flat
 * path per condition — a cloud is identical in every condition that has one, so
 * defining it once keeps them consistent and the file short.
 */

const WARM = 'var(--icon-warm, #ffd166)'
const COOL = 'var(--icon-cool, #7cc0f5)'
const BODY = 'var(--icon-cloud, #eef4ff)'
const DIM = 'var(--icon-cloud-dim, #b9c6da)'

/* -------------------------------- primitives ------------------------------ */

const Sun = ({ cx: cxIn = 12, cy: cyIn = 12, r: rIn = 4.4, rays = true }) => {
  // Coerced: a string prop here would string-concatenate in the ray maths below
  // and emit NaN coordinates rather than failing loudly.
  const cx = Number(cxIn)
  const cy = Number(cyIn)
  const r = Number(rIn)
  return (
  <g>
    {rays && (
      <g stroke={WARM} strokeWidth="1.8" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          const inner = r + 2.2
          const outer = r + 5
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * inner}
              y1={cy + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * outer}
              y2={cy + Math.sin(a) * outer}
            />
          )
        })}
      </g>
    )}
    <circle cx={cx} cy={cy} r={r} fill={WARM} />
  </g>
  )
}

/**
 * Crescent moon, carved with a mask so the bite is genuinely transparent.
 * An overlay disc in a "background colour" would only work on one backdrop —
 * these icons sit on cards, on glass and over the sky.
 */
const Moon = ({ cx = 12, cy = 11 }) => {
  const id = useId()
  return (
    <g>
      <mask id={id}>
        <circle cx={cx} cy={cy} r="5.6" fill="white" />
        <circle cx={cx + 2.9} cy={cy - 2.4} r="5" fill="black" />
      </mask>
      <circle cx={cx} cy={cy} r="5.6" fill="#e9eeff" mask={`url(#${id})`} />
    </g>
  )
}

/** The cloud body every precipitation icon shares. */
const Cloud = ({ y = 0, scale = 1, fill = BODY }) => (
  <g transform={`translate(12 ${12 + y}) scale(${scale}) translate(-12 -12)`}>
    <path
      d="M7.4 17.6a4.1 4.1 0 0 1-.3-8.2 5.6 5.6 0 0 1 10.7-1.2 3.7 3.7 0 0 1-.6 9.4z"
      fill={fill}
    />
  </g>
)

const Drops = ({ count = 3, y = 18.4, colour = COOL, length = 3.2 }) => (
  <g stroke={colour} strokeWidth="2" strokeLinecap="round">
    {Array.from({ length: count }, (_, i) => {
      const x = 8.4 + i * (7.2 / Math.max(1, count - 1 || 1))
      return <line key={i} x1={x} y1={y} x2={x - 1} y2={y + length} />
    })}
  </g>
)

const Flakes = ({ colour = '#e3edff' }) => (
  <g stroke={colour} strokeWidth="1.25" strokeLinecap="round">
    {[
      { x: 7.6, y: 19.2, r: 2.3 },
      { x: 12, y: 21, r: 2.5 },
      { x: 16.4, y: 19.2, r: 2.3 },
    ].map(({ x, y, r }) => (
      // Three arms, not four: at 20px an eight-point star fills in solid.
      <g key={x} transform={`translate(${x} ${y})`}>
        <line x1="0" y1={-r} x2="0" y2={r} />
        <line x1={-r * 0.87} y1={-r * 0.5} x2={r * 0.87} y2={r * 0.5} />
        <line x1={-r * 0.87} y1={r * 0.5} x2={r * 0.87} y2={-r * 0.5} />
      </g>
    ))}
  </g>
)

const Bolt = () => (
  <path d="M12.6 15.4h3.1l-4.6 6.4.9-4.3H9l4.3-6.1z" fill={WARM} />
)

const FogLines = () => (
  <g stroke={DIM} strokeWidth="2" strokeLinecap="round">
    <line x1="4.5" y1="14.5" x2="19.5" y2="14.5" />
    <line x1="6.5" y1="18" x2="17.5" y2="18" />
    <line x1="5" y1="21.2" x2="15" y2="21.2" />
  </g>
)

/* --------------------------------- scenes --------------------------------- */

const SCENES = {
  clear: {
    day: () => <Sun cy={12} r={4.6} />,
    night: () => <Moon cy={12} />,
  },
  'mainly-clear': {
    day: () => (
      <>
        <Sun cx={15.5} cy={8.5} r={3.4} />
        <Cloud y={2.2} scale={0.92} />
      </>
    ),
    night: () => (
      <>
        {/* Pushed up and right so the crescent clears the cloud and is legible. */}
        <Moon cx={16.4} cy={7} />
        <Cloud y={3.6} scale={0.82} />
      </>
    ),
  },
  cloudy: {
    day: () => (
      <>
        <Cloud y={-2.6} scale={0.72} fill={DIM} />
        <Cloud y={1.6} scale={0.96} />
      </>
    ),
  },
  fog: {
    day: () => (
      <>
        <Cloud y={-2.8} scale={0.86} fill={DIM} />
        <FogLines />
      </>
    ),
  },
  drizzle: {
    day: () => (
      <>
        <Cloud y={-1.6} scale={0.92} />
        <Drops count={3} y={18} length={2.4} />
      </>
    ),
  },
  rain: {
    day: () => (
      <>
        <Cloud y={-1.8} scale={0.92} />
        <Drops count={4} y={17.8} length={3.6} />
      </>
    ),
  },
  showers: {
    day: () => (
      <>
        <Sun cx={16.5} cy={7} r={2.8} rays={false} />
        <Cloud y={-0.6} scale={0.88} />
        <Drops count={3} y={18.2} length={3.4} />
      </>
    ),
  },
  freezing: {
    day: () => (
      <>
        <Cloud y={-3.4} scale={0.86} />
        <Drops count={2} y={17.2} length={2.4} />
        <Flakes />
      </>
    ),
  },
  snow: {
    day: () => (
      <>
        <Cloud y={-3.4} scale={0.86} />
        <Flakes />
      </>
    ),
  },
  thunderstorm: {
    day: () => (
      <>
        <Cloud y={-3} scale={0.9} fill={BODY} />
        <Bolt />
      </>
    ),
  },
}

/**
 * @param {string} group  weather group from the API
 * @param {boolean} isDay picks the day or night variant where one exists
 */
export default function WeatherIcon({ group = 'cloudy', isDay = true, size = 40, className, title }) {
  const scene = SCENES[group] ?? SCENES.cloudy
  const render = (isDay ? scene.day : scene.night ?? scene.day) ?? scene.day

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {render()}
    </svg>
  )
}
