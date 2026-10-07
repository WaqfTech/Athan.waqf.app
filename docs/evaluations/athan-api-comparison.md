# Islamic Prayer Times API Evaluation and Parity Benchmarking Analysis

Batoul Apps Adhan is the most accurate library engine for cross-validation against Athan Earth,
while AlAdhan is the most accessible public REST API despite its coarse minute rounding and
ephemeris limitations.

## Scope and Decision Framing

This evaluation assesses Islamic prayer time calculation engines and API providers to establish
an automated parity verification harness for Athan Earth (athan.waqf.app).

We classify our recommendations by decision type:
- Fact: AlAdhan uses PrayTimes.js v2.3, which rounds times to integer minutes and uses simplified
  solar polynomials without nutation or aberration.
- Fact: IslamicFinder API (api.islamicfinder.us) is defunct and returns an NXDOMAIN error.
- Fact: National authorities in Turkey (Diyanet) and Malaysia (JAKIM) apply administrative safety
  margins (temkin and ihtiyat) that diverge from pure astronomical calculations by design.
- Inference: Discrepancies between Athan Earth and AlAdhan will typically measure between 30 and
  90 seconds at temperate latitudes due to minute rounding and ephemeris truncation.
- Design choice: We recommend a dual-tier benchmarking strategy: an in-process Meeus validator
  using Batoul Apps Adhan for exact second-level checks, and an external AlAdhan REST client
  with a sixty-second tolerance window for ecosystem sanity checking.

Evidence: We verified these conclusions against primary source code repositories, live API
endpoints, official astronomical publications, and religious authority specifications.

## Executive Summary and Technical Ranking

Athan Earth requires an automated cross-validation partner to verify prayer time calculations
across 15,000 global settlements. Our investigation evaluated five categories of providers:
open REST APIs, open-source calculation libraries, defunct legacy APIs, national religious
authorities, and national astronomical observatories.

We rank the evaluated candidates by mathematical accuracy, temporal resolution, and suitability:

1. Athan Earth Observatory Engine (Internal Reference):
   Combines NOAA and Jean Meeus solar ephemerides with a continuous safeguarded Brent root solver.
   Delivers millisecond-level resolution, topological screening at noon and nadir, and typed
   provenance states without artificial minute rounding.

2. Batoul Apps Adhan (Best Automated Validation Engine):
   Implements Jean Meeus Astronomical Algorithms (1998) chapters 12, 13, 15, 22, and 25.
   Models nutation, aberration, and 3-point diurnal transit interpolation. Exposes exact
   second-level timestamps when configured with Rounding.None. It runs in-process with zero
   network latency, zero rate limits, and zero operational failure modes.

3. Official Astronomical Baselines (USNO and NOAA GML):
   Provides the gold standard for pure solar coordinates, transit times, and civil, nautical,
   and astronomical twilights. They lack Islamic prayer logic (Asr shadow ratios, fiqh twilight
   conventions, high-latitude night divisions) and restrict REST output to minute-level resolution.

4. AlAdhan REST API (Best Secondary Sanity Check):
   The most stable and open public REST API available today. It runs PHP on FrankenPHP and Caddy
   behind a Kong gateway, handling up to 12 requests per second with CORS enabled. Its underlying
   PrayTimes v2.3 engine uses low-precision solar polynomials, ignores elevation, truncates
   seconds, and suffers severe mathematical collapse in polar conditions.

5. National Authority APIs (Diyanet, JAKIM, Umm Al-Qura, London Central Mosque):
   Authoritative for local civil compliance, but unsuitable for global astronomical parity.
   They enforce administrative safety margins (temkin, ihtiyat), geopolitical zone grids,
   or pre-computed seasonal timetables that diverge from celestial geometry.

6. IslamicFinder API (Defunct):
   The historical domain api.islamicfinder.us has expired and returns NXDOMAIN. IslamicFinder
   no longer offers an open developer API.

## Architectural and Mathematical Comparison

The following table contrasts the technical characteristics of the primary candidates against
Athan Earth. All table columns align in monospace text.

