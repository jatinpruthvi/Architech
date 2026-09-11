import { describe, expect, it } from "vitest";
import {
  cityId,
  cityNode,
  listingOfferId,
  localityId,
  localityRef,
  namedRef,
  orgId,
  ref,
  residenceId,
  stateId,
  websiteId,
} from "./entity-graph";
import { cityUrl, localityUrl } from "./urls";

/* The contract that matters: one real-world thing has exactly one `@id`,
   everywhere, forever. These tests exist to catch the two ways that breaks —
   an id that varies by which page emitted it, and an id that silently changes
   shape so previously-published markup no longer reconciles. */

describe("entity ids are stable and unique", () => {
  it("gives a city one id regardless of intent", () => {
    /* The whole point of the buy/rent split was two URLs; the whole point of
       this module is that they are still ONE place. */
    expect(cityId("ahmedabad")).toBe(`${cityUrl("ahmedabad", "buy")}#city`);
    expect(cityId("ahmedabad")).not.toContain("/rent/");
  });

  it("gives a locality one id regardless of intent", () => {
    expect(localityId("ahmedabad", "bopal")).toBe(`${localityUrl("ahmedabad", "bopal", "buy")}#locality`);
    expect(localityId("ahmedabad", "bopal")).not.toContain("/rent/");
  });

  it("distinguishes every entity kind", () => {
    const ids = [
      orgId(),
      websiteId(),
      cityId("ahmedabad"),
      localityId("ahmedabad", "bopal"),
      stateId("gujarat"),
      residenceId("abc"),
      listingOfferId("abc"),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never collides across two different places", () => {
    expect(cityId("mumbai")).not.toBe(cityId("ahmedabad"));
    expect(localityId("ahmedabad", "bopal")).not.toBe(localityId("mumbai", "bopal"));
  });

  it("separates the property from the offer document about it", () => {
    // Conflating these is why a sold listing can poison a place entity.
    expect(residenceId("abc")).not.toBe(listingOfferId("abc"));
  });

  it("anchors every id on an absolute, fragment-bearing IRI", () => {
    for (const id of [orgId(), cityId("ahmedabad"), localityId("ahmedabad", "bopal"), stateId("gujarat")]) {
      expect(id).toMatch(/^https?:\/\//);
      expect(id).toContain("#");
    }
  });

  it("does not anchor state ids on a noindex per-state URL", () => {
    /* /locations/{state}/ is noindex until LGD data has a publication gate.
       An @id should not point at a URL we tell crawlers to ignore. */
    expect(stateId("gujarat")).toBe("https://architech-demo.example.com/locations/#state-gujarat");
  });
});

describe("references never restate entity properties", () => {
  it("ref carries nothing but the id", () => {
    expect(ref(cityId("ahmedabad"))).toEqual({ "@id": cityId("ahmedabad") });
  });

  it("namedRef carries only the id and a name", () => {
    expect(Object.keys(namedRef(cityId("ahmedabad"), "Ahmedabad")).sort()).toEqual(["@id", "name"]);
  });

  it("localityRef is a reference, not a definition", () => {
    const node = localityRef("ahmedabad", "bopal", "Bopal");
    expect(node["@id"]).toBe(localityId("ahmedabad", "bopal"));
    // No geo/address/PIN here: those belong to the page that DEFINES the place.
    expect(Object.keys(node).sort()).toEqual(["@id", "@type", "name"]);
  });
});

describe("cityNode", () => {
  const city = { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat", stateSlug: "gujarat" };

  it("returns a bare reference by default", () => {
    /* The default must be the safe option: ~500 pages mention a city and none
       of them should be re-describing it. */
    expect(cityNode(city)).toEqual({ "@id": cityId("ahmedabad"), "@type": "City", name: "Ahmedabad" });
  });

  it("returns the full definition only when asked", () => {
    const node = cityNode(city, { full: true }) as Record<string, unknown>;
    expect(node.url).toBe(cityUrl("ahmedabad", "buy"));
    expect(node.containedInPlace).toMatchObject({
      "@type": "AdministrativeArea",
      "@id": stateId("gujarat"),
      name: "Gujarat",
    });
  });

  it("nests the country inside the state, not the city", () => {
    const node = cityNode(city, { full: true }) as { containedInPlace: Record<string, unknown> };
    expect(node.containedInPlace.containedInPlace).toEqual({ "@type": "Country", name: "India" });
  });

  it("uses the same id in both modes", () => {
    const bare = cityNode(city) as { "@id": string };
    const full = cityNode(city, { full: true }) as { "@id": string };
    expect(bare["@id"]).toBe(full["@id"]);
  });
});
