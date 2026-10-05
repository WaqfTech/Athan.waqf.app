# Adhan Earth (athan.waqf.app)

[العربية](README.ar.md) | English

Adhan Earth is an interactive 3D planetary observatory.
It visualizes Earth in space with astronomical solar illumination,
moving Islamic prayer fronts, and continuous global adhan events across 15,000 settlements.

## Key Features

- Astronomical solar position and day-night illumination driven by NOAA and Meeus algorithms.
- Five dynamic prayer front contours: Fajr, Dhuhr, Asr, Maghrib, and Isha.
- Observer directionality placing dawn on rising altitudes and dusk on setting altitudes.
- Afternoon branch Asr front requiring strictly positive solar elevation at local noon.
- Fixed-interval Isha front tracking the time-shifted setting locus for statutory conventions.
- Distinct geometric (0.0 degree) and apparent (-0.833 degree) terminator representations.
- Radiometric Earth shader with planetary macro occlusion and zero direct night illumination.
- Bounded single-scattering atmosphere model fading through twilight with strict night cutoff.
- Safeguarded Brent root solver distinguishing directed crossings from polar night and midnight sun.
- Multi-day temporal windowing across civil dates without static 24-hour addition shortcuts.
- Sweep-line continuity statistics computing exact concurrent adhans from interval endpoints.
- Interactive inspector displaying prayer schedules, provenance badges, and count down timers.
- Support for 10 calculation conventions, 2 madhabs, and 3 high-latitude adjustment rules.
- GPU-instanced point cloud rendering 15,000 populated places at interactive frame rates.
- Zero-backend static client architecture deployable to Cloudflare Workers or static hosts.

## How Our Calculations Differ

Most prayer time calculators and globe visualizers rely on simplified assumptions
that fail at geographical or temporal boundaries. Adhan Earth resolves these issues
by enforcing physical correctness, typed astronomical states, and strict radiometric
rendering:

1. Typed Astronomical Absence Instead of Fabricated Dates:
Standard engines clamp out-of-range trigonometric outputs or return noon or midnight
when the Sun does not cross target elevations. During high-latitude polar night or
midnight sun, this fabricates fictitious sunrise, Maghrib, or Fajr dates. Adhan Earth
treats absence as a first-class typed state (polar night, midnight sun, grazing).
When the Sun does not rise, the system never returns an invented timestamp.

2. Positive Noon Shadow Requirement for Asr:
Conventional software solves the Asr shadow angle using the formula tan(|phi - delta|).
During polar winter, this produces a negative tangent, returning false Asr events below
the horizon or silently falling back to dhuhr plus two hours. Adhan Earth requires a
strictly positive solar elevation at local solar noon before computing Asr, reporting
a typed absence whenever a physical noon shadow cannot form.

3. True Front Directionality and Coordinate Geometry:
Globe renderers often invert prayer curves or misplace afternoon events. Adhan Earth
tracks local hour angles explicitly. Dawn contours (Fajr and Sunrise) advance along
rising solar altitude branches. Dusk contours (Maghrib and Isha) fall along setting
branches. The Asr contour remains locked to the afternoon hemisphere, and fixed-interval
Isha fronts accurately track time-shifted setting lines.

4. Physically Decoupled Shading and Color Management:
Standard WebGL globes use empirical textures or normal perturbations that cause daylight
to bleed into the night hemisphere. Adhan Earth separates direct sunlight from indirect
atmospheric scattering and night emissions. Planetary macro occlusion uses unperturbed
geometric normals, eliminating artificial night albedo floors. Shaders execute Three.js
tone mapping and linear-to-sRGB color management before final display.

5. Multi-Day Civil Windowing and Exact Sweep-Line Continuity:
Common calculators assume the next prayer occurs on the current UTC date or add a static
24 hours. Adhan Earth evaluates absolute multi-day intervals across local civil dates
and timezones to catch early morning transitions such as Tokyo Fajr. Global continuity
metrics calculate exact interval unions with a sweep-line algorithm over 15,000 settlements,
avoiding coarse binning proxies and eliminating false zero minimums.

## Mathematical and Physical Models

Solar Position:
Computes Julian centuries from J2000.0, solar mean anomaly, equation of the center,
true longitude, and apparent longitude corrected for nutation and aberration.
Derives mean and corrected obliquity of the ecliptic, solar declination, and Equation of Time.
The subsolar point uses solar declination as latitude and negative Greenwich Hour Angle as longitude.
Display axes follow Three.js conventions: +Y North, +Z Prime Meridian, and +X 90 degrees East.

Solar Event Root Solver:
Determines solar altitude crossing instants using safeguarded Brent root refinement.
Distinguishes directed crossings from physical absence:
- Crossing: directed altitude crossing refined to sub-second precision.
- Polar night (alwaysBelow): Sun remains below target altitude throughout the diurnal cycle.
- Midnight sun (alwaysAbove): Sun remains above target altitude throughout the diurnal cycle.
- Grazing: tangent contact at solar noon or nadir within numerical tolerance.
- Positive noon shadow validation: enforces strictly positive solar altitude at local noon for Asr.