| Technical Metric     | Athan Earth        | Batoul Adhan       | AlAdhan REST       | USNO / NOAA        |
| -------------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| Ephemeris Standard   | NOAA / Meeus (1998)| Meeus (1998) Ch.25 | Low-order poly     | NOVAS / DE405      |
| Equation of Center   | 3 sine terms + T^2 | 3 sine terms       | 2 sine terms       | Full JPL DE Series |
| Nutation/Aberration  | Fully modeled      | Fully modeled      | Omitted            | Full IAU 2000A     |
| Numerical Solver     | Safeguarded Brent  | 3-point polynomial | 1-step hour angle  | Iterative transit  |
| Solver Convergence   | 100 ms / 0.0001 deg| Analytical fit     | Analytical fit     | Sub-second         |
| Output Resolution    | Milliseconds       | Seconds (Raw mode) | HH:mm (truncated)  | HH:mm (minutes)    |
| Elevation Modeling   | Sea-level horizon  | Sea-level horizon  | Sea-level horizon  | Horizon dip formula|
| Polar Night / Day    | Typed absence flags| Polar resolver     | Time collapse bug  | Explicit flags     |
| Twilight Adjustments | 1/2, 1/7, Angle    | 1/2, 1/7, Angle    | 1/2, 1/7, Angle    | Civil/Naut/Astro   |
| Engine Delivery      | In-process engine  | In-process library | REST (12 req/sec)  | REST / Almanac CLI |
| License / Access     | Native open-source | MIT license        | Free public REST   | Public domain REST |

## Primary Candidate Evaluation: AlAdhan REST API

AlAdhan (api.aladhan.com) is the dominant public REST service for Islamic prayer data, maintained
by the Islamic Network project.

Primary sources:
- Official API Documentation: https://aladhan.com/prayer-times-api
- Backend Engine Package: https://packagist.org/packages/islamic-network/prayer-times
- Upstream Algorithm Specification: http://praytimes.org/calculation

System Architecture and Infrastructure:
Live probing of api.aladhan.com confirms that the service operates behind Kong API Gateway
version 3.9.1, routing requests to FrankenPHP running Caddy. The service enforces an active rate
limit of 12 requests per second per IP address, documented in the HTTP response headers
ratelimit-limit and x-ratelimit-remaining-second. Cross-Origin Resource Sharing (CORS) is enabled
globally with access-control-allow-origin set to wildcard (*).

Algorithmic Analysis:
AlAdhan executes a PHP port of Hamid Zarrabi-Zadeh's PrayTimes.js library (version 2.3).
Inspection of the underlying source code reveals significant astronomical simplifications:
1. Solar Coordinates: Solar position derives from a low-order polynomial approximation:
   Mean anomaly: g = 357.529 + 0.98560028 * D
   Mean longitude: q = 280.459 + 0.98564736 * D
   True longitude: L = q + 1.915 * sin(g) + 0.020 * sin(2g)
   Obliquity: e = 23.439 - 0.00000036 * D
   These equations omit orbital eccentricity perturbations, higher-order secular century terms,
   nutation in longitude and obliquity, and stellar aberration. This introduces angular solar
   position errors of 1 to 2 arcminutes, translating to 4 to 8 seconds of timing drift.

2. Forced Minute Rounding:
   In PrayTimes.js, the formatting method getFormattedTime applies an explicit rounding step:
   time = fixHour(time + 0.5 / 60)
   hours = Math.floor(time)
   minutes = Math.floor((time - hours) * 60)
   Even when requesting iso8601=true from api.aladhan.com, the returned timestamps append :00
   seconds (for example, 2026-10-07T04:58:00+03:00). The output is fundamentally quantized to
   minute intervals, producing up to 30 seconds of discretization error.

3. Absence of Elevation Correction:
   AlAdhan accepts no altitude or elevation parameter. Probing the endpoint with elevation=3000
   yields identical output to elevation=0. The engine assumes an observer at sea level.

4. Polar Breakdown:
   When evaluated at high latitudes where physical crossings do not occur, PrayTimes fails to
   distinguish between physical dawn and missing twilight signs. In Tromso, Norway on the summer
   solstice (2026-06-21), AlAdhan outputs 00:46 for Fajr, Sunrise, Sunset, Maghrib, and Isha.
   On the winter solstice (2026-12-21), it outputs 11:42 for Sunrise, Sunset, Dhuhr, and Maghrib.
   This timestamp collapse stems from dividing by zero when calculating daylight length.

Verdict for Parity Testing:
AlAdhan is valuable for broad sanity checking and integration smoke testing. Its minute rounding
and polar singularities make it unacceptable as a primary mathematical truth source.

