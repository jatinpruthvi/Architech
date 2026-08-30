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

## Decision 6 — The gate is inside the transition, not beside it

**Decision.** `moderateListingForServer` runs the publish gate *before* it
mutates anything, and emits the event *after*. The gate is not a separate step
a caller is trusted to remember.

**Why.** A gate placed beside a transition looks identical in a code review and
behaves completely differently the first time someone adds a second write path.
The doc's own words: "if a path can publish without emitting, the OS has a
hole."

**Do not** extract the gate into a helper that callers invoke before
`moderateListingForServer`. If you add a new write path that makes a listing
visible — an import, a CSV ingest, a lifecycle migration — it must go through
`moderateListingForServer` or emit through the same spine.

**The test that catches this:** `client/src/lib/persistence/publish-gate.test.ts`
asserts that a blocked approval emits `listing.gate_blocked`, leaves the draft
at `IN_REVIEW`, and emits no `listing.published`. If the gate is ever routed
around, that is what fails.

---

## Decision 7 — A near-duplicate is canonicalized, not refused

**Decision.** Three outcomes, not two: `publish`, `canonicalize`, `block`. A
description that is a near-duplicate of an already-published listing in the
same locality is approved and pointed at the listing it duplicates.

**Why.** Refusing a duplicate throws away real inventory; publishing it as a
second page creates two pages competing for the same query. Canonicalizing
keeps the listing visible and gives Google one page. This is the first writer
of `Listing.canonicalToListingId`, which has been in `prisma/schema.prisma`
since it was written and was referenced by nothing.

**The subtlety:** the gate will only canonicalize to a peer that is itself
`published`. Pointing Google at a page that does not exist is worse than a
duplicate. A near-duplicate whose twin is still in review therefore publishes
normally and only raises a warning — see
`nearestPublishedDuplicate` in `client/src/lib/listing/publish-gate.ts`.

**Do not** drop the `published` check, and do not canonicalize to the
alphabetically-first or oldest peer. The target is the most similar published
peer in the same locality.

---

## Decision 8 — RERA is a blocker off-plan, a warning otherwise

**Decision.** No `reraNumber` blocks only when `availability` is `NEW_LAUNCH`,
`UNDER_CONSTRUCTION`, or `PRE_LAUNCH`. For `RESALE` and `READY_TO_MOVE` it is a
warning.

**Why.** RERA registration is mandatory in India for a project sold before
completion; an individual reselling their own flat is generally outside it.
`ai/moderation.ts` already calls a missing RERA number a warning and says
"verify whether the listing requires one" — promoting that to a blanket blocker
would refuse most legitimate resale inventory. The doc said "promote it per
policy"; this is the policy, and it is the one the existing code already
implies.

**Revisit when:** someone with authority decides Architech will not list
unregistered off-plan stock at all, at which point the warning becomes a
blocker for every availability.

---

## Decision 9 — Thresholds are tunable constants, not settled truth

`MIN_DESCRIPTION_CHARS = 80`, `THIN_DESCRIPTION_CHARS = 200`,
`DUPLICATE_SIMILARITY_THRESHOLD = 0.75`, `MIN_PUBLISHABLE_MEDIA = 1`. All are
exported from `client/src/lib/listing/publish-gate.ts`.

These are judgement calls, and they were chosen against the inventory that
exists today. 80 characters blocks a single clause while passing every real
listing in the fixture set; if it starts refusing listings that are plainly
fine, lower it — but change the constant and its tests together, and expect the
duplicate threshold to need tuning once real broker copy arrives, because
brokers paste in ways fixtures do not.

**Do not** hard-code any of these numbers at a call site.

---

## Decision 10 — Media rights are not the same as media

`validateListingDraft` confirms the broker *has the rights* to publish
photographs. It never checks that any exist. The gate checks both, and also
checks that attached media are still `APPROVED` — a photograph that was
rejected or taken down does not count, because counting it would publish a page
whose image cannot be shown.

An id the media store does not recognise is counted rather than refused. Those
are fixture and legacy ids, and blocking them would refuse listings for a
bookkeeping reason no broker can see or act on.

---

## Decision 11 — `listAllDrafts()` is not for broker-facing surfaces

`listAllDrafts()` was added to `client/src/lib/broker/workflow.ts` so the gate
can see its peers. Duplicate detection is only meaningful across the whole
corpus — two brokers pasting the same paragraph is exactly the case being
caught, and a per-organization view would never see it.

**Any broker- or organization-facing surface must use `listBrokerDrafts`, which
is scoped.** Reaching for `listAllDrafts` in a UI would leak one broker's
inventory to another.

---

## Decision 12 — One existing test was changed, and that was the point

