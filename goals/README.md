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
- 🟢 **Implemented & Verified**: 5
- 🟡 **Ready to Execute (Pending)**: 0 (0 independent ⚡, 0 unblocked 🔗)
- 🎯 **By Tier**: 2 immediate (Tier 1), 3 roadmap (Tier 2), 0 nice-to-have (Tier 3), 0 wont-fix (Tier 4)
- 📋 **Execution Tasks Progress**: 24/24 completed (100%)

---

## 🟢 Implemented & Verified

| Goal Package | Mode | Shape | Task / Ref | Commit |
| :--- | :---: | :--- | :--- | :--- |
| [`crisp-globe-textures-and-shading`](crisp-globe-textures-and-shading/goal.md) | `⚡ Indep` | 🚢 SHIP | Git Commit | `2d1b4a3` |
| [`adhan-earth-observatory`](adhan-earth-observatory/goal.md) | `⚡ Indep` | 🚢 SHIP | Git Commit | `779cc42` |
| [`cloudflare-worker-athan-waqf-dev`](cloudflare-worker-athan-waqf-dev/goal.md) | `⚡ Indep` | 🚢 SHIP | Git Commit | `33729c5` |
| [`adhan-3d-light-pillars`](adhan-3d-light-pillars/goal.md) | `🔗 Dep` | 🚢 SHIP | Git Commit | `4f99b55` |
| [`adhan-sound-waves-and-qibla-arcs`](adhan-sound-waves-and-qibla-arcs/goal.md) | `🔗 Dep` | 🚢 SHIP | Git Commit | `eb97b7d` |
