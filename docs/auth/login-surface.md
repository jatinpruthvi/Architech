# Login surface

**Date:** 3 Sep 2026
**Workstream:** `P1-AUTH-002` (follows `P1-AUTH-001`)

`P1-AUTH-001` locked the session/role contract but there was no way to *create*
a session from the UI: `/api/auth/[...all]` was mounted, yet no page posted
credentials, and in `demo` mode every visitor was implicitly `BROKER_ADMIN`.
This slice adds the user-facing sign-in flow on top of the existing contract
without changing the `AuthSession` shape any broker surface reads.

## Added surfaces

```text
/login/                     sign in + create account (noindex, no sitemap)
POST /api/auth/login/       credential sign-in
POST /api/auth/register/    credential sign-up (live mode only)
POST /api/auth/logout/      session teardown
```

`GET /api/auth/session` is unchanged in shape; it now honours the demo session
cookie (see below).

## Module map

| Module | Responsibility |
| --- | --- |
| `lib/auth/credentials.ts` | Pure validation, shared by browser and server |
| `lib/auth/redirects.ts` | Open-redirect-safe `?next=`, role-aware landing |
| `lib/auth/login-throttle.ts` | Per-IP and per-email attempt budgets |
| `lib/auth/credential-flow.ts` | Server-only: validate → throttle → provider → cookies |
| `lib/auth/demo-accounts.ts` | Demo-mode credential roster (never used in live mode) |
| `contexts/SessionContext.tsx` | Client mirror of `/api/auth/session` |
| `components/architech/RequireSession.tsx` | Navigation guard (not an authorisation boundary) |
| `components/architech/AccountMenu.tsx` | Header identity + sign out |

## Security decisions

- **Uniform failure.** A wrong password and an unknown email return the same
  status, code and message. Distinguishing them turns the form into an account
  enumeration oracle.
- **No self-assigned roles.** `POST /api/auth/register/` always creates a
  `BUYER`; a `role` in the request body is ignored. Broker access still comes
  from a `BrokerUser` membership row.
- **Throttling.** 8 attempts per email and 20 per IP in a 15-minute window, on
  top of the generic mutation limiter. Keyed on both because the IP bucket
  cannot see a distributed attempt on one account, and the email bucket cannot
  see one host spraying many accounts. In-process state — **this must move to
  shared storage before running more than one instance.**
- **CSRF.** All three routes call `enforceMutationSafety`. That guard was fixed
  in this slice: its Origin check was previously wrapped in
  `if (NEXT_PUBLIC_SITE_URL)`, so it silently no-opped in local dev and in any
  deployment that had not set the variable. Origin-vs-Host equality needs no
  configuration to be correct, so it now always runs.
- **Open redirect.** `safeNextPath` accepts only same-site absolute paths and
  rejects `//host`, `/\host`, control characters and `/login/` itself. The
  server computes the destination independently of the client.
- **Cookies.** `HttpOnly; SameSite=Lax; Path=/`, `Secure` over HTTPS. All auth
  responses are `Cache-Control: no-store`.
- **Server remains the authority.** `RequireSession` only improves navigation;
  every protected API still calls `authorizeRequest()`.

## Demo mode

`ARCHITECH_AUTH_SOURCE=demo` has no user store, so the login page authenticates
against a named roster in `demo-accounts.ts` (broker admin, broker member,
buyer, moderator). This makes the flow exercisable in previews and CI.

Two consequences worth knowing:

1. **Registration is refused** with `503 REGISTRATION_UNAVAILABLE` rather than
   pretending to create an account that would vanish.
2. **Sign-out writes a sentinel**, not a cookie deletion. The historical demo
   contract is "no cookie ⇒ broker-admin session", which existing broker and
   moderation fixtures depend on; deleting the cookie would therefore sign the
   user straight back in.

The demo cookie is unsigned and is **not** an authentication mechanism. It is
safe only because `authorizeRequest()` already rejects every
`better-auth-contract-demo` session when `NODE_ENV === "production"`.

## Live mode

With `ARCHITECH_AUTH_SOURCE=better-auth` and the required secrets, the flow
dispatches to Better Auth via `auth.handler()` — deliberately the handler and
not the typed `auth.api.*` helpers, because the handler returns the real
`Set-Cookie` headers, and those cookies *are* the session.

The outstanding production handoff from
`live-better-auth-handoff.md` is unchanged and still applies: the Better Auth
`database` is the in-memory adapter until `Session`/`Account`/`Verification`
tables land, so **live accounts do not survive a restart yet**. Swapping in the
Prisma adapter is the remaining step; no code in this slice changes when it does.

## Validation

```bash
pnpm check
pnpm lint
pnpm test   # includes credentials, redirects, login-throttle, login-routes
```
