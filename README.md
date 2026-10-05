# Adhan Earth (athan.waqf.app)

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
