# Architech — Full Project Audit & Improvement Plan

> ## ✅ Status update — 23 Aug 2026
> **All top-10 priorities and applicable P1 findings implemented:** favicon + OG/social meta + theme-color, per-route titles, persistent saves (localStorage + context + real /saved page + header count badge), demo-data labelling everywhere, WCAG contrast pass (0 remaining violations), URL-synced multi-select filters + real sort, WebP/srcset images + hero preload (hero 207KB→43KB mobile), lead-form dialog with masked-contact explainer, 13 unused deps removed + ESLint(jsx-a11y) + 10 unit tests + GitHub Actions CI, README/todo/ideas/MCP docs refreshed, `__manus__` deleted, parameterized locality routes (6 localities, real OSM frames), honest 404s for unknown listings, server compression/cache/security headers, rAF-throttled animations, keyboard-navigable search suggestions.
> **Deferred (needs production stack):** Storybook, broker onboarding, dark mode, MapLibre pin-sync, SSR/SEO (Next.js migration).
**Date:** 23 Aug 2026 · **Scope:** every file/area of the prototype + repo · **Build status:** ✅ tsc clean, ✅ prod build passing, ✅ all 7 routes 200

---

## 1. Scorecard

| Area | Grade | Verdict |
|---|---|---|
| Visual design & motion | 🟢 A | Distinctive, coherent, 2026-grade |
| Component architecture | 🟢 A− | Clean split (pages / architech / magicui / ui) |
| Accessibility | 🟡 B | Strong foundations; contrast + focus-trap gaps |
| Performance | 🟡 B− | Good habits, but fonts/images unoptimized |
| SEO readiness | 🔴 D | SPA with zero meta — known Phase-1 gap |
| Code quality & tooling | 🟡 C+ | No lint, no tests, ~10 dead dependencies |
| Data layer | 🔴 D | All hardcoded; no API, no state persistence |
| Repo hygiene / docs | 🟡 C+ | Stale docs contradict the shipped design |

---

## 2. Item-by-item review

### 2.1 `client/index.html` — 🔴 highest-impact gaps
**Good:** clean, correct fonts, semantic lang attribute.
**Improve:**
- **No favicon** — browser shows default icon (P0, 5 min)
- **Zero social/meta tags** — no `og:title`, `og:image`, `twitter:card`, `theme-color`, canonical. Links shared on WhatsApp (critical in India) show nothing (P0)
- Google Fonts CSS is **render-blocking**; loads ~10 font weights. Subset to used weights, add `media="print" onload` swap trick or self-host with `font-display: swap` (P1)
- No `<link rel="preload">` for the hero image → slower LCP (P1)
- `lang="en"` only — no `lang` switching strategy for Hindi content (P2)

### 2.2 Images (`client/public/images/`) — 🟡
**Good:** bespoke, on-brand, all referenced, lazy-loaded below the fold.
**Improve:**
- 2.0 MB total JPEG; 4 files >300 KB. Convert to **WebP/AVIF** (~60-70% smaller) with `<picture>` fallback (P1)
- No `srcset`/`sizes` — mobile users download desktop-size images; the repo's own architecture doc mandates responsive derivatives (P1)
- Hero has no `fetchpriority="high"`; card images have no explicit `width/height` → minor CLS risk (P1)
- Only one image per property — galleries reuse the same 7 assets (P2, needs more assets)

### 2.3 `App.tsx` (shell, header, footer) — 🟢
**Good:** skip-link, Escape-to-close, aria-labels, scroll-aware header, editorial footer.
**Improve:**
- **No per-route `document.title`** — every page is titled identically; also hurts history/bookmarks. Add a tiny `useTitle()` hook per page (P0, 20 min)
- Mobile menu isn't a focus trap and lacks `aria-modal` semantics; consider shadcn `Sheet` (P1)
- Footer "How we verify"/"RERA methodology" both point at `/guide` — fine now, but should become anchors (`/guide#verify`) (P2)
- Header offset `pt-[78px]` is duplicated in every page — extract to a layout constant (P2)

