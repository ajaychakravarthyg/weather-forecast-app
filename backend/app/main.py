"""FastAPI application exposing a clean weather API backed by Open-Meteo.

Endpoints
---------
GET /api/health                        liveness probe (used to warm Render's free dyno)
GET /api/geocode?q=...&count=5         city name -> candidate locations (search dropdown)
GET /api/weather?city=...              one-shot: geocode + forecast for the best match
GET /api/weather/coords?lat=&lon=      forecast for explicit coordinates (geolocation button)

Run locally:  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Annotated, AsyncIterator

import httpx
from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .insights import build_facts, fetch_climate
from .models import GeocodeResults, InsightsResponse, Location, WeatherResponse
from .open_meteo import OpenMeteoClient, WeatherError, join_label

# ----------------------------------------------------------------------------- #
# Configuration
# ----------------------------------------------------------------------------- #
# Comma-separated list of allowed browser origins. Vite dev servers are allowed
# by default; add your Vercel URL via the ALLOWED_ORIGINS env var on Render, e.g.
#   ALLOWED_ORIGINS=https://my-weather.vercel.app
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",  # `vite preview`
    "http://127.0.0.1:4173",
]
_env_origins = [o.strip().rstrip("/") for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = DEFAULT_ORIGINS + _env_origins

# Any Vercel preview/production deployment of this project. Vercel gives every
# push its own subdomain, so a regex beats maintaining an explicit list.
ALLOWED_ORIGIN_REGEX = os.getenv("ALLOWED_ORIGIN_REGEX", r"https://.*\.vercel\.app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create one shared HTTP client for the process, and close it on shutdown."""
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12.0, connect=5.0),
        headers={"User-Agent": "weather-dashboard/1.0 (+https://github.com)"},
        follow_redirects=True,
    ) as client:
        app.state.open_meteo = OpenMeteoClient(client)
        yield


app = FastAPI(
    title="Weather Dashboard API",
    description="A free, key-less weather API. Wraps Open-Meteo for the React dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(WeatherError)
async def weather_error_handler(_: Request, exc: WeatherError) -> JSONResponse:
    """Turn our domain errors into the {"detail": "..."} shape the UI expects."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


def get_client(request: Request) -> OpenMeteoClient:
    return request.app.state.open_meteo


ClientDep = Annotated[OpenMeteoClient, Depends(get_client)]


# ----------------------------------------------------------------------------- #
# Routes
# ----------------------------------------------------------------------------- #
@app.get("/api/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Cheap liveness check. Ping this to wake a sleeping Render free instance."""
    return {"status": "ok"}


@app.get("/api/geocode", response_model=GeocodeResults, tags=["weather"])
async def geocode(
    client: ClientDep,
    q: Annotated[str, Query(min_length=1, max_length=100, description="City name to search for")],
    count: Annotated[int, Query(ge=1, le=10, description="Max number of matches")] = 5,
) -> GeocodeResults:
    """Autocomplete-style city lookup. Powers the search dropdown."""
    return GeocodeResults(results=await client.geocode(q, count=count))


@app.get("/api/weather", response_model=WeatherResponse, tags=["weather"])
async def weather_by_city(
    client: ClientDep,
    city: Annotated[str, Query(min_length=1, max_length=100, description="City name")],
    hours: Annotated[int, Query(ge=1, le=48, description="Hours of hourly forecast")] = 24,
) -> WeatherResponse:
    """Geocode `city`, then return the full forecast for the best match."""
    matches = await client.geocode(city, count=1)
    return await client.forecast(matches[0], hourly_hours=hours)


@app.get("/api/weather/coords", response_model=WeatherResponse, tags=["weather"])
async def weather_by_coords(
    client: ClientDep,
    lat: Annotated[float, Query(ge=-90, le=90, description="Latitude")],
    lon: Annotated[float, Query(ge=-180, le=180, description="Longitude")],
    name: Annotated[str | None, Query(max_length=120, description="Place name")] = None,
    admin1: Annotated[str | None, Query(max_length=120, description="State / region")] = None,
    country: Annotated[str | None, Query(max_length=120, description="Country name")] = None,
    country_code: Annotated[str | None, Query(max_length=2, description="ISO-3166 alpha-2")] = None,
    label: Annotated[str | None, Query(max_length=160, description="Full display label")] = None,
    hours: Annotated[int, Query(ge=1, le=48, description="Hours of hourly forecast")] = 24,
) -> WeatherResponse:
    """Forecast for explicit coordinates — used by "Use my location", by the
    search dropdown, and when restoring the last place on startup.

    Callers that already know the place pass its parts back (`name`, `admin1`,
    `country`…), so the card renders identically to the original lookup. That
    round-trip matters: passing only a flat `label` would collapse
    "Tiruppur / Tamil Nadu, India" into a single run-on city name.

    With nothing but coordinates we attempt a free reverse-geocode, and fall
    back to the rounded coordinates if that fails too.
    """
    location = None
    if name:
        location = Location(
            name=name,
            latitude=lat,
            longitude=lon,
            timezone="auto",
            admin1=admin1,
            country=country,
            country_code=country_code,
            label=label or join_label(name, admin1, country),
        )
    elif label:
        location = Location(name=label, latitude=lat, longitude=lon, timezone="auto", label=label)
    else:
        location = await client.reverse_geocode(lat, lon)

    if location is None:
        fallback = f"{lat:.2f}°, {lon:.2f}°"
        location = Location(name=fallback, latitude=lat, longitude=lon, timezone="auto", label=fallback)

    return await client.forecast(location, hourly_hours=hours)


@app.get("/api/insights", response_model=InsightsResponse, tags=["weather"])
async def insights(
    client: ClientDep,
    lat: Annotated[float, Query(ge=-90, le=90, description="Latitude")],
    lon: Annotated[float, Query(ge=-180, le=180, description="Longitude")],
    tmax: Annotated[
        float | None,
        Query(description="Today's forecast high, to compare against the seasonal normal"),
    ] = None,
) -> InsightsResponse:
    """Climate context for a location, derived from several years of ERA5 history.

    Deliberately fails soft: this panel is a bonus, so an archive outage returns
    an empty list and the UI simply hides the card rather than breaking the page.
    """
    try:
        climate = await fetch_climate(client, lat, lon)
        return InsightsResponse(facts=build_facts(climate, today_max=tmax))
    except WeatherError:
        return InsightsResponse(facts=[])
