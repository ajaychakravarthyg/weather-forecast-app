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

from .models import GeocodeResults, Location, WeatherResponse
from .open_meteo import OpenMeteoClient, WeatherError

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
    label: Annotated[str | None, Query(max_length=120, description="Override the display name")] = None,
    hours: Annotated[int, Query(ge=1, le=48, description="Hours of hourly forecast")] = 24,
) -> WeatherResponse:
    """Forecast for explicit coordinates — used by the "Use my location" button.

    Attempts a free reverse-geocode so the card shows a real place name; falls
    back to the rounded coordinates if that lookup fails.
    """
    location = None
    if label:
        location = Location(name=label, latitude=lat, longitude=lon, timezone="auto", label=label)
    else:
        location = await client.reverse_geocode(lat, lon)

    if location is None:
        fallback = f"{lat:.2f}°, {lon:.2f}°"
        location = Location(name=fallback, latitude=lat, longitude=lon, timezone="auto", label=fallback)

    return await client.forecast(location, hourly_hours=hours)
