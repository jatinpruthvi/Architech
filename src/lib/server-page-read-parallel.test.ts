import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* PERF-R5-001 guard. Two page-level wins that no unit test can reach (server
   components have no render harness here), and both are cheap to lose by
   accident while editing a page:
   1. the home page must not re-issue the nationwide inventory read just to
      pick its featured strip — it derives that with `orderFeaturedFirst`
      from the pool it already fetched;
   2. independent inventory reads in a server page go out together
      (`Promise.all`), not one round trip behind the other.
   Source-level scan, same idiom as sql-query-bounds.test.ts and
   bigint-range-guard.test.ts. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOME = "src/app/page.tsx";
const LOCALITY = "src/app/buy/[city]/[locality]/page.tsx";

/** Comments only — the pages' prose discusses the reads too. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function source(rel: string): string {
  return stripComments(readFileSync(join(repoRoot, rel), "utf8"));
}

/** Slices every `Promise.all(` argument list with a balanced-bracket scan, so
    formatting and extra nesting cannot hide a call from the guard. */
function promiseAllBlocks(src: string): string[] {
  const blocks: string[] = [];
  const opener = /Promise\.all\s*\(/g;
  for (let match = opener.exec(src); match; match = opener.exec(src)) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(src.slice(start, i + 1));
          opener.lastIndex = i;
          break;
        }
      }
    }
  }
  return blocks;
}

describe("PERF-R5-001: server pages do not serialise independent inventory reads", () => {
  it("the home page derives its featured strip instead of re-reading the inventory", () => {
    const home = source(HOME);
    expect(
      /orderFeaturedFirst\(\s*allListings\s*,\s*6\s*\)/.test(home),
      `${HOME} must derive featured listings with orderFeaturedFirst(allListings, 6)`,
    ).toBe(true);
    expect(
      /getFeaturedListingsForServer\s*\(/.test(home),
      `${HOME} must not call getFeaturedListingsForServer: it re-issues the nationwide ` +
        "inventory read the page has already made (PERF-R5-001)",
    ).toBe(false);
  });

  it("the home page issues its two inventory reads concurrently", () => {
    const blocks = promiseAllBlocks(source(HOME));
    expect(
      blocks.some((block) => (block.match(/getListingsForServer\s*\(/g) ?? []).length >= 2),
      `${HOME} must await its two getListingsForServer reads inside one Promise.all`,
    ).toBe(true);
  });

  it("the locality page issues its locality and city reads concurrently", () => {
    const blocks = promiseAllBlocks(source(LOCALITY));
    expect(
      blocks.some(
        (block) =>
          /getListingsByLocalityForServer\s*\(/.test(block) &&
          /getListingsForServer\s*\(/.test(block),
      ),
      `${LOCALITY} must await getListingsByLocalityForServer and getListingsForServer inside one Promise.all`,
    ).toBe(true);
  });

  /* The scan must actually find the construct it keys on. A Promise.all scan
     that matched nothing would pass forever while both pages regressed. */
  it("the scan finds real Promise.all blocks", () => {
    const blocks = promiseAllBlocks(source(HOME));
    expect(blocks.length).toBeGreaterThan(0);
  });
});
