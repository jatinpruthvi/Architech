import { describe, expect, it } from "vitest";
import sitemap from "../../../../app/sitemap";
import { guideUrl } from "./urls";

const toAbsoluteGuideUrl = (path: string) => guideUrl(path.replace(/^\/guide\//, "").replace(/\/$/, ""));

describe("SEO publication contracts", () => {
  it("does not publish request-time timestamps as sitemap freshness", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });

  it("normalizes guide collection entries to absolute canonical URLs", () => {
    expect(toAbsoluteGuideUrl("/guide/city/ahmedabad/home-buying-guide/")).toBe(
      guideUrl("city/ahmedabad/home-buying-guide"),
    );
    expect(toAbsoluteGuideUrl("/guide/locality/ahmedabad/paldi-buying-guide/")).toMatch(/^https:\/\//);
  });
});
