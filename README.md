# Adhan Earth (athan.waqf.app)

Adhan Earth is an interactive 3D planetary observatory. It displays Earth in space with real physical solar illumination, moving Islamic prayer fronts, and continuous global adhan events across 15,000 settlements.

## Key Features

- Physically accurate solar illumination and day-night terminator driven by astronomical algorithms.
- Five moving prayer front contours: Fajr, Dhuhr, Asr, Maghrib, and Isha.
- The Asr front calculates the exact latitude-dependent shadow length locus rather than a fixed twilight ring.
- GPU-instanced point cloud rendering 15,000+ global populated places at 60 FPS.
- Real-time adhan event engine with expanding visual pulses across communities entering prayer times.
- 24-hour continuity timeline ribbon with statistical metrics proving uninterrupted global adhan coverage.
- Interactive inspector panel displaying 5 prayer times, current period, and countdown for any city or coordinate.
- Follow the Adhan cinematic camera director tracking active prayer fronts westward around the world.
- Zero-backend static architecture deployable to Cloudflare Workers Static Assets or GitHub Pages.

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

Development:
```bash
aube dev
# or
pnpm dev
```

Run Tests:
```bash
aube test
# or
pnpm test
```

Production Build:
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

## Mathematical Models

Solar Position:
Computes Julian Day, solar mean anomaly, ecliptic longitude, and equation of time to derive the subsolar point (latitude equal to solar declination, longitude equal to negative Greenwich Hour Angle).

Prayer Contours:
- Fajr and Isha: Small circles of constant solar depression angle (-18 degrees and -17 degrees) centered on the subsolar point.
- Dhuhr: Meridian arc passing through the subsolar longitude from pole to pole.
- Asr: Non-circular curve derived from the fiqh shadow length formula (noon shadow plus 1x or 2x object height) evaluated per latitude slice.
- Maghrib and Sunrise: -0.833 degree solar altitude circle accounting for atmospheric refraction and solar radius.

## License

هذا العمل هو وَقْفٌ لله تعالى تحت شروط رُخصة وَقْف الرَّقْمِيَّة العامَّة - الإصدار الأول.
المُستوى المُطَبَّق هو: وَقْفٌ خَيْرِيٌّ مُلْزِمٌ بالإِسْنَادِ (WaqfDPL-Khayri-Mulzim 1.0).

See the [LICENSE](LICENSE) file for the full license text, or the [WaqfDPL repository](https://github.com/WaqfTech/waqf-license-draft) for details.
