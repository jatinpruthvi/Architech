import { describe, expect, it } from "vitest";
import path from "node:path";
import { cityId, localityId, orgId, stateId, websiteId } from "./entity-graph";
import { getCities, getLocalities } from "@/lib/repositories";
import { SITE_URL } from "./urls";

/* Production entity snapshot (P1-SEO-002 remaining "production entity
   snapshots").

   `entity-graph.ts` assigns every place one stable `@id` so the JSON-LD across
   ~500 pages composes into a single knowledge graph instead of anonymous
   blobs. Those ids are a production contract: they are baked into sitemap
   consumers, knowledge-panel eligibility, and any external reference. This
   snapshot pins the whole id surface (org, website, every state, city and
   locality) so an accidental URL-builder change — which would silently fork
   the graph — fails loudly here. Update deliberately with
   `npx vitest run entity-graph-snapshot -u` and review the diff. */

const SNAPSHOT = path.resolve(__dirname, "snapshots", "entity-graph.snapshot.txt");

/** Strip the deployment origin so the snapshot is environment-independent. */
function stripOrigin(url: string): string {
  return url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
}

function graphLines(): string[] {
  const lines: string[] = [];
  lines.push(`org | ${stripOrigin(orgId())}`);
  lines.push(`website | ${stripOrigin(websiteId())}`);

  const states = [...new Set(getCities().map((city) => city.stateSlug))].sort();
  for (const stateSlug of states) {
    lines.push(`state | ${stateSlug} | ${stripOrigin(stateId(stateSlug))}`);
  }

  const cities = [...getCities()].sort((a, b) => a.slug.localeCompare(b.slug));
  for (const city of cities) {
    lines.push(`city | ${city.slug} | ${stripOrigin(cityId(city.slug))}`);
  }

  const localities = [...getLocalities()].sort((a, b) =>
    `${a.citySlug}/${a.slug}`.localeCompare(`${b.citySlug}/${b.slug}`),
  );
  for (const locality of localities) {
    lines.push(`locality | ${locality.citySlug}/${locality.slug} | ${stripOrigin(localityId(locality.citySlug, locality.slug))}`);
  }

  return lines;
}

describe("production entity graph snapshot", () => {
  it("keeps the entity id surface byte-stable", async () => {
    const body = ["# Architech entity graph snapshot", "", ...graphLines()].join("\n") + "\n";
    await expect(body).toMatchFileSnapshot(SNAPSHOT);
  });

  it("assigns every place a unique, dereferenceable @id", () => {
    const ids = [
      orgId(),
      websiteId(),
      ...getCities().map((city) => cityId(city.slug)),
      ...getLocalities().map((locality) => localityId(locality.citySlug, locality.slug)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith(SITE_URL)).toBe(true);
      expect(id).toContain("#");
    }
  });
});