Prayer Front Geometry:
Evaluates local hour angle H = wrap180(longitude - subsolarLongitude):
- Morning dawn occurs on the rising branch (H < 0, positive altitude time derivative).
- Evening dusk occurs on the setting branch (H > 0, negative altitude time derivative).
- Dhuhr: solar noon meridian arc on the sunlit hemisphere.
- Asr: afternoon shadow locus (H > 0) where shadow length equals noon shadow plus school factor.
- Maghrib: apparent sunset locus (-0.833 degrees solar elevation).
- Fixed-interval Isha: setting locus at t - interval minutes (such as 90 minutes for Umm Al-Qura).
- Geometric terminator: great circle at 0.0 degrees center solar elevation.
- Apparent terminator: small circle at -0.833 degrees center solar elevation.

Radiometric Shading and Atmosphere:
Direct surface illumination uses unperturbed geometric sphere normals for planetary macro occlusion.
The shader eliminates artificial diffuse floors, enforcing zero direct light on the night side.
City night lights use NASA Black Marble photographic imagery active only in the night hemisphere.
The atmosphere model integrates single-scattering Rayleigh transport over spherical shell paths.
Scattering fades from sunset (-0.833 degrees) to astronomical twilight (-18.0 degrees).
Radiance drops to strict zero extinction at and below -18.0 degrees solar elevation.
Fragment shaders execute Three.js tone mapping and linear-to-sRGB color management chunks.

Multi-Day Simulation and Continuity:
The simulation window evaluates adjacent civil dates to handle local day rollovers and timezones.
Continuous coverage statistics use a sweep-line algorithm over exact half-open intervals.
Calculates covered seconds, longest gap, instantaneous peak, and minimum concurrent adhans.

## How We Achieved This

Achieving mathematical and physical integrity required a systematic, research-grade
engineering methodology rather than ad-hoc patches:

1. Research-Lab-Grade Work-Order (R0001):
The overhaul was designed under a rigorous specification contract (documented in
GitHub Issue #5 and docs/R0001_Athan_Evidence_Packet/). The specification cataloged 13
verified defects, 8 baseline failure witnesses, 12 implementation cells (C01 to C12),
and 30 unambiguous acceptance criteria.

2. Multi-Agent Teamwork Execution:
We deployed a multi-agent teamwork architecture where specialized agents managed
distinct phases of delivery. Survey agents mapped existing dependencies, worker agents
implemented focused mathematical and shader modules, and reviewer agents verified
architecture consistency at every milestone.

3. Multi-Tier Adversarial Testing:
We constructed a five-tier test suite containing 761 automated tests across 35 test
files. Adversarial challenger agents authored dedicated tests targeting edge cases,
such as Tromsø seasonal boundaries, polar nadir symmetry, cache pruning limits, and
heavy multi-threaded CPU contention. The full suite runs in under 5 seconds with zero
failures.

4. Independent Victory Audit:
Before landing changes, an independent victory auditor evaluated the codebase against
the original requirements. The audit verified authentic mathematical implementations,
zero mock facades, zero prohibited workflow files, and complete test reproducibility.

5. Open Mathematical Specifications:
We documented all reference frames, Julian date conversions, Meeus and NOAA ephemeris
algorithms, Brent root-solving formulas, and GLSL radiometric equations in
docs/solar-model.md for complete public transparency.

## Continuity Model Disclosures

Notice on Continuity Claims (Criterion A26):
Adhan Earth reports a 100 percent continuity metric under baseline simulation settings.
This figure is a mathematical property of the synthetic simulation model.
The result is explicitly conditional on:
1. The declared dataset of approximately 15,000 populated settlements.
2. The selected astronomical calculation convention, madhab, and high-latitude policy.
3. The nominal assumed adhan duration of 4 minutes per settlement event.

This metric does not constitute an empirical measurement or physical proof
that live audible prayer calls occur without interruption across every point of Earth.
Local mosque practices, terrain masking, microclimates, municipal schedules,
and uninhabited geographical regions are outside the scope of this astronomical model.

## Getting Started

Prerequisites:
- Node.js 22 or higher
- aube, aubr, or pnpm

Installation:
```bash
aube install
# or
pnpm install
```

Development Server:
```bash
aube dev
# or
pnpm dev
```

Run Test Suite:
```bash
aube test
# or
pnpm test
```

Typecheck and Production Build:
```bash
aube build
# or
pnpm build
```

Preview Production Build:
```bash
aube run preview
# or
pnpm preview
```

Cloudflare Deployment:
```bash
aube run deploy:dry
# or deploy
aube run deploy
```

## License

هذا العمل هو وَقْفٌ لله تعالى تحت شروط رُخصة وَقْف الرَّقْمِيَّة العامَّة - الإصدار الأول.
المُستوى المُطَبَّق هو: وَقْفٌ خَيْرِيٌّ مُلْزِمٌ بالإِسْنَادِ (WaqfDPL-Khayri-Mulzim 1.0).

See the [LICENSE.md](LICENSE.md) file for the full license text,
or the [WaqfDPL repository](https://github.com/WaqfTech/waqf-license-draft) for details.
