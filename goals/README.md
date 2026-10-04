# Goals Status & Pragmatic Execution Roadmap

This index tracks all goal packages under `goals/`, their execution mode (Independent ⚡ vs Dependent 🔗), dependencies, and progress status.

## 🤖 Agent Guide: How to Create, Claim & Execute Goals

1. **Create a Goal**: Scaffold a new goal package conforming to standards:
   ```bash
   sila goals create <slug> --title="..." [--depends-on="..."] [--independent]
   ```
2. **Claim a Goal**: Lock the goal so no other agent duplicates work:
   ```bash
   sila goals claim <slug> --agent=<name> [--note="evaluating..."]
   ```
3. **Launch & Implement**: Follow `facts.md` and `plan.md` until all tests pass:
   ```bash
   /goal goals/<slug>/goal.md
   ```
4. **Progress Updates**: Report status updates during execution:
   ```bash
   sila goals report <slug> "Running e2e test suite"
   ```
5. **Commit with Goal Reference**: Include the goal path in your commit message:
   ```bash
   git commit -m "feat(scope): implement description (goals/<slug>/goal.md)"
   ```
6. **Auto-Reconciliation**: Run `sila goals` to scan commits, mark 🟢 **Implemented**, and clear the claim lock.

## Summary
- **Total Goals**: 5
- 🟢 **Implemented & Verified**: 2
- 🟡 **Ready to Execute (Pending)**: 1 (1 independent ⚡, 0 unblocked 🔗)
- ⛔ **Blocked on Prerequisites**: 2
- 🎯 **By Tier**: 2 immediate (Tier 1), 3 roadmap (Tier 2), 0 nice-to-have (Tier 3), 0 wont-fix (Tier 4)
- 📋 **Execution Tasks Progress**: 9/24 completed (37%)

---

## 🟡 Ready to Execute (Pending Goals)

| Goal Package | Tier | Mode & Sequence | Dependencies | Focus & Description | Launch Command |
| :--- | :---: | :---: | :--- | :--- | :--- |
| [`crisp-globe-textures-and-shading`](crisp-globe-textures-and-shading/goal.md) | `🗺️ Roadmap` | `🚢 SHIP ⚡ Independent (#1)` | - | High-Contrast 4K Globe Textures and Ocean Specular Glint — Upgrade Earth textures to 4K NASA Blue Marble and Black Marble with ocean specul... | `/goal goals/crisp-globe-textures-and-shading/goal.md` |
| [`adhan-3d-light-pillars`](adhan-3d-light-pillars/goal.md) | `🗺️ Roadmap` | `🚢 SHIP ⛔ Blocked (#2)` | Prereqs: crisp-globe-textures-and-shading | 3D Vertical Light Pillars for Active Adhan Settlements — Render 3D glowing columns rising from cities calling Adhan, colored by prayer an... | `/goal goals/adhan-3d-light-pillars/goal.md` |
| [`adhan-sound-waves-and-qibla-arcs`](adhan-sound-waves-and-qibla-arcs/goal.md) | `🗺️ Roadmap` | `🚢 SHIP ⛔ Blocked (#3)` | Prereqs: adhan-3d-light-pillars | Minaret Acoustic Ripple Rings and 3D Qibla Arcs — Animate expanding sound wave rings on active Adhan cities and draw glowing 3D Qi... | `/goal goals/adhan-sound-waves-and-qibla-arcs/goal.md` |

---

## 🟢 Implemented & Verified

| Goal Package | Mode | Shape | Task / Ref | Commit |
| :--- | :---: | :--- | :--- | :--- |
| [`adhan-earth-observatory`](adhan-earth-observatory/goal.md) | `⚡ Indep` | 🚢 SHIP | Git Commit | `779cc42` |
| [`cloudflare-worker-athan-waqf-dev`](cloudflare-worker-athan-waqf-dev/goal.md) | `⚡ Indep` | 🚢 SHIP | Git Commit | `33729c5` |
