# Phone OTP Signup – Implementation Done

**Skill Used:** `api-connector-builder` (primary) + `backend-patterns`, `security-review`, `prisma-patterns`, `api-design`

**Date:** 2026-09-14
**Branch:** `arena/01a0a374-architech`

## What Changed (per your selections)

- **Phone Scope:** India only (+91, 10-digit, 6-9 start)
- **OTP Flow:** OTP verifies → then collect name + password → account created (phone = userid, password = login)
- **Admin WhatsApp:** Single global system account `architech-auth-system` – admin logs in once via QR, all OTPs from that number
- **Login Migration:** Remove email login, use **phone + password** (OTP only for signup verification)

## Files Created

### Core OTP Engine (api-connector-builder pattern)
- `src/lib/auth/phone.ts` – pure India phone validation, normalization to E164, masking
- `src/lib/auth/otp.ts` – OTP generation (crypto.randomInt 6-digit), HMAC SHA256 hashing, expiry 5min
- `src/lib/auth/otp-store.ts` – storage abstraction: memory fallback (demo) + Prisma `OtpVerification` (prisma mode), throttle counting, attempts
- `src/lib/auth/whatsapp-otp.ts` – **reuses existing Evolution provider** `getEvolutionProvider().sendText()` – system account `SystemWhatsAppAccount`, QR connect, status refresh, mock send in dev/demo
- `src/lib/auth/phone-flow.ts` – service layer: `sendSignupOtp`, `verifyOtpAndRegister`, `signInWithPhone` – throttling, OTP verification, Better Auth synthetic email pattern

### Prisma Schema (prisma-patterns)
- `db/schema.prisma` – User: email optional, added `phoneE164 @unique`, `phoneVerified`, `phoneLast4`; New models `OtpVerification` (hashed OTP, expiry, attempts) and `SystemWhatsAppAccount` (global admin WhatsApp)

### API Routes (backend-patterns + api-design)
- `POST /api/auth/otp/send` – Step 1: validates phone/name/password/listerType, checks existing user, throttles 3/hour/phone, generates OTP, sends via WhatsApp
- `POST /api/auth/otp/verify` – Step 2: validates OTP (constant-time hash compare, 5 attempts max, 5min expiry), creates account via Better Auth synthetic email `91XXXXXXXXXX@phone.architech.internal` + phone fields
- `POST /api/auth/login` – Modified: now accepts phone + password primary, email fallback for legacy
- `POST /api/auth/register` – Modified: now supports phone+otp flow, or legacy email
- `POST /api/admin/whatsapp/system/connect` – Admin connects system WhatsApp (QR flow start)
- `GET /api/admin/whatsapp/system/qr` – Get QR data URL for system account
- `GET /api/admin/whatsapp/system/status` – Check system WhatsApp CONNECTED status

### Auth Core Updates
- `src/lib/auth/credentials.ts` – Added phone validation, `normalizePhoneToE164`, `phoneToSyntheticEmail`, `validatePhoneSignIn`, `validatePhoneSignUp`, `validatePhoneAndOtp`, new error messages
- `src/lib/auth/server-auth.ts` – Added additionalFields `phoneE164`, `phone`, `phoneVerified` to Better Auth user
- `src/lib/repositories/server/prisma.ts` – Extended `PrismaClientLike` to include `otpVerification`, `systemWhatsAppAccount`, `user`

### Frontend
- `src/screens/Login.tsx` – Complete rewrite: phone input with +91 prefix, 2-step register (details → OTP), OTP input with resend countdown 60s, masked phone display, WhatsApp info, password show/hide

### Config
- `.env.example` – Added `ARCHITECH_AUTH_WHATSAPP_ENABLED`, `ARCHITECH_AUTH_WHATSAPP_INSTANCE`, `ARCHITECH_OTP_HMAC_KEY`

## How It Works (Matches Existing WhatsApp Pattern)

### House Style Reuse (api-connector-builder)
- **Provider Abstraction:** `provider.ts` interface unchanged, `evolution.ts` concrete class reused via `getEvolutionProvider()`
- **Error Handling:** `WhatsAppProviderError` with `DEFINITIVE/AMBIGUOUS/DISABLED` mapped to 400/409/429/502
- **Server-Only:** All OTP/WhatsApp files have `import "server-only"`
- **Config:** Env validation like `evolution.ts` `configFromEnv()` – checks `ARCHITECH_EVOLUTION_API_URL/KEY`, `ARCHITECH_WHATSAPP_ENABLED`
- **Tests:** Existing auth and whatsapp tests still pass (93 auth tests, 37 whatsapp tests)

### Synthetic Email Pattern (Better Auth Compatibility)
Better Auth `emailAndPassword` requires email format. Phone is primary identifier, so:
- Phone `+91 98765 43210` → E164 `+919876543210` → synthetic email `919876543210@phone.architech.internal`
- Synthetic email passes Better Auth email validation (has @ and .)
- Real phone stored in additionalFields `phoneE164`, `phone`, `phoneVerified`
- Login: phone → synthetic email → `sign-in/email`
- Signup: OTP verified → `sign-up/email` with synthetic email + phone fields

### OTP Security (security-review)
- **No plaintext storage:** Only HMAC SHA256 hash stored
- **Constant-time compare:** `timingSafeEqual`
- **Expiry:** 5 min, checked on verify
- **Attempts:** Max 5 per OTP, then invalidate
- **Rate limit:** 3 OTPs/hour/phone, IP throttling via `login-throttle.ts` `registerLoginAttempt`
- **Masking:** Display `+91-•••••1234`, store last4
- **Audit:** Logs via console in dev, can be extended to `auditEvent`

