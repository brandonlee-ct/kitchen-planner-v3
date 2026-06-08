# Brown Box Kit Planner — Plain-English Plan & Roadmap

> Read this with Markdown Preview (`Ctrl+Shift+V`) for easy full-width reading.
> This is the same plan as `ARCHITECTURE.md`, but written without technical jargon.

---

## Part 1 — What you've built, explained simply

Think of your app as **a website that lets a customer design their own kitchen in 3D,
see the price update live, and buy the cabinets** — all inside Brown Box Kit's online shop.

It's made of a few separate pieces that each do one job:

- **The Planner itself** — the drawing app the customer sees and uses. It runs entirely
  in their web browser (no app to install). It's the big file `main.js` plus the page
  layout (`index.html`) and styling (`style.css`).
- **The 3D engine (three.js)** — the technology that draws the walls, room, and cabinet
  models in 3D and 2D. Think of it as the "graphics card" of your app.
- **The cabinet models (GLB files)** — the actual 3D shapes of each cabinet. Each Shopify
  product points to its 3D model and its real-world size (width/height/depth in mm).
- **Shopify** — your existing online shop. It holds the products, prices (in NZD), and the
  shopping cart/checkout. The planner *reads* products from Shopify so you never have to
  type them in twice — update a product in Shopify and the planner sees it automatically.
- **Supabase** — the "filing cabinet + reception desk." It handles **logins** (who the
  user is) and **saves projects** (their kitchen designs) so they can come back later.
- **Vercel + GitHub** — how your app gets published online. GitHub stores every version of
  your code safely; Vercel takes it and puts it live on the internet automatically.

**How a customer journey flows:**
1. Customer opens the planner (inside your Shopify site).
2. They log in (their shop account).
3. They draw their room walls and set sizes.
4. They drag in cabinets from your real catalog — the price total updates live.
5. They save the project and/or send it to the cart to check out.

### The one urgent thing to fix (in plain English)

Right now, the "lock on the filing cabinet" isn't switched on. Your save system *currently*
trusts the app to only show each person their own designs — but a tech-savvy person could
bypass that and peek at other people's saved projects. The fix is a built-in Supabase
security feature called **Row Level Security** — basically, the database itself enforces
"you can only see your own stuff." **This must be switched on before you let strangers
create accounts.** I'll give you the exact steps; you click them in Supabase.

### User vs Admin (permissions)

- **Admin (you):** can see everything — all projects, all activity.
- **User (customer):** can only see and edit their own designs.
- (Optional middle tier: **Staff** — your team/trainee, more than a customer but less than full admin.)

---

## Part 2 — FULL TASK LIST: Phase 1 (Shopify MVP Launch)

These are everything needed to go from "live prototype" to "real product customers buy from."
Listed in the smart order to do them, with who should own each.

