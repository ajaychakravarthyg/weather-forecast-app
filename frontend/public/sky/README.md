# Background sky photographs

Drop image files in this folder and the dashboard picks them up automatically.
Supply none and it falls back to the procedural canvas sky — nothing breaks.

## Filenames

Resolution runs most-specific first, so **you can supply two files or twelve**:

| Priority | Filename | Applies to |
|---|---|---|
| 1 | `<group>-day.<ext>` / `<group>-night.<ext>` | that exact condition, that time of day |
| 2 | `<group>.<ext>` | that exact condition, day and night |
| 3 | `<family>-day.<ext>` / `<family>-night.<ext>` | a group of related conditions |
| 4 | `<family>.<ext>` | ditto, day and night |
| 5 | `default-day.<ext>` / `default-night.<ext>` | everything else |
| 6 | `default.<ext>` | everything |

Extensions tried, in order: `webp`, `jpg`, `jpeg`, `png`, `avif`.

**Groups** — `clear`, `mainly-clear`, `cloudy`, `fog`, `drizzle`, `rain`,
`showers`, `freezing`, `snow`, `thunderstorm`

**Families** — `clear` (clear, mainly-clear) · `cloudy` · `fog` ·
`rain` (drizzle, rain, showers) · `snow` (snow, freezing) · `storm` (thunderstorm)

### The minimum worth doing (2 files)

```
default-day.jpg
default-night.jpg
```

### A good middle ground (6 files)

```
clear-day.jpg     clear-night.jpg
cloudy.jpg        rain.jpg
snow.jpg          storm.jpg
```

### Full coverage (12 files)

Every `<family>-day` and `<family>-night` pair.

## Choosing images

- **Landscape, sky-dominant.** They're cropped with `background-size: cover`, so a
  portrait shot loses its edges. Aim for 16:9 or wider.
- **~2000px wide is plenty.** Bigger is wasted — it's a blurred, darkened backdrop.
- **Avoid busy foregrounds.** Buildings and people fight the cards for attention.
  Open sky, horizon, distant landscape work best.
- **Don't worry about brightness or colour cast.** The app darkens to 62%,
  desaturates to 82%, and grades the condition palette over the top, so a set of
  unrelated photographs still reads as one system. That treatment is also what
  keeps text legible — you don't need to pre-edit anything.

## Where to get them, free

- **[Unsplash](https://unsplash.com/s/photos/sky)** — free, no attribution required
- **[Pexels](https://www.pexels.com/search/sky/)** — same
- **Your own photos** — the most distinctive option

## Weight

Only the photo for the current conditions is downloaded, and each is probed once
per session. A 2000px JPEG at quality 80 lands around 200–400 kB; WebP is smaller
again, and is preferred when both exist.
