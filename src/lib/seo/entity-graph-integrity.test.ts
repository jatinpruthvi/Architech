import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cityId, localityId } from "./entity-graph";
import { getCities, getLocalities } from "@/lib/repositories";

/* Integrity of the entity graph, checked against the real route sources.
 *
 * A knowledge graph is only worth building if the ids are consistent. The two
 * ways this decays are both invisible to a unit test on entity-graph.ts:
 *
 *   1. A page invents its own anonymous City/Place node instead of referencing
 *      the shared id, so the entity silently forks into look-alikes again.
 *   2. Two pages both claim to DEFINE the same entity with different
 *      properties, so a crawler has to pick a winner.
 *
 * Both are properties of the route files, so this test reads them. */

const routeFiles = execSync("grep -rl '@type' app --include='*.tsx'", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const src = (file: string) => readFileSync(file, "utf8");

describe("place nodes reference the shared entity ids", () => {
  it("finds route files that emit schema", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it.each(routeFiles)("%s emits no anonymous City node", (file) => {
    const text = src(file);
    /* An anonymous City is `"@type": "City"` in an object literal with no
       "@id" nearby. Cities are defined once and referenced everywhere else, so
       a bare one means a fork. */
    const anonymous = [...text.matchAll(/"@type":\s*"City"/g)].filter((match) => {
      const window = text.slice(match.index ?? 0, (match.index ?? 0) + 240);
      return !window.includes('"@id"');
    });
    expect(
      anonymous.length,
      `${file} describes a City without an @id. Use cityNode(city) for a ` +
        "reference or cityNode(city, { full: true }) on the city's own hub.",
    ).toBe(0);
  });

  it.each(routeFiles)("%s emits no anonymous locality Place node", (file) => {
    const text = src(file);
    const anonymous = [...text.matchAll(/"@type":\s*"Place"/g)].filter((match) => {
      const window = text.slice(match.index ?? 0, (match.index ?? 0) + 240);
      return !window.includes('"@id"');
    });
    expect(
      anonymous.length,
      `${file} describes a Place without an @id. Use localityRef(...) unless ` +
        "this page is the locality's definition site.",
    ).toBe(0);
  });
});

describe("each entity is defined exactly once", () => {
  /** Files that emit a *full* definition: an @id plus real properties. */
  const definers = (idFragment: string) =>
    routeFiles.filter((file) => {
      const text = src(file);
      return text.includes(idFragment) && /containedInPlace|geo:/.test(text);
    });

  it("only the buy city hub defines a city", () => {
    /* The rent hub, locality pages, and listings must all reference. If a
       second file starts defining cities, the graph has two competing
       descriptions of the same place. */
    expect(definers("cityId(")).toEqual(["app/buy/[city]/page.tsx"]);
  });

  it("only the locality pages carry localityId definitions", () => {
    const files = routeFiles.filter((file) => src(file).includes("localityId("));
    expect(files.sort()).toEqual(["app/buy/[city]/[locality]/page.tsx", "app/rent/[city]/[locality]/page.tsx"]);
  });
});

describe("ids are collision-free across the real dataset", () => {
  it("every city in the registry gets a distinct id", () => {
    const ids = getCities().map((city) => cityId(city.slug));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every locality gets a distinct id even when names repeat across cities", () => {
    /* Indian city locality names collide constantly across metros. The id is
       city-scoped precisely so two different real places never merge. */
    const ids = getCities().flatMap((city) =>
      getLocalities(city.slug).map((locality) => localityId(city.slug, locality.slug)),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no locality id is also a city id", () => {
    const cityIds = new Set(getCities().map((city) => cityId(city.slug)));
    const localityIds = getCities().flatMap((city) =>
      getLocalities(city.slug).map((locality) => localityId(city.slug, locality.slug)),
    );
    expect(localityIds.filter((id) => cityIds.has(id))).toEqual([]);
  });
});