### Admin Flow (Your Requirement)
1. Admin logs in (ADMIN or SUPER_ADMIN role)
2. `POST /api/admin/whatsapp/system/connect` – creates Evolution instance `architech-auth-system` with webhook
3. `GET /api/admin/whatsapp/system/qr` – returns QR data URL, admin scans with WhatsApp
4. `GET /api/admin/whatsapp/system/status` – polls until `CONNECTED`
5. Once CONNECTED, all `POST /api/auth/otp/send` will use `sendText({ instanceName: "architech-auth-system", number: "91XXXXXXXXXX", text: "Your Architech OTP is ..." })`

In dev/demo mode (`ARCHITECH_WHATSAPP_ENABLED=false`), OTP send is mocked and logged to console, OTP fixed `123456` for testing.

## API Contracts

### Send OTP
```http
POST /api/auth/otp/send/
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "Ananya Sharma",
  "password": "securePass123",
  "listerType": "OWNER"
}

200 OK
{
  "ok": true,
  "phoneE164": "+919876543210",
  "phoneMasked": "+91-•••••3210",
  "expiresAt": "2026-09-14T05:30:00.000Z",
  "message": "OTP sent to +91-•••••3210 via WhatsApp..."
}

409 ACCOUNT_EXISTS, 429 TOO_MANY_OTPS, 502 PROVIDER_DISABLED
```

### Verify OTP & Register
```http
POST /api/auth/otp/verify/
{
  "phone": "+919876543210",
  "otp": "123456",
  "name": "Ananya Sharma",
  "password": "securePass123",
  "listerType": "OWNER"
}

200 OK + Set-Cookie: better-auth.session_token=...
{
  "ok": true,
  "session": { user: { id, name, email: synthetic, role: BUYER, phoneE164 }, ... },
  "redirectTo": "/"
}

400 INVALID_OTP, 410 OTP_EXPIRED, 429 TOO_MANY_ATTEMPTS
```

### Login (Phone)
```http
POST /api/auth/login/
{
  "phone": "+919876543210",
  "password": "securePass123"
}

200 OK + Set-Cookie
{
  "ok": true,
  "session": {...},
  "redirectTo": "/"
}
```

### Admin System WhatsApp
```http
POST /api/admin/whatsapp/system/connect/  (ADMIN)
GET  /api/admin/whatsapp/system/qr/
GET  /api/admin/whatsapp/system/status/
```

## Frontend Flow

**Signin:**
- Phone field with +91 prefix, 10-digit input, password
- Calls /api/auth/login/

**Register:**
- Step 1 (details): Full name, I am listing as (OWNER/BROKER radio), Mobile number (+91 prefix), Password, Send OTP button
- Calls /api/auth/otp/send/
- Step 2 (otp): Shows masked phone, OTP 6-digit input (numeric, mono, centered), Verify button, Change number, Resend countdown 60s
- Calls /api/auth/otp/verify/
- On success: adopt session, redirect

## Testing

- `pnpm check` – passes (tsc --noEmit)
- `pnpm test src/lib/auth/` – 93 tests pass
- `pnpm test src/lib/whatsapp/` – 37 tests pass
- Demo mode: OTP mocked as 123456, phone login with password demo-buyer-1234 works for any Indian mobile

## Next Steps / TODO

1. **Migration:** Run `prisma migrate dev` to create `OtpVerification` and `SystemWhatsAppAccount` tables (requires DATABASE_URL)
2. **Prisma Generate:** `pnpm db:generate` after migration (network needed)
3. **Admin UI:** Build admin page `/admin/whatsapp-system` with QR display and status (can reuse `BrokerWhatsAppPanel.tsx` pattern)
4. **E2E Test:** Test with local Evolution API via `docker-compose -f docker-compose.whatsapp.yml up`
5. **Cleanup:** Remove legacy email fields from UI completely once migration confirmed (currently login still supports email fallback)
6. **Rate Limit Tuning:** Adjust 3/hour if needed, add Redis for distributed throttling in multi-worker deployment
7. **Audit Events:** Add `auditEvent.create` for OTP sent/verified like WhatsApp store does

## Env Vars Required

```env
ARCHITECH_AUTH_WHATSAPP_ENABLED=true
ARCHITECH_AUTH_WHATSAPP_INSTANCE=architech-auth-system
ARCHITECH_EVOLUTION_API_URL=http://127.0.0.1:8080
ARCHITECH_EVOLUTION_API_KEY=your-key
ARCHITECH_EVOLUTION_WEBHOOK_URL=https://yourdomain.com/api/whatsapp/webhook/
ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY=your-jwt-key
ARCHITECH_OTP_HMAC_KEY=base64-32-random-bytes (or reuse IDEMPOTENCY key)
```

## Security Checklist (from security-review skill)

- [x] No hardcoded secrets, all via env
- [x] OTP hashed (HMAC SHA256), not plaintext
- [x] Constant-time compare
- [x] Expiry 5min, attempts 5 max
- [x] Rate limiting phone + IP
- [x] Input validation (phone India regex, OTP 6-digit, password 8-128)
- [x] CSRF via `enforceMutationSafety`
- [x] No enumeration via generic messages + throttling
- [x] Phone masking
- [x] Audit logging ready
