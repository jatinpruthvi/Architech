import { describe, expect, it } from "vitest";
import { BETTER_AUTH_SESSION_COOKIE, parseSessionCookie, resolveLiveSession } from "./live-session";

const claims = {
  userId: "u-live-1",
  name: "Live Broker",
  email: "live@example.com",
  role: "BROKER_ADMIN" as const,
  organization: { id: "org-live", slug: "nivasa-partners", name: "Nivasa Partners", verificationStatus: "VERIFIED_PARTNER" as const },
  permissions: ["lead.inbox.read", "listing.draft.create"],
};

const requestWithCookie = (value: string) =>
  new Request("http://example.com/api/auth/session", { headers: { cookie: `${BETTER_AUTH_SESSION_COOKIE}=${encodeURIComponent(value)}` } });

describe("live Better Auth session adapter", () => {
  it("reports not-configured when the auth source is not better-auth", async () => {
    const result = await resolveLiveSession(requestWithCookie("token"), { env: { ARCHITECH_AUTH_SOURCE: "demo" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.source).toBe("better-auth-not-configured");
  });

  it("reports missing secrets when source is better-auth but env is incomplete", async () => {
    const result = await resolveLiveSession(requestWithCookie("token"), { env: { ARCHITECH_AUTH_SOURCE: "better-auth" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.source).toBe("better-auth-not-configured");
      expect(result.missing).toEqual(expect.arrayContaining(["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "DATABASE_URL"]));
    }
  });

  it("reports no-session-cookie when the cookie is absent", async () => {
    const result = await resolveLiveSession(new Request("http://example.com/"), {
      env: { ARCHITECH_AUTH_SOURCE: "better-auth", BETTER_AUTH_SECRET: "s", BETTER_AUTH_URL: "https://auth.example.com", DATABASE_URL: "postgres://db" },
      resolveClaims: async () => claims,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.source).toBe("no-session-cookie");
  });

  it("maps a live session from a valid cookie", async () => {
    const result = await resolveLiveSession(requestWithCookie("valid-token"), {
      env: { ARCHITECH_AUTH_SOURCE: "better-auth", BETTER_AUTH_SECRET: "s", BETTER_AUTH_URL: "https://auth.example.com", DATABASE_URL: "postgres://db" },
      resolveClaims: async (token) => (token === "valid-token" ? claims : null),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("better-auth-live");
      expect(result.session.user.role).toBe("BROKER_ADMIN");
      expect(result.session.organization?.slug).toBe("nivasa-partners");
      expect(result.session.permissions).toContain("lead.inbox.read");
    }
  });

  it("parses the session token out of a cookie header without a cookie SDK", () => {
    expect(parseSessionCookie(`a=1; ${BETTER_AUTH_SESSION_COOKIE}=tok123; b=2`)).toBe("tok123");
    expect(parseSessionCookie("a=1; b=2")).toBeUndefined();
  });
});
