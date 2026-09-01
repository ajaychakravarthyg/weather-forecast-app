"""Derived "interesting facts" about a location's climate.

Everything here comes from Open-Meteo's **archive** API (ERA5 reanalysis), which
is free and needs no key, just like the forecast endpoints:

    https://archive-api.open-meteo.com/v1/archive

One request covers several years of daily history, and every fact below is
computed from that single payload — year-on-year comparisons, the rainfall
climatology used to name the season, and the seasonal normals.

Nothing here is hardcoded per country. The "monsoon" label, for example, is
earned by a real climatological test (how concentrated the annual rainfall is),
so it appears for Mumbai and not for Manchester without either being special-cased.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from .models import Fact

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# ERA5 lands a few days behind real time; 7 days keeps us clear of the edge.
ARCHIVE_LAG_DAYS = 7
# How many whole years of history to average for the climatology.
CLIMATOLOGY_YEARS = 5
# The comparison window for "vs this time last year".
WINDOW_DAYS = 30
# A month needs at least this many days present to count toward a monthly mean.
MIN_DAYS_IN_MONTH = 25

# --- thresholds for naming the season ------------------------------------- #
# Share of annual rainfall falling in the wettest four consecutive months.
MONSOON_SHARE = 0.7
# ...and the absolute rain those months must deliver, so arid places with a
# lopsided but negligible rainfall year aren't mislabelled as monsoonal.
MONSOON_MIN_MM = 300.0
# Below this annual total the location is simply dry, whatever the distribution.
ARID_ANNUAL_MM = 250.0

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

ARCHIVE_FIELDS = ["temperature_2m_mean", "temperature_2m_max", "precipitation_sum"]


def _shift_year(value: date, delta: int) -> date:
    """Same calendar day, `delta` years away. Feb 29 falls back to Feb 28."""
    try:
        return value.replace(year=value.year + delta)
    except ValueError:
        return value.replace(year=value.year + delta, day=28)


def _mean(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return sum(clean) / len(clean) if clean else None


class Climate:
    """Parsed archive data, indexed for the handful of questions we ask of it."""

    def __init__(self, payload: dict[str, Any]) -> None:
        daily = payload.get("daily") or {}
        times: list[str] = daily.get("time") or []
        means = daily.get("temperature_2m_mean") or []
        maxes = daily.get("temperature_2m_max") or []
        precip = daily.get("precipitation_sum") or []

        self.temp_mean: dict[date, float] = {}
        self.temp_max: dict[date, float] = {}
        self.precip: dict[date, float] = {}

        for index, stamp in enumerate(times):
            try:
                day = date.fromisoformat(stamp)
            except ValueError:
                continue
            if index < len(means) and means[index] is not None:
                self.temp_mean[day] = means[index]
            if index < len(maxes) and maxes[index] is not None:
                self.temp_max[day] = maxes[index]
            if index < len(precip) and precip[index] is not None:
                self.precip[day] = precip[index]

    def window(self, start: date, end: date) -> tuple[float | None, float | None]:
        """(mean temperature, total precipitation) across an inclusive date range."""
        temps: list[float] = []
        rain = 0.0
        seen_rain = False
        day = start
        while day <= end:
            if day in self.temp_mean:
                temps.append(self.temp_mean[day])
            if day in self.precip:
                rain += self.precip[day]
                seen_rain = True
            day += timedelta(days=1)
        return (_mean(temps), rain if seen_rain else None)

    def monthly_rainfall(self) -> dict[int, float]:
        """Average total rainfall per calendar month, across whole months only."""
        totals: dict[tuple[int, int], float] = defaultdict(float)
        counts: dict[tuple[int, int], int] = defaultdict(int)
        for day, value in self.precip.items():
            key = (day.year, day.month)
            totals[key] += value
            counts[key] += 1

        by_month: dict[int, list[float]] = defaultdict(list)
        for (year, month), total in totals.items():
            if counts[(year, month)] >= MIN_DAYS_IN_MONTH:
                by_month[month].append(total)

        return {month: sum(values) / len(values) for month, values in by_month.items() if values}

    def normal_max_around(self, target: date, spread: int = 3) -> float | None:
        """Average daily max for this time of year, ±`spread` days, across all years."""
        values: list[float] = []
        for day, value in self.temp_max.items():
            # Compare on month/day, ignoring the year.
            try:
                same_period = date(day.year, target.month, target.day)
            except ValueError:
                continue
            if abs((day - same_period).days) <= spread:
                values.append(value)
        return _mean(values)


async def fetch_climate(client, latitude: float, longitude: float) -> Climate:
    """One archive request covering the whole climatology period."""
    end = date.today() - timedelta(days=ARCHIVE_LAG_DAYS)
    start = date(end.year - CLIMATOLOGY_YEARS, 1, 1)
    payload = await client.get_archive(
        {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": ",".join(ARCHIVE_FIELDS),
            "timezone": "auto",
        }
    )
    return Climate(payload)


def build_facts(climate: Climate, today_max: float | None = None) -> list[Fact]:
    """Turn the archive into a handful of readable, genuinely local observations."""
    facts: list[Fact] = []

    end = date.today() - timedelta(days=ARCHIVE_LAG_DAYS)
    start = end - timedelta(days=WINDOW_DAYS - 1)
    prev_end = _shift_year(end, -1)
    prev_start = _shift_year(start, -1)

    now_temp, now_rain = climate.window(start, end)
    was_temp, was_rain = climate.window(prev_start, prev_end)

    period = f"{start.strftime('%-d %b')}–{end.strftime('%-d %b')}"

    # ---- year on year: temperature ---------------------------------------- #
    if now_temp is not None and was_temp is not None:
        delta = now_temp - was_temp
        if abs(delta) < 0.3:
            headline = "About as warm as last year"
        else:
            headline = f"{abs(delta):.1f}°C {'warmer' if delta > 0 else 'cooler'} than last year"
        facts.append(
            Fact(
                id="temp-vs-last-year",
                icon="thermometer",
                headline=headline,
                detail=(
                    f"Averaged {now_temp:.1f}°C over {period}, against "
                    f"{was_temp:.1f}°C in the same stretch of {prev_end.year}."
                ),
            )
        )

    # ---- year on year: rainfall ------------------------------------------- #
    if now_rain is not None and was_rain is not None:
        if was_rain < 1 and now_rain < 1:
            headline = "Dry both years"
            detail = f"Barely any rain over {period} in either year."
        elif was_rain < 1:
            headline = "Much wetter than last year"
            detail = f"{now_rain:.0f} mm over {period}, against almost nothing a year ago."
        else:
            change = (now_rain - was_rain) / was_rain * 100
            if abs(change) < 5:
                headline = "Rainfall close to last year"
            else:
                headline = f"{abs(change):.0f}% {'more' if change > 0 else 'less'} rain than last year"
            detail = f"{now_rain:.0f} mm over {period}, against {was_rain:.0f} mm in {prev_end.year}."
        facts.append(Fact(id="rain-vs-last-year", icon="droplet", headline=headline, detail=detail))

    # ---- where this month sits in the local rainfall year ------------------ #
    monthly = climate.monthly_rainfall()
    if len(monthly) >= 12:
        annual = sum(monthly.values())
        ranked = sorted(monthly, key=lambda m: -monthly[m])
        month = end.month
        rank = ranked.index(month) + 1

        # The wettest four *consecutive* months, and how much of the year's rain
        # they carry. A very high share is the defining trait of a monsoon
        # climate, which is why the label is earned rather than hardcoded.
        best_start = max(
            range(12),
            key=lambda s: sum(monthly.get(((s + i) % 12) + 1, 0) for i in range(4)),
        )
        wet_run = [((best_start + i) % 12) + 1 for i in range(4)]
        share = sum(monthly.get(m, 0) for m in wet_run) / annual if annual else 0
        in_wet_run = month in wet_run

        wet_run_total = sum(monthly.get(m, 0) for m in wet_run)
        # A monsoon needs concentration *and* volume. Without the volume floor
        # an arid place like Cairo — where 79% of a near-zero annual total lands
        # in winter — would qualify, which is plainly wrong.
        is_monsoon = share >= MONSOON_SHARE and wet_run_total >= MONSOON_MIN_MM

        if annual < ARID_ANNUAL_MM:
            headline = "Dry here all year round"
        elif is_monsoon and in_wet_run:
            headline = "Monsoon season right now"
        elif is_monsoon:
            headline = "Outside the monsoon months"
        elif rank <= 4:
            headline = "One of the wettest months here"
        elif rank >= 9:
            headline = "One of the driest months here"
        else:
            headline = "A middling month for rain here"

        wettest = MONTHS[ranked[0] - 1]
        second = MONTHS[ranked[1] - 1]
        facts.append(
            Fact(
                id="season",
                icon="calendar",
                headline=headline,
                detail=(
                    f"{MONTHS[month - 1]} ranks {rank} of 12 for rainfall, averaging "
                    f"{monthly[month]:.0f} mm. The wettest months are {wettest} and {second}; "
                    f"{MONTHS_SHORT[wet_run[0] - 1]}–{MONTHS_SHORT[wet_run[-1] - 1]} brings "
                    f"{share * 100:.0f}% of the year's rain."
                ),
            )
        )

    # ---- today against the seasonal normal --------------------------------- #
    normal = climate.normal_max_around(date.today())
    if normal is not None and today_max is not None:
        delta = today_max - normal
        if abs(delta) < 0.5:
            headline = "Right on the seasonal normal"
        else:
            headline = f"{abs(delta):.1f}°C {'above' if delta > 0 else 'below'} the seasonal normal"
        facts.append(
            Fact(
                id="vs-normal",
                icon="chart",
                headline=headline,
                detail=(
                    f"Today peaks at {today_max:.0f}°C. The {CLIMATOLOGY_YEARS}-year average "
                    f"for this point in {MONTHS[date.today().month - 1]} is {normal:.1f}°C."
                ),
            )
        )

    return facts
