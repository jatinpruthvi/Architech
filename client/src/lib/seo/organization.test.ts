/* Organization identity (StudyArena round-12, contestant F §3).

   F: "real estate money queries are YMYL, Google applies extra trust
   scrutiny" — so the organisation behind the site carries weight, and he asks
   for a marked-up address, phone and credentials.

   The test that matters here is the negative one. The contact page states
   that the phone and email channels are **pending activation**. Marking up a
   telephone anyway would be the exact fabricated trust signal YMYL scrutiny
   exists to catch, and it would contradict a page the user can read. So this
   suite asserts the schema claims only what the site already publishes, and
   fails if anyone fills the field to satisfy a checklist.

   When the channels go live, delete the corresponding assertion here in the
   same commit that adds the real number — that is the point of pinning it. */
import { describe, expect, it } from "vitest";
import { organizationJsonLd, ORG_COUNTRY, ORG_LATITUDE, ORG_LOCALITY, ORG_LONGITUDE, ORG_REGION } from "./organization";
import { homeUrl } from "./urls";

type Node = Record<string, unknown>;
const org = (): Node => organizationJsonLd() as unknown as Node;
const child = (key: string): Node => (org()[key] ?? {}) as Node;
const flat = () => JSON.stringify(organizationJsonLd()).toLowerCase();

describe("organization identity", () => {
  it("identifies the organisation", () => {
    expect(org()["@type"]).toBe("Organization");
    expect(org()["name"]).toBe("Architech");
    expect(org()["url"]).toBe(homeUrl());
    expect(org()["@id"]).toBe(`${homeUrl()}#org`);
  });

  it("marks up the address it already publishes", () => {
    const address = child("address");
    expect(address["@type"]).toBe("PostalAddress");
    expect(address["addressLocality"]).toBe(ORG_LOCALITY);
    expect(address["addressRegion"]).toBe(ORG_REGION);
    expect(address["addressCountry"]).toBe(ORG_COUNTRY);
  });

  it("marks up coordinates", () => {
    const geo = child("geo");
    expect(geo["@type"]).toBe("GeoCoordinates");
    const latitude = Number(geo["latitude"]);
    const longitude = Number(geo["longitude"]);
    expect(latitude).toBe(ORG_LATITUDE);
    expect(longitude).toBe(ORG_LONGITUDE);
    // A coordinate outside its own range is a typo, not a place.
    expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
    expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
  });

  /* The guard. Channels behind an activation gate must not appear as live
     contact details in structured data. */
  it("claims no telephone, email or street address while those channels are pending", () => {
    expect(flat()).not.toContain("telephone");
    expect(flat()).not.toContain("\"email\"");
    expect(flat()).not.toContain("streetaddress");
    expect(flat()).not.toContain("postalcode");
  });

  it("still declares a contact point, using only what is true", () => {
    const contact = child("contactPoint");
    expect(contact["@type"]).toBe("ContactPoint");
    expect(contact["contactType"]).toBe("customer support");
    expect(contact["availableLanguage"]).toEqual(["en-IN", "hi-IN"]);
    expect(contact["telephone"]).toBeUndefined();
    expect(contact["email"]).toBeUndefined();
  });

  /* Deferred since file 8 for the same reason: the profiles are not claimed,
     so pointing sameAs at them would assert an identity that is not
     established. Pinning it stops a well-meaning guess. */
  it("asserts no social profiles it has not claimed", () => {
    expect(org()["sameAs"]).toBeUndefined();
  });

  it("is serialisable — the script tag takes a string", () => {
    expect(() => JSON.stringify(organizationJsonLd())).not.toThrow();
    expect(JSON.parse(JSON.stringify(organizationJsonLd()))["@type"]).toBe("Organization");
  });
});
