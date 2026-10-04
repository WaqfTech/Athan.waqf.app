# Plan: 3D Vertical Light Pillars for Active Adhan Settlements

## Execution Steps
- [ ] Phase 1: 3D Pillar Geometry & InstancedMesh: Create reusable cylinder/prism geometry oriented normal to the sphere surface at settlement positions.
- [ ] Phase 2: Prayer color & height mapping: Bind vertex attributes for prayer color (cyan for Fajr, yellow for Dhuhr, amber for Asr, crimson for Maghrib, purple for Isha) and population-scaled pillar height.
- [ ] Phase 3: Active Adhan animation: Animate vertical pillar height extrusion and glow pulsing during the active prayer call duration.
- [ ] Phase 4: Verification & interactive hit testing: Verify settlement click selection, inspector synchronization, and frame rate stability with thousands of instanced pillars.
- [ ] Phase 5: Attribution Commit: Commit with `(goals/adhan-3d-light-pillars/goal.md)` using a `feat:`, `fix:`, `refactor:`, `perf:`, or `chore:` subject, then run `sila goals`.