### 2.4 `index.css` (design system) — 🟢
**Good:** tokenized palette, motion tokens, comprehensive reduced-motion block, signature utilities.
**Improve:**
- **Contrast audit needed:** 24 usages of `ink/35–45` and `paper/40–45` for 9–11px mono text — most fail WCAG AA (4.5:1). Bump floors to `ink/55` & `paper/60` for text that conveys information (P0)
- `.ruled` utility is defined but unused — delete or use (P2)
- Legacy aliases (`--clay`, `--limestone`) kept "just in case" — grep shows no remaining users; remove (P2)
- Dark mode variables don't exist despite `@custom-variant dark` — either implement `.dark` tokens or remove the variant (P2)

### 2.5 `pages/Home.tsx` — 🟢
**Good:** strongest page; hero, suggestions, bento, tickers, testimonials, FAQ all work.
**Improve:**
- Search suggestions panel: no keyboard navigation (↑/↓/Enter) and `role="listbox"` without managed `aria-activedescendant` — arrow-key support or switch to `cmdk` (already a dependency!) (P1)
- Search input discards the typed query on submit — pass it as `/search?q=…` and reflect it there (P1)
- Testimonials are fictional but presented as real — add a "concept preview" disclaimer or mark as illustrative to stay aligned with the repo's own trust rules (P0 for honesty)
- Stats (281 homes / 37 re-verified) are invented — same trust rule: label as demo data (P0)
- `WordReveal` attaches a scroll listener per instance — throttle with rAF or use IntersectionObserver steps (P2)

### 2.6 `pages/ResultsPage.tsx` — 🟢
**Good:** working filters, skeletons, aria-live, bottom-sheet, OSM map, curated empty state.
**Improve:**
- Filter state is lost on navigation — sync to URL (`/search?filter=2bhk`) so back-button and sharing work; this is also the repo's canonical-URL principle (P1)
- Only single-select filters — real users combine BHK + price + verified; make chips multi-select with AND logic (P1)
- "Page 1 of 43" is fake pagination on 4 items — either hide it or paginate honestly over a bigger fixture set (P1)
- Sort control is announced in copy ("sorted by freshness") but doesn't exist — add a real `Select` (P2)
- "Search this area" resets filters as a side effect — surprising; keep filters, only refresh (P2)

