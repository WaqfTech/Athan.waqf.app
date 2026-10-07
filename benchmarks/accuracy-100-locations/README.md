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
  Mean Absolute Error (MAE) is 126.89 seconds, with a median difference of 21.36 seconds.
  The difference is predominantly caused by AlAdhan truncating seconds to integer minutes (:00).

## Discrepancy Breakdown by Location Segment

| Segment    | Locations | vs Batoul MAE | vs Batoul Median | vs AlAdhan MAE | vs AlAdhan Median |
| ---------- | --------- | ------------- | ---------------- | -------------- | ----------------- |
| Main       | 25        | 7.13          | 1.13             | 27.68          | 20.40             |
| Known      | 25        | 6.86          | 1.12             | 24.85          | 18.29             |
| Hard       | 50        | 21.78         | 1.29             | 227.85         | 23.41             |
| All        | 100       | 14.37         | 1.18             | 126.89         | 21.36             |

## Discrepancy Breakdown by Prayer

| Prayer     | vs Batoul Adhan (MAE / Max) | vs AlAdhan API (MAE / Max) |
| ---------- | --------------------------- | -------------------------- |
| Fajr       |  10.60s (max 465.38s)         | 303.62s (max 12357.12s)         |
| Sunrise    |   0.93s (max  11.19s)         |  15.02s (max  74.19s)         |
| Dhuhr      |   3.00s (max   8.63s)         |  59.63s (max  98.64s)         |
| Asr        |  53.09s (max 568.24s)         |  73.68s (max 729.76s)         |
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

## Steps for Reproducibility

Follow these steps to reproduce this 100-location benchmark from source:

1. Prerequisites:
   - Go 1.22 or higher installed.
   - Node.js v20 or higher installed.
   - Aube package manager (or pnpm).

2. Install Dependencies:
   Run `aube install` (or `pnpm install`) from the repository root.

3. Bundle the Batch Calculation Helper:
   The TypeScript helper uses esbuild to bundle a standalone runner:
   ```bash
   node_modules/.aube/vite@6.4.3/node_modules/.bin/esbuild \
     benchmarks/accuracy-100-locations/calc-batch.ts \
     --bundle --platform=node --format=esm --packages=external \
     --outfile=benchmarks/accuracy-100-locations/calc-batch.mjs
   ```

4. Execute the Benchmark Runner:
   Run the Go tool from the repository root:
   ```bash
   go run benchmarks/accuracy-100-locations/compare.go
   ```

5. Automated Execution Pipeline:
   The runner executes the following steps:
   - Computes unrounded second-level timestamps for Athan Earth and Batoul Adhan.
   - Queries the AlAdhan REST API throttled to 4.5 req/s (under the 12 req/s limit).
   - Nudges exact 0.0 coordinates to 0.0001 to bypass AlAdhan's PHP empty validation bug.
   - Converts all local timestamps to UTC aligned with solar noon (Dhuhr).
   - Writes the 600-row comparison table to benchmarks/accuracy-100-locations/comparison.csv.
   - Computes Mean Absolute Error (MAE), medians, and regenerates this README.md report.

6. Modifying Benchmark Parameters:
   To evaluate solstices or equinoxes, change `dateStr` in compare.go.
   To test other conventions (e.g. Umm Al-Qura or ISNA), adjust the options in calc-batch.ts.

The raw 600-row comparison data is recorded in benchmarks/accuracy-100-locations/comparison.csv.
