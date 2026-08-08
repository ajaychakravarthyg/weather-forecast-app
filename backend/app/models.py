"""Pydantic response models — these define the JSON contract the React app consumes.

All values are returned in **metric** units (°C, km/h, hPa, mm). The frontend
converts to imperial on the fly so the °C/°F toggle never needs a refetch.
"""

from pydantic import BaseModel, Field


class Location(BaseModel):
    name: str
    latitude: float
    longitude: float
    timezone: str
    country: str | None = None
    country_code: str | None = None
    admin1: str | None = None  # state / region
    population: int | None = None
    label: str = Field(description='Pretty display name, e.g. "Paris, Île-de-France, France"')


class GeocodeResults(BaseModel):
    results: list[Location]


class CurrentWeather(BaseModel):
    time: str
    temperature: float | None = None
    apparent_temperature: float | None = None
    humidity: int | None = None
    pressure: float | None = None
    wind_speed: float | None = None
    wind_direction: int | None = None
    wind_gusts: float | None = None
    precipitation: float | None = None
    cloud_cover: int | None = None
    visibility: float | None = Field(default=None, description="Metres")
    is_day: bool = True
    weather_code: int | None = None
    description: str
    group: str
    # Convenience fields lifted from today's daily block
    sunrise: str | None = None
    sunset: str | None = None
    uv_index_max: float | None = None
    temp_max: float | None = None
    temp_min: float | None = None
    daylight_duration: float | None = Field(default=None, description="Seconds")


class DailyEntry(BaseModel):
    date: str
    temp_max: float | None = None
    temp_min: float | None = None
    weather_code: int | None = None
    description: str
    group: str
    precipitation_sum: float | None = None
    precipitation_probability: int | None = None
    wind_speed_max: float | None = None
    uv_index_max: float | None = None
    sunrise: str | None = None
    sunset: str | None = None
    daylight_duration: float | None = Field(default=None, description="Seconds")


class HourlyEntry(BaseModel):
    time: str
    temperature: float | None = None
    apparent_temperature: float | None = None
    precipitation_probability: int | None = None
    humidity: int | None = None
    wind_speed: float | None = None
    visibility: float | None = Field(default=None, description="Metres")
    weather_code: int | None = None
    description: str
    group: str
    is_day: bool = True


class Units(BaseModel):
    temperature: str = "°C"
    wind_speed: str = "km/h"
    pressure: str = "hPa"
    precipitation: str = "mm"


class WeatherResponse(BaseModel):
    location: Location
    current: CurrentWeather
    daily: list[DailyEntry]
    hourly: list[HourlyEntry]
    units: Units = Units()


class ErrorResponse(BaseModel):
    detail: str
