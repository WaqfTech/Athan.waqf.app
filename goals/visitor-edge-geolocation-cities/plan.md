# Plan: Visitor Edge Geolocation and 10 Closest Cities in Header

## Execution Steps
- [x] Phase 1: Edge Geolocation Worker endpoint: Implement /api/geo in Cloudflare Worker reading request.cf coordinates and location metadata.
- [x] Phase 2: K-Nearest Neighbor spatial lookup: Implement findKNearest on SettlementSpatialIndex to quickly query the 10 closest settlements.
- [x] Phase 3: Dynamic Header quick cities strip: Update HUD quick cities bar to show sacred sanctuaries plus the 10 closest cities to the visitor.
- [x] Phase 4: Verification and tests: Write unit tests for findKNearest and test edge geolocation endpoint live in browser.
- [x] Phase 5: Attribution Commit: Commit with `(goals/visitor-edge-geolocation-cities/goal.md)` using a `feat:`, `fix:`, `refactor:`, `perf:`, or `chore:` subject, then run `sila goals`.
