# Phase 1 Trust-Aware Listing Surface

**Date:** 25 Aug 2026  
**Workstream:** `P1-SEO-008`

The listing page now surfaces the trust score visibly and honestly, and emits structured verification signals for search engines.

## Files

```text
client/src/components/architech/TrustPanel.tsx
app/listing/[id]/page.tsx
client/src/lib/i18n.ts
scripts/seo/raw-html-smoke.mjs
```

## What changed

- **Visible trust dossier.** `TrustPanel` renders the 0–100 score, the six verification signals (with pass/open states), and an honest explanation. It is derived from structured facts via `badgesToTrustInput` + `computeTrustScore`; it never invents claims.
- **Translated labels.** New `listing.trust` dictionary keys in both `en` and `hi`, keeping the i18n shape-parity invariant intact.
- **Structured JSON-LD.** The listing server component adds `additionalProperty` on the `Residence` node encoding `trustScore`, `trustGrade`, and each signal as a `PropertyValue` — machine-readable and scoped to the `Place` type.
- **SEO regression net.** `scripts/seo/raw-html-smoke.mjs` now asserts the listing page contains `trustScore`, `additionalProperty`, `Trust score`, and the `RERA verified` badge.

## Accessibility

- The panel is a `<section>` labelled by an `<h2>` (`aria-labelledby`).
- Signal rows use a semantic `<ul>`/`<li>`; decorative status glyphs are `aria-hidden`.

## Validation

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
node scripts/seo/raw-html-smoke.mjs
node scripts/performance/budget.mjs
```

Budget baseline after this change: `/listing/[id]` first-load JS 685.6 KiB raw / 209.7 KiB gzip, listing HTML 47.3 KiB — within Phase 1 budgets.
