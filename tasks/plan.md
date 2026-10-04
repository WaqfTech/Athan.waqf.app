# Build Plan: Adhan Earth (athan.waqf.app)

## Overview

Adhan Earth is an interactive 3D planetary observatory built with Three.js and TypeScript. It presents Earth in space with true solar illumination, day and night shading, continuous prayer twilight fronts, and thousands of illuminated settlements. Visitors can rotate the globe, scrub time, watch prayer fronts migrate westward, inspect local prayer times for any coordinate, and quantitatively evaluate whether the adhan is continuously active across the planet. The application builds as a fully static bundle ready for free hosting on GitHub Pages with zero server requirements.

## Architecture Decisions

Decision: Three.js for core 3D scene with vanilla TypeScript UI overlay.
Decision type: design choice.
Evidence: Three.js delivers 60 FPS animation loops, custom GLSL shaders, and GPU-instanced points without React virtual DOM overhead. The HUD consists of lightweight DOM panels styled with modern CSS logical properties.

Decision: Self-contained astronomical solar position engine.
Decision type: design choice.
Evidence: NOAA and Meeus astronomical algorithms calculate solar declination and Greenwich Hour Angle within 0.01 degree accuracy. Running this locally eliminates network latency, works offline, and enables arbitrary time scrubbing.

Decision: Analytical contour derivation for prayer fronts.
Decision type: fact.
Evidence: Fajr, sunrise, sunset, and Isha form small circles of constant solar altitude centered at the subsolar point. Dhuhr corresponds to the solar noon meridian. Asr depends on shadow length, which varies by latitude; computing the hour angle per latitude slice derives the exact non-circular front.

Decision: Compact tiered settlement dataset.
Decision type: optimization.
Evidence: An initial payload of roughly 15,000 to 25,000 settlements (under 400 KB compressed) delivers instantaneous initial load. An optional extended dataset can be fetched on demand for deep continuity proofs.

Decision: Pure client-side static hosting on GitHub Pages.
Decision type: design choice.
Evidence: All ephemeris and prayer calculations execute in the browser. Geolocation uses standard browser APIs with manual search fallback. State serializes to URL query parameters for reproducible link sharing.

## Mathematical and Physical Models

Solar position:
At any UTC timestamp t, compute Julian Day, solar mean anomaly, ecliptic coordinates, and equation of time. This yields the subsolar point with latitude equal to solar declination and longitude equal to negative Greenwich Hour Angle.

Solar elevation angle:
At any latitude phi and longitude lambda, solar elevation h satisfies sin(h) = sin(phi) * sin(declination) + cos(phi) * cos(declination) * cos(lambda - lambda_sun).

Prayer twilight circles:
Fajr front: locus where h = -18 degrees (or selected convention angle) on the dawn side.
Sunrise and sunset: locus where h = -0.833 degrees (accounting for refraction and solar radius).
Isha front: locus where h = -17 or -18 degrees on the dusk side.
These loci are spherical circles with angular radius theta = 90 - h from the subsolar point.

Dhuhr front:
The meridian line where local solar time is 12:00 (local noon), spanning from pole to pole through the subsolar longitude.

Asr shadow curve:
Noon shadow length ratio is S0 = tan(|phi - declination|).
Asr begins when shadow length is S0 + 1 (Shafi, Maliki, Hanbali) or S0 + 2 (Hanafi).
The required solar altitude is h_asr = atan(1 / (S0 + n)).
The afternoon hour angle satisfies cos(H) = (sin(h_asr) - sin(phi) * sin(declination)) / (cos(phi) * cos(declination)).
The front longitude at latitude phi is lambda = lambda_sun - H.

Adhan continuity metric:
Given N settlements, each prayer event at time T produces an active window [T, T + duration], where duration defaults to 4 minutes. The union of all active intervals across 24 hours determines global coverage percentage and longest gap.

## Project Structure