`client/src/lib/persistence/persistence.test.ts` previously approved a draft
that had no photographs attached, and asserted the approval succeeded. The gate
made it fail. It now attaches media before approving, the way the broker flow
does.

This is recorded because a modified existing test is the kind of change that
deserves suspicion: it can mean someone bent a test to fit their code. It was
not. The draft was incomplete, the gate was right, and the test now models a
listing a broker would actually submit. **If you find yourself relaxing a gate
to make a test pass, stop — the test is telling you about a real listing.**

---

## Decision 13 — Discovery subscribers register at startup, not in a route

**Decision.** `registerSeoDiscovery()` is called once from `instrumentation.ts`.

**Why.** Registering a subscriber inside a route module means a write path
that never imports that module also never notifies anyone. That is precisely
the hole the spine was built to close, and it is invisible until someone adds
the second write path.

**Do not** move the registration into a route handler to "make it simpler". If
you add a new write path — an import, a bulk lifecycle update — it must either
go through `moderateListingForServer` or emit through the spine.

---

## Decision 14 — A blocked listing pings nothing

**Decision.** `discoverListingEvent` skips the IndexNow submission entirely for
`listing.gate_blocked`.

**Why.** Indexing requests are a scarce, quota-limited resource. Spending one
on a page that does not exist is the worst possible use of it. This is the
concrete form of §3.4's rule that the gate comes before the last mile.

---

## Decision 15 — The listing's own URL is not pinged, on purpose

**Decision.** `urlsForIndexingRequest` submits the locality hub, the city hub
and the price index — not `/listing/{id}/`.

**Why.** For a draft approved through moderation there is no public id to build
that URL from. The SEO page registry is built from the fixture repository, and
a UI-published listing is not in it. Submitting a constructed guess would
submit a 404, which is worse than submitting nothing.

The new listing is still crawled: it is one hop from its locality hub, which
*is* pinged, and revalidated. That is authority routing doing its job.

**Revisit when:** step 0 lands and the repository reads from Prisma, at which
point `SeoPage.canonicalUrl` becomes derivable and the listing's own URL should
join the submission.

---

## Decision 16 — Siblings are locality-first, and still capped at three

**Decision.** `getRelatedListings` orders same-locality, then same-city, then
everything else. The limit stays at 3.

**Why the ordering changed:** a listing's strongest internal links are the ones
that share its query, and a query is dominated by its locality. Linking a Paldi
listing to a Bandra one because both are in the country spends a link on a
different question.

**Why the count did not:** the grid that renders these is three columns, so
three fills exactly one row. The design doc suggested "3–5 where the layout
allows" — this layout does not allow five without a ragged second row. Raising
it is a layout decision, not an SEO one.

---

## Decision 17 — Demo Search Console numbers are withheld, never displayed

**Decision.** `seoStatusBoard` reports the demo provider's snapshot as
`available: false`, with the source named.

**Why.** `DEMO_GSC_SNAPSHOT` contains 3,200 impressions and 120 clicks. Those
are constants in a file. A dashboard that renders them invites someone to make
a real decision on invented data, which is the most dangerous state an SEO
dashboard can be in — far worse than showing nothing.

`client/src/lib/seo/url-status.test.ts` asserts this. If you change it, you are
choosing to show numbers that did not come from Google.

**Also true:** the board reports `perUrl: false`. The current snapshot is
aggregate; nothing in it can be attributed to a single page. Per-URL ingestion
needs domain verification and the Search Console API, and `LiveGscProvider`
throws by design until then. Do not present aggregate figures as if they were
per-URL.

---

## Summary for an agent about to touch this

- Do not add a permission without the five steps in Decision 1.
- Do not remove the auth gate to make a page render (Decision 2).
- Do not sum the gaps into the headline (Decision 3).
- Do not quote fixture numbers as market facts (Decision 4).
- Do not count pages as indexed when only indexing-eligible (Decision 5).
- Do not move the gate out of the moderation transition (Decision 6).
- Do not canonicalize to an unpublished peer (Decision 7).
- Do not block every listing that lacks a RERA number (Decision 8).
- Do not hard-code a gate threshold (Decision 9).
- Do not count a taken-down photograph (Decision 10).
- Do not use `listAllDrafts()` in a broker-facing surface (Decision 11).
- Do not relax the gate to make a test pass (Decision 12).
- Do not register a subscriber in a route module (Decision 13).
- Do not ping anything for a blocked listing (Decision 14).
- Do not invent a listing URL to submit to IndexNow (Decision 15).
- Do not raise the sibling count without changing the grid (Decision 16).
- Do not display demo Search Console numbers as measurement (Decision 17).
