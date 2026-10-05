# Solar Position and Astronomical Calculation Model

Technical specification for Adhan Earth Observatory astronomical and physical models.

## Scope and Purpose

This document specifies the astronomical, mathematical, and radiometric models in Adhan Earth.
It documents coordinate reference frames, solar ephemeris algorithms, event root solving,
fiqh calculation rules, prayer front contours, Earth shading, and simulation continuity.

## Coordinate Reference Frames and Planetary Constants

Terrestrial coordinates use geographic latitude and east-positive longitude in degrees.
Latitudes range from -90.0 degrees (South Pole) to +90.0 degrees (North Pole).
Longitudes range from -180.0 degrees to +180.0 degrees.
Angles normalize through the function wrap180(x) = ((x + 180) mod 360) - 180.

Three.js 3D space uses a right-handed Cartesian coordinate system:
- +Y axis points toward the Geographic North Pole.
- +Z axis points toward the Prime Meridian (0 degrees latitude, 0 degrees longitude).
- +X axis points toward 90 degrees East longitude on the equator.
- Earth sphere radius is set to 5.0 units in 3D world coordinates.

Cartesian coordinates for latitude phi and longitude lambda on a sphere of radius R are:
x = R * cos(phi) * sin(lambda)
y = R * sin(phi)
z = R * cos(phi) * cos(lambda)

## Solar Ephemeris and Ephemeris Time

The solar position engine implements algorithms from the NOAA Solar Calculator
and Jean Meeus, Astronomical Algorithms (Second Edition, 1998).

1. Julian Centuries:
From UTC Date, derive Julian Date JD.
Compute Julian centuries T elapsed since J2000.0 (JD 2451545.0):
T = (JD - 2451545.0) / 36525.0

2. Geometric Mean Longitude:
L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T^2 (degrees mod 360)

3. Geometric Mean Anomaly:
M = 357.52911 + 35999.05029 * T - 0.0001537 * T^2 (degrees mod 360)

4. Earth Orbital Eccentricity:
e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T^2

5. Sun Equation of the Center:
C = sin(M) * (1.914602 - 0.004817 * T + 0.000014 * T^2)
  + sin(2M) * (0.019993 - 0.000101 * T)
  + sin(3M) * 0.000289 (degrees)

6. Apparent Solar Longitude:
True longitude: L_true = L0 + C
Moon ascending node longitude: omega = 125.04 - 1934.136 * T
Apparent longitude: lambda_app = L_true - 0.00569 - 0.00478 * sin(omega)

7. Obliquity of the Ecliptic:
Mean obliquity: eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
Corrected obliquity: eps = eps0 + 0.00256 * cos(omega)

8. Solar Declination:
delta = asin(sin(eps) * sin(lambda_app))

9. Equation of Time:
y = tan(eps / 2)^2
EoT = 4 * (y * sin(2*L0) - 2*e * sin(M) + 4*e*y * sin(M) * cos(2*L0)
      - 0.5 * y^2 * sin(4*L0) - 1.25 * e^2 * sin(2*M)) (minutes of time)

10. Subsolar Coordinates:
Latitude equals solar declination delta.
Longitude equals (12.0 - UTC_hours) * 15.0 - EoT / 4.0 (degrees mod 180).

Accuracy envelope: maximum error within 0.01 degrees of standard ephemeris reference data
over the operational interval 2000 to 2100.

## Safeguarded Brent Root Solver and Event Topology

Solar crossing calculations find roots of the function:
f(t) = getSolarAltitude(lat, lon, t) - targetAltitude

The root engine runs in two stages:

1. Topological screening:
Calculates solar altitude at local solar noon (h_noon) and local nadir (h_nadir).
Let h_max = max(h_noon, h_nadir) and h_min = min(h_noon, h_nadir).
With tolerance epsilon = 0.005 degrees:
- Target altitude > h_max + epsilon: returns alwaysBelow (polar night).
- Target altitude < h_min - epsilon: returns alwaysAbove (midnight sun).
- Target altitude within epsilon of h_max or h_nadir: returns grazing tangent event.

