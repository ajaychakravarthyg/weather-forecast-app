"""Thin async client + response mapper for the Open-Meteo APIs.

Open-Meteo is free for non-commercial use and needs **no API key**:
  - Geocoding: https://geocoding-api.open-meteo.com/v1/search
  - Forecast:  https://api.open-meteo.com/v1/forecast

Everything the frontend needs is normalised here so the React code never has to
know about Open-Meteo's parallel-arrays response format.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime
from typing import Any

import httpx

from .models import (
    CurrentWeather,
    DailyEntry,
    HourlyEntry,
    Location,
    WeatherResponse,
)
from .weather_codes import describe

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
# Free, key-less reverse geocoder used only to put a friendly name on the
# "Use my location" result. Failure here is non-fatal (we fall back to coords).
REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"

CURRENT_FIELDS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "weather_code",
    "cloud_cover",
    "pressure_msl",
    "surface_pressure",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
]

HOURLY_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "relative_humidity_2m",
    "wind_speed_10m",
    # Visibility is hourly-only in Open-Meteo — the "current" block has no
    # equivalent, so we lift the current hour's value into it ourselves.
    "visibility",
    "weather_code",
    "is_day",
]

DAILY_FIELDS = [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "sunrise",
    "sunset",
    "daylight_duration",
    "precipitation_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "uv_index_max",
]


class WeatherError(Exception):
    """Base class for errors we want to surface to the client as clean JSON."""

    status_code = 502
    message = "Weather service error"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message


class CityNotFound(WeatherError):
    status_code = 404
    message = "City not found"


class UpstreamUnavailable(WeatherError):
    status_code = 503
    message = "Weather provider is unavailable right now. Please try again."


# --------------------------------------------------------------------------- #
# A tiny in-process TTL cache. Keeps us well inside Open-Meteo's free-tier
# limits and makes repeat searches feel instant. Good enough for a single
# container; swap for Redis if this ever needs to scale horizontally.
# --------------------------------------------------------------------------- #
class TTLCache:
    def __init__(self, ttl_seconds: float, max_entries: int = 512) -> None:
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at < time.monotonic():
                self._data.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            if len(self._data) >= self.max_entries:
                # Cheap eviction: drop whatever expires soonest.
                oldest = min(self._data, key=lambda k: self._data[k][0])
                self._data.pop(oldest, None)
            self._data[key] = (time.monotonic() + self.ttl, value)


_forecast_cache = TTLCache(ttl_seconds=600)  # 10 minutes
_geocode_cache = TTLCache(ttl_seconds=86_400)  # 24 hours — city coords never move


class OpenMeteoClient:
    """Wraps a single shared httpx.AsyncClient for the app's lifetime."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def _get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            # Open-Meteo returns {"error": true, "reason": "..."} on bad input.
            reason = None
            try:
                reason = exc.response.json().get("reason")
            except Exception:  # noqa: BLE001 - body may not be JSON
                pass
            raise WeatherError(reason or f"Weather provider returned {exc.response.status_code}") from exc
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise UpstreamUnavailable() from exc

    # ----------------------------- geocoding ------------------------------ #
    async def geocode(self, query: str, count: int = 5) -> list[Location]:
        """Resolve a city name to a list of candidate locations."""
        query = query.strip()
        if not query:
            raise CityNotFound("Please enter a city name")

        cache_key = f"geo:{query.lower()}:{count}"
        if (cached := await self._geo_cached(cache_key)) is not None:
            return cached

        payload = await self._get_json(
            GEOCODING_URL,
            {"name": query, "count": count, "language": "en", "format": "json"},
        )
        results = [_to_location(item) for item in payload.get("results") or []]
        if not results:
            raise CityNotFound(f'No city found matching "{query}"')

        await _geocode_cache.set(cache_key, results)
        return results

    @staticmethod
    async def _geo_cached(key: str) -> list[Location] | None:
        return await _geocode_cache.get(key)

    async def reverse_geocode(self, latitude: float, longitude: float) -> Location | None:
        """Best-effort name for a coordinate pair. Returns None on any failure."""
        cache_key = f"rev:{latitude:.3f},{longitude:.3f}"
        if (cached := await _geocode_cache.get(cache_key)) is not None:
            return cached
        try:
            payload = await self._get_json(
                REVERSE_GEOCODE_URL,
                {"latitude": latitude, "longitude": longitude, "localityLanguage": "en"},
            )
        except WeatherError:
            return None

        name = payload.get("city") or payload.get("locality") or payload.get("principalSubdivision")
        if not name:
            return None

        location = Location(
            name=name,
            latitude=latitude,
            longitude=longitude,
            timezone="auto",
            country=payload.get("countryName"),
            country_code=payload.get("countryCode"),
            admin1=payload.get("principalSubdivision"),
            label=_join_label(name, payload.get("principalSubdivision"), payload.get("countryName")),
        )
        await _geocode_cache.set(cache_key, location)
        return location

    # ------------------------------ forecast ------------------------------ #
    async def forecast(self, location: Location, hourly_hours: int = 24) -> WeatherResponse:
        cache_key = f"fc:{location.latitude:.4f},{location.longitude:.4f}"
        payload = await _forecast_cache.get(cache_key)
        if payload is None:
            payload = await self._get_json(
                FORECAST_URL,
                {
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "current": ",".join(CURRENT_FIELDS),
                    "hourly": ",".join(HOURLY_FIELDS),
                    "daily": ",".join(DAILY_FIELDS),
                    "timezone": "auto",
                    "forecast_days": 7,
                },
            )
            await _forecast_cache.set(cache_key, payload)

        return build_weather_response(location, payload, hourly_hours=hourly_hours)


