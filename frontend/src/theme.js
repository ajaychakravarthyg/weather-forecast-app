/**
 * Chart palette — single source of truth shared by the CSS and the SVG marks.
 *
 * Recharts writes these straight into SVG attributes, so they're kept as plain
 * hex here rather than CSS custom properties. The matching CSS variables in
 * styles.css use the same values.
 *
 * These two hues were validated as a categorical pair against the dark chart
 * surface below (OKLab CVD separation ΔE 26.8 protan / 32.4 tritan, normal-vision
 * ΔE 31.8, both ≥ 3:1 contrast) — comfortably clear of the safety floors, so the
 * two lines stay distinguishable for colour-vision-deficient readers.
 */

export const CHART_SURFACE = '#1a2336' // the card colour the marks sit on
export const SERIES_WARM = '#d95926' // orange — "Temperature" / "High"
export const SERIES_COOL = '#3987e5' // blue   — "Feels like" / "Low"

export const INK_MUTED = '#8b95a8' // axis + tick labels
export const GRID_LINE = 'rgba(255, 255, 255, 0.07)' // hairline gridlines
