import { describe, expect, it } from "vitest";
import { isTechnoWorkspacePath } from "./routes";

describe("isTechnoWorkspacePath", () => {
  it.each([
    "/broker",
    "/broker/",
    "/broker/search",
    "/broker/owners/ResidentialRent",
    "/broker/brokers/CommercialSell",
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
