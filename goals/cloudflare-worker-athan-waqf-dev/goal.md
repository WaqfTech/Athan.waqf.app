# Goal: Configure Cloudflare Worker for athan.waqf.app

## Goal Description
Configure Cloudflare Workers Static Assets with custom domain on athan.waqf.app using wrangler.jsonc, SPA routing, and local dry-run verification.

## Dependencies & Execution Order
- **Mode**: Independent (disjoint, parallelizable)
- **Depends On**: none
- **Sequence**: -
- **Shape**: ship
- **Tier**: immediate

## References
- **Shared Understanding & Fact Sheet**: [`goals/cloudflare-worker-athan-waqf-dev/facts.md`](facts.md)
- **Execution Plan**: [`goals/cloudflare-worker-athan-waqf-dev/plan.md`](plan.md)

## Done Condition
1. All requirements described in the goal and execution plan are implemented.
2. All automated unit and integration tests pass cleanly with `-race` (`go test -race ./...` or stack equivalent).
3. Zero architectural regressions; definitions of done satisfied.
