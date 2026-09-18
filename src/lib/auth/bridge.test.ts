import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as bridge } from "../../app/api/auth/bridge/route";
import { POST as login } from "../../app/api/auth/login/route";
import { clearLoginThrottleForTests } from "./login-throttle";
import { clearMutationSafetyBucketsForTests } from "./request-safety";
import { DEMO_ACCOUNTS, DEMO_SESSION_COOKIE } from "./demo-accounts";
import { resetAuthServerForTests } from "./server-auth";

/* The bridge is the cookie-hostile-embed escape hatch: a successful demo login
   also returns a single-use URL that signs the user in from a TOP-LEVEL tab,
   where first-party cookies always work. See demo-accounts.ts for why the
   embedded preview can drop even SameSite=None; Secure; Partitioned cookies. */
const ORIGIN = "http://localhost:3000";
const broker = DEMO_ACCOUNTS[0];

function post(path: string, body: unknown) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", "x-real-ip": "203.0.113.42" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  clearLoginThrottleForTests();
  clearMutationSafetyBucketsForTests();
  resetAuthServerForTests();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  vi.stubEnv("ARCHITECH_AUTH_SOURCE", "demo");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demo bridge", () => {
  it("login returns a one-time bridgeUrl for demo sessions", async () => {
    const response = await login(post("/api/auth/login", { phone: broker.phoneE164, password: broker.password }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.bridgeUrl).toMatch(/^\/api\/auth\/bridge\/\?token=/);
    expect(body.bridgeUrl).toContain(encodeURIComponent("/dashboard/"));
  });

  it("exchanges a valid token for the session cookie and redirects to the destination", async () => {
    const loginResponse = await login(post("/api/auth/login", { phone: broker.phoneE164, password: broker.password }));
    const { bridgeUrl } = (await loginResponse.json()) as { bridgeUrl: string };

    const response = await bridge(new Request(`${ORIGIN}${bridgeUrl}`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/dashboard/");

    const setCookie = response.headers.getSetCookie().join(" ");
    expect(setCookie).toContain(`${DEMO_SESSION_COOKIE}=${broker.id}`);
  });

  it("honours a safe ?next= destination", async () => {
    const loginResponse = await login(post("/api/auth/login", { phone: broker.phoneE164, password: broker.password, next: "/broker/leads/" }));
    const { bridgeUrl } = (await loginResponse.json()) as { bridgeUrl: string };

    const response = await bridge(new Request(`${ORIGIN}${bridgeUrl}`));
    expect(response.headers.get("location")).toBe("/broker/leads/");
  });

  it("rejects a replayed token — single use", async () => {
    const loginResponse = await login(post("/api/auth/login", { phone: broker.phoneE164, password: broker.password }));
    const { bridgeUrl } = (await loginResponse.json()) as { bridgeUrl: string };

    await bridge(new Request(`${ORIGIN}${bridgeUrl}`));
    const replay = await bridge(new Request(`${ORIGIN}${bridgeUrl}`));
    expect(replay.status).toBe(302);
    expect(replay.headers.get("location")).toBe("/login/?bridge=expired");
    expect(replay.headers.getSetCookie()).toHaveLength(0);
  });

  it("sends unknown tokens back to sign-in", async () => {
    const response = await bridge(new Request(`${ORIGIN}/api/auth/bridge/?token=not-a-token`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login/?bridge=expired");
  });
});
