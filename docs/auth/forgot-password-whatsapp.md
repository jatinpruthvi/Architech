# Forgot Password via WhatsApp OTP — Implementation

**Date:** 2026-09-15
**Builds on:** [`phone-otp-implementation.md`](./phone-otp-implementation.md) (PR #89, phone OTP signup)
**Branch:** `arena/01a0a41c-architech`

## Summary

Users who registered with a mobile number have no email to receive a reset link,
so a password reset has to travel the same channel their account was created on:
a WhatsApp OTP from the single system account. This reuses the OTP engine from
the signup flow rather than adding a parallel one — same generation, hashing,
storage, throttling and delivery, with a different `purpose`.

## Flow

```
POST /api/auth/otp/forgot   { phone }                      → { phoneMasked, expiresAt }
        └─ validates +91 · throttles 3/hour · stores HMAC-hashed code
           under purpose "password-reset" · sends via system WhatsApp

POST /api/auth/otp/reset    { phone, otp, password }        → { ok, phoneMasked }
        └─ constant-time compare · 5 attempts · 5 min expiry · single use
           → Better Auth request-password-reset → reset-password
```

UI: `Login.tsx` gains a `forgot` mode reached from **Forgot password?** on the
sign-in form, or directly at `/login/?mode=forgot`. Two steps — number, then
code + new password — and on success the user is returned to sign-in with the
number prefilled.

## Why the reset goes through Better Auth

Better Auth owns the password store, so the flow cannot write a new hash itself;
it has to travel Better Auth's own `request-password-reset` → `reset-password`
pair, which is the only path that stores the hash `sign-in/email` later verifies
against. Writing to `account.password` by hand would need to reproduce Better
Auth's scrypt parameters exactly, and would silently drift the day they change.

The handoff between those two calls is a single-use token that Better Auth only
hands to the `sendResetPassword` callback. This app has no email transport, so
`server-auth.ts` configures that callback to park the token in a per-email slot
(`armResetTokenCapture` / `disarmResetTokenCapture`) that
`requestPasswordResetToken()` reads back. The WhatsApp OTP replaces the emailed
link as the proof of ownership.

Two details that are load-bearing:

- **Capture is keyed by email, not a single shared slot.** A shared slot breaks
  under concurrency: request A arms, request B arms over the top of it, and A's
  callback then finds a slot belonging to B and captures nothing — so A returns
  no token and the reset fails with no obvious cause.
- **The callback body has no `await`.** Better Auth passes the callback's result
  to `runInBackgroundOrAwait`, so a capture that depended on being awaited would
  be a race. Running synchronously means the token is in the slot before
  `requestPasswordReset` resolves. `password-reset-flow.test.ts` pins both
  properties.

## Non-enumeration

A forgot-password form is an account-existence oracle unless you are deliberate
about it, and "does +91 98765 43210 have an account here" is exactly the
question a targeting list wants answered. So:

| Signal | Behaviour |
|---|---|
| `forgot` response body | Identical whether or not the number is registered |
| `forgot` throttling | An OTP row is recorded for **every** request, so an unregistered number hits 429 at the same point as a registered one |
| `reset` with a correct code but no account | Same generic `RESET_FAILED` as a rejected code — never `USER_NOT_FOUND` |
| `reset` response | Carries only the masked number |

The one observable difference is that no WhatsApp message arrives for an
unregistered number, which needs control of the handset — the same trade-off
every OTP-based reset makes.

## Security

- HMAC-SHA256 hashed code, `timingSafeEqual` compare, never stored in plaintext
- **Purpose separation:** `signup` and `password-reset` are distinct
  discriminators and every store lookup filters on them, so a code requested to
  create an account cannot change that account's password, or vice versa
- 5-minute expiry, 5 attempts, 3 codes/hour/number, plus the shared IP throttle
- **Single use:** the code is consumed before the password write, so a failure
  in the write cannot leave a replayable code behind
- **No session is minted.** Recovering an account and being signed in to it are
  separate decisions; a 6-digit code must not be a session-granting secret
- New password held to the same floor as sign-up (`PASSWORD_MIN_LENGTH`) — a
  reset that allowed a weaker password would be an easy permanent downgrade
- Failed-login budget for the number is cleared after a successful reset: the
  user just proved ownership and should not be locked out of the account they
  recovered
- Logs carry the masked number only (`+91-•••••3210`)
- CSRF and rate limits via the shared `enforceMutationSafety`; `no-store` on
  every response

## Demo mode

Demo mode has no user store, so there is no hash to update. Rather than report
success and change nothing, `password-reset-flow.ts` parks the new password per
phone and `signInWithPhone`'s demo branch honours it — and once a number has a
reset password it is the **only** accepted one, so "change your password" really
does change what signs you in. The code is fixed at `123456`, matching the
signup demo path.

## Files

**New**
- `src/lib/auth/password-reset-flow.ts` — `sendPasswordResetOtp`, `verifyOtpAndResetPassword`, demo password store
- `src/lib/auth/password-reset-flow.test.ts` — 22 tests across demo mode, live Better Auth, and the token helpers
- `src/app/api/auth/otp/forgot/route.ts` — step 1
- `src/app/api/auth/otp/reset/route.ts` — step 2
- `docs/auth/forgot-password-whatsapp.md` — this file

**Changed**
- `src/lib/auth/server-auth.ts` — `sendResetPassword` capture, `requestPasswordResetToken`, `applyPasswordResetToken`
- `src/lib/auth/otp.ts` — `OTP_PURPOSE_*` constants, `DEMO_OTP`, reset message wording
- `src/lib/auth/whatsapp-otp.ts` — `sendAuthOtpViaWhatsApp(phone, otp, purpose)`
- `src/lib/auth/credentials.ts` — `validateResetRequest`, `validateResetPassword`
- `src/lib/auth/phone-flow.ts` — demo sign-in honours a reset password
- `src/screens/Login.tsx` — `forgot` mode, two steps, confirm field, success notice
- `db/schema.prisma` — comment-only: documents `OtpVerification.purpose` values (no migration)

## How to test

Demo mode (default):

1. `/login/` → **Forgot password?**
2. Number `9876543210` → **Send reset code**
3. Console: `[Demo OTP] password-reset for +91-•••••3210: 123456`
4. Enter `123456` + a new password → **Set new password**
5. Sign in with `9876543210` and the new password (the old demo password now fails)

Production: set `ARCHITECH_AUTH_WHATSAPP_ENABLED=true` and connect the system
WhatsApp via the QR flow at `/api/admin/whatsapp/system/connect`, exactly as for
signup. No new environment variables were introduced.