## Primary Candidate Evaluation: Batoul Apps Adhan Library

The Adhan library developed by Ameen Soleimani at Batoul Apps is an open-source astronomical
calculation package available for TypeScript, Swift, Kotlin, Java, and Python.

Primary sources:
- JavaScript / TypeScript Repository: https://github.com/batoulapps/adhan-js
- Swift Reference Implementation: https://github.com/batoulapps/Adhan
- Documentation: https://batoulapps.github.io/adhan-js/

Algorithmic Analysis:
Unlike PrayTimes, Batoul Apps Adhan implements the full analytical framework from Jean Meeus,
Astronomical Algorithms (Second Edition, 1998):
1. Precision Ephemeris:
   Solar coordinates are calculated in SolarCoordinates.ts using Julian centuries T since J2000.0.
   The engine computes mean solar longitude, mean lunar longitude, and ascending lunar node.
   It explicitly calculates nutation in longitude (dPsi) and obliquity (dEpsilon), deriving the
   true and apparent obliquity of the ecliptic. It corrects solar longitude for aberration
   (-0.00569 degrees) and nutation, yielding apparent solar right ascension and declination.

2. Diurnal Interpolation:
   In SolarTime.ts, transit and hour angle solutions do not assume a static Sun. The engine
   samples solar coordinates at three distinct epochs: yesterday (julianDay - 1), today
   (julianDay), and tomorrow (julianDay + 1). It applies Meeus chapter 15 interpolation across
   these three coordinates to find the true transit and hour angle crossings.

3. Second-Level Resolution:
   While Adhan defaults to Rounding.Nearest for consumer displays, its architecture exposes
   first-class support for unrounded outputs. In Rounding.ts, the library defines:
   Rounding = { Nearest: 'nearest', Up: 'up', None: 'none' }
   Setting calculationParameters.rounding = Rounding.None causes roundedMinute to apply an offset
   of 0 seconds. The library returns unmodified JavaScript Date objects with exact second-level
   precision.

4. Polar Circle Resolution:
   In PolarCircleResolution.ts, the library implements structured high-latitude strategies:
   - AqrabBalad: Shifts the latitude iteratively by 0.5 degrees down to a safe 65-degree parallel.
   - AqrabYaum: Searches forward and backward through the calendar year to find the closest date
     with valid sunrise and sunset.
   - Unresolved: Returns NaN without fabricating invalid timestamps.

Verdict for Parity Testing:
Batoul Apps Adhan is the single best candidate for automated parity benchmarking against Athan
Earth. It shares our high-precision Meeus ephemeris foundation, supports second-level outputs,
runs in-process without network overhead, and has zero external rate limits.

## Primary Candidate Evaluation: IslamicFinder API

IslamicFinder (islamicfinder.org) historically provided embeddable prayer time widgets and
informal web feeds.

Primary sources:
- Legacy Reference: api.islamicfinder.us
- Official Portal: https://www.islamicfinder.org

Investigation Results:
DNS lookup against api.islamicfinder.us confirms that the domain returns an NXDOMAIN error.
HTTP probes to port 80 and port 443 time out with no network listener. IslamicFinder has retired
its developer API in favor of pre-rendered iframe widgets.

Verdict for Parity Testing:
Defunct. IslamicFinder cannot be used for automated benchmarking or cross-validation.

## National Authority APIs and Administrative Deviations

National religious ministries publish daily prayer schedules for their territories. While legally
binding for their populations, their calculations deviate from pure astronomy.

1. Umm Al-Qura / KACST (Kingdom of Saudi Arabia):
   - Primary source: https://www.ummulqura.org.sa
   - Specification: Fajr at 18.5 degrees solar depression. Dhuhr at solar transit plus safety
     margin. Asr at shadow factor 1 (Shafi). Maghrib at apparent sunset. Isha at a fixed 90-minute
     delay after Maghrib (extended to 120 minutes during Ramadan).
   - API Status: KACST provides no documented public developer REST API. Official times must be
     queried through web portal forms or secondary packages.
   - Parity Value: Athan Earth already includes the UmmAlQura convention profile, which exactly
     reproduces these astronomical parameters.