### 2.7 `pages/CityPage.tsx` — 🟢
**Good:** breadcrumbs, snapshot card, editorial spread, real OSM distances.
**Improve:**
- Hardcoded to Paldi while the route says `/buy/ahmedabad/` — either rename route to `/buy/ahmedabad/paldi/` (matches the architecture's URL grammar) or make it a real city page listing localities (P1)
- "128 homes" vs. 4 shown — reconcile the counts or label as demo (P1)
- Nearby-locality chips all link to the same page — wire to real locality params once the route is parameterized (P1)

### 2.8 `pages/ListingPage.tsx` — 🟢
**Good:** trust-first layout, RERA tooltip, info-trail timeline, privacy-respecting map note.
**Improve:**
- Unknown listing IDs silently show the first property — return the 404 page instead (P1, correctness)
- "Ask about this home" button does nothing — open a shadcn `Dialog` with a demo lead form (name, message, masked-phone explainer) to complete the core funnel (P1)
- The fabricated RERA number is shown as real — prefix with "DEMO" or move to fixture data flagged as sample (P0 trust rule)
- Gallery images aren't clickable — add a lightbox (shadcn `Dialog` + carousel already available) (P2)

### 2.9 `pages/Guide.tsx`, `Saved.tsx`, `NotFound.tsx` — 🟢
**Improve:**
- Guide cards are `cursor-pointer` but go nowhere — either build one real article page (great for the SEO story) or remove the pointer affordance (P1)
- `/saved` is always empty even after hearting cards — persist saves in `localStorage` + a tiny context; then Saved actually lists them. Highest-value small feature in the app (P0, ~1 hr)
- 404 renders with HTTP 200 (SPA limitation) — note for the Next.js migration (P2)

### 2.10 Components (`architech/`, `magicui/`) — 🟢
**Improve:**
- `PropertyCard` save state is per-mount — the same home shows unsaved elsewhere; move to shared context/localStorage (P0, same task as Saved)
- Compare toast says "pick one more home" but there's no compare page/state — either build a minimal compare drawer or soften the copy (P1)
- `TiltCard` writes styles in mousemove without rAF throttling (P2)
- `NumberTicker` uses `toLocaleString("en-IN")` — good; add `aria-label` with final value so SRs don't read intermediate numbers (P1)

### 2.11 `server/index.ts` — 🟡
**Improve:**
- No compression, no cache headers, no security headers. Add `compression`, long-cache for `/assets`, and basic helmet-style headers (P1 for any real deploy)
- `app.get("*")` breaks on Express 5; pin Express 4 (already ^4.21) or use `app.use` fallback (P2)

### 2.12 Dependencies (`package.json`) — 🟡
- **Unused in app code:** `axios`, `recharts`, `streamdown`, `framer-motion`, `zod`, `nanoid`, `react-hook-form`, `input-otp`, `react-day-picker`, `embla-carousel-react`, `cmdk`, `react-resizable-panels`, `next-themes` (only via unused ui files). Removing unused ui components + deps cuts install and bundle risk (P1)
- No `lint` script — add ESLint + `eslint-plugin-jsx-a11y` (catches the contrast/aria issues automatically) (P1)
- `vitest` installed, **zero tests** — start with 3: filters logic, save persistence, route smoke (P1)
- No CI — a 20-line GitHub Action running `tsc && vitest && build` protects `main` now that PRs are flowing (P1)

### 2.13 Repo docs — 🟡
- `README.md` still says "this is the architecture source, not application source" and describes Bricolage Grotesque/Editorial Terracotta — now inaccurate. Add a "Prototype" section w/ screenshots + run instructions (P1)
- `todo.md` items are all unchecked but mostly done — update or archive (P2)
- `ideas.md` documents the *old* theme as chosen — append the Amdavad Modern decision record (P2)
- `free-first-design-mcp-workflow.md` — fold in the 2026 MCP revision we discussed (P2)
- Leftover `client/public/__manus__/` debug folder — delete (P0, 1 min)

### 2.14 SEO (known, structural) — 🔴
Everything the repo's own architecture mandates is impossible in a Vite SPA: SSR HTML, per-route metadata, JSON-LD, sitemaps, robots, canonical URLs, lifecycle status codes. **The real fix is the planned Next.js migration**; until then: per-route titles/meta via a head manager, `robots.txt`, and honest 404s are the best available patches (P1 patches, P0 migration when ready).

---

## 3. Top 10 priorities (ordered)

| # | Item | Effort | Why first |
|---|---|---|---|
| 1 | Favicon + OG/social meta + theme-color | 30 min | Every share/tab looks broken today |
| 2 | Per-route `document.title` | 20 min | UX + history + baseline SEO |
| 3 | Persistent saves (localStorage + context) → real `/saved` page | 1 hr | Turns a dead page into the app's stickiest feature |
| 4 | Label demo data (stats, testimonials, RERA nos.) | 30 min | The repo's own #1 trust rule |
| 5 | Contrast pass on mono stamps (ink/40 → ink/55+) | 30 min | WCAG AA; 24 violations |
| 6 | Filter state in URL + multi-select | 1–2 hr | Shareable searches, honest UX |
| 7 | WebP conversion + srcset + hero preload | 1 hr | ~1.3 MB saved; India mobile-first |
| 8 | Lead-form dialog on listing page | 1 hr | Completes the discovery→lead funnel |
| 9 | Remove unused deps/ui + add ESLint + 3 tests + CI | 2 hr | Protects `main`; PRs now exist |
| 10 | README refresh + delete `__manus__/` | 30 min | Repo tells the truth again |

**Structural next step (when ready):** the Next.js 16 migration the architecture docs mandate — SSR, real SEO, Postgres data layer.

---

*Generated from a live audit: image weights measured, dependency usage grepped, meta tags counted, contrast classes counted, routes and build verified.*