2. Safeguarded Brent root refinement:
When topological screening confirms a crossing, the engine brackets the diurnal half-cycle.
The search interval spans from solar noon to nadir (setting) or nadir to noon (rising).
Brent method combines inverse quadratic interpolation, secant steps, and bisection.
The solver stops when residual altitude is within 0.0001 degrees
or temporal bracket duration is within 100 milliseconds.

The solver returns a typed SolarEventResult object:
- Crossing: includes resolved Date, direction, actual altitude, and local hour angle.
- AlwaysBelow and AlwaysAbove: date is null, includes min and max altitude bounds.
- Grazing: includes tangent Date, tangent altitude, and hour angle.
- Indeterminate or Invalid: date is null, includes descriptive failure reason.

## Fiqh Calculation Engine and High-Latitude Rules

Prayer times derive from astronomical criteria and statutory offsets:

1. Dhuhr:
Local solar noon plus convention safety offset (default 1 minute).
Local solar noon corresponds to transit of the Sun across the observer meridian.

2. Sunrise and Sunset:
Solar altitude crosses -0.8333 degrees (rising for sunrise, setting for sunset).
This threshold includes 16 arcminutes solar semi-diameter and 34 arcminutes refraction.

3. Asr:
Requires positive solar altitude at local noon (h_noon > 0).
Calculates noon shadow ratio of a vertical gnomon: S_noon = tan(|lat - delta|).
If h_noon <= 0, no physical shadow exists; Asr returns unresolved with provenance label.
If h_noon > 0, required solar altitude is h_asr = atan(1 / (S_noon + factor)).
Factor is 1 for Shafi, Maliki, and Hanbali schools; factor is 2 for Hanafi school.
The solver searches strictly along the afternoon setting branch (H > 0).

4. Maghrib:
Occurs at apparent sunset (-0.8333 degrees) or explicit dusk angle (such as Tehran).

5. Fajr and Isha Astronomical Signs:
Fajr occurs at morning dawn crossing of -fajrAngle.
Isha occurs at evening dusk crossing of -ishaAngle for angle-based conventions.

6. Fixed-Interval Isha:
For conventions using statutory delays (Umm Al-Qura and Qatar):
Isha = Maghrib + ishaIntervalMinutes (default 90 minutes).
Provenance is marked fixedInterval.

7. High-Latitude Adjustments:
When twilight crossings do not occur (polar night or summer persistent twilight):
- MiddleOfTheNight: divides night length by 2 (fraction = 1/2).
- SeventhOfTheNight: divides night length by 7 (fraction = 1/7).
- AngleBased: scales night proportion by twilight angle (fraction = angle / 60.0).
Night length equals 24 hours minus daylight duration between sunrise and sunset.
If sunrise and sunset do not occur, a virtual 8-hour night centered at nadir is used.

8. Assignment Provenance:
Each prayer entry returns a typed provenance field:
- astronomicalSign: direct physical solar altitude crossing.
- fixedInterval: statutory interval relative to another prayer time.
- highLatitudeAdjustment: adjustment applied due to missing twilight signs.
- unresolved: solar sign physically absent without applicable policy.

Supported Conventions:
- MuslimWorldLeague (Fajr 18.0 deg, Isha 17.0 deg)
- UmmAlQura (Fajr 18.5 deg, Isha fixed 90 min)
- Egyptian (Fajr 19.5 deg, Isha 17.5 deg)
- Karachi (Fajr 18.0 deg, Isha 18.0 deg)
- NorthAmerica (Fajr 15.0 deg, Isha 15.0 deg)
- Dubai (Fajr 18.2 deg, Isha 18.2 deg)
- Qatar (Fajr 18.0 deg, Isha fixed 90 min)
- Kuwait (Fajr 18.0 deg, Isha 17.5 deg)
- Singapore (Fajr 20.0 deg, Isha 18.0 deg)
- Turkey (Fajr 18.0 deg, Isha 17.0 deg)

