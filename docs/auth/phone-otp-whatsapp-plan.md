# Phone OTP Signup via WhatsApp – Skill Selection & Implementation Plan

**Date:** 2026-09-14
**Task:** Change signup from email to mobile number, send OTP via WhatsApp API, admin logs into WhatsApp first then that number sends OTP.
**Selected Skill (primary):** `api-connector-builder`
**Supporting Skills:** `backend-patterns`, `security-review`, `prisma-patterns`, `api-design`

---

## 1. Why `api-connector-builder` is Best Fit

### House Style Analysis (Step 1 of skill)

Existing WhatsApp integration follows a clean provider pattern:

| Layer | Files | Pattern |
|-------|-------|---------|
| **Provider Abstraction** | `src/lib/whatsapp/provider.ts` | Interface `WhatsAppProvider` with `createInstance`, `getQr`, `getConnectionState`, `sendText` |
| **Concrete Provider** | `src/lib/whatsapp/evolution.ts` | `EvolutionWhatsAppProvider` class, env config `ARCHITECH_EVOLUTION_API_URL/KEY`, `ARCHITECH_WHATSAPP_ENABLED`, error classification `DEFINITIVE/AMBIGUOUS/DISABLED` |
| **Tenant Store** | `src/lib/whatsapp/store.ts` | Per-organization `WhatsAppAccount`, `WhatsAppTemplate`, transaction with `withOrganization`, opaque `instanceName`, audit events |
| **Contracts** | `src/lib/whatsapp/contracts.ts` | Constants `WHATSAPP_PROVIDER_TIMEOUT_MS`, statuses, `WHATSAPP_DISPATCH_PURPOSE` |
| **Dispatch/Queue** | `src/lib/whatsapp/dispatch.ts`, `worker.ts` | Enqueue lead ack, worker claims with retention checks |
| **API Routes** | `src/app/api/broker/whatsapp/*` | `connect/route.ts`, `qr/route.ts`, `status/route.ts`, `template/route.ts` – all use `authorizeRequest` + `isAuthorized` |
| **Tests** | `*.test.ts` | Vitest with hoisted mocks, `vi.mock("@/lib/...")`, env stubbing |

**Guardrails from skill:**
- Do NOT invent new integration architecture – we must reuse `getEvolutionProvider().sendText()`
- Do NOT start from vendor docs alone – start from existing in-repo connector
- Must include registry wiring, tests, docs

Task is exactly "add one more integration surface" – **auth OTP sender** – using same Evolution API but for a **single global system account** instead of per-broker-org.

### Why not only `backend-patterns`?
- `backend-patterns` is excellent for API routes/service layer but doesn't enforce matching existing WhatsApp connector pattern.
- `api-connector-builder` explicitly says: match house style, config schema, auth model, error handling, test style – which is critical because we already have Evolution API wired and we must NOT create second WhatsApp client.

### Supporting Skills
- `backend-patterns`: For new OTP service layer, repository pattern, rate limiting middleware, error handling
- `security-review`: OTP brute-force protection, hashing, secrets management, input validation (phone)
- `prisma-patterns`: Schema changes (User phone, Otp model), singleton Prisma, transaction handling
- `api-design`: REST contract for `/api/auth/otp/send` and `/api/auth/otp/verify`

---

## 2. Narrow Target Integration (Step 2)

### What we need:
- **Auth flow:** Single global admin WhatsApp account (system), admin logs in via QR once, then system uses it to send OTP
- **Key entities:**
  - `SystemWhatsAppAccount` (or reuse `WhatsAppAccount` with fixed orgId `system`)
  - `OtpChallenge` (phone, hashed OTP, expiry, attempts)
  - `User` with `phoneE164` unique, `phoneVerified`
- **Core operations:**
  - Admin: `connectSystemWhatsApp`, `getSystemQr`, `getSystemStatus` (mirrors broker flow)
  - Auth: `sendOtp(phone)`, `verifyOtp(phone, otp)`, `createAccountAfterOtp`
