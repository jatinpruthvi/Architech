# SEO operating system — decisions an agent must honour

**Status:** decisions taken while building `docs/seo/seo-operating-system.md`.
**Audience:** any engineer or AI agent changing this code before production.

This file exists because two decisions in the step-1 build are *silent*: they
are correct, they are invisible in a diff, and the obvious “clean-up” an agent
might reach for would reverse them while looking like an improvement. Each
entry below states the decision, the reason, and the **exact action** to take
if you disagree.

Read this before changing anything under `client/src/lib/seo/`,
`app/api/admin/acquisition/`, or `app/admin/acquisition/`.

---

## Decision 1 — The acquisition queue reuses an existing permission

**Decision.** `GET /api/admin/acquisition` is gated on
`moderation.queue.read`. No new permission, no roles migration.

**Where.** The constant lives in `client/src/lib/seo/acquisition-queue.ts` as
`ACQUISITION_READ_PERMISSION`, and the route imports it. It is exported rather
than inlined specifically so a test pins it.

**Why.** The queue is arithmetic over inventory the moderation queue already
exposes. Anyone who can read the moderation queue can derive coverage from it
today. A dedicated permission would mean a roles migration, a seed update, and
a permission matrix change for no additional access control — and a migration
is a real risk to carry for zero benefit.

**Do not** read this as “the gate is provisional and should be tidied up
later”. It is the considered answer.

### If you disagree, do exactly this

1. Add the permission string to the permission set in
   `client/src/lib/auth/roles.ts` (define it alongside the existing
   `moderation.*` entries — do not introduce a new naming scheme).
2. Grant it in `demoBrokerSession.permissions` and in every role that should
   retain access. **Check `requirePermission`**: it currently short-circuits to
   `true` for `role === "ADMIN"`, so admins keep access automatically and the
   brokers/analysts do not.
3. Update the `ACQUISITION_READ_PERMISSION` constant in
   `client/src/lib/seo/acquisition-queue.ts`.
4. Update `acquisition-queue.test.ts` — the pinning test asserts the constant's
   value. If you change the constant you must change that assertion in the
   same commit; do not skip the test.
5. Add the permission to the roles migration, not only to the seed.

**Revisit when:** the queue starts showing data the moderation queue does not
already imply — for example per-broker acquisition targets, sourcing costs, or
anything scoped to one organization.

---

## Decision 2 — The acquisition queue is internal, not public

**Decision.** `/admin/acquisition` and `/api/admin/acquisition` are
authenticated and `noindex`. The queue is **not** surfaced publicly for
convenience, demo value, or to make a preview look populated.

**Where.** `app/admin/acquisition/page.tsx` sets
`metadata.robots = { index: false, follow: false }`, and the route authorizes
every request.

**Why.** The queue states precisely where coverage is thin — which cities have
no publishable index and which localities are one or two listings short. That
is a competitive fact. Publishing it tells competitors exactly which
micro-markets Architech has not entered, and tells landlords and brokers how
little leverage we have in a given locality. The honesty that justifies
showing a *gap* on a withheld price index (see below) does not extend to
publishing a roadmap of our weaknesses.

**Do not** remove the auth check to make the page render in a local preview or
screenshot. In a production build with demo auth disabled the route returns
`503 DEMO_AUTH_DISABLED` and the page shows its error state. **That is the
gate working, not a bug.** Do not “fix” it.

### What is public, and why that is different

`app/price-index/[city]/page.tsx` does publish the gap, and does publish what
would close it:

> This index publishes when any one locality reaches 3 sale listings. Paldi is
> closest, 2 short.

That is deliberate and is not a contradiction of Decision 2. The distinction:

| | Withheld price index | Acquisition queue |
| --- | --- | --- |
| Unit shown | One city the reader is already on | Every city, ranked by weakness |
| What it admits | This one figure is not ready | Where the whole business is thin |
| Reader | Someone who came for that city | Anyone, including competitors |

A visitor who asks for Ahmedabad's price index is entitled to know why it is
empty and what would fill it. A stranger is not entitled to a ranked list of
our weakest markets.

**Revisit when:** coverage is complete in every city, at which point the queue
says “nothing is gated” and there is no longer anything to protect.

---

## Decision 3 — The minimum ask is one locality, never the sum of all gaps

**Decision.** `cityAcquisitionPlan().minimumToPublish` is the cheapest single
locality that clears the bar. `fullCoverage` is the sum across all localities.
Both are reported; the headline always uses the minimum.

**Why.** A city index publishes when **any one** locality clears
`MIN_SAMPLE_FOR_PUBLISHED_STAT`. Quoting the sum would send someone to source
14 listings to unlock what 2 unlocks. This is the difference between a
worklist and a shopping list, and it is the single most consequential line in
the module.

**Do not** “correct” the headline to a total. If a future change makes a city
index require *n* localities rather than 1, update the minimum computation and
its tests together — the 16 tests in `acquisition-queue.test.ts` encode the
one-locality rule.

---

## Decision 4 — Numbers in the queue describe the fixture, not the market

**Decision.** The queue reports against whatever `ARCHITECH_DATA_SOURCE`
resolves to. The default is **fixture** mode.

**Consequence.** The figures quoted in the design doc — 12 cities, 1 withheld
index, 2 listings to publish every index, 14 to full coverage — describe the
committed fixture inventory. They are a correct measurement of a fixture.

**Do not** quote those numbers as market facts, put them in a report, or use
them in a launch decision. **Step 0 (turn on Prisma persistence) must land
before any number here means anything operationally.**

---

## Decision 5 — Public indexing is gated off

`isPublicIndexingEnabled()` returns false in production unless
`PUBLIC_INDEXING_ENABLED=true`. Every page count in this system is pages
*ready* to index, not pages in Google's index. Say so whenever you quote one.

---

## Summary for an agent about to touch this

- Do not add a permission without the five steps in Decision 1.
- Do not remove the auth gate to make a page render (Decision 2).
- Do not sum the gaps into the headline (Decision 3).
- Do not quote fixture numbers as market facts (Decision 4).
- Do not count pages as indexed when only indexing-eligible (Decision 5).