# --------------------------------------------------------------------------- #
# Mapping helpers
# --------------------------------------------------------------------------- #
def _join_label(*parts: str | None) -> str:
    """Join the non-empty, non-duplicate parts of a place name with commas."""
    seen: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return ", ".join(seen)


def _to_location(item: dict[str, Any]) -> Location:
    name = item["name"]
    return Location(
        name=name,
        latitude=item["latitude"],
        longitude=item["longitude"],
        timezone=item.get("timezone") or "auto",
        country=item.get("country"),
        country_code=item.get("country_code"),
        admin1=item.get("admin1"),
        population=item.get("population"),
        label=_join_label(name, item.get("admin1"), item.get("country")),
    )


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _hourly_start_index(times: list[str], current_time: str | None) -> int:
    """Index of the first hourly slot at or after the current local hour."""
    now = _parse_iso(current_time)
    if now is None:
        return 0
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    for index, stamp in enumerate(times):
        parsed = _parse_iso(stamp)
        if parsed is not None and parsed >= current_hour:
            return index
    return 0


def _at(values: list[Any] | None, index: int) -> Any:
    """Safe indexed read — Open-Meteo omits arrays it has no data for."""
    if not values or index >= len(values):
        return None
    return values[index]


def build_weather_response(
    location: Location,
    payload: dict[str, Any],
    hourly_hours: int = 24,
) -> WeatherResponse:
    """Flatten Open-Meteo's parallel arrays into the frontend's JSON shape."""
    current_raw: dict[str, Any] = payload.get("current") or {}
    daily_raw: dict[str, Any] = payload.get("daily") or {}
    hourly_raw: dict[str, Any] = payload.get("hourly") or {}

    # The resolved IANA timezone comes back on the forecast response — prefer it
    # over the geocoder's value (and it's the only source when reverse-geocoding).
    resolved_timezone = payload.get("timezone") or location.timezone
    location = location.model_copy(update={"timezone": resolved_timezone})

    # ------------------------------- daily -------------------------------- #
    daily: list[DailyEntry] = []
    for index, date in enumerate(daily_raw.get("time") or []):
        code = _at(daily_raw.get("weather_code"), index)
        info = describe(code)
        daily.append(
            DailyEntry(
                date=date,
                temp_max=_at(daily_raw.get("temperature_2m_max"), index),
                temp_min=_at(daily_raw.get("temperature_2m_min"), index),
                weather_code=code,
                description=info["description"],
                group=info["group"],
                precipitation_sum=_at(daily_raw.get("precipitation_sum"), index),
                precipitation_probability=_at(daily_raw.get("precipitation_probability_max"), index),
                wind_speed_max=_at(daily_raw.get("wind_speed_10m_max"), index),
                uv_index_max=_at(daily_raw.get("uv_index_max"), index),
                sunrise=_at(daily_raw.get("sunrise"), index),
                sunset=_at(daily_raw.get("sunset"), index),
                daylight_duration=_at(daily_raw.get("daylight_duration"), index),
            )
        )

    # ------------------------------ hourly -------------------------------- #
    times: list[str] = hourly_raw.get("time") or []
    start = _hourly_start_index(times, current_raw.get("time"))
    hourly: list[HourlyEntry] = []
    for index in range(start, min(start + hourly_hours, len(times))):
        code = _at(hourly_raw.get("weather_code"), index)
        info = describe(code)
        hourly.append(
            HourlyEntry(
                time=times[index],
                temperature=_at(hourly_raw.get("temperature_2m"), index),
                apparent_temperature=_at(hourly_raw.get("apparent_temperature"), index),
                precipitation_probability=_at(hourly_raw.get("precipitation_probability"), index),
                humidity=_at(hourly_raw.get("relative_humidity_2m"), index),
                wind_speed=_at(hourly_raw.get("wind_speed_10m"), index),
                visibility=_at(hourly_raw.get("visibility"), index),
                weather_code=code,
                description=info["description"],
                group=info["group"],
                is_day=bool(_at(hourly_raw.get("is_day"), index)),
            )
        )

    # ------------------------------ current ------------------------------- #
    code = current_raw.get("weather_code")
    info = describe(code)
    today = daily[0] if daily else None
    current = CurrentWeather(
        time=current_raw.get("time") or "",
        temperature=current_raw.get("temperature_2m"),
        apparent_temperature=current_raw.get("apparent_temperature"),
        humidity=current_raw.get("relative_humidity_2m"),
        pressure=current_raw.get("pressure_msl") or current_raw.get("surface_pressure"),
        wind_speed=current_raw.get("wind_speed_10m"),
        wind_direction=current_raw.get("wind_direction_10m"),
        wind_gusts=current_raw.get("wind_gusts_10m"),
        precipitation=current_raw.get("precipitation"),
        cloud_cover=current_raw.get("cloud_cover"),
        # Visibility has no "current" equivalent upstream — borrow the value from
        # the hourly slot that covers right now.
        visibility=_at(hourly_raw.get("visibility"), start),
        is_day=bool(current_raw.get("is_day", 1)),
        weather_code=code,
        description=info["description"],
        group=info["group"],
        sunrise=today.sunrise if today else None,
        sunset=today.sunset if today else None,
        uv_index_max=today.uv_index_max if today else None,
        temp_max=today.temp_max if today else None,
        temp_min=today.temp_min if today else None,
        daylight_duration=today.daylight_duration if today else None,
    )

    return WeatherResponse(location=location, current=current, daily=daily, hourly=hourly)
