# Planner Smoke-Test Script (browser-only — no Git, no repo access)

**Live URL:** https://planner.brownboxkit.co.nz
**Who this is for:** a verifier/tester (browser-only role). You need the live URL and a test Google account. You do **not** need GitHub or any code access.
**Origin:** AGENTS.md "Post-task smoke checklist" + H's Sprint-1 live-verification report (29 Jul 2026). This file is the single source for the manual smoke pass (Law S — kept in the repo, not in chat).

## Rules
- One step at a time. **Record what you actually see — never assume.**
- Refresh with **Ctrl+R** (not F5 if F5 is bound to something else on your keyboard).
- The iPad/touch section requires a real iPad or iPhone.
- If you need an on-screen console on a device, use **eruda** (already loaded on the page per AGENTS.md).
- Report **pass/fail + a screenshot** for each step, using the template at the bottom.

---

## A. Desktop — Restart Planner
1. Open https://planner.brownboxkit.co.nz
2. ☰ (hamburger) → 🔄 **Restart Planner** → confirm **Restart — discard work**.
- **Pass if:** empty room, total `$0.00`, no error.

## B. Desktop — 300mm slab (place → save → reload)
1. Draw a small room (🧱 → Preset Room → **Rectangle** → ✓).
2. Place any **base cabinet**.
3. Note the cabinet sits on the grey **slab** (not floating, not sunk).
4. ☰ → 💾 **Save Project** → name it e.g. `Slab test`.
5. Browser **Refresh (Ctrl+R)** → ☰ → **My Projects** → **Load** the project.
- **Pass if:** cabinet is still on the slab (not sunk or floating) after reload.

## C. Desktop — Power point (GPO) in elevation
1. With walls drawn, switch to **elevation view** (wall-facing mode — use the existing elevation entry in the UI).
2. Find the **power point / GPO** button.
3. Place one power point on a wall.
- **Pass if:** the GPO appears in elevation, no error.

## D. Desktop — Door/window drag + dims
1. Add a **door or window** to a wall.
2. Select it, then **drag** it along the wall.
- **Pass if:** it moves along the wall and dimensions are visible / update.

## E. Desktop — Zoom speed with a cabinet selected
1. Place and **select** a cabinet.
2. Scroll-zoom (mouse wheel).
- **Pass if:** zoom feels normal (not extremely fast/slow vs. when nothing is selected).

## F. iPad / iPhone — full touch pass
Repeat on a real device: https://planner.brownboxkit.co.nz

| # | Check |
|---|-------|
| F1 | Long-press selects a cabinet (touch select) |
| F2 | Save Project + Restart Planner via ☰ |
| F3 | Cabinet on 300mm slab after save → reload → load |
| F4 | Power point in elevation |
| F5 | Quote CSV + PDF export |
| F6 | Door/window select + drag |
| F7 | Undo / redo |
| F8 | Zoom speed normal with a cabinet selected |

---

## Tester report template (paste back to H → O/A)
```
Item 10 completion — tester: [name] — date: [date] — device: [desktop / iPad]
A Restart Planner:    pass / fail — saw: ___
B 300mm slab:         pass / fail — saw: ___
C Power point elev.:  pass / fail — saw: ___
D Door/window drag:   pass / fail — saw: ___
E Zoom speed:         pass / fail — saw: ___
F iPad F1–F8:         pass / fail per row — saw: ___
Screenshots attached: yes / no
```

---

## Already verified on desktop (H, 29 Jul 2026) — no need to re-run unless regressing
Save Project · Quote CSV + PDF · undo/redo · Send-to-Cart (service line) ·
S3 OAuth draft restore · S4 refresh resume prompt (Restore + Discard) ·
S5 service product (no 3D box, quote/CSV/PDF/cart, save+reload round-trip).

## Known gaps carried out of Sprint 1
- Genuine **v1–v3 legacy save** migration not live-tested (no pre-v4 save exists) — covered by A code-audit.
- This document's checks (Restart, slab, GPO, door/window, zoom, all touch) are the outstanding **item 10** remainder.