- **Rate limits:** 3 OTPs/hour/phone, 5 verify attempts/OTP, 5 min expiry, 6-digit numeric
- **Webhook:** Reuse existing Evolution webhook (no new events needed for OTP, only send)

### Env Config (matches existing pattern)
```env
ARCHITECH_AUTH_WHATSAPP_ENABLED=true # reuse ARCHITECH_WHATSAPP_ENABLED gate
ARCHITECH_AUTH_WHATSAPP_INSTANCE=architech-auth-system # fixed instance name
ARCHITECH_EVOLUTION_API_URL=http://127.0.0.1:8080 # existing
ARCHITECH_EVOLUTION_API_KEY=xxx # existing
ARCHITECH_EVOLUTION_WEBHOOK_URL=https://... # existing
```

---

## 3. Build in Repo-Native Layers (Step 3)

### 3.1 Config / Schema Layer

**File:** `src/lib/auth/phone.ts` (new, pure validation, like `credentials.ts`)
```ts
- PHONE_E164_REGEX India: /^\+91[6-9]\d{9}$/
- normalizePhone(input): +91XXXXXXXXXX or null
- validatePhone(input): CredentialIssue | null
- validatePhoneSignUp: { phone, name, password, listerType }
- PASSWORD_MIN_LENGTH existing reuse
```

**File:** `src/lib/auth/otp.ts` (new service)
```ts
- generateOtp(): 6-digit string (crypto.randomInt)
- hashOtp(otp): SHA256 + pepper or bcrypt (use existing HMAC key ARCHITECH_IDEMPOTENCY_HMAC_KEY or new ARCHITECH_OTP_HMAC_KEY)
- expiry: 5 min
- attempts: max 5
- storage interface: OtpStore (Prisma + memory fallback for demo mode)
```

### 3.2 Prisma Schema Changes (prisma-patterns)

**File:** `db/schema.prisma`

```prisma
model User {
  id            String    @id @default(cuid())
  email         String?   @unique // make optional, keep for backward compat
  phoneE164     String?   @unique @db.VarChar(20) // +91XXXXXXXXXX
  phoneVerified DateTime?
  // ... existing
  @@index([phoneE164])
}

model OtpVerification {
  id           String   @id @default(cuid())
  phoneE164    String   @db.VarChar(20)
  otpHash      String   @db.VarChar(128) // hashed OTP
  purpose      String   @default("signup") @db.VarChar(20) // signup, login, reset
  attempts     Int      @default(0)
  maxAttempts  Int      @default(5)
  expiresAt    DateTime
  verifiedAt   DateTime?
  createdAt    DateTime @default(now())
  // No userId until verified, then link

  @@index([phoneE164, purpose, createdAt])
  @@index([expiresAt])
}

model SystemWhatsAppAccount { // OR reuse WhatsAppAccount with organizationId="system"
  id                 String   @id @default(cuid())
  instanceName       String   @unique // architech-auth-system
  provider           String   @default("EVOLUTION_BAILEYS")
  status             WhatsAppAccountStatus @default(PROVISIONING)
  phoneLast4         String?  @db.VarChar(4)
  providerInstanceId String?
  connectedAt        DateTime?
  lastObservedAt     DateTime?
  lastErrorCode      String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

Alternative: reuse `BrokerOrganization` with slug `architech-system` and store account there – simpler, no new model, matches existing `store.ts` pattern. Preferred: **create fixed org** `system-auth` via seed.

### 3.3 Client / Transport Layer – Reuse Existing

**File:** `src/lib/auth/whatsapp-otp.ts` (new, matches `evolution.ts` usage)

```ts
import "server-only"
import { getEvolutionProvider } from "@/lib/whatsapp/evolution"
import { getPrismaClient } from "@/lib/repositories/server/prisma"

