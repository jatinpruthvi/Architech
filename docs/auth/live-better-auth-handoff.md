# Live Better Auth Handoff

**Date:** 24 Aug 2026

This slice adds the production auth source switch while keeping the demo session contract as the default for previews and CI.

## Auth source mode

```text
ARCHITECH_AUTH_SOURCE=demo | better-auth
```

Default:

```text
demo
```

## Required live auth environment

Live Better Auth mode requires these secrets in platform secret stores only:

```text
BETTER_AUTH_SECRET
BETTER_AUTH_URL
DATABASE_URL
```

## Current behavior

- `ARCHITECH_AUTH_SOURCE=demo` returns the existing demo broker-admin session.
- `ARCHITECH_AUTH_SOURCE=better-auth` checks required environment readiness.
- If required live auth secrets are missing, `/api/auth/session?source=better-auth` returns a not-configured response instead of silently falling back.
- The `AuthSession` response shape remains stable for broker dashboards and workflow guards.

## Production handoff

When staging secrets and database are ready:

1. Configure Better Auth with Prisma/PostgreSQL adapter.
2. Mount Better Auth handler routes.
3. Replace the placeholder branch in `getSessionContractForRequest()` with `auth.api.getSession()`.
4. Resolve organization membership from `User -> BrokerUser -> BrokerOrganization`.
5. Add CSRF/rate-limit tests for login/session endpoints.
6. Keep `ARCHITECH_AUTH_SOURCE=demo` available only in non-production.
