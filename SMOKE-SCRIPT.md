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
- ⚠ **Use a normal, everyday browser you opened yourself.** Do not run these checks in an automation
  or "test" browser (Playwright, Puppeteer, Selenium, a headless window, or anything launched from a
  script). Those browsers disable features real customers have, and section **G** below cannot fail in
  them — it will report a false PASS. See the caveat in section G.

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
| F9 | Send to Cart → browser Back → button usable again (section G caveat applies) |

## G. Desktop — Send to Cart, then browser Back (bug C3)
> **Why this section exists:** the Send-to-Cart button used to stay greyed out on "Adding to cart…"
> forever after you pressed Back from the Shopify checkout, so the customer could not order. Fixed
> 19 Aug 2026; this is the check that it stays fixed. It exercises a real cart, but takes no payment —
> stop at the checkout page, never enter card details.

1. Open https://planner.brownboxkit.co.nz in a **normal browser tab you opened yourself**.
2. Draw a small room and place any **base cabinet**.
3. Click 🛒 **Send to Cart** and wait until the Shopify checkout page has loaded.
4. Press the browser **Back** button once (do **not** refresh, and do not use Ctrl+R).
- **Pass if:** the Send-to-Cart button is green and reads `🛒 Send to Cart`.
- **Fail if:** it is grey and still reads `Adding to cart…`.
5. Click 🛒 **Send to Cart** again — it must actually reach the checkout, proving the button really
   works and was not just relabelled.
6. Repeat steps 2–5 on **iPad and iPhone Safari.** This is the important one — those browsers restore
   the page differently from desktop Chrome, which is exactly why the fix does not rely on the
   browser telling us a restore happened.

> ⚠ **Caveat that produced a false PASS on 19 Aug 2026 — read before reporting.** Pressing Back only
> exercises this bug if the browser restores the page from its **back/forward cache** instead of
> reloading it. A default automation browser (Playwright/Puppeteer/Selenium/headless Chrome) has that
> cache **switched off**, so Back silently does a fresh page load — and on a fresh load the button
> starts out green anyway. The test then passes identically with **and without** the fix, which is not
> a test at all. During C3 testing an agent-driven Chrome did exactly this and reported PASS on a run
> that could not fail; it had to be withdrawn (see the CORRECTION entry in `RELAY.md`).
>
> **How to tell which one you got:** if the **"Resume your unsaved design?"** prompt appears after
> pressing Back, the page reloaded from scratch — that run proves nothing about this bug. **Report it
> as "inconclusive — page reloaded", not as a pass.** On a genuine restore the design is simply still
> there, with no prompt.

---

## Tester report template (paste back to H → O/A)
```
Item 10 completion — tester: [name] — date: [date] — device: [desktop / iPad]
A Restart Planner:    pass / fail — saw: ___
B 300mm slab:         pass / fail — saw: ___
C Power point elev.:  pass / fail — saw: ___
D Door/window drag:   pass / fail — saw: ___
E Zoom speed:         pass / fail — saw: ___
F iPad F1–F9:         pass / fail per row — saw: ___
G Send-to-Cart Back:  pass / fail / inconclusive-page-reloaded — saw: ___
                      (did the "Resume your unsaved design?" prompt appear? yes / no)
Screenshots attached: yes / no
```

---

## Already verified on desktop (H, 29 Jul 2026) — no need to re-run unless regressing
Save Project · Quote CSV + PDF · undo/redo · Send-to-Cart (service line) ·
S3 OAuth draft restore · S4 refresh resume prompt (Restore + Discard) ·
S5 service product (no 3D box, quote/CSV/PDF/cart, save+reload round-trip).

## Known gaps carried out of Sprint 1
- Genuine **v1–v3 legacy save** migration not live-tested (no pre-v4 save exists) — covered by A code-audit.
- Sections **A–F** (Restart, slab, GPO, door/window, zoom, all touch) are the outstanding **item 10** remainder.
- Section **G** is not part of item 10 — it is the live verification of bug **C3**, added 19 Aug 2026, and it has never been run on a real device by a human.