const SYSTEM_INSTANCE = process.env.ARCHITECH_AUTH_WHATSAPP_INSTANCE ?? "architech-auth-system"

export async function sendAuthOtpViaWhatsApp(phoneE164: string, otp: string) {
  // phoneE164: +919999999999 -> Evolution expects 919999999999@s.whatsapp.net or plain number
  // Check system account connected
  // Use provider.sendText({ instanceName: SYSTEM_INSTANCE, number: phoneE164WithoutPlus, text: `Your Architech OTP is ${otp}. Valid for 5 min. Don't share.` })
  // Handle WhatsAppProviderError -> map to OTP_SEND_FAILED
}

export async function getSystemWhatsAppStatus() { ... } // similar to refreshWhatsAppConnectionState but for system org
export async function connectSystemWhatsApp(actorUserId) { ... } // similar to connectWhatsAppAccount but fixed orgId
```

Matches house style: server-only, uses `getEvolutionProvider()`, throws `WhatsAppProviderError`, no direct fetch.

### 3.4 Mapping / Service Layer

**File:** `src/lib/auth/otp-service.ts`

```ts
- sendSignupOtp(input: { phone, name, password, listerType }) -> { ok, retryAfter? }
  1. validate phone (India 10-digit -> +91)
  2. check user not exists (phoneE164 unique)
  3. throttle: check recent OtpVerification count for phone in last hour <3
  4. generate OTP, hash, store with expiresAt = now+5min
  5. call sendAuthOtpViaWhatsApp
  6. return ok

- verifySignupOtpAndCreateAccount(input: { phone, otp, name, password, listerType, request })
  1. find latest non-expired Otp for phone
  2. check attempts <5
  3. compare hash (constant-time)
  4. if ok: mark verified, create user via existing registerWithCredentials but phone-based
  5. clear OTPs for phone
  6. return session + cookies (reuse sessionFromMintedCookies pattern)
```

Reuse `credential-flow.ts` pattern: `callProvider`, `sessionFromMintedCookies`, `clientKey` for throttling.

### 3.5 API Routes (api-design + backend-patterns)

**New routes:**

```
POST /api/auth/otp/send
Body: { phone: string, name?: string, password?: string, listerType?: "OWNER"|"BROKER", next?: string }
Response: { ok: true, expiresAt, phoneMasked } | { ok:false, error, retryAfter }
Status: 200 ok, 400 invalid phone, 409 already exists, 429 too many, 502 whatsapp unavailable
Rate: 3/hour/phone, 10/hour/ip (reuse login-throttle.ts pattern)

POST /api/auth/otp/verify
Body: { phone: string, otp: string, name: string, password: string, listerType: string, next?: string }
Response: { ok:true, session, redirectTo } + Set-Cookie
Status: 200, 400 invalid otp, 410 expired, 429 too many attempts
This route creates account (role BUYER forced, like existing register)

POST /api/auth/login  (MODIFY)
Body: { phone: string, password: string } instead of email
Reuse signInWithCredentials -> signInWithPhone
Validation: phone + password

