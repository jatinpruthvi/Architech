import { describe, expect, it } from "vitest";
import { capabilitiesFor, MARKETPLACE_PLAN_SEEDS, safePublicLocation } from "./access";

describe("marketplace access policy", () => {
  it("keeps public location approximate and never invents exact address", () => {
    expect(safePublicLocation({ locality: "Paldi", publicLatitude: 23.01, publicLongitude: 72.52 })).toEqual({ locality: "Paldi", latitude: 23.01, longitude: 72.52 });
  });

  it("does not grant contact or exact-address access to a free user", () => {
    const result = capabilitiesFor({ visibility: "OWNER_DIRECT", addressVisibility: "REQUEST_AFTER_LEAD", contactVisibility: "RELAY_ONLY", signedIn: true, paidBroker: false, verifiedAdvertiser: false });
    expect(result.canRelayCall).toBe(false);
    expect(result.canRelayWhatsapp).toBe(false);
    expect(result.canRequestExactAddress).toBe(false);
  });

  it("allows a paid broker to request, but not automatically view, exact address", () => {
    const result = capabilitiesFor({ visibility: "BROKER_SHAREABLE", addressVisibility: "APPOINTMENT_ONLY", contactVisibility: "RELAY_ONLY", signedIn: true, paidBroker: true, verifiedAdvertiser: false });
    expect(result.canViewBrokerInventory).toBe(true);
    expect(result.canRequestExactAddress).toBe(true);
    expect(result.canViewExactAddress).toBe(false);
  });

  it("provides bounded plan seed entitlements", () => {
    expect(MARKETPLACE_PLAN_SEEDS.map((plan) => plan.code)).toEqual(["FREE", "BROKER_STARTER", "BROKER_PRO", "BROKERAGE_TEAM"]);
    expect(MARKETPLACE_PLAN_SEEDS.find((plan) => plan.code === "FREE")?.entitlements).toEqual(["listing.view", "contact.lead.create"]);
  });
});
