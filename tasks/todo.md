# Task List: Adhan Earth

## Task 1: Project scaffold and toolchain setup

Description: Initialize the project directory with Vite, TypeScript, pnpm, and Vitest. Configure build scripts, tsconfig with strict typing, and basic HTML entry point with canvas container.

Acceptance criteria:
- [ ] Vite dev server runs cleanly on local port.
- [ ] Vitest test runner executes and passes a smoke test.
- [ ] TypeScript compiles with zero errors under strict mode.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Open browser at local port to confirm clean blank canvas page.

Dependencies: None

Files likely touched:
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `index.html`
- `src/main.ts`

Estimated scope: Small (1-3 files)

## Task 2: Astronomical solar calculation engine

Description: Build pure TypeScript astronomy functions to compute Julian date, solar declination, Greenwich Hour Angle, and subsolar latitude and longitude for any given UTC timestamp. Add spherical trigonometry utilities to convert between spherical coordinates and Cartesian 3D vectors.

Acceptance criteria:
- [ ] Calculate solar declination and GHA matching reference NOAA ephemeris within 0.05 degrees.
- [ ] Transform latitude and longitude coordinates into normalized 3D unit vectors on a sphere.
- [ ] Thorough unit tests cover solstices, equinoxes, and known solar positions.

Verification:
- [ ] Tests pass: pnpm test src/astronomy/solar.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Inspect calculated subsolar point for current timestamp against astronomical almanac.

Dependencies: Task 1

Files likely touched:
- `src/astronomy/julian.ts`
- `src/astronomy/solar.ts`
- `src/astronomy/coordinates.ts`
- `src/astronomy/solar.test.ts`

Estimated scope: Medium (3-4 files)

## Task 3: Three.js globe with day and night terminator shader

Description: Construct the 3D Earth scene in Three.js with texture mapping, orbit controls, and a custom day and night shader driven by the calculated Sun vector. The terminator line emerges naturally from physical lighting rather than an artificial split.

Acceptance criteria:
- [ ] Render 3D Earth sphere with day texture on sunlit side and city lights texture on night side.
- [ ] Position directional light and shader uniforms matching the astronomical Sun vector.
- [ ] OrbitControls allow smooth rotation, pitch, and zoom with sensible distance boundaries.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Verify Earth illumination matches real-world daylight boundaries for current time.

Dependencies: Task 2

Files likely touched:
- `src/globe/scene.ts`
- `src/globe/earth.ts`
- `src/globe/camera.ts`
- `src/styles/main.css`

Estimated scope: Medium (3-4 files)

## Checkpoint: Astronomical Earth Foundation
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] 3D Earth renders with real solar illumination and orbit controls

## Task 4: Local prayer time calculation engine

Description: Write the fiqh prayer calculation module supporting standard conventions (Muslim World League, Umm Al-Qura, Egyptian General Authority, Karachi, North America). Apply exact solar altitude formulas for Fajr, Sunrise, Dhuhr, Asr (Shafi and Hanafi shadow ratios), Maghrib, and Isha.

Acceptance criteria:
- [ ] Compute accurate prayer times for any coordinate and date without external network calls.
- [ ] Match reference prayer times for Makkah, Cairo, London, and Jakarta within 1 minute.
- [ ] Support both Shafi and Hanafi Asr calculations.

Verification:
- [ ] Tests pass: pnpm test src/prayer/calculator.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Compare calculated times for Makkah against official Umm Al-Qura schedule.

Dependencies: Task 2

Files likely touched:
- `src/prayer/conventions.ts`
- `src/prayer/calculator.ts`
- `src/prayer/calculator.test.ts`

Estimated scope: Small (2-3 files)

## Task 5: Global continuous prayer contour geometry generator

Description: Invert the prayer time problem to generate geographic contour lines for any instant. Derive small circles for Fajr and Isha depression angles, the Dhuhr meridian arc, and the latitude-dependent Asr shadow curve. Sample each curve into ordered 3D spherical vertices.

Acceptance criteria:
- [ ] Fajr and Isha contours form smooth circles perpendicular to the Sun vector at their respective depression angles.
- [ ] Dhuhr front aligns with the subsolar meridian.
- [ ] Asr front calculates the correct afternoon hour angle per latitude slice based on shadow length.
- [ ] Vertices correctly elevate slightly above the Earth surface to prevent z-fighting.

Verification:
- [ ] Tests pass: pnpm test src/prayer/contours.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Verify contours match where local cities are currently entering their respective prayer times.

Dependencies: Task 4

