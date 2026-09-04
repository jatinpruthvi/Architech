import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/* No other portal's brand name may appear in shipped code.
 *
 * Origin: the broker workspace shipped an empty state reading "No
 * Addressbox-style leads yet". Addressbox is a competitor; the string came
 * from the feature-parity research notes and was never rewritten, so a rival's
 * brand was rendered to our own users inside our own product.
 *
 * That is not a typo, it is a category of mistake. This codebase was built
 * partly by studying other portals, so their names are all over the research
 * documents, and every one of those names is one careless copy-paste away from
 * a user-visible surface. A reviewer cannot be relied on to catch the next
 * one — greping for it is cheap and exact.
 *
 * SCOPE: shipped code only (`app/`, `client/src/`). Research and planning
 * documents legitimately name the products they analyse; forbidding that would
 * make honest competitive analysis unwritable. The line is that nothing which
 * reaches a build may carry the name — not in UI copy, and not in a comment,
 * because comments get promoted into copy.
 */

/** Brand names that must never appear in shipped source. */
const FORBIDDEN_BRANDS = [
  "addressbox",
  "housing.com",
  "magicbricks",
  "magicbreaks",
  "99acres",
  "nobroker",
  "square yards",
  "squareyards",
  "proptiger",
  "commonfloor",
  "makaan",
  "quikr",
  "sulekha",
  "hozen",
  "zillow",
  "realtor.com",
  "redfin",
  "rightmove",
  "trulia",
  "opendoor",
];

/* Every source file that can reach a build. Test files are included: a
   fixture named after a competitor is the same leak one refactor later. */
const shippedFiles = execSync(
  "git ls-files 'app/**/*.ts' 'app/**/*.tsx' 'client/src/**/*.ts' 'client/src/**/*.tsx' 'client/src/**/*.css'",
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

describe("no competitor brand names in shipped code", () => {
  it("scans a real set of source files", () => {
    // A broken glob would make every assertion below vacuously pass.
    expect(shippedFiles.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN_BRANDS)("never mentions %s", (brand) => {
    const offenders: string[] = [];
    for (const file of shippedFiles) {
      // This file legitimately lists the names it forbids.
      if (file.endsWith("competitor-names.test.ts")) continue;
      const source = readFileSync(file, "utf8").toLowerCase();
      if (!source.includes(brand)) continue;
      const line = source.split("\n").findIndex((text) => text.includes(brand)) + 1;
      offenders.push(`${file}:${line}`);
    }
    expect(
      offenders,
      `"${brand}" is a competitor's brand and must not appear in shipped code. `
        + `Describe the capability instead of naming the portal. Research notes may name it; product code may not.`,
    ).toEqual([]);
  });

  it("keeps our own brand spelled consistently where it is shown", () => {
    /* The counterpart to the rule above: the product has one name, and a
       stray "AddressBox" got in precisely because nobody was asserting what
       the name IS. */
    const header = readFileSync("client/src/components/architech/Header.tsx", "utf8");
    expect(header).toContain("Architech");
  });
});
