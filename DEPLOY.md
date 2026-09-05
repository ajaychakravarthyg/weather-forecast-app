# Deploying to the internet

Everything below is free and needs no credit card. Pick **one** of the two paths.

| | Path A — Render Blueprint | Path B — Vercel + Render |
|---|---|---|
| Steps | ~3 clicks, one platform | ~8 clicks, two platforms |
| Frontend | Render static site | Vercel CDN |
| Config | none — wired by `render.yaml` | one env var to paste |
| Frontend speed | good | excellent (global edge) |
| API cold start | ~30–60s after idle | same |

**Path A is the fastest way to get a public URL.** Path B is worth it if you want
the frontend on Vercel's edge network, which is noticeably snappier worldwide.

---

## Path A — one Blueprint, both services

`render.yaml` in the repo root already describes the API *and* the web service.

1. Sign up at **[render.com](https://render.com)** and connect your GitHub account.
2. **New +** → **Blueprint** → pick `weather-forecast-app` → **Apply**.
3. Wait for both services to go live (first build ~3–5 minutes).

That's it. Your URL is the one Render gives `weather-dashboard-web`, something like:

```
https://weather-dashboard-web.onrender.com
```

**Nothing to configure.** The web service reads the API's hostname directly from
the API service via `fromService`, so there is no URL to copy between dashboards.
The backend's default CORS rule already allows `*.onrender.com`.

---

## Path B — Vercel (frontend) + Render (API)

Deploy the API first; the frontend needs its URL.

### 1. API on Render

**New +** → **Web Service** → connect the repo, then:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

> Binding to `$PORT` is required — Render marks the deploy unhealthy if you
> hardcode a port.

Confirm `https://<your-api>.onrender.com/api/health` returns `{"status":"ok"}`,
then copy that base URL.

### 2. Frontend on Vercel

**[vercel.com](https://vercel.com)** → **Add New** → **Project** → import the repo.

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Add one **Environment Variable**:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-api>.onrender.com` |

Deploy. Done.

> **Vite inlines env vars at build time.** If you change `VITE_API_BASE_URL`
> later you must **redeploy** — editing it alone changes nothing.

### 3. CORS

Nothing to do for a `*.vercel.app` URL — it is allowed by default. For a
**custom domain**, add on the Render API service:

| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://weather.yourdomain.com` |

(Comma-separate several.) Render restarts on save.

---

## About the free-tier cold start

**Render's free instances sleep after ~15 minutes idle**, so the first request
afterwards takes **~30–60 seconds** while the container starts. Subsequent
requests are fast. This is normal, not a bug.

The UI already handles it: a network failure against a remote backend says
*"…it may be waking up — try again in a few seconds"* rather than showing a
generic error.

If it bothers you:

- **Keep it warm** — hit `/api/health` every 10 minutes from a free pinger such
  as [cron-job.org](https://cron-job.org). Simple and effective.
- **Use a host that doesn't sleep** — [Fly.io](https://fly.io) has a free
  allowance and its machines wake in about a second rather than a minute. You
  already have container images published to GHCR by CI, so this is mostly
  `fly launch --image ghcr.io/<you>/weather-forecast-app-backend:latest`.
- **Mention it in your README** — for a portfolio project, recruiters understand
  free tiers, and it is one line.

---

## Deploying the container images instead

CI publishes both images to GitHub Container Registry on every push to `main`:

```
ghcr.io/<you>/weather-forecast-app-frontend:latest
ghcr.io/<you>/weather-forecast-app-backend:latest
```

Any host that runs a container can use them directly — Fly.io, Koyeb, Railway,
Google Cloud Run, or a VPS with `docker compose`. The frontend image expects
`BACKEND_ORIGIN` at runtime (where nginx forwards `/api`), and the backend
respects `$PORT`.

---

## Verifying a deployment

```bash
API=https://<your-api>.onrender.com
curl -s "$API/api/health"                      # {"status":"ok"}
curl -s "$API/api/weather?city=Tiruppur" | head -c 200
```

Then open the site and check the browser devtools **Network** tab: requests
should go to your API's origin, and none should be CORS-blocked.
