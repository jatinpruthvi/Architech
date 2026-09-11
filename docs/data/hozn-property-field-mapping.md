# Formal Hozn-to-Architech Property-field Mapping

**Status:** Review complete; Architech remains the production foundation.

## Mapping principles

Hozn’s property CRUD vocabulary is useful for naming and grouping, but Architech must preserve richer lifecycle semantics. A field is not simply accepted because it exists in an external form: it needs validation, source provenance, privacy classification, moderation behavior, and an indexability decision. Public claims must come from approved source records, while broker-entered drafts remain private until moderation.

| Hozn-style field or concept | Architech field/contract | Validation | Provenance and privacy | SEO/indexability | Decision |
|---|---|---|---|---|---|
| Property title | `ListingDraftInput.title` | Minimum length and normalized text | Broker-entered draft; source context required | Published title only after moderation | Keep and use Architech validation |
| Location | `localitySlug` plus locality repository | Must match Ahmedabad locality vocabulary | Derived locality identity; no private address required in public draft | Canonical locality URL only for approved records | Keep; Architech’s locality model is stronger |
| Price | `priceInr` | Positive INR numeric value; supports price-on-request policy separately | Broker claim until verified; source timestamp required | Index only when approved and meaningful | Keep; do not infer market value |
| Bedrooms/BHK | `bhk` | Positive integer within supported range | Broker/source field; no sensitive data | Structured listing fact after approval | Keep |
| Area | `areaSqft` | Minimum area and numeric normalization | Source required; unit displayed explicitly | Structured listing fact after approval | Keep |
| Availability/status | `availability` | Required controlled vocabulary or reviewed free text | Must show freshness and source context | Public only after moderation | Keep; improve vocabulary over time |
| Description | `description` | Minimum length; no unsupported claims | Source context and moderation required | Editorial/public copy only after review | Keep; no generated or unverifiable claims |
| RERA | `reraNumber` | Format check and provider lookup when activated | Official RERA source or explicit unverified state | Add structured data only when verified | Keep; Architech’s RERA adapter governs truth |
| Images/media | `mediaRightsConfirmed` plus media attach contract | Rights confirmation, moderation, EXIF/takedown policies | Rights and audit event required | Derivatives/public media only after approval | Keep Architech media pipeline; never copy Hozn assets |
| User profile | Better Auth profile and broker organization | Server-side auth and role checks | Private account/org scope | Never index private profile | Do not copy Hozn JWT/profile implementation |
| Buy/sell action | Leads, requirements, shortlist, contact history | Consent, idempotency, rate limit, ownership | Audited event; masked contacts | Not an indexable listing mutation | Map conceptually; do not implement direct sale mutation |

## Review result

The current Architech listing wizard already covers the high-value Hozn property fields and adds stronger source-trail, rights, moderation, and RERA semantics. The measurable UX gap is not missing data coverage; it is **completion visibility**. A broker entering a draft should immediately see which required facts are complete before attempting draft creation. The approved bounded improvement is an in-form completion meter with a deterministic checklist and a clear distinction between field completion and publication verification.

The improvement does not add Hozn code, dependencies, assets, or authentication behavior. It uses Architech’s existing React state and design tokens, preserves server validation as the final authority, and does not change the API payload or moderation lifecycle.

## Online Booking Management pattern review

The repository’s strongest transferable patterns are presentation-level: a clear listing-to-detail journey, grouped booking facts, responsive filter and drawer behavior, date-range input hierarchy, and restrained motion around galleries and state changes. Architech can recreate the useful interaction principles with its own components. Because the repository did not declare an SPDX license in the API response and its visible code baseline is from 2023, no source code, assets, copy, or dependency configuration is imported. The repository is treated as inspiration only until licensing is clarified.

| Pattern observed | Architech adoption | Guardrail |
|---|---|---|
| Listing cards that expose a strong primary fact and a clear next action | Already reflected in Architech’s listing dossier and search rails | Preserve source and freshness labels; do not add fabricated ratings |
| Multi-step booking/listing composition | Reused only as a completion/readiness signal in the broker draft wizard | Server validation remains authoritative |
| Responsive filter and date-picker surfaces | Pattern reference for future search refinements | Use existing Architech controls and URL-synced state |
| Gallery/detail transitions | Pattern reference for future verified media | Rights, moderation, alt text, and provenance required |
| Dark/light presentation | Architech already has its own theme controls | Do not import template CSS or tokens |

## Verification status

TypeScript checking, linting, the 242-test suite, Prisma validation, the production wrapper, and nine-route raw HTML SEO smoke completed successfully after the wizard change. The dedicated Playwright accessibility suite could not launch because the local Playwright Chromium executable is absent; this is an environment prerequisite failure, not an application assertion result. The existing browser-based route verification remains the appropriate follow-up once the managed browser binary is available.
