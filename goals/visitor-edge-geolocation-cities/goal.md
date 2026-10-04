# Goal: Visitor Edge Geolocation and 10 Closest Cities in Header

## Goal Description
Use Cloudflare request.cf edge geolocation and spatial indexing to display the 10 closest cities to the visitor in the header quick strip.

## Dependencies & Execution Order
- **Mode**: Independent (disjoint, parallelizable)
- **Depends On**: none
- **Sequence**: -
- **Shape**: ship
- **Tier**: roadmap

## References
- **Shared Understanding & Fact Sheet**: [`goals/visitor-edge-geolocation-cities/facts.md`](facts.md)
- **Execution Plan**: [`goals/visitor-edge-geolocation-cities/plan.md`](plan.md)

## Done Condition
1. All requirements described in the goal and execution plan are implemented.
2. All automated unit and integration tests pass cleanly with `-race` (`go test -race ./...` or stack equivalent).
3. Zero architectural regressions; definitions of done satisfied.
