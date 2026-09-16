import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as forgot } from "../../app/api/auth/otp/forgot/route";
import { POST as reset } from "../../app/api/auth/otp/reset/route";
import { POST as sendSignupOtp } from "../../app/api/auth/otp/send/route";
import { POST as login } from "../../app/api/auth/login/route";
import { clearLoginThrottleForTests, MAX_ATTEMPTS_PER_IP } from "./login-throttle";
import { clearMutationSafetyBucketsForTests } from "./request-safety";
import { clearMemoryStoreForTests, getLatestValidOtp } from "./otp-store";
import { DEMO_OTP, OTP_PURPOSE_PASSWORD_RESET, OTP_PURPOSE_SIGNUP } from "./otp";
import { clearDemoResetPasswordsForTests, demoResetPasswordFor } from "./password-reset-flow";
import { applyPasswordResetToken, requestPasswordResetToken, resetAuthServerForTests } from "./server-auth";

/* Live mode generates a random code, which a test cannot read back — the store
   only holds the HMAC. Pinning generation keeps the live-path tests driving the
   real route rather than reaching around it, and touches nothing the demo-path
   tests use (demo always uses DEMO_OTP). `vi.hoisted` because the `vi.mock`
   factory is hoisted above this module's own declarations. */
const LIVE_OTP = "654321";
const otpState = vi.hoisted(() => ({ value: "654321" }));
vi.mock("./otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./otp")>();
  return { ...actual, generateOtp: () => otpState.value };
});

const ORIGIN = "http://localhost:3000";
const PHONE = "9876543210";
const PHONE_E164 = "+919876543210";

function post(path: string, body: unknown, init: { origin?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: init.origin ?? ORIGIN, host: "localhost:3000" };
  headers["x-real-ip"] = init.ip ?? "203.0.113.42";
  return new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

function clearAllState() {
  clearLoginThrottleForTests();
  clearMutationSafetyBucketsForTests();
  clearMemoryStoreForTests();
  clearDemoResetPasswordsForTests();
}

/** Switch to live Better Auth (memory adapter) on a fresh instance. */
function useLiveAuth() {
  vi.stubEnv("ARCHITECH_AUTH_SOURCE", "better-auth");
  vi.stubEnv("BETTER_AUTH_SECRET", "w".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.stubEnv("DATABASE_URL", "postgres://unused-by-memory-adapter");
  resetAuthServerForTests();
}

beforeEach(() => {
  clearAllState();
  resetAuthServerForTests();
  otpState.value = LIVE_OTP;
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  vi.stubEnv("ARCHITECH_AUTH_SOURCE", "demo");
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearAllState();
  resetAuthServerForTests();
});

describe("forgot-password: sending a reset code (demo mode)", () => {
  it("accepts the number and answers with a masked one", async () => {
    const response = await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    /* The full number must never come back down the wire — the browser already
       has the number it just typed, and a masked-only response is one fewer
       place a full number can land in a log or a capture. */
    expect(body.phoneMasked).toBe("+91-•••••3210");
    expect(body.phoneE164).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(PHONE);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("stores the code under the reset purpose, never in plaintext", async () => {
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    const record = await getLatestValidOtp(PHONE_E164, OTP_PURPOSE_PASSWORD_RESET);
    expect(record).not.toBeNull();
    expect(record?.purpose).toBe(OTP_PURPOSE_PASSWORD_RESET);
    expect(record?.otpHash).not.toBe(DEMO_OTP);
    expect(record?.otpHash).toHaveLength(64); // HMAC-SHA256 hex
    /* 5 minutes, and 5 tries — the same budget signup gets. */
    expect(record?.maxAttempts).toBe(5);
    expect(record!.expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60 * 1000);
  });

  it("answers a number we have never seen exactly like one we have", async () => {
    /* Account enumeration is the whole risk of a forgot-password form. Demo
       mode has no roster to distinguish against, so what is pinned here is the
       property that actually holds in every mode: the response carries no
       signal about whether the number is registered. */
    const known = await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }, { ip: "203.0.113.10" }));
    const unknown = await forgot(post("/api/auth/otp/forgot/", { phone: "9812345678" }, { ip: "203.0.113.11" }));
    expect(known.status).toBe(unknown.status);
    const a = await known.json();
    const b = await unknown.json();
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.message.replace(a.phoneMasked, "<masked>")).toBe(b.message.replace(b.phoneMasked, "<masked>"));
  });

  it("validates the number before touching the code store", async () => {
    const empty = await forgot(post("/api/auth/otp/forgot/", { phone: "" }));
    expect(empty.status).toBe(400);
    expect((await empty.json()).issues.map((i: { field: string }) => i.field)).toEqual(["phone"]);

    /* Landline prefixes and foreign numbers are both out of scope: this is an
       India-only surface and the WhatsApp sender is Indian. */
    const landline = await forgot(post("/api/auth/otp/forgot/", { phone: "2212345678" }));
    expect(landline.status).toBe(400);
    expect(await getLatestValidOtp("+912212345678", OTP_PURPOSE_PASSWORD_RESET)).toBeNull();
  });

  it("rejects a cross-site submission (CSRF)", async () => {
    const response = await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }, { origin: "https://evil.example.com" }));
    expect(response.status).toBe(403);
  });

  it("caps reset codes at three per number per hour", async () => {
    for (let i = 0; i < 3; i += 1) {
      const ok = await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }, { ip: `203.0.113.${20 + i}` }));
      expect(ok.status).toBe(200);
    }
    const blocked = await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }, { ip: "203.0.113.30" }));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe("TOO_MANY_OTPS");
    expect(blocked.headers.get("retry-after")).toBe("3600");
  });

  it("rejects a malformed body rather than guessing at it", async () => {
    const request = new Request(`${ORIGIN}/api/auth/otp/forgot/`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", "x-real-ip": "203.0.113.42" },
      body: "{not-json",
    });
    const response = await forgot(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("INVALID_BODY");
  });
});

