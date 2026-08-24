# Phase 1 Better Auth and Broker Organization Contract

**Date:** 24 Aug 2026  
**Workstream:** `P1-AUTH-001`

This slice establishes the route/session/role contract for authenticated broker operations. It adds `better-auth` as the approved auth dependency and keeps live session activation behind the production auth gate.

## Added surfaces

```text
GET /api/auth/session
/broker/dashboard
```

`/api/auth/session` currently returns a demo broker-admin session with organization context:

- user role: `BROKER_ADMIN`
- organization: `Nivasa Partners`
- permissions: broker dashboard, listing draft creation, lead inbox, organization profile
- source: `better-auth-contract-demo`

## Why demo-backed first

The Phase 1 schema already includes `User`, `BrokerOrganization`, and `BrokerUser`. Live Better Auth sessions require production decisions for cookies, domains, OAuth/email providers, passkeys, 2FA, CSRF, rate limits, and legal/privacy text. This implementation locks the role and route contract first so broker workflows can build against stable authorization semantics.

## Next production handoff

Replace `demoBrokerSession` in `client/src/lib/auth/roles.ts` / `session.ts` with Better Auth server session retrieval and Prisma-backed organization memberships:

1. validate secure session cookie
2. load user
3. load broker memberships
4. resolve active organization
5. derive permissions
6. audit sensitive auth events

## Validation

```bash
pnpm test -- client/src/lib/auth/auth.test.ts
pnpm check
pnpm lint
pnpm test
pnpm build
```
