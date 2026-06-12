# Brown Box Kit — 3D Kitchen Planner

Live planner: **planner.brownboxkit.co.nz**

---

## Shopify integration (Phase 1)

### Option A — Subdomain link (recommended first step)

Add a navigation link or button anywhere in your Shopify theme that points to:

```
https://planner.brownboxkit.co.nz
```

This is the simplest and most reliable option. The planner opens in a new tab,
fully standalone. No theme changes required beyond adding the link.

---

### Option B — Embedded iframe with `?embed=1`

If your theme allows custom HTML (e.g. a Custom Liquid section), you can embed
the planner directly in a Shopify page:

```html
<iframe
  src="https://planner.brownboxkit.co.nz?embed=1"
  style="width:100%; height:80vh; border:none; border-radius:8px;"
  allow="fullscreen"
  title="Kitchen Planner">
</iframe>
```

The `?embed=1` parameter activates embed mode:
- Toolbar is slightly slimmer to save vertical space
- Advanced / developer tools (Free Draw, Import GLB, X-Ray Walls) are hidden
- All core features remain: products, quote, save/load, Send to Cart, auth

**Note:** Some Shopify themes block iframes via Content Security Policy. Test in
your theme before relying on this option. If it is blocked, use Option A.

---

### Recommended Phase 1 rollout

1. Deploy planner to `planner.brownboxkit.co.nz` (already live via Vercel)
2. Add a "Design Your Kitchen" link/button in the Shopify nav or a landing page
   pointing to the standalone URL — zero risk, works everywhere
3. Optionally test the iframe embed on a draft page; promote it if the theme allows

Phase 2 (not in scope here): customer-account sync, JWT bridge, Shopify checkout
session continuity.

---

## Local development

```bash
npm install
npm run dev      # dev server at localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the build locally
```

Stack: Vite · three.js · Supabase · Shopify Storefront API · Vercel