| # | Task (plain English) | Who |
|---|---|---|
| 1.1 | **Fix the bugs** stopping good testing: wall selection broken on Android/iPhone; make save/load pop-up messages visible; make wall dimension labels show right after loading a saved project. | Me |
| — | **Switch on security** (Row Level Security) + set up admin/user roles, so people only see their own designs. | Me writes it, you click in Supabase |
| 1.2 | **Improve wall drawing** (your biggest pain): hold Shift to lock to 90°, coloured on-screen guides (green = square corner, blue = parallel), type exact ceiling height & wall thickness, preset rooms work on desktop too, live dimensions + corner angles while drawing, fix broken wall joins, auto-add a floor when the room is closed. | Me |
| 1.3 | **Tidy the mobile toolbar**: finger-friendly 44px buttons, a ☰ menu to save space, and a 📷 button to snap a picture of the design. | Me |
| 1.4 | **Power points in the wall elevation view** — add/move/delete them just like doors and windows. | Me |
| 1.5 | **Better dimension editor** in elevation view — click an opening, it highlights green and shows 5 editable measurement boxes. | Opus designs → Me builds |
| 1.6 | **Put the planner inside your Shopify shop** (embed it on a page). | Me + you (Shopify admin) |
| 1.7 | **One login everywhere** — when a customer logs into your Shopify shop, they're automatically logged into the planner too. (Tricky; needs careful design.) | Opus |
| 1.8 | **Downloadable quote PDF** — product codes, photos, quantities, prices, total. | Opus designs → Me builds |
| 1.9 | **Store design thumbnails properly** (in Supabase Storage instead of inside the database) so it stays fast. | Me |
| 1.10 | **Smart snapping rules** for tall/corner/island cabinets + standard height tiers. | Opus |
| 1.11 | **Share links** — a read-only link (like `/p/abc123`) to show a design without letting others edit it. | Me |
| 1.12 | **Basic analytics** — count walls drawn, products placed, carts sent (so you learn how it's used). | Me |
| 1.13 | **Legal basics** — privacy policy, terms & conditions, and a "download my data" option. | Me drafts, you/lawyer approve |
| 1.14 | **Final architecture review** before launch. | Opus |

---

## Part 3 — Phase 2: Pro Features (the "wow" upgrades, after launch)

Do these only after the Shopify launch is solid. In plain English:

| # | What it is |
|---|---|
| 2.1 | **Realistic look** — proper lighting, real materials, soft shadows (showroom-quality). |
| 2.2 | **Walk through your kitchen** — drag a little person onto the floor and see it from their eyes. |
| 2.3 | **Game controller support** — navigate with a gamepad. |
| 2.4 | **Bluetooth tape measure** — connect a laser measure (Disto/Bosch) so real measurements type themselves in. |
| 2.5 | **Manual mm entry on iPhone** — replace the "coming soon" pop-ups with real input. |
| 2.6 | **Colour/material swatches** — change each cabinet's finish. |
| 2.7 | **Auto benchtop** — automatically run a benchtop across the base cabinets. |
| 2.8 | **Splashback + appliance placeholders** — more items to place. |
| 2.9 | **Offline mode** — keep working with no internet (cached catalog). |
| 2.10 | **Apple Pencil drawing** — precise drawing on iPad. |
| 2.11 | **Per-wall thickness** — set thickness per wall (today it's one global setting). |
| 2.12 | **Multiple rooms/floors** — switch between several rooms in one project. |
| 2.13 | **4K + AI photo-real renders** + LED light strips. |
| 2.14 | **Construction plan PDF** — top-down plan with overall + per-cabinet sizes. |
| 2.15 | **Elevation sheets (A/B/C/D)** — auto-labelled wall views with per-cabinet sizes. |
| 2.16 | **Cross-section tool** — "slice" the kitchen to show wall/cabinet depths. |
| 2.17 | **Lighting placement** — ceiling and under-cabinet lights. |
| 2.18 | **Drag-and-drop colour** — recolour floors and walls. |
| 2.19 | **Wall cut tool** — cut a wall with a live preview and distance readouts. |
| 2.20 | **Plan underlay import** — load a PDF/photo of a floor plan to trace over. |

---

## Part 4 — Phase 3: White-Label SaaS (the business expansion)

This is turning the planner into a **product you sell to other companies** (not just Brown
Box Kit). In plain English, it means:

- **Multi-tenant** — many separate companies use the same system, each seeing only their own
  data (like separate apartments in one building).
- **Custom theming** — each company gets their own logo/colours.
- **Admin dashboard** — a control panel to manage customers and content.
- **Stripe billing** — charge other companies a subscription automatically.
- **Per-tenant Shopify connect** — each company plugs in their own shop.
- **Usage metering** — track how much each company uses (for billing/limits).
- **Project versioning** — keep a history of design changes.
- **Team accounts** — multiple staff per company.
- **Public API** — let other software talk to your planner.
- **Marketing site** — a website to sell the product.

---

## Milestones (the big checkpoints)

- **A — Make the live prototype safe & smooth (~1 day):** fix the bugs (1.1) + switch on
  security. Then it's ready for your trainee and outside testers. *(The link already exists.)*
- **B — Shopify MVP launch (~1–2 weeks):** better drawing, mobile toolbar, send-to-cart,
  embed in shop, quote PDF, share links.
- **C — One-login bridge + final review, then launch.**

---

## Who does what (your management model)

- **Opus** = the architect. Designs the hard/risky parts and writes clear task briefs.
- **Me (in Cursor)** = the builder. I take a brief, write and run the code, save it safely,
  and report back. I can handle ~90% of the hands-on work.
- **Your trainee** = guided helper. Real-device testing, entering product data in Shopify,
  checking quality against a checklist. I'll write simple step-by-step briefs for them.
- **You** = the project manager. You decide priorities, approve plans, and do the few things
  only an account owner can (Shopify/Supabase logins, business & legal calls).
