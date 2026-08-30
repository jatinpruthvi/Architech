import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getGuideByScope, getGuides, getScopedGuideStaticParams, type GuideRouteKind } from "./guides";

const root = process.cwd();

describe("scope-aware guide routes", () => {
  it("generates route params from each guide's own city or jurisdiction", () => {
    for (const kind of ["city", "locality", "rera"] as GuideRouteKind[]) {
      const params = getScopedGuideStaticParams(kind);
      const expected = getGuides()
        .filter((guide) => guide.routeKind === kind)
        .map((guide) => ({
          scope: kind === "rera" ? guide.jurisdictionSlug : guide.citySlug,
          slug: guide.slug,
        }));
      expect(params).toEqual(expected);
      for (const param of params) expect(getGuideByScope(kind, param.scope, param.slug)).toBeDefined();
    }
  });

  it("has one dynamic implementation per route kind, with no Ahmedabad-only shadow route", () => {
    for (const kind of ["city", "locality", "rera"] as GuideRouteKind[]) {
      const dynamicPage = resolve(root, `app/guide/${kind}/[scope]/[slug]/page.tsx`);
      expect(existsSync(dynamicPage)).toBe(true);
      expect(readFileSync(dynamicPage, "utf8")).toContain("getGuideByScope(ROUTE_KIND, scope, slug)");
    }
    expect(existsSync(resolve(root, "app/guide/city/ahmedabad/[slug]/page.tsx"))).toBe(false);
    expect(existsSync(resolve(root, "app/guide/locality/ahmedabad/[slug]/page.tsx"))).toBe(false);
    expect(existsSync(resolve(root, "app/guide/rera/gujarat/[slug]/page.tsx"))).toBe(false);
  });

  it("keeps the old Gujarat RERA URL as a redirect to the India canonical", () => {
    const source = readFileSync(resolve(root, "app/guide/rera/[scope]/[slug]/page.tsx"), "utf8");
    expect(source).toContain('scope === "gujarat"');
    expect(source).toContain('getGuideByScope(ROUTE_KIND, "india", slug)');
    expect(source).toContain("permanentRedirect(nationalGuide.path)");
  });
});
