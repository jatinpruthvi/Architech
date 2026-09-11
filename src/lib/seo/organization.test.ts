import { describe, expect, it } from "vitest";
import { organizationJsonLd, ORG_COUNTRY } from "./organization";
import { homeUrl } from "./urls";

type Node = Record<string, unknown>;
const org = (): Node => organizationJsonLd() as unknown as Node;
const child = (key: string): Node => (org()[key] ?? {}) as Node;
const flat = () => JSON.stringify(organizationJsonLd()).toLowerCase();

describe("organization identity", () => {
  it("identifies the organization and national service area", () => {
    expect(org()["@type"]).toBe("Organization");
    expect(org()["name"]).toBe("Architech");
    expect(org()["url"]).toBe(homeUrl());
    expect(org()["@id"]).toBe(`${homeUrl()}#org`);
    expect(child("areaServed")["name"]).toBe("India");
    expect(ORG_COUNTRY).toBe("IN");
  });

  it("does not turn an old launch-market coordinate into a corporate address", () => {
    expect(org()["address"]).toBeUndefined();
    expect(org()["geo"]).toBeUndefined();
    expect(flat()).not.toContain("ahmedabad");
    expect(flat()).not.toContain("gujarat");
  });

  it("claims no unactivated contact channel or street address", () => {
    expect(flat()).not.toContain("telephone");
    expect(flat()).not.toContain("\"email\"");
    expect(flat()).not.toContain("streetaddress");
    expect(flat()).not.toContain("postalcode");
  });

  it("declares only the support scope that is true", () => {
    const contact = child("contactPoint");
    expect(contact["@type"]).toBe("ContactPoint");
    expect(contact["contactType"]).toBe("customer support");
    expect(contact["availableLanguage"]).toEqual(["en-IN", "hi-IN"]);
    expect(contact["telephone"]).toBeUndefined();
    expect(contact["email"]).toBeUndefined();
  });

  it("asserts no unclaimed social profiles and remains serializable", () => {
    expect(org()["sameAs"]).toBeUndefined();
    expect(() => JSON.stringify(organizationJsonLd())).not.toThrow();
  });
});