## Prayer Front Geometry and Observer Directionality

Prayer fronts represent instantaneous curves on the globe where a prayer begins.

1. Local Hour Angle:
For any observer at longitude lambda, local hour angle H relative to subsolar point is:
H = wrap180(lambda - subsolarLongitude)
- H < 0 defines the morning side (rising Sun, dh/dt > 0).
- H > 0 defines the afternoon and evening side (falling Sun, dh/dt < 0).

2. Altitude Arcs:
Fajr and Sunrise fronts sample the dawn half-arc where H < 0.
Maghrib and Isha fronts sample the dusk half-arc where H > 0.
Points sample sequentially along circle angular parameter alpha, avoiding zig-zag artifacts.

3. Asr Front:
Evaluated across latitude slices from -89.5 to +89.5 degrees.
Filters out latitudes where local noon solar altitude is not strictly positive.
Places the contour strictly on the afternoon branch (H > 0):
lambda_asr = wrap180(subsolarLongitude + hourAngleDeg).

4. Fixed-Interval Isha Front:
Constructed by evaluating the dusk setting arc at time t - interval minutes.
If subsolar coordinate at t - interval is unavailable,
subsolar longitude rotates eastward by interval * 0.25 degrees.

5. Terminators:
- Geometric terminator: altitude 0.0 degrees (solar center on horizon).
- Apparent terminator: altitude -0.833 degrees (solar upper limb touching apparent horizon).

## Radiometric Shading and Atmosphere Pipeline

1. Planetary Macro Occlusion:
Direct solar illumination uses the unperturbed sphere normal geomNormal.
dotMacro = dot(geomNormal, sunDirection)
directOcclusion = smoothstep(0.0, 0.025, dotMacro)
Direct occlusion is strictly zero when dotMacro <= 0.
Micro-bump normals perturb reflection only where directOcclusion > 0.
This eliminates sunlight leakage across the night hemisphere.

2. Night Emissions:
City night light textures are modulated by:
nightFactor = 1.0 - smoothstep(-0.03, 0.03, dotMacro)
Lights activate only on the night side of the planetary horizon.

3. Bounded Atmosphere Model:
Atmosphere outer shell extends to radius R_atm = 1.022 * R_earth.
Rayleigh scattering phase function: phase = 0.75 * (1.0 + cosPsi^2).
Twilight illumination decays quadratically between sunset (-0.833 deg) and night (-18.0 deg).
Strict extinction cutoff:
if dot(geomNormal, sunDirection) <= sin(-18.0 degrees), radiance = vec4(0.0).

4. Color Management:
All custom shaders include Three.js chunk tonemapping_fragment and colorspace_fragment.
Textures decode from sRGB to linear on upload.
Linear radiance composites directly before final display transformation.

## Simulation Windowing and Sweep-Line Continuity

1. Multi-Day Temporal Windowing:
To avoid missing prayer times across civil dates and timezones (such as Tokyo or Samoa),
the engine evaluates a window spanning the observer local date and adjacent dates.
Ephemeris positions are recalculated per date without static 24-hour addition shortcuts.

2. Sweep-Line Continuity:
Calculates concurrency across 15,000 settlements over a 24-hour window (86,400 seconds).
Each settlement event produces a half-open time interval [startSec, endSec).
Start and end boundary events sort chronologically.
Simultaneous endpoints collapse into net concurrency deltas.
The sweep determines:
- coveredSeconds: total seconds where concurrency > 0.
- longestGapSeconds: maximum duration where concurrency == 0.
- peakConcurrency: maximum concurrent adhans.
- minConcurrency: minimum concurrent adhans across all interval points.

3. Qualification Statement:
Continuous coverage metrics reflect synthetic model outputs under specific input parameters.
They do not represent real-time sensor measurements or audible monitoring of physical mosques.
