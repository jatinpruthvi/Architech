import { describe, expect, it } from "vitest";
import { GET } from "../../../../app/api/auth/session/route";
import { canAccessBrokerDashboard, demoBrokerSession, hasRoleAtLeast, requirePermission } from "./roles";
import { mapBetterAuthClaimsToSession } from "./live";
import { getAuthSourceMode, validateBetterAuthEnvironment } from "./source";

describe("auth and broker organization contract", () => {
  it("checks role hierarchy", () => {
    expect(hasRoleAtLeast("BROKER_ADMIN", "BROKER_MEMBER")).toBe(true);
    expect(hasRoleAtLeast("BUYER", "BROKER_MEMBER")).toBe(false);
    expect(hasRoleAtLeast("ADMIN", "MODERATOR")).toBe(true);
  });

  it("requires broker role plus organization context for broker dashboard", () => {
    expect(canAccessBrokerDashboard(demoBrokerSession)).toBe(true);
    expect(canAccessBrokerDashboard({ ...demoBrokerSession, organization: undefined })).toBe(false);
  });

  it("checks permissions", () => {
    expect(requirePermission(demoBrokerSession, "lead.inbox.read")).toBe(true);
    expect(requirePermission(demoBrokerSession, "platform.admin")).toBe(false);
  });

  it("maps Better Auth claims to the stable Architech session shape", () => {
    const session = mapBetterAuthClaimsToSession({ userId: "u1", name: "Broker", email: "broker@example.com", role: "BROKER_MEMBER", organization: demoBrokerSession.organization, permissions: ["lead.inbox.read"] });
    expect(session.source).toBe("better-auth-live");
    expect(canAccessBrokerDashboard(session)).toBe(true);
  });

  it("validates Better Auth source readiness", () => {
    expect(getAuthSourceMode(undefined)).toBe("demo");
    expect(getAuthSourceMode("better-auth")).toBe("better-auth");
    expect(validateBetterAuthEnvironment({ BETTER_AUTH_SECRET: "s", BETTER_AUTH_URL: "https://auth.example.com", DATABASE_URL: "postgres://db" }).ok).toBe(true);
  });

  it("exposes session route contract", async () => {
    const response = await GET(new Request("http://example.com/api/auth/session"));
    const body = await response.json();
    expect(body.authProvider).toBe("better-auth");
    expect(body.canAccessBrokerDashboard).toBe(true);
    expect(body.session.organization.slug).toBe("nivasa-partners");
  });

  it("reports live Better Auth as not configured when secrets are missing", async () => {
    const response = await GET(new Request("http://example.com/api/auth/session?source=better-auth"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.source).toBe("better-auth-not-configured");
    expect(body.missing).toEqual(expect.arrayContaining(["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "DATABASE_URL"]));
  });
});
