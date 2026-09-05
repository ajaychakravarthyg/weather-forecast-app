# ⛅ Weather Dashboard

A modern, responsive weather dashboard built with **React (Vite)** and **FastAPI**, powered by the
[Open-Meteo API](https://open-meteo.com).

**Zero cost, zero API keys, zero signup.** Open-Meteo is free for non-commercial use and requires no
authentication, so you can clone this repo and have it running in under two minutes — and deploy it
publicly for free.

The React frontend never talks to Open-Meteo directly. It calls the FastAPI backend, which handles
geocoding, forecasting, response normalisation and caching. That keeps the API logic server-side and
the React components clean.

---

## ✨ Features

| | Feature |
|---|---|
| 🔎 | **City search with disambiguation** — a debounced dropdown of matches, so you can tell London/England from London/Ontario from London/Kentucky |
| 🌡️ | **Current conditions** — temperature, "feels like", condition + icon, humidity, wind (with compass direction), pressure, UV index, cloud cover, precipitation, gusts, sunrise/sunset |
| 📅 | **7-day forecast** — daily min/max, condition icons, chance of precipitation, and a mini range bar showing each day's span against the week |
| ⏱️ | **24-hour forecast** — a scrollable hourly strip with per-hour icons, temperatures and rain chance |
| 📈 | **Temperature chart** — a Recharts area chart that toggles between the 7-day high/low and the 24-hour temperature vs. "feels like", with a crosshair tooltip |
| 📍 | **Geolocation** — a "Use my location" button using the browser Geolocation API, reverse-geocoded to a real place name |
| 🔄 | **Unit toggle** — °C/°F, and with it km/h ⇄ mph, hPa ⇄ inHg, mm ⇄ in. Converted client-side, so switching is instant and never refetches |
| 🕘 | **Search history** — your recent cities as clickable chips; re-searching uses the stored coordinates and skips geocoding |
| 📈 | **Local climate insights** — how the last 30 days compare with the same stretch last year, where this month sits in the local rainfall year, and today against the seasonal normal. Derived from several years of ERA5 history for those exact coordinates |
| 💾 | **Picks up where you left off** — the last location, recent cities and unit choice persist across reloads. On a first visit it asks for your device location and falls back to a default city if you decline |
| ⏳ | **Loading & error states** — a spinner on first load, a top progress bar on refetch (the previous data stays on screen rather than flashing a skeleton), and specific, friendly messages for "city not found", network failures and a cold-starting backend |
| 🏞️ | **Photographic skies (optional)** — drop images into `frontend/public/sky/` and they become the background, resolved per condition and time of day with a fallback chain so two files or twelve both work. A darken/desaturate/grade treatment makes unrelated photos read as one system and keeps text legible. With the folder empty it falls back to the procedural canvas sky. See [`frontend/public/sky/README.md`](frontend/public/sky/README.md). |
| 🎨 | **Polish** — the background tint responds to the current weather and to day/night, glassmorphism cards, staggered entry animations, full keyboard support in the search dropdown, and `prefers-reduced-motion` respected |

### A note on the chart

The two series use a colour pair validated for colour-vision deficiency against the actual dark card
surface (CVD separation ΔE 26.8 protan / 32.4 tritan; both above 3:1 contrast). Colour follows the
*entity*, not its rank — "High" is always warm and "Low" always cool, so a series never changes colour
when the lines cross. A legend is always present, and every plotted value is also printed in the
hourly strip and the 7-day list, so the tooltip enhances the data rather than gating it.

---

## 📸 Screenshots

> Replace these placeholders with your own captures — drop the files into `docs/` and the paths below
> will pick them up.

| Desktop | Mobile |
|---|---|
| ![Desktop dashboard](docs/screenshot-desktop.png) | ![Mobile dashboard](docs/screenshot-mobile.png) |

| Temperature chart | City search |
|---|---|
| ![Temperature chart](docs/screenshot-chart.png) | ![City search dropdown](docs/screenshot-search.png) |

---

## 🧱 Tech stack

**Frontend** — React 19, Vite 7, Recharts 3, plain CSS (no framework, no runtime CSS-in-JS)
**Backend** — Python 3.12, FastAPI, Uvicorn, httpx, Pydantic v2
**Data** — [Open-Meteo](https://open-meteo.com) forecast + geocoding APIs (no key)
**Containers** — Docker + Docker Compose (nginx serving the SPA and proxying the API)
**Hosting** — one Render Blueprint deploys both services, or Vercel + Render. Free either way.

---

## 📂 Project structure

```
weather-forecast-app/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, routes, CORS, error handling
│   │   ├── open_meteo.py     # Open-Meteo client, TTL cache, response mapping
│   │   ├── models.py         # Pydantic response models (the JSON contract)
│   │   └── weather_codes.py  # WMO weather code -> description + group
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx        # search + debounced suggestion dropdown
│   │   │   ├── CurrentWeather.jsx   # hero card + stat grid
│   │   │   ├── DailyForecast.jsx    # 7-day list
│   │   │   ├── HourlyForecast.jsx   # 24-hour scroll strip
│   │   │   ├── TempChart.jsx        # Recharts area chart
│   │   │   ├── UnitToggle.jsx       # °C / °F
│   │   │   ├── SearchHistory.jsx    # recent-city chips
│   │   │   ├── Spinner.jsx
│   │   │   └── ErrorMessage.jsx
│   │   ├── utils/
│   │   │   ├── units.js      # unit conversion + number formatting
│   │   │   └── weather.js    # icons, date/time formatting, flags
│   │   ├── api.js            # fetch wrapper + typed errors
│   │   ├── theme.js          # chart palette (shared with CSS)
│   │   ├── styles.css
│   │   ├── App.jsx           # state, data fetching, layout
│   │   └── main.jsx
│   ├── .env.example
│   ├── vercel.json
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml        # nginx + FastAPI (production-style)
├── docker-compose.dev.yml    # live-reload stack for development
├── render.yaml               # Render Blueprint — deploys API + web together
├── DEPLOY.md                 # deployment walkthrough
├── .gitignore
└── README.md
```

Each service also carries its own `Dockerfile` and `.dockerignore`, and the frontend
has an `nginx.conf.template` used by the production image.

---

## 🚀 Run it locally

**Prerequisites:** Python 3.10+ and Node.js 18+.
*(Prefer containers? Skip to [Run it with Docker](#-run-it-with-docker) — one command, no local toolchain.)*

You'll need **two terminals** — one for each server.

### Terminal 1 — backend (port 8000)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify it's up: <http://127.0.0.1:8000/api/health> → `{"status":"ok"}`
Interactive API docs: <http://127.0.0.1:8000/docs>

### Terminal 2 — frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **<http://localhost:5173>** and you're done.

No `.env` file is needed locally: the Vite dev server proxies `/api/*` to `http://127.0.0.1:8000`
(configured in `vite.config.js`), so there are no CORS issues and nothing to configure.

> **On Debian/Ubuntu**, if `python3 -m venv` fails with *"ensurepip is not available"*, install the
> venv package first: `sudo apt install python3-venv`

---

## 🔌 API reference

The backend returns all values in **metric** units (°C, km/h, hPa, mm); the frontend converts for
display, which is why the unit toggle needs no refetch.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check. Ping to wake a sleeping Render instance. |
| `GET` | `/api/geocode?q=London&count=5` | City name → candidate locations (powers the dropdown). |
| `GET` | `/api/weather?city=London&hours=24` | Geocode + full forecast for the best match. |
| `GET` | `/api/weather/coords?lat=51.5&lon=-0.13&name=London&admin1=England&country=United+Kingdom` | Forecast for explicit coordinates. Pass the place's parts to render it exactly as searched; omit them all to reverse-geocode a name. |
| `GET` | `/api/insights?lat=51.5&lon=-0.13&tmax=24` | Climate context from the ERA5 archive. Fails soft — returns an empty list rather than an error, so the panel just hides. |

Errors come back as `{"detail": "..."}` with a meaningful status code (`404` for an unknown city,
`503` when Open-Meteo is unreachable). Forecast responses are cached in-process for 10 minutes,
geocoding for 24 hours and archive history for 24 hours, which keeps the app well inside
Open-Meteo's free-tier limits.

The insights endpoint reads Open-Meteo's [historical archive](https://open-meteo.com/en/docs/historical-weather-api)
(ERA5 reanalysis) — also free, also no key. One request covers five years of dailies, and every
fact is computed from it. Nothing is hardcoded per country: the "monsoon season" label, for
instance, is earned by a real climatological test — at least 70% of annual rainfall concentrated in
the wettest four consecutive months, *and* enough absolute rain to mean something. So it appears for
Mumbai (91%) and not for Cairo, whose rainfall is just as lopsided but essentially nil.

Try it:

```bash
curl "http://127.0.0.1:8000/api/weather?city=Tokyo"
curl "http://127.0.0.1:8000/api/geocode?q=London&count=3"
```

---

## 🐳 Run it with Docker

If you'd rather not install Python and Node at all, the whole stack runs in two containers.

```bash
docker compose up --build
```

Then open **<http://localhost:8080>**. That's it — no `.env`, no CORS setup.

To stop it: `Ctrl+C`, then `docker compose down`.

### How the containers fit together

```
                    ┌─────────────────────────────┐
  browser  ─────►   │  frontend  (nginx :80)      │
  :8080             │   /        → static SPA     │
                    │   /api/*   → proxy ────────┐│
                    └───────────────────────────┼┘
                                                │  docker network
                    ┌───────────────────────────▼─┐
                    │  backend  (uvicorn :8000)   │  ──►  Open-Meteo
                    └─────────────────────────────┘
```

The key detail: **nginx serves the app and proxies `/api` to the backend**, so the browser
only ever talks to one origin. That means no CORS configuration, and no API URL baked in at
build time — the frontend uses relative `/api/...` paths. Port `8000` is also published so you
can hit the API and its `/docs` page directly, but the app doesn't need it.

| Service | Image size | Port | Notes |
|---|---|---|---|
| `frontend` | ~74 MB | `8080` → 80 | Multi-stage build; only the compiled `dist/` reaches the nginx image |
| `backend` | ~233 MB | `8000` → 8000 | `python:3.12-slim`, runs as non-root `appuser` (UID 1000) |

Both containers declare healthchecks, and the frontend waits for the backend to report
healthy (`depends_on: condition: service_healthy`) before it starts accepting traffic.

### Development, with live reload

The default compose file builds an optimised bundle, so it won't pick up your edits. For
day-to-day work use the dev stack instead:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Open **<http://localhost:5173>**. This runs the Vite dev server with HMR and `uvicorn --reload`,
with your source bind-mounted in — edit a file on the host and the browser updates. Here Vite
does the `/api` proxying (`VITE_PROXY_TARGET` points it at the backend container), so nginx
isn't involved at all.

### Useful commands

```bash
docker compose logs -f backend        # follow backend logs
docker compose logs -f frontend       # follow nginx logs
docker compose ps                     # status + health
docker compose exec backend sh        # shell into the API container
docker compose up --build --force-recreate   # rebuild from scratch
docker compose down -v                # stop and remove volumes
```

### Building the images on their own

```bash
# Backend
docker build -t weather-backend ./backend
docker run --rm -p 8000:8000 weather-backend

# Frontend — BACKEND_ORIGIN is read at container start, not build time
docker build -t weather-frontend ./frontend
docker run --rm -p 8080:80 -e BACKEND_ORIGIN=http://host.docker.internal:8000 weather-frontend
```

The backend honours `$PORT`, so the same image runs unchanged on Render, Fly.io or Cloud Run.
If you need the frontend to call a backend on a *different* origin (rather than through the
nginx proxy), bake it in at build time instead:

```bash
docker build -t weather-frontend \
  --build-arg VITE_API_BASE_URL=https://your-api.onrender.com ./frontend
```

> **Permission denied on `/var/run/docker.sock`?** Your user isn't in the `docker` group.
> Either prefix the commands with `sudo`, or add yourself once:
> `sudo usermod -aG docker $USER` — then log out and back in (or run `newgrp docker`).

---

## 🔁 CI/CD

`.github/workflows/ci.yml` runs on every push to `main`, every pull request, and
weekly on a schedule.

```
build-frontend ─┐
                ├─► image  (build → scan for CVEs → push only if clean)
check-backend  ─┘
audit-deps ─────── independent, runs alongside
```

### The pipeline

| Job | What it does |
|---|---|
| **build-frontend** | `npm ci` then `npm run build`, uploads `frontend/dist` as an artifact |
| **check-backend** | installs requirements, imports the app and asserts all five `/api` routes register |
| **audit-deps** | `npm audit` on the production tree (dev findings advisory only) and `pip-audit` on the installed environment |
| **image** | matrix over frontend/backend: build → **CVE scan** → SBOM → push if the gate passed |

### Two properties worth knowing

**The artifact is built once.** `npm run build` runs in its own job; the image
build downloads that artifact and uses the Dockerfile's `prebuilt` target, which
copies `dist/` straight into nginx rather than running npm again. The bundle that
was built is the bundle that ships.

**The image that was scanned is the image that ships.** The build step uses
`load: true` with `push: false`, so nothing reaches the registry before the scan.
After the gate passes, the *same local image* is tagged and pushed — it is never
rebuilt, so the bytes that were checked and the bytes that ship cannot differ.

### The CVE gate

Trivy (pinned to `aquasec/trivy:0.74.0` — an unpinned scanner makes builds fail
on someone else's release day) scans each image and the build **fails on
CRITICAL or HIGH vulnerabilities that have a fix available**.

Results go three places: a readable table in the job summary, SARIF uploaded to
the repository's **Security tab**, and a CycloneDX **SBOM** kept as an artifact
for 30 days.

#### Why `--ignore-unfixed`

Because the alternative is a gate nobody can ever pass. Scanning the images
before this work found:

| | CRITICAL | HIGH | Fixable |
|---|---|---|---|
| backend | 3 | 16 | 3 |
| frontend | 1 | 34 | 35 |

The unfixable ones are base-image CVEs with no patched version published — there
is no action a developer can take, so blocking on them would mean a permanently
red pipeline and a gate everyone learns to ignore. Gating on *fixable* findings
keeps every failure actionable.

That distinction was worth making, because the fixable ones were all real:

- **backend** — the FastAPI pin dragged in `starlette 0.41.3`, carrying three HIGH
  CVEs. Fixed by moving to FastAPI 0.141.1 / starlette 1.6.0.
- **frontend** — all 35 came from stale Alpine packages in the base image
  (`libssl3`, `libexpat`, `libxml2`, `libpng`, `musl`, `zlib`…), none from
  application code. Fixed with `apk upgrade --no-cache` in the runtime stage;
  the backend does the equivalent with `apt-get upgrade`.

Both images now report **zero fixable CRITICAL/HIGH**, and the gate was verified
in both directions — it passes on the patched images and exits non-zero on the
unpatched `nginx:1.27-alpine` base.

### Registry

Images publish to GitHub Container Registry, authenticated with the built-in
`GITHUB_TOKEN`, so there are no secrets to configure:

```
ghcr.io/<you>/weather-forecast-app-frontend:latest
ghcr.io/<you>/weather-forecast-app-backend:latest
```

Tagged `latest` on `main`, plus short SHA, branch name, and semver tags for `v*`
releases. Pull requests **build and scan but do not push** — a fork's token
cannot write packages, and unreviewed code should not publish an image.

### Reproducing it locally

```bash
# the artifact-based image build CI performs
cd frontend && npm ci && npm run build
docker build --target prebuilt -t weather-frontend .

# the same gate CI applies
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:0.74.0 image --scanners vuln \
  --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 weather-frontend
```

> The plain `docker compose up --build` path is untouched — it uses the `prod`
> target and builds the bundle inside the image, so it needs no prerequisites.

---

## ☁️ Deploy for free

Two free paths, no credit card. The fastest is **one Blueprint that deploys both
services** — `render.yaml` wires the frontend to the API automatically, so there
is nothing to copy between dashboards:

> Render → **New +** → **Blueprint** → pick this repo → **Apply**

Full walkthrough, the Vercel + Render alternative, notes on the free-tier cold
start, and how to deploy the published container images instead:
**[DEPLOY.md](DEPLOY.md)**.

---

## 🛠️ Design notes & possible extensions

A few decisions worth knowing if you want to build on this:

- **State persists in `localStorage`** (`src/utils/storage.js`): the last location, recent cities and
  unit choice. Every access is guarded, because Safari private mode throws rather than degrading.
- **A first visit asks for geolocation** and quietly falls back to `DEFAULT_CITY` in `App.jsx` if
  permission is refused — a new visitor never gets an error as their first impression.
- **The cache is in-process**, which is right for a single free instance. For horizontal scaling, swap
  `TTLCache` in `open_meteo.py` for Redis.
- **Times are rendered in the location's timezone** — a Tokyo forecast reads in Tokyo time regardless of
  where the browser is. Open-Meteo returns naive local ISO strings, and `utils/weather.js` parses their
  parts directly rather than through `Date` UTC handling, which would double-shift them.
- Ideas: an air-quality panel (Open-Meteo has a free air-quality API), a favourites list, a
  precipitation bar chart, or a wind-direction compass.

---

## 📄 License

MIT — do whatever you like with it.

## 🙏 Credits

Weather and geocoding data from [Open-Meteo](https://open-meteo.com), free for non-commercial use
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reverse geocoding for the
"Use my location" label uses the key-less
[BigDataCloud client endpoint](https://www.bigdatacloud.com/), and degrades gracefully to
coordinates if unavailable.
