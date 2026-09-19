import { describe, expect, it } from "vitest";
import { isTechnoWorkspacePath, normalizeTechnoPathname } from "./routes";

describe("isTechnoWorkspacePath", () => {
  it("normalizes canonical trailing slashes for client navigation state", () => {
    expect(normalizeTechnoPathname("/broker/")).toBe("/broker");
    expect(normalizeTechnoPathname("/broker/owners/ResidentialRent///")).toBe("/broker/owners/ResidentialRent");
  });

  it.each([
    "/broker",
    "/broker/",
    "/broker/search",
    "/broker/owners/ResidentialRent",
    "/broker/brokers/CommercialSell",
    "/broker/buyers",
    "/broker/buyers/lead-1/matches",
    "/broker/requirements/ResidentialSell",
    "/broker/shortlisted",
    "/broker/premium",
    "/broker/activities",
    "/broker/call-queue",
  ])("recognizes Techno workspace route %s", (pathname) => {
    expect(isTechnoWorkspacePath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/brokerage",
    "/broker/agent",
    "/broker/channel",
    "/broker/leads",
    "/broker/onboarding",
  ])("does not hide public chrome on non-Techno route %s", (pathname) => {
    expect(isTechnoWorkspacePath(pathname)).toBe(false);
  });
});
