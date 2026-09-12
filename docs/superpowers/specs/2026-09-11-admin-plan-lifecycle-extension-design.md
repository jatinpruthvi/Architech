# Design: Admin plan activation, deactivation, and expiry enforcement

**Date:** 11 Sep 2026  
**Status:** Committed for user review  
**Parent design:** [`2026-09-10-broker-calling-completion-design.md`](./2026-09-10-broker-calling-completion-design.md)

## 1. Goal

Extend the existing owner-only `/admin/plans` workflow so an administrator can clearly:

- activate a broker organization plan;
- deactivate it by setting the existing `EXPIRED` status; and
- optionally set an expiry date that automatically blocks plan-gated access after the date.

This is an extension of the existing subscription ledger, not a new billing system.

## 2. Confirmed product decisions

| Decision | Choice |
|---|---|
| Deactivation state | Use the existing `EXPIRED` subscription status. No new enum or migration. Reactivation changes it back to `ACTIVE` or `TRIAL`. |
| Expiry behavior | An `ACTIVE` or `TRIAL` subscription with `expiresAt` at or before the current time is treated as effectively `EXPIRED` by server-side plan resolution. No cron job is required for access blocking. |
| Admin surface | Extend the existing owner-authenticated `/admin/plans` page and `/api/admin/plans` route only. |
| Date semantics | `expiresAt` remains optional. `EXPIRED` status clears the date from the form request. Active/trial plans may have no expiry or a future expiry. |
| Authorization | Keep the existing `admin.plans.read` / `admin.plans.write` authorization and super-admin session. |
| Audit | Preserve `admin.plan.updated`, previous status, resulting status, expiry, login email, and IP hash. |
| Scope | Organization-wide and city-agnostic. The most recent subscription for the broker organization remains authoritative. |

## 3. Existing behavior to preserve

- Plan activation already updates or creates the organization’s most recent `MarketplaceSubscription`.
- `TRIAL`, `ACTIVE`, and `EXPIRED` are already supported by the API and database enum.
- The current date field is retained rather than introducing a second date model.
- `PAUSED` and `CANCELLED` remain internal database states but are not added to this first admin control because the requested deactivation behavior is the existing `EXPIRED` state.
- The WhatsApp gate continues to require the effective `ACTIVE` subscription; a trial, expired, deactivated, or date-lapsed plan cannot enqueue a message.

## 4. Implementation shape

### 4.1 Server-side effective status

Update `resolvePlanStatusForOrg` to read `expiresAt` along with the subscription status:

1. explicit `ARCHITECH_BROKER_PLAN_STATUS` override still wins;
2. fixture mode behavior is unchanged;
3. in Prisma mode, no subscription and non-active statuses retain their current mappings;
4. `ACTIVE` or `TRIAL` with an expiry date in the past or exactly now resolves to `EXPIRED`;
5. otherwise the stored `ACTIVE` or `TRIAL` status is returned.

This keeps enforcement server-side and avoids relying on an administrator or scheduled job to flip a row at the exact expiry time.

### 4.2 Admin API and UI

- Keep the existing `POST /api/admin/plans` contract and validation.
- Keep the existing status options `TRIAL`, `ACTIVE`, and `EXPIRED`; label `EXPIRED` as the deactivated/expired state in the UI.
- Keep the optional date input for `TRIAL` and `ACTIVE`; disable/clear it for `EXPIRED`.
- When an organization is looked up, populate the form with its current status and expiry so the administrator can reactivate or deactivate deliberately instead of editing a blank default.
- Preserve ISO date validation and normalized database timestamps.
- Show effective expiry information in the existing lookup and subscription table.

### 4.3 Data and migration decision

No schema migration is needed. `MarketplaceSubscription.status` already includes `EXPIRED`, and `expiresAt` already exists and is nullable. This change only corrects effective-status resolution and makes the existing controls less error-prone.

## 5. Test plan

Add or update tests for:

1. an `ACTIVE` subscription with a future expiry remains active;
2. an `ACTIVE` subscription whose expiry is in the past resolves to `EXPIRED`;
3. a `TRIAL` subscription whose expiry is in the past resolves to `EXPIRED`;
4. `PAUSED`, `EXPIRED`, and `CANCELLED` continue to block plan-gated operations;
5. the admin API accepts `EXPIRED` as the deactivation state and persists the supplied expiry for active/trial updates;
6. the admin API still rejects unknown status values and invalid dates;
7. current admin lookup/list behavior remains covered.

## 6. Non-goals

- Payment processing, automatic renewal, invoices, or webhooks.
- A separate `DEACTIVATED` enum.
- Broker self-service plan changes.
- A scheduled job that rewrites expired subscription rows.
- New WhatsApp controls beyond the existing active-plan gate.

## 7. Self-review checklist

- **Smallest change:** reuses the current enum, field, API, page, audit event, and plan resolver; no migration or new endpoint.
- **Safety:** access enforcement uses server time and cannot be bypassed by the UI; admin authorization remains unchanged.
- **Compatibility:** existing no-expiry active plans continue to work; explicit environment overrides retain precedence.
- **Consistency:** manual deactivation and date-based expiry both produce the same effective `EXPIRED` gate result.
- **Testability:** boundary behavior is pure enough to cover with resolver tests, and the API contract remains stable.
