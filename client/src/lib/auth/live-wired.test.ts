import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionContractForRequest } from "./live";
import { resolveBetterAuthClaims, resetAuthServerForTests } from "./server-auth";
import { canAccessBrokerDashboard, requirePermission } from "./roles";

/* I-1: live session retrieval was never wired — a configured Better Auth cookie
   yielded `{ session: null }`. These tests prove the contract end-to-end: the
   same server-auth module that resolves claims is used to mint a session. */

const LIVE_ENV = {
  ARCHITECH_AUTH_SOURCE: "better-auth",
  BETTER_AUTH_SECRET: "w".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://unused-by-memory-adapter",
};

async function signUpAndCookie(email: string, role: string): Promise<string> {
  const { getAuthServer } = await import("./server-auth");
  const auth = getAuthServer();
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Live Broker", email, password: "password123", role }),
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers.getSetCookie().map((part) => part.split(";")[0]).join("; ");
  expect(cookie).toContain("better-auth.session_token=");
  return cookie;
}

describe("live Better Auth session wired into the request contract", () => {
  beforeEach(() => {
    resetAuthServerForTests();
    vi.stubEnv("ARCHITECH_AUTH_SOURCE", LIVE_ENV.ARCHITECH_AUTH_SOURCE);
    vi.stubEnv("BETTER_AUTH_SECRET", LIVE_ENV.BETTER_AUTH_SECRET);
    vi.stubEnv("BETTER_AUTH_URL", LIVE_ENV.BETTER_AUTH_URL);
    vi.stubEnv("DATABASE_URL", LIVE_ENV.DATABASE_URL);
  });

  afterEach(() => {
    resetAuthServerForTests();
    vi.unstubAllEnvs();
  });

  it("yields a live session for a configured Better Auth cookie", async () => {
    const cookie = await signUpAndCookie("broker-live@example.com", "BROKER_ADMIN");
    const contract = await getSessionContractForRequest(
      new Request("http://example.com/api/auth/session", { headers: { cookie } }),
    );
    expect(contract.session).not.toBeNull();
    expect(contract.session?.source).toBe("better-auth-live");
    expect(contract.session?.user.email).toBe("broker-live@example.com");
    expect(contract.session?.user.role).toBe("BROKER_ADMIN");
    /* A live broker session must be a *usable* broker session: org membership
       is what the dashboard gate requires, and role permissions are what the
       guarded APIs check. Without them the auth switch is cosmetic. */
    expect(contract.session?.organization?.slug).toBe("nivasa-partners");
    expect(canAccessBrokerDashboard(contract.session)).toBe(true);
    expect(requirePermission(contract.session, "lead.inbox.read")).toBe(true);
    expect(requirePermission(contract.session, "media.upload.write")).toBe(true);
  });

  it("returns no session (not a 503) when the cookie is absent or invalid", async () => {
    const absent = await getSessionContractForRequest(new Request("http://example.com/api/auth/session"));
    expect(absent.session).toBeNull();
    expect(absent.source).toBe("better-auth-live");

    const invalid = await getSessionContractForRequest(
      new Request("http://example.com/api/auth/session", { headers: { cookie: "better-auth.session_token=garbage" } }),
    );
    expect(invalid.session).toBeNull();
    expect(invalid.source).toBe("better-auth-live");
  });

  it("maps claims directly through the same resolver the contract uses", async () => {
    const claims = await resolveBetterAuthClaims("not-a-real-token");
    expect(claims).toBeNull();
  });
});
