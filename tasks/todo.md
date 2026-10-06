# Task List: Islamic Night Division and Last Third of the Night

## Task 1: Core Islamic night astronomical calculation engine

Description: Implement pure TypeScript astronomical functions to calculate the Islamic night
interval from Maghrib athan to the following Fajr athan. Compute the total night duration,
Islamic midnight (half of the night), the start of the last third (Fajr minus one third of the
night), and the end of the last third (Fajr athan). Extend PrayerTimesSchedule with an
islamicNight object containing these properties, handling both current active night and upcoming
night. Add comprehensive unit tests covering solstices, equinoxes, and high-latitude adjustments.

Acceptance criteria:
- [ ] Calculate night duration as exact difference between next Fajr and preceding Maghrib.
- [ ] Compute start of the last third as Maghrib plus two thirds of night duration (or Fajr minus one third).
- [ ] Compute end of the last third as Fajr athan timestamp.
- [ ] Identify whether an arbitrary timestamp falls within the last third of the night.
- [ ] Integrate islamicNight structure into PrayerTimesSchedule and calculator output.

Verification:
- [ ] Tests pass: pnpm test src/prayer/calculator.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Verify Makkah and London night third calculations against astronomical tables.

Dependencies: None

Files likely touched:
- `src/prayer/calculator.ts`
- `src/prayer/calculator.test.ts`

Estimated scope: Small (2 files)

## Task 2: Multi-lingual internationalization and terminology

Description: Add localized terms for the Islamic night and its divisions across all 10 supported
languages (Arabic, English, French, Turkish, Urdu, Persian, Bengali, Indonesian, Malay, Russian).
Define translations for the last third of the night, night duration, start time, end time,
active status indicators, and global counter labels. Update translation type definitions and add
unit tests asserting presence and correctness.

Acceptance criteria:
- [ ] Add last third of the night terminology to Translations interface under inspector and controls.
- [ ] Provide authentic Islamic translations in Arabic (الثلث الأخير من الليل, بداية الثلث الأخير).
- [ ] Ensure Arabic translations use Western Arabic numerals (0-9).
- [ ] Provide translations for all 9 other languages without missing key fallbacks.
- [ ] Validate translation dictionaries with automated unit tests.

Verification:
- [ ] Tests pass: pnpm test src/i18n/i18n.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Switch language to Arabic and English to verify displayed labels.

Dependencies: Task 1

Files likely touched:
- `src/i18n/translations.ts`
- `src/i18n/i18n.test.ts`

Estimated scope: Small (2 files)

## Checkpoint: After Tasks 1-2
- [ ] All prayer calculator and internationalization tests pass.
- [ ] Application builds without errors.

## Task 3: Inspector panel night schedule and status display

Description: Update the settlement and coordinate inspector panel to display the Islamic night
section. Render the last third of the night with its start time, end time, total night duration,
and a dynamic active status badge when the inspected location is currently in its last third.
Include a countdown showing time remaining until the last third starts or ends. Ensure proper
RTL formatting and CSS logical properties.

Acceptance criteria:
- [ ] Inspector renders a dedicated card or row for the last third of the night.
- [ ] Display formatted start time and end time matching the settlement local timezone.
- [ ] Display total night duration in hours and minutes.
- [ ] Show a distinct active badge when current time is within the last third of the night.
- [ ] Update night countdown dynamically during simulation playback.

Verification:
- [ ] Tests pass: pnpm test src/ui/inspector.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Inspect Makkah during night and day to verify time display and active badge.

Dependencies: Tasks 1, 2

Files likely touched:
- `src/ui/inspector.ts`
- `src/ui/inspector.test.ts`
- `src/styles/main.css`

Estimated scope: Medium (3 files)

## Task 4: Global settlements last third counter in event engine

Description: Extend AdhanEventEngine to calculate the number of settlements currently in the
last third of the night. Optimize the calculation loop across 15,000 settlements using
precomputed coordinate keys and cached civil dates to guarantee sub-millisecond execution.
Add unit tests verifying calculation correctness and performance benchmarks.

Acceptance criteria:
- [ ] Implement countSettlementsInLastThird method in AdhanEventEngine.
- [ ] Accurately detect which settlements are in their local last third of the night at any UTC time.
- [ ] Maintain performance under 2ms per evaluation across 15,000 settlements.
- [ ] Add unit test verifying that global count is positive and fluctuates smoothly across 24 hours.

Verification:
- [ ] Tests pass: pnpm test src/simulation/eventEngine.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Verify execution time on 15,000 settlements during continuous animation ticks.

Dependencies: Task 1

Files likely touched:
- `src/simulation/eventEngine.ts`
- `src/simulation/eventEngine.test.ts`

Estimated scope: Small (2 files)

## Checkpoint: After Tasks 3-4
- [ ] Inspector shows accurate night divisions for inspected settlements.
- [ ] Event engine computes global settlements in the last third without performance regressions.
- [ ] All test suites pass.

## Task 5: HUD and timeline live telemetry integration

Description: Integrate the global count of settlements in the last third of the night into the
HUD and timeline interface. Display a live statistic chip showing the count of cities currently
in the last third of the night, updated smoothly during simulation playback. Ensure layout is
responsive, accessible, and styled with CSS logical properties.

Acceptance criteria:
- [ ] Add a live telemetry stat chip displaying the count of cities in the last third.
- [ ] Update the counter dynamically on clock tick and time scrub.
- [ ] Provide informative tooltip explaining the calculation of the last third of the night.
- [ ] Ensure full responsiveness on mobile and desktop viewports without visual overlap.

Verification:
- [ ] Tests pass: pnpm test src/ui/hud.test.ts
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Scrub timeline across 24 hours and watch the night third counter update.

Dependencies: Tasks 3, 4

Files likely touched:
- `src/ui/hud.ts`
- `src/ui/timeline.ts`
- `src/styles/main.css`

Estimated scope: Medium (3 files)

## Task 6: Comprehensive verification and regression suite

Description: Create end-to-end and regression tests validating the complete workflow of the
Islamic night and last third feature. Test multi-day transitions, high-latitude edge cases,
timezone conversions, inspector rendering, and global settlement counting across different
fiqh conventions.

Acceptance criteria:
- [ ] End-to-end tests verify night third calculation across diverse latitudes.
- [ ] Verify that night third times adjust properly when calculation convention or rule changes.
- [ ] Verify zero memory leaks or cache thrashing during 24-hour simulation loops.
- [ ] All 35+ test files pass cleanly with 100% green status.

Verification:
- [ ] Tests pass: pnpm test
- [ ] Build succeeds: pnpm build
- [ ] Manual check: Run preview build with pnpm preview and inspect live interaction.

Dependencies: Tasks 1, 2, 3, 4, 5

Files likely touched:
- `tests/e2e/tier1-features.test.ts`
- `src/smoke.test.ts`

Estimated scope: Small (2 files)

## Checkpoint: Complete
- [ ] All 6 tasks completed and verified.
- [ ] All automated tests pass in Vitest.
- [ ] Production build succeeds with zero errors.
- [ ] Ready for review and deployment.
