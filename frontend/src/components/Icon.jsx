/**
 * Inline SVG icon set.
 *
 * Replaces the emoji the UI used to lean on. Emoji are not icons: they render
 * differently on every platform (Windows shows regional-indicator pairs as bare
 * letters, and a headless browser with no emoji font shows tofu boxes), they
 * can't inherit colour, and they can't be styled or animated.
 *
 * Everything here is drawn on a 24×24 grid with a 1.75 stroke, round caps and
 * joins, and `currentColor` — so an icon takes the colour and size of whatever
 * text it sits beside, and one CSS rule restyles the whole set.
 */

const PATHS = {
  // --- interface ---------------------------------------------------------- #
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 1 0-13 0c0 5.2 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4.5V10h-5.4" />
    </>
  ),
  // --- measurements ------------------------------------------------------- #
  thermometer: (
    <>
      <path d="M13.8 13.6V5.4a2.4 2.4 0 1 0-4.8 0v8.2a4.2 4.2 0 1 0 4.8 0z" />
      <path d="M11.4 9.6v5.6" />
    </>
  ),
  cloud: (
    <path d="M7.2 18.2a4.3 4.3 0 0 1-.3-8.6 5.9 5.9 0 0 1 11.2-1.2 3.9 3.9 0 0 1-.6 9.8z" />
  ),
  droplet: <path d="M12 3.2c3 3.6 5.4 6.3 5.4 9.2A5.4 5.4 0 0 1 6.6 12.4c0-2.9 2.4-5.6 5.4-9.2z" />,
  wind: (
    <>
      <path d="M3 8.5h11.2a2.9 2.9 0 1 0-2.9-2.9" />
      <path d="M3 15.5h13.6a2.9 2.9 0 1 1-2.9 2.9" />
      <path d="M3 12h7.5" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.5 17.5a8.5 8.5 0 1 1 15 0" />
      <path d="M12 17.5l4-5.2" />
      <circle cx="12" cy="17.5" r="1.3" />
    </>
  ),
  uv: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5c0 4 4 4.8 4 8.5s-4 4.5-4 8.5" />
      <path d="M16 3.5c0 4-4 4.8-4 8.5s4 4.5 4 8.5" />
    </>
  ),
  sunrise: (
    <>
      <path d="M12 3.5v3.6M5.6 9.6 7 11M18.4 9.6 17 11M2.5 17h4M17.5 17h4" />
      <path d="M8 17a4 4 0 0 1 8 0" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  sunset: (
    <>
      <path d="M12 7.1V3.5M5.6 9.6 7 11M18.4 9.6 17 11M2.5 17h4M17.5 17h4" />
      <path d="M8 17a4 4 0 0 1 8 0" />
      <path d="M3.5 20.5h17" />
      <path d="M9.6 5 12 7.4 14.4 5" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />,
  arrowDown: <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />,
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.6" />
      <path d="M3.5 10.5h17M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19.5V4.5" />
      <path d="M4 19.5h16" />
      <path d="M7.5 16l3.5-4.6 3.2 2.6 4.3-6" />
    </>
  ),
  // --- error states ------------------------------------------------------- #
  alert: (
    <>
      <path d="M12 4.2 21 19.5H3z" />
      <path d="M12 9.6v4.2" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3.5v5M15 3.5v5" />
      <path d="M6.2 8.5h11.6v2.8a5.8 5.8 0 0 1-11.6 0z" />
      <path d="M12 17.1v3.4" />
    </>
  ),
  pencil: (
    <>
      <path d="M4.5 19.5h4L20 8a2.5 2.5 0 0 0-3.5-3.5L5 16z" />
      <path d="M15.2 5.8 18.7 9.3" />
    </>
  ),
}

/**
 * @param {string} name  key from PATHS
 * @param {number} size  px, sets both width and height
 */
export default function Icon({ name, size = 20, className, title, ...rest }) {
  const glyph = PATHS[name]
  if (!glyph) return null

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default; pass a title to expose it to assistive tech.
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {glyph}
    </svg>
  )
}
