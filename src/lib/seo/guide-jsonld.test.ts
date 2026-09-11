/* Guide structured data (StudyArena round-12, contestant D §2 and §3).

   D asks for breadcrumbs on public routes and for schema that reflects the
   page. Before this change each guide route carried its own copy of the same
   `Article` block — three copies, already drifting (two emitted a relative
   image path, one an absolute URL) — and none emitted a breadcrumb at all.
   Copies do not get fixed in triplicate; one shared builder does.

   These tests run against the real published guides rather than fixtures, so
   a fourth route kind or a guide moved to a new path fails here instead of
   shipping a breadcrumb that points at the wrong silo. */
import { describe, expect, it } from "vitest";
import { guideArticleUrl, guideBreadcrumb, guideHubJsonLd, guideJsonLd } from "./guide-jsonld";
import type { Guide } from "@/lib/repositories";
import { getGuides } from "@/lib/repositories";

const published = getGuides();

describe("guide JSON-LD", () => {
  it("covers every published guide", () => {
    expect(published.length).toBeGreaterThan(0);
  });

  it("emits one Article and one BreadcrumbList per guide", () => {
    for (const guide of published) {
      const graph = (guideJsonLd(guide) as { "@graph": Record<string, unknown>[] })["@graph"];
      expect(graph.map((node) => node["@type"]), guide.path).toEqual(["Article", "BreadcrumbList"]);
    }
  });

  /* The defect this builder removes. Two of the three route templates emitted
     a bare `/images/<name>.jpg`; crawlers resolve those against whatever host
     they are on, so the image was only accidentally right on production. */
  it("always emits an absolute article image", () => {
    for (const guide of published) {
      const article = (guideJsonLd(guide) as { "@graph": Record<string, unknown>[] })["@graph"][0];
      expect(article["image"], guide.path).toMatch(/^https?:\/\//);
      expect(article["image"], guide.path).toContain(`${guide.image}.jpg`);
    }
  });

  it("emits an absolute mainEntityOfPage matching the guide path", () => {
    for (const guide of published) {
      const article = (guideJsonLd(guide) as { "@graph": Record<string, unknown>[] })["@graph"][0];
      expect(article["mainEntityOfPage"], guide.path).toMatch(/^https?:\/\//);
      expect(article["mainEntityOfPage"], guide.path).toBe(
        guideBreadcrumb(guide)[guideBreadcrumb(guide).length - 1]!.item,
      );
    }
  });

  /* D §1 is about siloing: city hub, then locality, then the article. A
     locality guide that only reports "Home › Guide › title" throws away the
     hierarchy the locality pages already earn. */
  it("gives a locality guide the full city silo, and a city guide only the hub", () => {
    const locality = published.find((guide) => guide.routeKind === "locality");
    const rera = published.find((guide) => guide.routeKind === "rera");
    expect(locality).toBeDefined();
    expect(rera).toBeDefined();

    const localityTrail = guideBreadcrumb(locality as Guide);
    expect(localityTrail.map((crumb) => crumb.name)).toEqual([
      "Home",
      "Field notes",
      `Buy in ${locality!.citySlug}`,
      locality!.localitySlug,
      locality!.title,
    ]);

    const reraTrail = guideBreadcrumb(rera as Guide);
    expect(reraTrail.map((crumb) => crumb.name)).toEqual(["Home", "Field notes", rera!.title]);
  });

  it("numbers breadcrumb positions from 1 with no gaps", () => {
    for (const guide of published) {
      const breadcrumb = (guideJsonLd(guide) as { "@graph": Record<string, unknown>[] })["@graph"][1];
      const items = breadcrumb["itemListElement"] as { position: number; item: string }[];
      expect(items.map((item) => item.position), guide.path).toEqual(
        items.map((_, index) => index + 1),
      );
      expect(items[0]!.position, guide.path).toBe(1);
      expect(items.at(-1)!.item, guide.path).toContain(guide.slug);
      for (const item of items) expect(item.item, guide.path).toMatch(/^https?:\/\//);
    }
  });

  it("is serialisable — the script tag takes a string, not an object", () => {
    for (const guide of published) {
      expect(() => JSON.stringify(guideJsonLd(guide))).not.toThrow();
      expect(JSON.parse(JSON.stringify(guideJsonLd(guide)))["@context"]).toBe("https://schema.org");
    }
  });

  it("gives the hub a breadcrumb too, so its articles point at a real node", () => {
    const hub = guideHubJsonLd() as { "@graph": Record<string, unknown>[] };
    expect(hub["@graph"].map((node) => node["@type"])).toEqual(["CollectionPage", "BreadcrumbList"]);
    const trail = hub["@graph"][1]!["itemListElement"] as { position: number; name: string; item: string }[];
    expect(trail).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: trail[0]!.item },
      { "@type": "ListItem", position: 2, name: "Field notes", item: trail[1]!.item },
    ]);
    expect(trail[1]!.item).toContain("/guide/");
  });

  it("derives the article URL from path without a duplicated regex", () => {
    for (const guide of published) {
      expect(guideArticleUrl(guide), guide.path).toBe(guideBreadcrumb(guide).at(-1)!.item);
    }
  });
});
