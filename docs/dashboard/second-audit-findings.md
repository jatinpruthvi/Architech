# Second dashboard audit — per-panel data-path trace

The first pass built the dashboard surface and fixed the requirements panel.
This pass traced **each panel's data path** for **each role**, rather than
checking that the page rendered. That found leaks the first pass missed: a
panel can render perfectly and still be showing the wrong person's data.

## Method

For every panel, follow: UI → `fetch` → route handler → server adapter →
store/Prisma query, and ask one question at each hop — *what restricts this to
the signed-in person?*

## Panel-by-panel result

| Panel | Route | Scoped by | Verdict |
|---|---|---|---|
| Requirements | `GET /api/requirements` | `userId` from session | **OK** (fixed in first pass) |
| Shortlist | client-side `SavedContext` | localStorage, per-device | OK |
| Your properties | `GET /api/broker/listings` | `brokerOrgId` from session org | OK |
| Saved searches | `GET /api/saved-searches` | **nothing** | **LEAK** |
| Enquiries | `GET /api/broker/leads` | **nothing** | **LEAK** |
| Verification | session object | session | OK |
| Channel | `/api/broker/channel/*` | `organizationId` | OK |

## Finding 1 — saved searches were global (cross-user leak)

`listSavedSearchesForServer()` took no argument and ran
`db.savedSearch.findMany({ orderBy: { updatedAt: "desc" } })` — no `where`.
The memory path was the same: `[...store.values()]`.

`SavedSearch.userId` exists in the schema, is indexed as `@@index([userId,
notify])`, and was **never written and never read**. Every signed-in user saw
every other user's saved searches.

Proved against the running server: saved `"ALICE PRIVATE SEARCH 3BHK Powai"`,
then a plain `GET /api/saved-searches/` returned it.

This is worse than untidy. A saved search is a statement of intent and budget
("3BHK Powai under 2.4Cr") and leaking it across accounts is a privacy breach
and, between competing brokers, commercially harmful.

Also `dedupeKey` was `@unique` **globally**, so once one user saved a search,
a second user saving the identical search got the *first user's row* returned
as a "duplicate" — their search was silently never saved.

## Finding 2 — the lead inbox was global (cross-organization leak)

`listLeadsForServer()` also took no argument: `findMany({ where: { deletedAt:
null } })`. Every broker organization saw every other organization's leads —
buyer names, masked phones, messages and which listing they enquired about.

`Lead.organizationId` exists in the schema and is indexed
(`@@index([organizationId, status])`) but was not filtered on. The in-memory
`LeadRecord` had no organization id at all — only `organizationName`, a
display string taken from `listing.developer`.

## Finding 3 — IDOR on lead mutations

`DELETE /api/broker/leads/[id]` and `POST /api/broker/leads/[id]/reply` checked
the `lead.inbox.read` permission but never checked that the lead **belongs to
the caller's organization**. Any broker could delete, close, or revoke consent
on any other organization's lead by guessing or observing an id — and ids are
returned by the (leaking) list endpoint.

Note the permission on the reply/delete routes is `lead.inbox.read`, a *read*
permission gating *writes*. Left as-is to keep this change scoped, but flagged.

## Why the first pass missed these

The first pass asserted the dashboard *rendered* for each role and that
requirements were isolated. It did not assert isolation for panels it had not
written. Rendering proves the wiring exists; it says nothing about the `where`
clause behind it. Multi-tenant scoping has to be tested with **two** accounts —
a single-account test passes just as happily against a global store.

## Finding 4 — the Owner and Builder "Your properties" panel dead-ended

`my-listings` was declared `permission: null`, meaning "any signed-in session
may load this". Its API is not: `GET /api/broker/listings` requires
`broker.dashboard.read`, and the submission form at `/broker/listings/new/`
requires `listing.draft.create` **plus an organization**. A `BUYER` role — which
is what every owner, tenant and builder actually is — holds neither.

So the owner and builder dashboards fired a request that returned 403, the
client's `loadJson` helper swallowed it and returned `[]`, and the panel
rendered **"No properties listed yet"**. That is indistinguishable from
genuinely having no properties. The header's "List a property" button then led
to a gate the account could never pass, with no explanation.

Fixed by making the requirement explicit (`permission: "broker.dashboard.read"`)
and adding `lockedPanels()` alongside `visiblePanels()`. A panel the persona
has but the session cannot load is now rendered **locked**, with the reason and
the route that unlocks it, rather than hidden or rendered misleadingly empty.
The header CTA points at onboarding instead of the wall.

The general principle, now enforced by a test that partitions each persona's
composition into exactly visible + locked: a dashboard may tell you something
is unavailable, but it must never tell you that you have nothing when it simply
could not look.

---

# Third pass — interactive state and shared devices

The second pass traced server-side data paths. This pass covered what it did
not: **client-persisted state**, and the panels previously waved through as
"OK" without a two-account test.

## Finding 5 — the shortlist was shared across accounts on one device

The Shortlist panel was recorded as "OK — localStorage, per-device" in the
second audit. That description was accurate and the conclusion was wrong.

`SavedContext` read and wrote one global key, `architech.saved`. It was never
scoped to an account and never cleared on sign-out. So on any shared device —
a family laptop, an office machine, a broker's desk — the next person to sign
in inherited the previous person's shortlist, and the dashboard counted it as
theirs and offered it in "Next steps".

A shortlist reveals budget and intent, so this is the same class of privacy
problem as the saved-search leak, just on the client where the second pass was
not looking. "Per-device" is only an acceptable scope when a device has one
user, which is not true of the Indian market this product targets.

Fixed by keying storage per account (`architech.saved.u.<id>`, plus
`architech.saved.guest` for signed-out visitors), with two behaviours that
matter as much as the fix:

- **`mergeGuestSaved`** folds a guest shortlist into the account on sign-in.
  Someone who shortlists three flats and *then* registers must not lose them —
  that is precisely the moment they are most likely to sign up.
- **`adoptLegacySaved`** migrates the pre-scoping global list into the guest
  list on first read, once. Without it, shipping this change would have
  silently emptied the shortlist of every existing user. It cannot resurrect a
  list the person has since deliberately cleared.

## Verified end to end, per role

All five roles were driven against the live server: each files a requirement
with a role-appropriate intent (`buyer→buy`, `owner→list_sale`, `tenant→rent`,
`agent→buy`, `builder→list_rent`), all return 201, and all five read back on
the dashboard with the phone masked and the correct owner attached.

## Known, deliberately out of scope

`CompareContext` (`architech.compare.v1`) and `CollectionsContext` share the
same unscoped-localStorage pattern. Neither is a dashboard panel, so they were
left alone rather than widening this change; they should be scoped the same way
before launch. Recording them here so the pattern is not rediscovered a fourth
time.