describe("forgot-password: exchanging a code for a password (demo mode)", () => {
  it("resets the password, and the new one is what signs in", async () => {
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    const done = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "brand-new-pass-1" }));
    expect(done.status).toBe(200);
    const body = await done.json();
    expect(body.ok).toBe(true);
    expect(body.phoneMasked).toBe("+91-•••••3210");

    /* Recovering an account must not hand out a session: a 6-digit code should
       never be a session-granting secret. */
    expect(done.headers.getSetCookie()).toHaveLength(0);

    /* The claim that matters: the password just chosen actually signs in. */
    const signedIn = await login(post("/api/auth/login/", { phone: PHONE, password: "brand-new-pass-1" }));
    expect(signedIn.status).toBe(200);
    expect((await signedIn.json()).session.user.phoneE164).toBe(PHONE_E164);
  });

  it("makes the new password supersede the shared demo one", async () => {
    const { DEMO_ACCOUNTS } = await import("./demo-accounts");
    const buyerPassword = DEMO_ACCOUNTS.find((a) => a.id === "demo-user-buyer")!.password;

    /* Before any reset, the published demo password works for any number. */
    expect((await login(post("/api/auth/login/", { phone: PHONE, password: buyerPassword }))).status).toBe(200);

    clearLoginThrottleForTests();
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "rotated-pass-99" }));

    clearLoginThrottleForTests();
    const oldPassword = await login(post("/api/auth/login/", { phone: PHONE, password: buyerPassword }));
    expect(oldPassword.status).toBe(401);
    expect(demoResetPasswordFor(PHONE_E164)).toBe("rotated-pass-99");
  });

  it("rejects a wrong code and stops accepting guesses after five", async () => {
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: String(100000 + attempt), password: "whatever-pass-1" }));
      expect(wrong.status).toBe(401);
      expect((await wrong.json()).issues[0].field).toBe("otp");
    }
    /* The sixth guess is refused on the attempt count, before the code is even
       compared — so the budget cannot be extended by asking nicely. */
    const locked = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "whatever-pass-1" }));
    expect(locked.status).toBe(429);
    expect((await locked.json()).error).toBe("TOO_MANY_ATTEMPTS");
    /* Lockout must not be a back door: the password stays unchanged. */
    expect(demoResetPasswordFor(PHONE_E164)).toBeNull();
  });

  it("treats a code as single-use", async () => {
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    const first = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "first-pass-1234" }));
    expect(first.status).toBe(200);
    const replay = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "second-pass-5678" }));
    expect(replay.status).toBe(400);
    expect((await replay.json()).error).toBe("OTP_EXPIRED");
    /* The replay must not have written over the first password. */
    expect(demoResetPasswordFor(PHONE_E164)).toBe("first-pass-1234");
  });

  it("will not accept a signup code for a reset", async () => {
    /* Purpose separation is a security property: the two flows must not be able
       to satisfy each other, or a code requested to CREATE an account would
       also be able to change its password. */
    await sendSignupOtp(post("/api/auth/otp/send/", { phone: PHONE, name: "Ananya Sharma", password: "signup-pass-1", listerType: "OWNER" }));
    expect(await getLatestValidOtp(PHONE_E164, OTP_PURPOSE_SIGNUP)).not.toBeNull();
    expect(await getLatestValidOtp(PHONE_E164, OTP_PURPOSE_PASSWORD_RESET)).toBeNull();

    const response = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "stolen-pass-123" }));
    expect(response.status).toBe(400);
    expect(demoResetPasswordFor(PHONE_E164)).toBeNull();
  });

  it("refuses to reset without a code having been sent", async () => {
    const response = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "no-code-pass-1" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("OTP_EXPIRED");
  });

  it("holds the new password to the same floor as sign-up", async () => {
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    const short = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "short" }));
    expect(short.status).toBe(400);
    const body = await short.json();
    expect(body.issues.map((i: { field: string }) => i.field)).toEqual(["password"]);
    expect(demoResetPasswordFor(PHONE_E164)).toBeNull();
  });

  it("validates the code's shape before spending it", async () => {
    await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    const malformed = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: "12ab", password: "otherwise-fine-1" }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).issues.map((i: { field: string }) => i.field)).toEqual(["otp"]);
    /* A shape rejection must not consume an attempt. */
    const stillWorks = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "otherwise-fine-1" }));
    expect(stillWorks.status).toBe(200);
  });

  it("bounds guessing across many numbers from one IP", async () => {
    /* Per-code attempts alone would let an attacker request codes for a whole
       number range and take five clean guesses at each. The IP budget has to
       bite regardless of how many numbers are in play. */
    const ip = "203.0.113.99";
    let attempts = 0;
    let blocked = false;
    for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i += 1) {
      const number = `98${String(i).padStart(8, "0")}`;
      await forgot(post("/api/auth/otp/forgot/", { phone: number }, { ip }));
      const guess = await reset(post("/api/auth/otp/reset/", { phone: number, otp: "000000", password: "guessed-pass-123" }, { ip }));
      attempts += 1;
      if (guess.status === 429) {
        blocked = true;
        expect((await guess.json()).error).toBe("TOO_MANY_ATTEMPTS");
        break;
      }
    }
    expect(blocked).toBe(true);
    expect(attempts).toBeLessThanOrEqual(MAX_ATTEMPTS_PER_IP);
  });

  it("rejects a cross-site submission (CSRF)", async () => {
    const response = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: DEMO_OTP, password: "csrf-pass-12345" }, { origin: "https://evil.example.com" }));
    expect(response.status).toBe(403);
  });
});

