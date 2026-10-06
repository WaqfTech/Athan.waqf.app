# Implementation Plan: Islamic Night Division and Last Third of the Night

## Overview

This plan defines the architectural additions required to calculate and display the Islamic
night (الليل الشرعي) and the last third of the night (الثلث الأخير من الليل). In Islamic fiqh,
the night begins at Maghrib athan (sunset) and concludes at Fajr athan (true dawn). The night
duration is divided into three equal portions. The last third begins at two-thirds of the night
span (or one-third before Fajr) and ends at Fajr athan. The implementation adds astronomical
calculations, multi-lingual translations, inspector displays, and real-time global counts.

## Architecture Decisions

Decision: Standardize Islamic night duration as the interval from Maghrib athan to next Fajr athan.
Decision type: fact.
Evidence: Classical Islamic jurisprudence unanimously defines the legal night (الليل الشرعي) as
the duration between sunset (غروب الشمس / أذان المغرب) and true dawn (طلوع الفجر الصادق / أذان الفجر).
Dividing this interval into three equal parts establishes the exact start of the last third.

Decision: Support both current observer night and upcoming night in the prayer calculator.
Decision type: design choice.
Evidence: An observer inspecting a location during daylight needs to see the upcoming night schedule,
while an observer checking during the night needs to know whether the current instant falls inside
the last third of the night. Multi-day lookahead and lookbehind resolve this without discontinuities.

Decision: Add dedicated last third of the night telemetry to the inspector panel.
Decision type: design choice.
Evidence: Users inspecting any of the 15,000 settlements or arbitrary coordinates need to see the
exact start time, end time, total night duration, active status badge, and countdown.

Decision: Implement a high-performance global counter for settlements in the last third.
Decision type: optimization.
Evidence: Iterating through 15,000 settlements during simulation ticks must execute in under 2ms.
Leveraging cached civil dates and longitude offsets enables sub-millisecond evaluation.

## Task List

Phase 1: Foundation and Calculation Engine
- Task 1: Core Islamic night astronomical calculation engine
- Task 2: Multi-lingual internationalization and terminology

Checkpoint: Foundation
- All unit tests pass
- TypeScript compiles cleanly with zero errors

Phase 2: User Interface and Inspection
- Task 3: Inspector panel night schedule and status display
- Task 4: Global settlements last third counter in event engine

Checkpoint: Core Features
- Inspector displays night times accurately for all cities
- Global settlement counter operates efficiently during simulation

Phase 3: Telemetry, Integration and Verification
- Task 5: HUD and timeline live telemetry integration
- Task 6: Comprehensive verification and regression suite

Checkpoint: Complete
- All acceptance criteria verified
- All 35+ test files pass in Vitest
- Production build succeeds

## Risks and Mitigations

- High latitudes and polar regions:
  Impact: Medium.
  Mitigation: Use high-latitude adjustment fallbacks or flag unresolved state gracefully.

- Performance overhead across 15,000 settlements:
  Impact: High.
  Mitigation: Reuse cached civil dates, avoid per-tick allocations, and use candidate filters.

- Timezone midnight crossing:
  Impact: Medium.
  Mitigation: Anchor night to UTC timestamps and convert to observer local time via Intl.

## Open Questions

- Should the last third of the night also render as a toggleable 3D contour line on the globe?
- Should the timeline canvas include a visual shaded band for night thirds across 24 hours?
