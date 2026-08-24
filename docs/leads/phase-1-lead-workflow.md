# Phase 1 Lead Persistence and Consent/Audit Workflow

**Date:** 24 Aug 2026  
**Workstream:** `P1-LEAD-001`

This slice turns the listing lead dialog into a backend API contract with consent and audit metadata. It is fixture/in-memory backed until the production PostgreSQL service is available.

## API

```text
POST /api/leads
```

Request:

```ts
type LeadInput = {
  listingId: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  mode?: "MASKED" | "DIRECT_CONSENTED";
  consentText: string;
  idempotencyKey?: string;
};
```

Response includes:

- masked phone number
- lead status
- idempotency key
- audit event ID
- consent text
- source marker: `api.leads.fixture-store`

## Current implementation

- `client/src/lib/leads/lead.ts` validates lead input, masks phone numbers, creates idempotent lead records, and attaches audit metadata.
- `app/api/leads/route.ts` exposes the POST endpoint.
- `client/src/pages/ListingPage.tsx` submits the dialog to the API and requires explicit consent.

## Database handoff

The Prisma schema already contains `Lead` and `AuditEvent`. Once `DATABASE_URL` points to a provisioned PostgreSQL database, replace the in-memory store in `createLead()` with Prisma writes inside a transaction:

1. validate listing lifecycle and broker organization
2. create `Lead`
3. create `AuditEvent`
4. enqueue notification/email job
5. return the same API response shape

## Validation

```bash
pnpm test -- client/src/lib/leads/lead.test.ts
pnpm check
pnpm lint
pnpm test
pnpm build
```
