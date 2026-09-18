import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DEMO_ACCOUNTS,
  DEMO_SESSION_COOKIE,
  DEMO_SIGNED_OUT,
  demoCookieAttributes,
  demoSessionCookieValue,
  demoSignOutCookieValue,
} from "./demo-accounts";

/* The demo session cookie must survive the cross-site preview iframe.
 *
 * Arena/e2b previews embed this app in an iframe on a different site. Chrome
 * silently DROPS `SameSite=Lax` cookies in that context — the login POST
 * answers 200 while the browser keeps no session, which presented as "demo
 * login signs nobody in, and shows no error". `demoCookieAttributes` therefore
 * emits `SameSite=None; Secure; Partitioned` outside production; this file
 * pins both branches so the attributes cannot silently regress to Lax. */
describe("demoCookieAttributes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits the iframe-proof form outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new Request("http://localhost:3000/api/auth/login");
    expect(demoCookieAttributes(request)).toBe("HttpOnly; SameSite=None; Secure; Partitioned");
  });

  it("keeps the strict protocol-derived form in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const http = new Request("http://localhost:3000/api/auth/login");
    const https = new Request("https://architech.example.com/api/auth/login");
    expect(demoCookieAttributes(http)).toBe("HttpOnly; SameSite=Lax");
    expect(demoCookieAttributes(https)).toBe("HttpOnly; SameSite=Lax; Secure");
  });

  it("sign-in and sign-out cookies carry the same attributes", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new Request("http://localhost:3000/api/auth/login");
    const account = DEMO_ACCOUNTS[0];

    const signIn = demoSessionCookieValue(account, request);
    expect(signIn).toContain(`${DEMO_SESSION_COOKIE}=${encodeURIComponent(account.id)}`);
    expect(signIn).toContain("SameSite=None");
    expect(signIn).toContain("Partitioned");

    const signOut = demoSignOutCookieValue(request);
    expect(signOut).toContain(`${DEMO_SESSION_COOKIE}=${DEMO_SIGNED_OUT}`);
    expect(signOut).toContain("SameSite=None");
    expect(signOut).toContain("Partitioned");
  });
});
