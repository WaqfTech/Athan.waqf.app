# Goal: 3D Vertical Light Pillars for Active Adhan Settlements

## Goal Description
Render 3D glowing columns rising from cities calling Adhan, colored by prayer and scaled by population.

## Dependencies & Execution Order
- **Mode**: Dependent (requires prerequisite goals)
- **Depends On**: crisp-globe-textures-and-shading
- **Sequence**: 2
- **Shape**: ship
- **Tier**: roadmap

## References
- **Shared Understanding & Fact Sheet**: [`goals/adhan-3d-light-pillars/facts.md`](facts.md)
- **Execution Plan**: [`goals/adhan-3d-light-pillars/plan.md`](plan.md)

## Done Condition
1. All requirements described in the goal and execution plan are implemented.
2. All automated unit and integration tests pass cleanly with `-race` (`go test -race ./...` or stack equivalent).
3. Zero architectural regressions; definitions of done satisfied.