Files likely touched:
- `src/prayer/contours.ts`
- `src/prayer/contours.test.ts`

Estimated scope: Medium (2-3 files)

## Task 6: Glowing 3D prayer front visualization layer

Description: Render the computed prayer contours in the Three.js scene using custom shaders or fat lines. Assign distinct colors to each prayer front (Fajr cyan, Dhuhr amber, Asr orange, Maghrib crimson, Isha indigo) and add layer visibility toggles.

Acceptance criteria:
- [ ] Render all 5 prayer fronts simultaneously as smooth glowing ribbons or lines on Earth.
- [ ] Fronts update smoothly in real time or during accelerated playback without stutter.
- [ ] Individual prayer layers can be toggled on or off from the UI state.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Toggle each prayer front and observe smooth westward migration as time scrubs forward.

Dependencies: Task 5

Files likely touched:
- `src/globe/fronts.ts`
- `src/globe/scene.ts`

Estimated scope: Small (2 files)

## Checkpoint: Prayer Calculation and Contours
- [ ] All tests pass
- [ ] Prayer engine outputs match standard reference cities
- [ ] Moving prayer fronts display accurately on the 3D globe

## Task 7: Settlement dataset pipeline and compact loader

Description: Prepare and bundle a curated settlement dataset of major populated places across all continents. Create a compact JSON or binary loader with an efficient spatial index for fast distance and coordinate queries.

Acceptance criteria:
- [ ] Bundle at least 15,000 global populated places with name, latitude, longitude, and country code.
- [ ] Compressed dataset size stays under 400 KB for rapid network delivery.
- [ ] Fast lookup by coordinates or proximity query.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Verify key cities across all continents exist in the parsed index.

Dependencies: Task 1

Files likely touched:
- `scripts/build-cities.go`
- `public/data/cities-core.json`
- `src/population/loader.ts`
- `src/population/spatialIndex.ts`

Estimated scope: Medium (3-4 files)

## Task 8: GPU instanced city point cloud rendering

Description: Render settlement points on the globe using Three.js InstancedMesh or custom points buffer geometry. Encode settlement coordinates, population brightness, and prayer state attributes directly into GPU buffers.

Acceptance criteria:
- [ ] Render 15,000+ points on the globe surface maintaining steady 60 FPS on standard hardware.
- [ ] Points scale subtly with camera distance and population tier.
- [ ] Points support dynamic color tinting when active.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Rotate and zoom the globe with 15,000 points active, checking framerate in browser dev tools.

Dependencies: Task 7

Files likely touched:
- `src/globe/cities.ts`
- `src/globe/scene.ts`

Estimated scope: Small (2 files)

## Task 9: Real-time adhan event scheduler and pulse engine

Description: Connect settlement schedules to a global event engine. When the simulated clock crosses a settlement prayer time, mark the settlement as active for a configurable duration (3 to 5 minutes) and trigger an expanding visual pulse wave on the globe.

Acceptance criteria:
- [ ] Cities accurately trigger active adhan state when the current time matches their local prayer time.
- [ ] Active cities display an expanding soft light pulse that fades over the adhan duration.
- [ ] Fast time scrubbing (60x, 300x) updates pulse waves continuously without missing events.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Fast-forward through a 24-hour cycle and observe waves of pulses cascading westward across timezones.

Dependencies: Task 4, Task 8

Files likely touched:
- `src/simulation/eventEngine.ts`
- `src/simulation/clock.ts`
- `src/globe/cities.ts`

Estimated scope: Medium (3 files)

## Checkpoint: Settlements and Adhan Events
- [ ] All tests pass
- [ ] 15,000+ settlements render with steady framerates
- [ ] Adhan pulses trigger accurately as prayer fronts sweep past cities

## Task 10: 24-hour global adhan continuity calculator and timeline strip

Description: Compute the mathematical continuity of the adhan across the 24-hour cycle. Display an interactive 24-hour ribbon below the globe showing active adhan density, current playhead, coverage percentage, and the longest silence gap.

Acceptance criteria:
- [ ] Calculate the exact union of active adhan intervals for the selected date and convention.
- [ ] Display summary statistics: total active coverage percentage and longest silent interval.
- [ ] Interactive timeline strip allows clicking or dragging to jump the planetary time instantly.

Verification:
- [ ] Tests pass: pnpm test src/simulation/continuity.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Drag timeline scrubber across 24 hours and observe instant synchronization with globe illumination.

Dependencies: Task 9

Files likely touched:
- `src/simulation/continuity.ts`
- `src/simulation/continuity.test.ts`
- `src/ui/timeline.ts`
- `src/styles/main.css`

