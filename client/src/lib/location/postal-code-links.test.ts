import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/* The PIN-code page ("Reviewed property localities" block) links every resolved
   locality to its canonical property page. The URL grammar is
   `/buy/{city}/{locality}/` — a hand-rolled `/locality/...` href has no route,
   so every link on the page would 404. Keep the page on the shared
   `localityPath()` helper so the grammar has exactly one definition. */
describe("postal-code page locality links", () => {
  const pageSource = readFileSync(resolve(root, "app/locations/postal-codes/[code]/page.tsx"), "utf8");

  it("builds locality hrefs with the shared localityPath helper", () => {
    expect(pageSource).toContain("localityPath(locality.citySlug, locality.slug)");
  });

  it("never links to the non-existent /locality/ route", () => {
    expect(pageSource).not.toContain('href={`/locality/');
    expect(pageSource).not.toContain('"/locality/');
  });
});
