import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "../../../../app/api/auth/login/route";
import { POST as logout } from "../../../../app/api/auth/logout/route";
import { POST as register } from "../../../../app/api/auth/register/route";
import { GET as session } from "../../../../app/api/auth/session/route";
import { clearLoginThrottleForTests, MAX_ATTEMPTS_PER_EMAIL } from "./login-throttle";
import { clearMutationSafetyBucketsForTests } from "./request-safety";
import { DEMO_ACCOUNTS, DEMO_SESSION_COOKIE, DEMO_SIGNED_OUT } from "./demo-accounts";
import { resetAuthServerForTests } from "./server-auth";

const ORIGIN = "http://localhost:3000";

function post(path: string, body: unknown, init: { cookie?: string; origin?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: init.origin ?? ORIGIN, host: "localhost:3000" };
  if (init.cookie) headers.cookie = init.cookie;
  headers["x-real-ip"] = init.ip ?? "203.0.113.42";
  return new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

function cookiesOf(response: Response): string {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

const broker = DEMO_ACCOUNTS[0];
const buyer = DEMO_ACCOUNTS.find((account) => account.session.user.role === "BUYER")!;

beforeEach(() => {
  clearLoginThrottleForTests();
  clearMutationSafetyBucketsForTests();
  resetAuthServerForTests();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  vi.stubEnv("ARCHITECH_AUTH_SOURCE", "demo");
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearLoginThrottleForTests();
  clearMutationSafetyBucketsForTests();
});

describe("login route", () => {
  it("signs a demo account in and sets an HttpOnly session cookie", async () => {
    const response = await login(post("/api/auth/login", { email: broker.email, password: broker.password }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.session.user.email).toBe(broker.email);
    expect(body.canAccessBrokerDashboard).toBe(true);

    const setCookie = response.headers.getSetCookie().join(" ");
    expect(setCookie).toContain(DEMO_SESSION_COOKIE);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    /* The cookie must never be readable by page scripts, and the response must
       never be cached by a shared proxy. */
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("routes each role to a landing page that role can open", async () => {
    const brokerBody = await (await login(post("/api/auth/login", { email: broker.email, password: broker.password }))).json();
    expect(brokerBody.redirectTo).toBe("/broker/dashboard/");

    clearLoginThrottleForTests();
    const buyerBody = await (await login(post("/api/auth/login", { email: buyer.email, password: buyer.password }))).json();
    expect(buyerBody.redirectTo).toBe("/saved/");
  });

  it("honours a safe ?next= destination but refuses an off-site one", async () => {
    const safe = await (await login(post("/api/auth/login", { email: buyer.email, password: buyer.password, next: "/search/?city=pune" }))).json();
    expect(safe.redirectTo).toBe("/search/?city=pune");

    clearLoginThrottleForTests();
    const hostile = await (await login(post("/api/auth/login", { email: buyer.email, password: buyer.password, next: "https://evil.example.com/" }))).json();
    expect(hostile.redirectTo).toBe("/saved/");
  });

  it("returns one indistinguishable message for a bad password and an unknown email", async () => {
    const wrongPassword = await login(post("/api/auth/login", { email: broker.email, password: "not-the-password" }));
    clearLoginThrottleForTests();
    const unknownEmail = await login(post("/api/auth/login", { email: "nobody@example.com", password: "not-the-password" }));

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const a = await wrongPassword.json();
    const b = await unknownEmail.json();
    expect(a.message).toBe(b.message);
    expect(a.error).toBe(b.error);
    /* No cookie may be minted on a failed attempt. */
    expect(wrongPassword.headers.getSetCookie()).toHaveLength(0);
  });

  it("validates the payload before touching any credential store", async () => {
    const response = await login(post("/api/auth/login", { email: "not-an-email", password: "x" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues.map((issue: { field: string }) => issue.field).sort()).toEqual(["email", "password"]);
  });

  it("throttles repeated failures against one account", async () => {
    /* The guesses must be well-formed: validation runs before the throttle, so
       a too-short password would be rejected without ever consuming budget. */
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL; attempt += 1) {
      const failed = await login(post("/api/auth/login", { email: broker.email, password: `wrong-password-${attempt}` }, { ip: `10.1.0.${attempt}` }));
      expect(failed.status).toBe(401);
    }
    const blocked = await login(post("/api/auth/login", { email: broker.email, password: broker.password }, { ip: "10.1.9.9" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("rejects a cross-site submission (login CSRF)", async () => {
    const response = await login(post("/api/auth/login", { email: broker.email, password: broker.password }, { origin: "https://evil.example.com" }));
    expect(response.status).toBe(403);
  });

  it("rejects a malformed body without a stack trace", async () => {
    const request = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", "x-real-ip": "203.0.113.1" },
      body: "{not json",
    });
    const response = await login(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("INVALID_BODY");
  });
});

describe("session + logout round trip", () => {
  it("reflects the signed-in demo account and then clears it", async () => {
    const signedIn = await login(post("/api/auth/login", { email: buyer.email, password: buyer.password }));
    const cookie = cookiesOf(signedIn);

    const withCookie = await session(new Request(`${ORIGIN}/api/auth/session`, { headers: { cookie } }));
    const sessionBody = await withCookie.json();
    expect(sessionBody.authenticated).toBe(true);
    expect(sessionBody.session.user.email).toBe(buyer.email);
    expect(sessionBody.canAccessBrokerDashboard).toBe(false);

    const signedOut = await logout(post("/api/auth/logout", {}, { cookie }));
    expect(signedOut.status).toBe(200);
    const clearedCookie = cookiesOf(signedOut);
    expect(clearedCookie).toContain(DEMO_SIGNED_OUT);

    /* The crucial assertion: after sign-out the session contract must report
       nobody. Deleting the demo cookie instead of writing the sentinel would
       fall back to the implicit broker session and silently sign the user
       back in. */
    const after = await session(new Request(`${ORIGIN}/api/auth/session`, { headers: { cookie: clearedCookie } }));
    const afterBody = await after.json();
    expect(afterBody.authenticated).toBe(false);
    expect(afterBody.session).toBeNull();
  });

  it("keeps the historical no-cookie demo contract intact", async () => {
    const response = await session(new Request(`${ORIGIN}/api/auth/session`));
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.session.user.role).toBe("BROKER_ADMIN");
  });
});

describe("register route", () => {
  it("refuses to fake account creation in demo mode", async () => {
    const response = await register(post("/api/auth/register", { name: "New User", email: "new@example.com", password: "password123" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("REGISTRATION_UNAVAILABLE");
  });

  it("creates a live account, mints a session, and never honours a self-assigned role", async () => {
    vi.stubEnv("ARCHITECH_AUTH_SOURCE", "better-auth");
    vi.stubEnv("BETTER_AUTH_SECRET", "w".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
    vi.stubEnv("DATABASE_URL", "postgres://unused-by-memory-adapter");
    resetAuthServerForTests();

    const response = await register(post("/api/auth/register", { name: "Ananya Sharma", email: "ananya@example.com", password: "password123", role: "ADMIN" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    /* Privilege escalation guard: the request asked for ADMIN. */
    expect(body.session.user.role).toBe("BUYER");
    expect(body.redirectTo).toBe("/saved/");
    expect(response.headers.getSetCookie().join(" ")).toContain("better-auth.session_token");
  });

  it("signs a live account in with the credentials it was created with", async () => {
    vi.stubEnv("ARCHITECH_AUTH_SOURCE", "better-auth");
    vi.stubEnv("BETTER_AUTH_SECRET", "w".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
    vi.stubEnv("DATABASE_URL", "postgres://unused-by-memory-adapter");
    resetAuthServerForTests();

    await register(post("/api/auth/register", { name: "Live User", email: "live-login@example.com", password: "password123" }));
    clearLoginThrottleForTests();

    const good = await login(post("/api/auth/login", { email: "live-login@example.com", password: "password123" }));
    expect(good.status).toBe(200);
    expect((await good.json()).session.user.email).toBe("live-login@example.com");

    clearLoginThrottleForTests();
    const bad = await login(post("/api/auth/login", { email: "live-login@example.com", password: "wrong-password" }));
    expect(bad.status).toBe(401);
    expect(bad.headers.getSetCookie()).toHaveLength(0);
  });

  it("reports a duplicate account without leaking a different failure shape", async () => {
    vi.stubEnv("ARCHITECH_AUTH_SOURCE", "better-auth");
    vi.stubEnv("BETTER_AUTH_SECRET", "w".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
    vi.stubEnv("DATABASE_URL", "postgres://unused-by-memory-adapter");
    resetAuthServerForTests();

    await register(post("/api/auth/register", { name: "Dupe", email: "dupe@example.com", password: "password123" }));
    const again = await register(post("/api/auth/register", { name: "Dupe", email: "dupe@example.com", password: "password123" }));
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe("ACCOUNT_EXISTS");
  });
});
