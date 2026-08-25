# Phase 1 Broker Lead Inbox & Masked-Response

**Date:** 25 Aug 2026  
**Workstream:** `P1-LEAD-001`

The lead contract now surfaces to the broker side: enquiries land in a masked inbox and can be advanced (acknowledged / replied / closed) with an audited trail, while the buyer's phone number stays masked.

## Files

```text
client/src/lib/leads/lead.ts         (listLeads, updateLeadStatus, statusHistory)
client/src/lib/leads/server.ts       (listLeadsForServer, updateLeadStatusForServer)
client/src/pages/BrokerLeadInbox.tsx
app/broker/leads/page.tsx
app/api/broker/leads/route.ts        (GET list)
app/api/broker/leads/[id]/reply/route.ts  (POST status change)
```

## Design rules

- **Mask by default.** The inbox shows only `phoneMasked`; the raw number is never returned by the inbox API.
- **Consent on file.** Each lead carries its `consentText` and is shown to the broker before any action.
- **Status workflow.** `NEW → ACKNOWLEDGED → REPLIED → CLOSED`; every change appends to `statusHistory` and, in `prisma` mode, writes an `AuditEvent`.
- **Source-abstracted.** Memory store (default) and Prisma share the same contract; `listLeadsForServer`/`updateLeadStatusForServer` route by `ARCHITECH_LEAD_STORAGE`.

## API

- `GET /api/broker/leads` → `{ ok, leads: LeadRecord[], count }` (newest-first, no-store).
- `POST /api/broker/leads/:id/reply` → `{ status }` in `ACKNOWLEDGED | REPLIED | CLOSED`; returns the updated masked `LeadRecord`.

## Validation

```bash
pnpm check
pnpm lint
pnpm exec vitest run client/src/lib/leads/lead.test.ts
```

The lead unit suite covers idempotent masked creation, phone masking, list ordering, status advancement with audit history, and 404 on unknown lead.