2. Diyanet İşleri Başkanlığı (Republic of Turkey):
   - Primary source: https://namazvakitleri.diyanet.gov.tr
   - Specification: Diyanet uses an 18-degree Fajr angle and a 17-degree Isha angle, but modifies
     all times using Ottoman administrative safety allowances known as temkin.
     Fajr temkin advances dawn by approximately 7 to 9 minutes. Sunset and Maghrib temkin delays
     the time by approximately 7 minutes. Sunrise temkin delays visible sunrise by 4 to 7 minutes.
   - API Status: Diyanet operates no public developer API. Third-party packages scrape the web
     portal.
   - Parity Value: Pure astronomical algorithms cannot match Diyanet data without applying
     city-specific empirical lookup tables.

3. Department of Islamic Development Malaysia (JAKIM):
   - Primary source: https://www.e-solat.gov.my
   - Specification: Fajr at 20 degrees, Isha at 18 degrees, with 2 to 3 minutes of ihtiyat (safety
     margin) and localized altitude corrections. Malaysia is partitioned into 60 distinct zones
     (such as SGR01 and WLY01), each indexed to a base reference point.
   - API Status: e-Solat publishes zone-based schedules. There is no continuous coordinate API.
     Community wrappers like api.waktusolat.app scrape these static zone tables.
   - Parity Value: Useful only for validating Malaysian zone tables, not for generic global
     coordinate parity.

4. London Unified Prayer Timetable (United Kingdom):
   - Primary source: https://londonprayertimes.com
   - Specification: Established jointly by the London Central Mosque, East London Mosque, and
     local scholars. It combines HM Nautical Almanac Office solar tables with fixed calendar
     adjustments during British summer months when astronomical twilight persists all night.
   - API Status: The London Prayer Times API provides JSON data restricted to London.
   - Parity Value: Local benchmark only.

## Official Astronomical Baselines: NOAA and USNO

To validate celestial mechanics independently of religious fiqh rules, we examined government
astronomical institutions.

1. NOAA Global Monitoring Laboratory (GML):
   - Primary source: https://gml.noaa.gov/grad/solcalc/calcdetails.html
   - Implementation: Spreadsheet and web algorithms derived from Jean Meeus. Computes solar
     declination, equation of time, apparent sunrise, and apparent sunset.
   - Limitation: NOAA retired and archived active support for the GML Solar Calculator. It
     calculates only solar noon and horizon crossings (-0.8333 degrees). It does not compute
     shadow ratios or twilight depression angles.

2. United States Naval Observatory (USNO):
   - Primary source: https://aa.usno.navy.mil/data/api
   - Endpoint: https://aa.usno.navy.mil/api/rstt/oneday?date=YYYY-MM-DD&coords=LAT,LON
   - Implementation: Derives from the Naval Observatory Vector Astrometry Software (NOVAS) and
     the JPL DE405 planetary ephemeris. Sub-arcsecond accuracy.
   - Output: Returns sunrise, sunset, upper transit, and civil, nautical, and astronomical twilight.
   - Limitation: USNO outputs integer minute strings (HH:mm). It does not calculate Asr or custom
     Islamic prayer angles. Network requests from outside North America frequently encounter
     firewall throttling.

## Athan Earth Architecture Compared to External Engines

Athan Earth (athan.waqf.app) implements an advanced astronomical engine optimized for continuous
global simulation:

1. Ephemeris Accuracy:
   Athan Earth implements the NOAA Solar Calculator and Meeus (1998) model with full century
   terms (T and T^2), 3-term Equation of the Center, 5-term Equation of Time, apparent solar
   longitude with nutation and aberration, and true obliquity. Ephemeris error remains below
   0.01 degrees across the 2000-2100 operational envelope.

2. Safeguarded Brent Root Solver:
   Rather than relying on 3-point polynomial interpolation (Batoul Adhan) or static hour angle
   formulas (AlAdhan), Athan Earth computes prayer events by solving the continuous function:
   f(t) = getSolarAltitude(lat, lon, t) - targetAltitude
   The solver brackets the diurnal half-cycle and executes safeguarded Brent iterations combining
   inverse quadratic interpolation, secant steps, and bisection. It halts when the residual
   altitude is within 0.0001 degrees or bracket duration is under 100 milliseconds.