Estimated scope: Medium (3-4 files)

## Task 11: Geoscape HUD controls and layer toggles

Description: Build the tactical Geoscape HUD overlay. Include time controls (Live, Pause, 1x, 10x, 60x, 300x), date picker, fiqh convention selector, layer switches (Visual, Astronomical, Prayer Fronts, Population, Continuity), and adhan duration slider.

Acceptance criteria:
- [ ] Clean HUD layout adhering to logical CSS properties without physical directional rules.
- [ ] Playback buttons smoothly control simulation speed and direction.
- [ ] Layer switches toggle visibility of day/night, contour lines, and settlement points.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Test all playback speeds, reverse, forward, and layer toggles on desktop and mobile viewports.

Dependencies: Task 3, Task 6, Task 10

Files likely touched:
- `src/ui/hud.ts`
- `src/ui/controls.ts`
- `src/styles/main.css`

Estimated scope: Medium (3 files)

## Task 12: Settlement inspector panel and URL state sync

Description: Enable raycasting to select any city or click any coordinate on the globe. Display a detailed inspector panel showing coordinates, local time, 5 prayer times, current prayer period, and countdown to next adhan. Sync view coordinates, timestamp, and active mode to URL query parameters for sharing.

Acceptance criteria:
- [ ] Clicking a city or coordinate opens the inspector with accurate local prayer schedule.
- [ ] Next adhan countdown ticks in real time.
- [ ] URL updates with lat, lon, time, and mode query parameters; loading a URL restores that exact planetary view.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Select Makkah, copy the generated URL, open in private window, verify view restored identically.

Dependencies: Task 8, Task 11

Files likely touched:
- `src/ui/inspector.ts`
- `src/ui/urlState.ts`
- `src/globe/scene.ts`

Estimated scope: Medium (3 files)

## Checkpoint: Core Geoscape and Continuity Complete
- [ ] All tests pass
- [ ] Timeline strip and HUD controls operate smoothly
- [ ] City inspection and URL state sharing work end-to-end

## Task 13: Follow the Adhan narrative camera mode

Description: Build an automated cinematic camera tour that smoothly follows the leading adhan front westward. The camera rotates and interpolates between active major settlements as prayer times transition from Indonesia to the Middle East, Africa, Europe, and the Americas.

Acceptance criteria:
- [ ] Activating narrative mode smoothly tweens the camera to the currently active prayer front.
- [ ] Camera tracks westward along the globe as time advances.
- [ ] User manual drag smoothly disengages auto-follow mode without abrupt camera jumps.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Enable Follow the Adhan mode at 60x speed and watch the camera smoothly track the Fajr front around the world.

Dependencies: Task 9, Task 12

Files likely touched:
- `src/globe/camera.ts`
- `src/simulation/narrative.ts`

Estimated scope: Small (2 files)

## Task 14: Atmospheric scattering, visual polish, and mobile layout

Description: Add realistic atmospheric rim glow using a Fresnel shader, subtle starfield background, and refine UI layout for small mobile touchscreens. Ensure all UI controls scale cleanly and touch gestures support rotating and pinching Earth.

Acceptance criteria:
- [ ] Atmospheric glow encircles Earth limb without clipping artifacts.
- [ ] UI panels adapt to mobile screens without obstructing the globe interaction.
- [ ] Touch gestures handle rotation, pinch zoom, and city tapping smoothly.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Emulate mobile viewport in browser dev tools, verify touch controls and responsive layout.

Dependencies: Task 3, Task 11

Files likely touched:
- `src/globe/atmosphere.ts`
- `src/styles/main.css`

Estimated scope: Small (2 files)

## Task 15: Production static build and GitHub Pages deployment configuration

Description: Configure the Vite build pipeline to produce a fast static bundle. Set up base paths, asset hashing, and local verification scripts. Confirm zero server requirements and verify bundle size.

Acceptance criteria:
- [ ] Production build generates static dist directory with clean index.html and compressed assets.
- [ ] Relative or base-path asset loading works correctly on GitHub Pages subpaths.
- [ ] Local preview script runs the production bundle with zero console errors.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Run pnpm preview and verify full application functionality from the static dist output.

Dependencies: Task 13, Task 14

Files likely touched:
- `vite.config.ts`
- `package.json`
- `README.md`

Estimated scope: Small (2-3 files)

## Checkpoint: Launch Readiness
- [ ] Full test suite passes
- [ ] Static production build passes inspection
- [ ] Ready for user review and deployment
