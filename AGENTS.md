# AGENTS.md: Adhan Earth (athan.waqf.app)

Always read and strictly adhere to the universal agent operating rules located at:
- `~/.agents/AGENTS.md`

## Stack and Architecture

- Core 3D engine: Three.js (v0.180+) with custom GLSL shaders for day and night terminator, atmosphere glow, and GPU-instanced settlements.
- Astronomy: Pure TypeScript solar position and Julian date algorithms (NOAA and Meeus).
- Prayer calculations: Pure TypeScript astronomical and fiqh calculation engine.
- Build tool: Vite with static output suitable for GitHub Pages.
- Package manager: aube, aubr, aubx; otherwise pnpm. Never use npm or yarn.
- Test runner: Vitest.

## Essential Commands

- Install dependencies: `aube install` (or `pnpm install`)
- Dev server: `aube dev` (or `pnpm dev`)
- Run tests: `aube test` (or `pnpm test`)
- Typecheck and build: `aube build` (or `pnpm build`)
- Preview production build: `aube run preview` (or `pnpm preview`)

## Key Codebase Conventions

- No physical directional CSS: Never use ml-*, mr-*, pl-*, pr-*, left-*, right-* without LTR container isolation. Always use logical CSS properties (inset-inline, margin-inline, padding-inline, border-inline).
- Numbers in UI: Always use Western numerals (0-9). Never use Eastern Arabic-Indic numerals.
- WebGL loop performance: Never pass canvas dimensions to renderer or shader updates inside requestAnimationFrame. Keep canvas resizing decoupled inside ResizeObserver callbacks to prevent GPU pipeline stalls.
- Scripting preference: Any utility or data generation scripts must be written in Go (e.g. `scripts/build-cities.go`).
- Zero CI sprawl: Never introduce `.github/workflows/` files. Verify all tests and builds locally.
