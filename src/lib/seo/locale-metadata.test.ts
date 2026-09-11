import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* Locale metadata invariants (P1-I18N-001 remaining "metadata tests").

   The JSON-LD for a place page advertises the entity's name in English and its
   `alternateName` in Devanagari. A regression that swaps `city.hindi` for
   `city.name` (or `locality.hindi` for `locality.name`) silently makes every
   Hindi page describe its place by the English name, and a unit test on a pure
   builder cannot see it because the markup is composed inline in the route
   files. These invariants read the route files that emit the markup — the same
   approach `entity-graph-integrity.test.ts` uses for the @id graph. */

const root = "src/app";
const read = (file: string) => readFileSync(file, "utf8");

describe("place metadata alternates use the Devanagari field", () => {
  it("city pages set alternateName from city.hindi, not city.name", () => {
    const text = read(`${root}/buy/[city]/page.tsx`);
    expect(text).toMatch(/alternateName:\s*city\.hindi/);
    expect(text).not.toMatch(/alternateName:\s*city\.name/);
  });

  it("buy locality pages set alternateName from locality.hindi, not locality.name", () => {
    const text = read(`${root}/buy/[city]/[locality]/page.tsx`);
    expect(text).toMatch(/alternateName:\s*locality\.hindi/);
    expect(text).not.toMatch(/alternateName:\s*locality\.name/);
  });

  it("rent locality pages set alternateName from locality.hindi", () => {
    const text = read(`${root}/rent/[city]/[locality]/page.tsx`);
    expect(text).toMatch(/alternateName:\s*locality\.hindi/);
    expect(text).not.toMatch(/alternateName:\s*locality\.name/);
  });
});

describe("site-wide language declaration", () => {
  it("declares both English and Hindi as site languages", () => {
    const text = read(`${root}/layout.tsx`);
    expect(text).toContain('inLanguage: ["en-IN", "hi-IN"]');
    expect(text).toContain('"en-IN"');
    expect(text).toContain('"hi-IN"');
  });
});
