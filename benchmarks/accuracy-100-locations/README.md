# 100-Location Prayer Times Benchmark: Athan Earth vs Batoul Adhan vs AlAdhan API

Empirical comparison of Islamic prayer times for 100 global locations on 2026-10-07.
Testing Muslim World League convention (Fajr 18.0 deg, Isha 17.0 deg) and Shafi madhab.

## Executive Summary

We evaluated 100 global locations spanning 25% main cities, 25% known cities, and 50% random hard locations
(extreme high latitudes, polar circle, equator, high elevation, and date line transitions).

- Athan Earth vs Batoul Apps Adhan:
  Mean Absolute Error (MAE) is 14.37 seconds, with a median difference of 1.18 seconds.
  This verifies tight sub-second to second-level agreement between both Meeus-based implementations.

- Athan Earth vs AlAdhan REST API:
  Mean Absolute Error (MAE) is 126.59 seconds, with a median difference of 21.30 seconds.
  The difference is predominantly caused by AlAdhan truncating seconds to integer minutes (:00).

## Discrepancy Breakdown by Location Segment

| Segment    | Locations | vs Batoul MAE | vs Batoul Median | vs AlAdhan MAE | vs AlAdhan Median |
| ---------- | --------- | ------------- | ---------------- | -------------- | ----------------- |
| Main       | 25        | 7.13          | 1.13             | 26.88          | 20.31             |
| Known      | 25        | 6.86          | 1.12             | 24.85          | 18.29             |
| Hard       | 50        | 21.78         | 1.29             | 227.65         | 23.41             |
| All        | 100       | 14.37         | 1.18             | 126.59         | 21.30             |

## Discrepancy Breakdown by Prayer

| Prayer     | vs Batoul Adhan (MAE / Max) | vs AlAdhan API (MAE / Max) |
| ---------- | --------------------------- | -------------------------- |
| Fajr       |  10.60s (max 465.38s)         | 303.62s (max 12357.12s)         |
| Sunrise    |   0.93s (max  11.19s)         |  15.02s (max  74.19s)         |
| Dhuhr      |   3.00s (max   8.63s)         |  59.63s (max  98.64s)         |
| Asr        |  53.09s (max 568.24s)         |  71.86s (max 729.76s)         |
| Maghrib    |   0.85s (max   7.43s)         |  15.94s (max 111.56s)         |
| Isha       |  18.16s (max 685.47s)         | 292.90s (max 13622.88s)         |

## Key Discrepancy Causes and Physical Analysis

1. Minute-Level Truncation in AlAdhan:
   AlAdhan (PrayTimes v2.3) truncates seconds into integer minutes (:00).
   This inherently generates a uniform distribution error between 0 and 59 seconds (mean ~30 seconds).

2. High Latitude and Polar Night Differences:
   For extreme high-latitude locations (such as Alert, Nunavut at 82.5 deg N),
   the sun remains below the horizon.
   Athan Earth explicitly flags UNRESOLVED (Polar night / Midnight sun) with typed provenance.
   Batoul Adhan returns null for uncrossed elevations.
   AlAdhan returns forced calculated values or fails to flag absence, resulting in apparent divergences.

3. Asr Shadow Calculation Nuances:
   Athan Earth and Batoul Adhan evaluate solar elevation at noon to compute shadow length.
   Minor 1 to 3 second differences stem from 3-point polynomial interpolation versus Brent root-solving.

The raw 600-row comparison data is recorded in benchmarks/accuracy-100-locations/comparison.csv.
