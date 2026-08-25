# Phase 1 Live Moderation Queue

**Date:** 25 Aug 2026  
**Workstream:** `P1-BROKER-001`

The moderation queue is now live rather than a static contract shell. It reads drafts from the persistence store and posts approve / request-changes / reject decisions, closing the draft → review → active lifecycle with an audit trail.

## Files

```text
app/api/admin/moderation/listings/route.ts          (GET queue)
app/api/admin/moderation/listings/[draftId]/route.ts (POST decision)
client/src/pages/ModerationQueue.tsx
```

## Design rules

- **Sources are durable and abstracted.** `getModerationQueueForServer` reads the in-memory store by default and `Listing` rows in `prisma` mode; the GET API returns the same `ListingDraft` contract either way.
- **Decisions are audited.** Approve sets the listing `ACTIVE`, request-changes sets `CHANGES_REQUESTED`, reject sets `REJECTED` — each writes an `AuditEvent` via `moderateListingForServer`.
- **Reason-first.** Rejecting or requesting changes requires a reason (min length enforced) so the audit trail stays actionable.
- **End-to-end demo.** A broker creates + submits a draft through `/api/broker/listings`, it appears here, and the moderator can drive it to active.

## Validation

```bash
pnpm check
pnpm lint
pnpm exec vitest run client/src/lib/persistence/persistence.test.ts
```

The persistence contract test covers create → submit → moderate → queue round-trip in the fixture/memory path.
