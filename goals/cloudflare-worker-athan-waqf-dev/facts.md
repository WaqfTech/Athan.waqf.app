# Facts: Configure Cloudflare Worker for athan.waqf.dev

## Architectural Invariants & Constraints
- Cloudflare Workers Static Assets serves the static assets from ./dist directly.
- Configuration must use JSONC (wrangler.jsonc), never TOML.
- Target custom domain is athan.waqf.dev with custom_domain: true.
- SPA routing fallback: not_found_handling set to single-page-application to support URL parameters.
- No unprompted remote deployment: all verification performed locally with wrangler deploy --dry-run.

## File & Interface Contracts
- wrangler.jsonc: Worker configuration with account ID, assets directory, SPA routing, and custom domain route.
- package.json: deploy and deploy:dry npm scripts.
- dist/: Static output directory created by aube build.
