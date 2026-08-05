"""WMO weather interpretation codes used by Open-Meteo.

Reference: https://open-meteo.com/en/docs (see "WMO Weather interpretation codes")

Each entry maps a code to a human-readable description plus a coarse "group"
that the frontend uses to pick an icon and a background treatment.
"""

from typing import TypedDict


class WeatherInfo(TypedDict):
    description: str
    group: str


# group is one of:
#   clear | mainly-clear | cloudy | fog | drizzle | rain | freezing
#   snow | showers | thunderstorm
WEATHER_CODES: dict[int, WeatherInfo] = {
    0: {"description": "Clear sky", "group": "clear"},
    1: {"description": "Mainly clear", "group": "mainly-clear"},
    2: {"description": "Partly cloudy", "group": "mainly-clear"},
    3: {"description": "Overcast", "group": "cloudy"},
    45: {"description": "Fog", "group": "fog"},
    48: {"description": "Depositing rime fog", "group": "fog"},
    51: {"description": "Light drizzle", "group": "drizzle"},
    53: {"description": "Moderate drizzle", "group": "drizzle"},
    55: {"description": "Dense drizzle", "group": "drizzle"},
    56: {"description": "Light freezing drizzle", "group": "freezing"},
    57: {"description": "Dense freezing drizzle", "group": "freezing"},
    61: {"description": "Slight rain", "group": "rain"},
    63: {"description": "Moderate rain", "group": "rain"},
    65: {"description": "Heavy rain", "group": "rain"},
    66: {"description": "Light freezing rain", "group": "freezing"},
    67: {"description": "Heavy freezing rain", "group": "freezing"},
    71: {"description": "Slight snowfall", "group": "snow"},
    73: {"description": "Moderate snowfall", "group": "snow"},
    75: {"description": "Heavy snowfall", "group": "snow"},
    77: {"description": "Snow grains", "group": "snow"},
    80: {"description": "Slight rain showers", "group": "showers"},
    81: {"description": "Moderate rain showers", "group": "showers"},
    82: {"description": "Violent rain showers", "group": "showers"},
    85: {"description": "Slight snow showers", "group": "snow"},
    86: {"description": "Heavy snow showers", "group": "snow"},
    95: {"description": "Thunderstorm", "group": "thunderstorm"},
    96: {"description": "Thunderstorm with slight hail", "group": "thunderstorm"},
    99: {"description": "Thunderstorm with heavy hail", "group": "thunderstorm"},
}

_UNKNOWN: WeatherInfo = {"description": "Unknown", "group": "cloudy"}


def describe(code: int | None) -> WeatherInfo:
    """Return description/group for a WMO code, tolerating unexpected values."""
    if code is None:
        return _UNKNOWN
    return WEATHER_CODES.get(int(code), _UNKNOWN)
