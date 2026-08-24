import { describe, expect, it } from "vitest";
import { GET } from "../../../../app/api/auth/session/route";
import { canAccessBrokerDashboard, demoBrokerSession, hasRoleAtLeast, requirePermission } from "./roles";

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

  it("exposes session route contract", async () => {
    const response = await GET(new Request("http://example.com/api/auth/session"));
    const body = await response.json();
    expect(body.authProvider).toBe("better-auth");
    expect(body.canAccessBrokerDashboard).toBe(true);
    expect(body.session.organization.slug).toBe("nivasa-partners");
  });
});
