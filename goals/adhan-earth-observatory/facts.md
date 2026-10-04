# Facts: Adhan Earth 3D Planetary Observatory

## Architectural Invariants and Constraints
- Ground all implementations in official astronomical algorithms (NOAA, Meeus) and standard fiqh conventions.
- Asr front calculates exact latitude-dependent shadow length locus rather than a fixed twilight ring.
- Pure client-side static bundle suitable for GitHub Pages hosting with zero backend servers.
- Use logical CSS properties throughout.

## File and Interface Contracts
- `src/astronomy/solar.ts`: Solar declination, Equation of Time, Subsolar coordinates.
- `src/astronomy/coordinates.ts`: Spherical to 3D Cartesian conversions.
- `src/prayer/calculator.ts`: Fiqh prayer time calculations for 10 international conventions.
- `src/prayer/contours.ts`: Continuous spherical 3D contour lines for Fajr, Dhuhr, Asr, Maghrib, Isha, Terminator.
- `src/globe/scene.ts`: Three.js scene manager with day/night terminator shader and decoupled resize observer.
- `src/globe/cities.ts`: GPU-instanced point cloud for 15,000 global populated places.
- `src/simulation/eventEngine.ts`: Real-time adhan scheduler and expanding pulse detector.
- `src/simulation/continuity.ts`: 24-hour mathematical continuity and silent gap analysis.
- `src/simulation/narrative.ts`: Follow the Adhan cinematic camera director.
- `src/ui/hud.ts`, `src/ui/timeline.ts`, `src/ui/inspector.ts`, `src/ui/urlState.ts`: Tactical Geoscape HUD overlay.