POST /api/admin/whatsapp/system/connect (NEW, ADMIN only)
POST /api/admin/whatsapp/system/qr
GET  /api/admin/whatsapp/system/status
Reuse broker/whatsapp pattern but with fixed organizationId = system and permission admin
```

**Modify existing:**

- `src/app/api/auth/register/route.ts`: Keep but deprecate, or change to accept phone. Better: new OTP verify route becomes new register.
- `src/app/api/auth/login/route.ts`: Change input from email to phone
- `src/lib/auth/credentials.ts`: Add `validatePhone`, `validatePhoneSignIn`, `validatePhoneSignUp`
- `src/lib/auth/server-auth.ts`: Add `phoneE164` to additionalFields
- `src/lib/auth/credential-flow.ts`: Add `signInWithPhone`, `registerWithPhoneAfterOtp`

### 3.6 Frontend (Login.tsx)

**File:** `src/screens/Login.tsx`

Current: email + password, mode signin/register, listerType toggle.

New (per your choices: India only, OTP then profile, phone+password login):

**Signup flow 2-step:**

Step 1: Phone + Name + Password + ListerType + "Send OTP" button
- Client validation: phone 10-digit Indian (6-9 start)
- POST /api/auth/otp/send
- On success: show OTP input (6-digit), timer 5min, resend

Step 2: OTP input + Verify
- POST /api/auth/otp/verify
- On success: adopt session, redirect

**Login flow:**
- Phone field (10-digit, auto +91) + Password + Show password
- POST /api/auth/login
- Remove email references

UI components:
- Use existing `fieldClass`, `issueFor`, `focusFirstIssue` pattern
- Add OTP input with 6 boxes or single input
- Add masked phone display +91 ••••••1234
- Add resend countdown

### 3.7 Tests (matching house style)

- `src/lib/auth/phone.test.ts` – validatePhone, normalizePhone (like credentials.test.ts)
- `src/lib/auth/otp.test.ts` – hash, expiry, attempts logic
- `src/lib/whatsapp/auth-otp.test.ts` – mock provider, test sendAuthOtpViaWhatsApp success/failure mapping (like evolution.test.ts)
- `src/lib/auth/otp-service.test.ts` – throttle, existing user check, OTP verification flow
- `src/app/api/auth/otp/send/route.test.ts` – 400 invalid, 409 exists, 429 throttle, 200 ok
- Update `login-routes.test.ts` to cover phone login

Mock pattern: `vi.mock("server-only", ...)`, `vi.mock("@/lib/whatsapp/evolution", ...)`, `vi.mock("@/lib/repositories/server/prisma", ...)`, `vi.stubEnv`

---

## 4. Validation Against Source Pattern (Step 4)

Checklist from skill:

- [ ] matches existing in-repo integration pattern – YES, reuses `WhatsAppProvider` interface, `getEvolutionProvider()`, `WhatsAppProviderError`, `server-only`, env config pattern
- [ ] config validation exists – YES, `configFromEnv()`-like check for `ARCHITECH_AUTH_WHATSAPP_ENABLED`, `ARCHITECH_EVOLUTION_API_URL/KEY`
- [ ] auth and error handling are explicit – YES, `DEFINITIVE` vs `AMBIGUOUS`, maps to 400/409/429/502, no leaking internal errors
- [ ] pagination/retry behavior follows repo norms – N/A for OTP, but throttle follows `login-throttle.ts` pattern
- [ ] registry/discovery wiring is complete – YES, new API routes registered, Prisma models, system account seed
- [ ] tests mirror host repo's style – YES, vitest, hoisted mocks, `describe/it`
- [ ] docs updated – YES, this plan + README update

---

## 5. Security Considerations (security-review)

- **OTP Storage:** Never store plaintext OTP, only hash (HMAC SHA256 with `ARCHITECH_OTP_HMAC_KEY` or `ARCHITECH_IDEMPOTENCY_HMAC_KEY`). Use constant-time compare.
- **Expiry:** 5 min, auto-delete expired via cron or on next send (like retention)
- **Attempts:** Max 5 verify attempts per OTP, then invalidate. 3 OTPs per hour per phone, 10 per IP per hour (reuse `registerLoginAttempt` pattern)
- **Phone Validation:** Strict India regex `/^[6-9]\d{9}$/`, normalize to E164 `+91`, store E164, display masked `+91-•••••12345`
- **Rate Limiting:** Reuse `login-throttle.ts` but new bucket `otp:${phone}` and `otp:ip:${ip}`
- **WhatsApp Send:** Only from verified CONNECTED system account, check status before send, fail closed if DISCONNECTED
- **Secrets:** No hardcoded keys, all via env, verify existence at startup (like `evolution.ts` `configFromEnv`)
- **CSRF:** Keep `enforceMutationSafety` on all POST routes
- **Enumeration:** Return same message for "phone already exists" vs "OTP sent" ? For signup we should return 409 explicit? Better to return generic "If not registered, OTP sent" to avoid enumeration, but product may want explicit. Choose explicit for UX, with rate limit to prevent enumeration.
- **Password:** Keep existing password validation (8-128 chars), store via Better Auth (bcrypt)
- **Audit:** Log `auth.otp.sent`, `auth.otp.verified`, `auth.otp.failed` via `auditEvent` like WhatsApp store does

---

## 6. Implementation Steps (Execution Order)

1. **Prisma Schema:** Add `phoneE164`, `phoneVerified`, `OtpVerification`, `SystemWhatsAppAccount` (or seed system org)
2. **Phone Validation:** `src/lib/auth/phone.ts` + tests
3. **OTP Service:** `src/lib/auth/otp.ts` + `otp-service.ts` + tests
4. **WhatsApp OTP Sender:** `src/lib/auth/whatsapp-otp.ts` – reuse provider, add system account helpers
5. **Admin System WhatsApp Routes:** `/api/admin/whatsapp/system/*` – connect, qr, status (copy broker pattern)
6. **Auth OTP Routes:** `/api/auth/otp/send`, `/api/auth/otp/verify`
7. **Modify Credential Flow:** Add `signInWithPhone`, update `register` to require verified OTP (check OtpVerification verifiedAt)
8. **Modify Login/Register Routes:** Change to phone
9. **Frontend:** Update `Login.tsx` – phone input, OTP step, resend timer
10. **Demo Accounts:** Update `demo-accounts.ts` to include phone for demo mode (or keep email for demo, phone for live)
11. **Migrations & Seed:** Create migration, seed system organization
12. **E2E Test:** Manual test with Evolution API local docker (`docker-compose.whatsapp.yml`)

---

## 7. Your Selections Summary

- **Skill:** `api-connector-builder` (primary) – you selected this
- **Phone Scope:** India only (+91, 10-digit) – strict regex, auto +91
- **OTP Flow:** OTP verifies → then collect name + password (you selected otp_then_profile) – Step 1 phone/name/password + Send OTP, Step 2 verify OTP, then account created
- **Admin WhatsApp:** Single global system account – admin logs in once via QR, all OTPs from that number
- **Login Migration:** Remove email login, use phone + password (your custom: phone OTP for signup verification, then phone as userid + password for login)

---

## 8. Next Actions – Need Your Confirmation

The plan is ready. To proceed with implementation, confirm:

1. Should I create new Prisma model `OtpVerification` + `SystemWhatsAppAccount` or reuse existing `WhatsAppAccount` with fixed orgId `system`?
2. Should demo mode still use email/password (for local dev) or also switch to phone OTP mock?
3. For login, should we support **both** phone OTP login (passwordless) in future, or strictly phone + password only?

If you approve, I will start implementation in order: schema → phone validation → OTP service → WhatsApp sender → API routes → frontend.

---

**Files to Touch (estimated 15-20):**
- `db/schema.prisma`
- `src/lib/auth/phone.ts` (new)
- `src/lib/auth/otp.ts` (new)
- `src/lib/auth/otp-service.ts` (new)
- `src/lib/auth/whatsapp-otp.ts` (new)
- `src/lib/auth/credentials.ts` (modify)
- `src/lib/auth/credential-flow.ts` (modify)
- `src/lib/auth/server-auth.ts` (modify additionalFields)
- `src/app/api/auth/otp/send/route.ts` (new)
- `src/app/api/auth/otp/verify/route.ts` (new)
- `src/app/api/auth/login/route.ts` (modify to phone)
- `src/app/api/admin/whatsapp/system/connect/route.ts` (new)
- `src/app/api/admin/whatsapp/system/qr/route.ts` (new)
- `src/app/api/admin/whatsapp/system/status/route.ts` (new)
- `src/screens/Login.tsx` (major modify)
- Tests: 5-6 new test files