```text
athan.waqf.app/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── public/
│   ├── data/
│   │   ├── cities-core.json
│   │   └── cities-extended.bin
│   └── textures/
│       ├── earth-day.webp
│       ├── earth-night.webp
│       └── earth-clouds.webp
├── src/
│   ├── main.ts
│   ├── styles/
│   │   └── main.css
│   ├── astronomy/
│   │   ├── coordinates.ts
│   │   ├── julian.ts
│   │   ├── solar.ts
│   │   └── solar.test.ts
│   ├── prayer/
│   │   ├── conventions.ts
│   │   ├── calculator.ts
│   │   ├── calculator.test.ts
│   │   ├── contours.ts
│   │   └── contours.test.ts
│   ├── globe/
│   │   ├── scene.ts
│   │   ├── earth.ts
│   │   ├── atmosphere.ts
│   │   ├── fronts.ts
│   │   ├── cities.ts
│   │   └── camera.ts
│   ├── simulation/
│   │   ├── clock.ts
│   │   ├── eventEngine.ts
│   │   └── continuity.ts
│   └── ui/
│       ├── hud.ts
│       ├── timeline.ts
│       ├── inspector.ts
│       └── urlState.ts
└── tasks/
    ├── plan.md
    └── todo.md
```

## Phases and Tasks

Phase 1: Project Setup and Astronomical Earth Foundation
Task 1: Project scaffold with Vite, TypeScript, pnpm, and Vitest.
Task 2: Astronomical solar engine and coordinate transforms.
Task 3: Three.js globe scene with day and night terminator shader.

Phase 2: Prayer Calculations and Global Moving Fronts
Task 4: Local prayer calculation engine with selectable conventions.
Task 5: Global continuous prayer contour geometry generator.
Task 6: Three.js glowing prayer front layer rendering.

Phase 3: Settlements and Adhan Pulse Engine
Task 7: Settlement dataset pipeline and compact loader.
Task 8: GPU instanced city point cloud with dynamic pulse attributes.
Task 9: Real-time adhan event scheduler and pulse animator.

Phase 4: Continuity Strip and Geoscape Controls
Task 10: 24-hour global continuity calculation and timeline ribbon.
Task 11: HUD controls, playback scrubbers, and layer toggles.
Task 12: Settlement inspector panel and shareable URL state sync.

Phase 5: Narrative Tour and Production Static Build
Task 13: Follow the Adhan auto-tracking camera mode.
Task 14: Atmospheric scattering, bloom polish, and mobile layout.
Task 15: Production static build verification and GitHub Pages readiness.

## Verification Strategy

Automated test suites:
Vitest runs unit tests for Julian date conversion, solar declination, equation of time, prayer time calculations against reference tables (Makkah, London, Cairo, Jakarta), and continuity math.

Type checks and linting:
TypeScript strict mode compiler checks all modules without error. Code style follows project standards.

Browser manual verification:
Verify 60 FPS rotation, drag controls, zoom limits, time acceleration (1x, 60x, 300x), accurate day and night division, accurate sunset alignment with Maghrib front, settlement click inspection, and timeline scrubbing.

## Risks and Mitigations

Risk: Rendering thousands of pulsating points may degrade framerate on mobile devices.
Impact: Medium.
Mitigation: Use GPU InstancedMesh with per-instance attributes and float buffers, avoiding CPU object updates during animation loops.

Risk: High latitude summer seasons where sun does not reach Fajr or Isha angles.
Impact: Medium.
Mitigation: Support standard fiqh approximation methods (middle of night, one-seventh of night, nearest latitude angle) and handle contour discontinuities gracefully.

Risk: Large city dataset size delaying page initial load.
Impact: Medium.
Mitigation: Ship a compact 15,000 city core index (under 400 KB) for immediate rendering. Stream additional settlements asynchronously if the user selects high-density mode.

## Open Questions

Question 1: Dataset density.
Option A: Start with top 15,000 cities by population (fastest load, under 400 KB).
Option B: Ship full 130,000 settlements in a packed binary format (roughly 3 MB).
Option C: Start with 15,000 cities and lazy-load the remaining settlements when continuity analysis mode opens.

Question 2: Adhan audio.
Option A: Visual only (silent space observatory, cleanest experience).
Option B: Optional subtle spatial audio chime or short takbeer when clicking an active settlement.

Question 3: Visual theme.
Option A: Realistic photorealistic Earth (NASA Blue Marble textures, realistic clouds, subtle atmospheric blue glow).
Option B: Stylized deep navy tactical Geoscape aesthetic with neon vector contours and glowing cybernetic markers.
