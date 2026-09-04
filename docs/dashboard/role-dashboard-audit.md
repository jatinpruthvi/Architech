# Role dashboard audit — what actually worked before this change

Audited on request: "make sure we have all the functionality of Dashboard
working end to end for all different roles — Buyer, Owner, Tenant,
Broker/Agent, Builder."

## Finding 1 — only one of the five roles had a dashboard

`app/dashboard/page.tsx` was a blanket `redirect("/broker/dashboard/")`.
`/broker/dashboard/` is wrapped in
`RequireSession permission="broker.dashboard.read" requireOrganization`.

So for four of the five named roles the end-to-end journey was:

    /dashboard  ->  /broker/dashboard/  ->  "You do not have access to this
                                             workspace"  ->  partner onboarding

A buyer following the site's own post-login landing logic never reached a
dashboard at all. `landingPathForSession` sent them to `/saved/`, which is a
shortlist of properties, not a dashboard: no requirements, no saved searches,
no activity, no next action.

## Finding 2 — three of the five roles do not exist in the auth model

`AuthRole = BUYER | BROKER_MEMBER | BROKER_ADMIN | MODERATOR | ADMIN`.

There is no Owner, no Tenant, no Builder. `POST /api/auth/register/` hardcodes
`role: "BUYER"` for every sign-up (correctly — self-service role selection
would be a privilege-escalation hole). The only owner/broker signal captured
anywhere is `listerType`, which is explicitly documented as a declaration that
must never influence authorisation.

So "dashboard for the Owner role" could not be built by branching on
`session.user.role`: the value is `BUYER` for owners, tenants and builders
alike.

## Finding 3 — requirements were write-only

`app/api/requirements/route.ts` exported `POST` and nothing else. A person
could submit a requirement and it was encrypted and persisted, but no endpoint
could ever read it back. The `Requirement` model also had no `userId`: rows
were not linked to the account that created them, so even adding a `GET` had
nothing to scope by.

This is why the broker workspace's own Requirements panel reads "Requirements
created through the public brief will appear here after the authenticated
persistence source is enabled" — the read path was never built.

## Finding 4 — the broker workspace renders a hardcoded session

`AgentWorkspace`'s Profile panel reads `demoBrokerSession` directly rather than
`useSession()`, so it shows "Nivasa Demo Admin" regardless of who is signed in.

## The design decision taken

Owner, Tenant and Builder are **personas, not authorities**.

Modelling them as `AuthRole` values would be wrong twice over. `roleRank` is a
linear ladder (`BUYER 0 < BROKER_MEMBER 10 < ...`) and owner/tenant/builder do
not sit anywhere on a ladder of privilege — a tenant is not "more" than a
buyer. And a self-service sign-up that let someone pick "Builder" would be the
exact escalation path `register/route.ts` and `lister-type.ts` were carefully
written to prevent.

Instead this change adds a `DashboardPersona` dimension alongside the existing
role, following the separation the codebase already documents for
`listerType`:

- **`AuthRole` decides what you may access.** Unchanged. Still server-enforced
  by `authorizeRequest`.
- **`DashboardPersona` decides what you are shown.** Self-declared, derived
  from `listerType` and from what the person has actually done on the site.
  It grants nothing.

A persona can never widen access: the broker persona is only offered to a
session that already passes `canAccessBrokerDashboard()`, and every panel
still fetches from a permission-guarded API. Choosing "Builder" in the
persona switch gets you a builder-shaped dashboard, not a builder's authority.
