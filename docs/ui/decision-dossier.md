# Decision Dossier & Reusable Property Primitives

**Date:** 25 Aug 2026  
**Workstream:** `P1-COST-001`, `P1-MEDIA-002`, `P1-UI-001`

Implements the high-value, additive part of the design review: make Architech a *decision dossier* (understand a property, its locality, and its true cost) plus a reusable property-primitive layer — without breaking the SEO/SSR/perf foundation or re-routing URLs.

## What was added

### 1. Buyer ownership-cost estimator (`lib/cost/ownership.ts` + `POST /api/cost/ownership`)
- Reduces a listing price to **estimated monthly EMI**, **stamp duty**, **registration**, and **cash required** — 80% LTV, 20y, 8.5% by default, all adjustable, each labelled.
- Pure `calculateOwnershipCost` + `monthlyEmi` (reducing balance). Educational only; not a lender quote or tax advice.
- `OwnershipCost` panel on the listing dossier with tenure/rate inputs.

### 2. Premium listing gallery (`ListingGallery` + `lib/listing/media.ts`)
- Primary-first slides + editorial context shots (Facade & materiality, Neighbourhood, Architecture in context), each with label + alt text.
- Desktop thumbnail rail + mobile **scroll-snap** carousel (no third-party dependency).
- **Fullscreen lightbox**: keyboard (←/→/Esc), focus-managed, body-scroll locked, counter + media labels.
- Media + count are **SSR-rendered** (verified: "Primary view", "4 photos"), so no-JS SEO keeps the media facts.

### 3. Sticky conversion bar (`StickyBar`)
- Appears after a scroll threshold (transform/opacity only, reduced-motion safe): price + locality, **save** toggle, **Ask about this home** CTA that opens the lead dialog (now controlled/shared).

### 4. Reusable property primitives — PropertyCard variants
- `variant="grid" | "horizontal" | "map-preview"` on `PropertyCard`.
- **Restrained hover**: image scale 1→1.025 + a cross-faded secondary editorial shot (via `secondaryImage`), textual verification line (`badge` text next to `status`), keyboard-accessible save.

## Scope decisions (foundation-safe)
- **Not** re-routing `app/market/` or adding RTK-Query (Suggestion 2): moving `/listing/:id` → `/market/listing/:id` would break canonical URLs, the registry-driven sitemap, JSON-LD, bookmarks, and the raw-HTML SEO smoke — directly conflicting with the production-foundation mandate. The shared-layer benefit is instead delivered through reusable primitives + a controlled dossier composition, with URLs unchanged.
- **No new runtime deps** (`motion`, `embla`, `lenis`): the repo already has CSS-driven motion + a reduced-motion-aware `Reveal`; CSS transitions + native scroll-snap cover the gallery/card/interaction needs without bundle growth. Lenis is intentionally avoided (native scrolling is more reliable for maps/a11y/perf).

## Validation
```bash
pnpm test      # 60 files / 284 tests
pnpm check / lint / build
pnpm test:seo  # 9 routes
pnpm test:perf # budgets re-baselined (documented)
pnpm storybook:smoke
```
Storybook stories added for `ListingGallery`, `OwnershipCost`, and PropertyCard `Horizontal`/`MapPreview` variants.