describe("forgot-password: Better Auth reset-token helpers", () => {
  /* These two helpers are the seam between "the user proved the phone" and
     "the password store changed". Better Auth only hands the token to the
     `sendResetPassword` callback, and nothing here controls whether Better Auth
     awaits that callback — so the capture being ready by the time
     `requestPasswordReset` resolves is an assumption worth pinning. If a future
     Better Auth defers it, this fails instead of resets silently breaking. */

  async function signUp(email: string, password: string) {
    const { getAuthServer } = await import("./server-auth");
    const response = await getAuthServer().handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ name: "Reset Target", email, password }),
      }),
    );
    expect(response.status).toBe(200);
  }

  async function signInStatus(email: string, password: string) {
    const { getAuthServer } = await import("./server-auth");
    const response = await getAuthServer().handler(
      new Request(`${ORIGIN}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email, password }),
      }),
    );
    return response.status;
  }

  beforeEach(() => useLiveAuth());

  it("mints a token, spends it, and the old password stops working", async () => {
    useLiveAuth();
    const email = "919876543210@phone.architech.internal";
    await signUp(email, "old-password-1");
    expect(await signInStatus(email, "old-password-1")).toBe(200);

    const token = await requestPasswordResetToken(email);
    expect(token).toBeTruthy();

    const applied = await applyPasswordResetToken(token!, "new-password-2");
    expect(applied.ok).toBe(true);

    expect(await signInStatus(email, "new-password-2")).toBe(200);
    expect(await signInStatus(email, "old-password-1")).not.toBe(200);
  });

  it("returns no token for an account that does not exist", async () => {
    useLiveAuth();
    /* Better Auth answers 200 either way so the endpoint is not an enumeration
       oracle; the flow reads the absence from the missing token, not the
       status, and must keep doing so. */
    expect(await requestPasswordResetToken("919000000000@phone.architech.internal")).toBeNull();
  });

  it("refuses to spend a token twice", async () => {
    useLiveAuth();
    const email = "919876543211@phone.architech.internal";
    await signUp(email, "old-password-1");
    const token = await requestPasswordResetToken(email);
    expect((await applyPasswordResetToken(token!, "new-password-2")).ok).toBe(true);
    const replay = await applyPasswordResetToken(token!, "attacker-pass-3");
    expect(replay.ok).toBe(false);
    expect(await signInStatus(email, "new-password-2")).toBe(200);
  });

  it("keeps concurrent resets for different accounts from trading tokens", async () => {
    useLiveAuth();
    const a = "919876543212@phone.architech.internal";
    const b = "919876543213@phone.architech.internal";
    await signUp(a, "old-password-1");
    await signUp(b, "old-password-1");
    const [tokenA, tokenB] = await Promise.all([requestPasswordResetToken(a), requestPasswordResetToken(b)]);
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();
    expect(tokenA).not.toBe(tokenB);
    expect((await applyPasswordResetToken(tokenA!, "a-new-pass-1")).ok).toBe(true);
    expect((await applyPasswordResetToken(tokenB!, "b-new-pass-1")).ok).toBe(true);
    /* Each token reset its own account, not the other's. */
    expect(await signInStatus(a, "a-new-pass-1")).toBe(200);
    expect(await signInStatus(b, "b-new-pass-1")).toBe(200);
  });
});

describe("forgot-password: live Better Auth end to end", () => {
  beforeEach(() => useLiveAuth());

  it("resets a real account's password through the routes", async () => {
    useLiveAuth();
    const email = `${PHONE_E164.replace(/\D/g, "")}@phone.architech.internal`;
    const { getAuthServer } = await import("./server-auth");
    await getAuthServer().handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ name: "Ananya Sharma", email, password: "old-password-1", role: "BUYER", phoneE164: PHONE_E164 }),
      }),
    );

    const sent = await forgot(post("/api/auth/otp/forgot/", { phone: PHONE }));
    expect(sent.status).toBe(200);

    const done = await reset(post("/api/auth/otp/reset/", { phone: PHONE, otp: LIVE_OTP, password: "recovered-pass-1" }));
    expect(done.status).toBe(200);

    clearLoginThrottleForTests();
    const withNew = await login(post("/api/auth/login/", { phone: PHONE, password: "recovered-pass-1" }));
    expect(withNew.status).toBe(200);
    expect((await withNew.json()).session.user.email).toBe(email);

    clearLoginThrottleForTests();
    const withOld = await login(post("/api/auth/login/", { phone: PHONE, password: "old-password-1" }));
    expect(withOld.status).toBe(401);
  });

  it("refuses to reset for a number with no account, without saying so", async () => {
    useLiveAuth();
    const sent = await forgot(post("/api/auth/otp/forgot/", { phone: "9812345678" }));
    expect(sent.status).toBe(200);
    const done = await reset(post("/api/auth/otp/reset/", { phone: "9812345678", otp: LIVE_OTP, password: "sneaky-pass-123" }));
    expect(done.status).toBe(400);
    /* Generic failure — not USER_NOT_FOUND, not "no account". */
    expect((await done.json()).error).toBe("RESET_FAILED");
  });

  it("retires the previous code when a new one is requested", async () => {
    /* A user who asks twice — message did not arrive, tapped again — must not
       leave two live codes in flight. The one that arrives late is the one they
       have already stopped watching for. */
    useLiveAuth();
    const email = "919876543214@phone.architech.internal";
    const { getAuthServer } = await import("./server-auth");
    await getAuthServer().handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ name: "Twice Asker", email, password: "old-password-1", role: "BUYER", phoneE164: "+919876543214" }),
      }),
    );

    otpState.value = "111111";
    expect((await forgot(post("/api/auth/otp/forgot/", { phone: "9876543214" }))).status).toBe(200);
    otpState.value = "222222";
    expect((await forgot(post("/api/auth/otp/forgot/", { phone: "9876543214" }))).status).toBe(200);

    /* 401, not 400: the retired code leaves exactly one valid record, so the
       lookup returns the NEW code and the stale one simply fails the compare.
       Either way it does not reset anything — which is the point. */
    const stale = await reset(post("/api/auth/otp/reset/", { phone: "9876543214", otp: "111111", password: "stale-pass-1234" }));
    expect(stale.status).toBe(401);
    expect((await stale.json()).error).toBe("INVALID_OTP");

    const current = await reset(post("/api/auth/otp/reset/", { phone: "9876543214", otp: "222222", password: "current-pass-12" }));
    expect(current.status).toBe(200);
  });
});
