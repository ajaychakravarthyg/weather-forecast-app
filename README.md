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
**Hosting** — Vercel (frontend) + Render (backend), both free tiers

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
├── render.yaml               # Render Blueprint for the backend
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

## 🔁 CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request.

```
build-frontend ─┐
                ├─► images (frontend + backend, in parallel)
check-backend  ─┘
```

1. **build-frontend** — `npm ci` (lockfile-exact) then `npm run build`, and uploads
   `frontend/dist` as a workflow artifact.
2. **check-backend** — installs the requirements and imports the app, asserting the
   `/api` routes register. Ten seconds, and it stops an image that can't boot.
3. **images** — builds both containers on a matrix. The frontend image downloads the
   artifact and uses the Dockerfile's **`prebuilt`** target, which just copies `dist/`
   into nginx rather than running npm a second time. **The bundle that was built is
   byte-for-byte the bundle that ships** — no chance of the image containing something
   the pipeline never produced.

Images publish to GitHub Container Registry, free for public repos and authenticated
with the built-in `GITHUB_TOKEN` — no secrets to configure:

```
ghcr.io/<you>/weather-forecast-app-frontend:latest
ghcr.io/<you>/weather-forecast-app-backend:latest
```

Tagged `latest` on `main`, plus a short SHA tag on every build, the branch name, and
semver tags for `v*` releases. Pull requests **build but do not push** — a fork's token
can't write packages, and unreviewed code shouldn't publish an image. Layer cache is
kept in GitHub Actions cache, so repeat builds are quick.

To reproduce the CI image build locally:

```bash
cd frontend
npm ci && npm run build
docker build --target prebuilt -t weather-frontend .
```

> The plain `docker compose up --build` path is untouched — it still uses the `prod`
> target and builds the bundle inside the image, so you need no prerequisites.

---

## ☁️ Deploy for free

Two free services: **Render** for the Python backend, **Vercel** for the React frontend. Deploy the
backend first, because the frontend needs its URL.

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Weather dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/weather-forecast-app.git
git push -u origin main
```

### Step 2 — Backend on Render

1. Sign up at [render.com](https://render.com) (free, no card required).
2. **New +** → **Web Service** → connect your GitHub repo.
3. Configure it exactly like this:

   | Setting | Value |
   |---|---|
   | **Root Directory** | `backend` |
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | Free |
   | **Health Check Path** | `/api/health` |

   > Binding to `$PORT` is required — Render marks the deploy unhealthy if you hardcode a port.
   >
   > Alternatively, use the included `render.yaml`: **New +** → **Blueprint** and point it at the repo.

4. Deploy, then confirm `https://<your-service>.onrender.com/api/health` returns `{"status":"ok"}`.
5. Copy that base URL — you need it next.

### Step 3 — Frontend on Vercel

1. Sign up at [vercel.com](https://vercel.com) and **Add New** → **Project** → import the same repo.
2. Configure:

   | Setting | Value |
   |---|---|
   | **Root Directory** | `frontend` |
   | **Framework Preset** | Vite (auto-detected) |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |

3. Add an **Environment Variable** — this is the important bit:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<your-service>.onrender.com` |

   No trailing slash. Vite inlines env vars at **build time**, so if you change this later you must
   **redeploy** for it to take effect.

4. Deploy. 🎉

### Step 4 — CORS

The backend already allows any `*.vercel.app` origin, so a standard Vercel deployment works with no
extra configuration. If you use a **custom domain**, add it on Render as an environment variable:

| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://weather.yourdomain.com` |

(Comma-separate multiple origins.) Render restarts automatically when you save it.

### ⏰ About Render's free tier

**Render's free instances sleep after ~15 minutes of inactivity.** The first request after that has to
cold-start the container, so **it can take ~30–60 seconds** — subsequent requests are fast. This is
normal and not a bug in the app.

The UI handles it gracefully: a network failure against a remote backend shows *"…it may be waking up
— try again in a few seconds"* rather than a generic error. Options if it bothers you:

- Mention the cold start in your portfolio README (recruiters understand free tiers).
- Hit `/api/health` from a free uptime pinger (e.g. [cron-job.org](https://cron-job.org)) every
  10 minutes to keep it warm.
- Deploy the backend somewhere that doesn't sleep — [Fly.io](https://fly.io) has a free allowance.

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