3. Topological Screening and Typed Absence:
   Before numerical root solving, Athan Earth computes solar altitude at local noon (h_noon) and
   local nadir (h_nadir). If the target depression angle is unachievable, the engine returns
   typed absence states:
   - alwaysBelow (polar night)
   - alwaysAbove (midnight sun)
   - grazing (tangent contact)
   This eliminates the division-by-zero errors and fake timestamp collapses found in PrayTimes.

4. Provenance Metadata and High-Latitude Fiqh:
   Every PrayerEntry records an explicit provenance tag: astronomicalSign, fixedInterval,
   highLatitudeAdjustment, or unresolved. When twilight is absent, the engine applies
   MiddleOfTheNight, SeventhOfTheNight, or AngleBased adjustments cleanly, backed by a virtual
   8-hour night fallback during continuous daylight.

5. Global Multi-Settlement Simulation:
   The engine simulates 15,000 settlements across 24-hour windows using sweep-line interval
   trees. It maintains chronological continuity across calendar boundaries without timezone seams.

## Recommended Parity Benchmarking Strategy

We recommend a dual-tier benchmarking architecture for validating Athan Earth:

Tier 1: In-Process High-Precision Parity Suite (Batoul Apps Adhan)
- Implementation: Embed batoulapps/adhan-js directly into the test suite.
- Configuration: Set calculationParameters.rounding = Rounding.None to extract unrounded dates.
- Benchmark Matrix: Run a daily test against 100 globally distributed benchmark coordinates
  spanning equatorial, temperate, sub-polar (55 to 65 degrees), and extreme polar latitudes.
- Acceptance Criteria:
  * Solar noon (Dhuhr base transit): difference must not exceed 2.0 seconds.
  * Sunrise and Sunset (-0.8333 degrees): difference must not exceed 4.0 seconds.
  * Fajr and Isha astronomical crossings: difference must not exceed 6.0 seconds.
  * Discrepancies exceeding 10 seconds indicate ephemeris coordinate drift or interpolation error.

Tier 2: External REST Parity Suite (AlAdhan API)
- Implementation: Build an automated nightly regression test querying api.aladhan.com.
- Rate Limiting: Throttle requests to 5 calls per second to respect the 12 req/sec threshold.
- Benchmark Coordinates: 20 major Islamic population centers (Makkah, Cairo, Istanbul, Jakarta,
  Karachi, London, New York, etc.).
- Acceptance Criteria:
  * Because AlAdhan truncates seconds to integer minutes, timestamps must agree within 60 seconds
    (|t_athan - t_aladhan| <= 60s).
  * High-latitude tests (above 55 degrees) must assert typed absence in Athan Earth and skip
    direct equality checks against AlAdhan's collapsed polar values.

## Primary Sources and Technical Citations

1. AlAdhan API Documentation. Islamic Network, 2026.
   https://aladhan.com/prayer-times-api
2. Islamic Network Prayer Times PHP Engine. Packagist, 2026.
   https://packagist.org/packages/islamic-network/prayer-times
3. PrayTimes Calculation Methods. Hamid Zarrabi-Zadeh, Sharif University of Technology, 2011.
   http://praytimes.org/calculation
4. Batoul Apps Adhan JavaScript Library. Ameen Soleimani, Batoul Apps, 2026.
   https://github.com/batoulapps/adhan-js
5. Jean Meeus. Astronomical Algorithms. Second Edition, Willmann-Bell, Richmond, Virginia, 1998.
   ISBN 0-943396-61-1.
6. NOAA Solar Calculation Details. Earth System Research Laboratories, Global Monitoring
   Laboratory, National Oceanic and Atmospheric Administration.
   https://gml.noaa.gov/grad/solcalc/calcdetails.html
7. U.S. Naval Observatory Astronomical Applications Department API. USNO, Washington D.C.
   https://aa.usno.navy.mil/data/api
8. Umm Al-Qura Calendar System. King Abdulaziz City for Science and Technology (KACST),
   Riyadh, Kingdom of Saudi Arabia.
   https://www.ummulqura.org.sa
9. Presidency of Religious Affairs (Diyanet İşleri Başkanlığı), Ankara, Turkey.
   https://namazvakitleri.diyanet.gov.tr
10. Department of Islamic Development Malaysia (JAKIM), Putrajaya, Malaysia.
    https://www.e-solat.gov.my
11. London Prayer Times and Unified Timetable. Islamic Cultural Centre / London Central Mosque.
    https://londonprayertimes.com
