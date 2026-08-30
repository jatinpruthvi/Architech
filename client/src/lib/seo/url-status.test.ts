/* The status board.

   The load-bearing test in this file is the one about the demo provider. The
   demo snapshot reports 3,200 impressions and 120 clicks — numbers that came
   from a constant in `gsc.ts`. A board that displays them invites someone to
   make a decision on invented data, which is the single most dangerous state
   an SEO dashboard can be in. So the demo source is reported as unavailable,
   and that is asserted rather than merely intended.

   Everything else here is available with no credentials at all: indexability,
   gate state, sitemap membership, declared query, and content date. That is
   the point — the questions that matter at this stage ("is this page ready,
   and what is blocking it?") are answerable without Search Console. */
import { describe, expect, it } from "vitest";
import { seoStatusBoard, type PageStatusRow } from "./url-status";

describe("seoStatusBoard", () => {
  it("reports a row for every published page", async () => {
    const board = await seoStatusBoard();
    expect(board.rows.length).toBe(board.totals.pages);
    expect(board.totals.pages).toBeGreaterThan(0);
  });

  it("withholds demo Search Console numbers instead of presenting them", async () => {
    // The default provider is the demo fixture. Its numbers must never reach
    // a decision-maker as if they were measured.
    const board = await seoStatusBoard();
    expect(board.measurement.available).toBe(false);
    if (board.measurement.available) return;
    expect(board.measurement.source).toBe("demo-gsc");
    expect(board.measurement.reason).toMatch(/demo fixture/i);
  });

  it("still reports the gate and sitemap state with no credentials", async () => {
    // This is what makes the board useful before GSC is connected.
    const board = await seoStatusBoard();
    const sample: PageStatusRow = board.rows[0];
    expect(["approved", "held"]).toContain(sample.gate);
    expect(typeof sample.inSitemap).toBe("boolean");
    expect(typeof sample.indexable).toBe("boolean");
  });

  it("counts every page as indexable-or-not and sitemap-or-not", async () => {
    const board = await seoStatusBoard();
    expect(board.totals.indexable).toBe(board.rows.filter((row) => row.indexable).length);
    expect(board.totals.inSitemap).toBe(board.rows.filter((row) => row.inSitemap).length);
    expect(board.totals.heldByGate).toBe(board.rows.filter((row) => row.gate === "held").length);
  });

  it("gives a held page the reasons it is held", async () => {
    // A gate that says "no" without saying why is a wall.
    const board = await seoStatusBoard();
    for (const row of board.rows.filter((candidate) => candidate.gate === "held")) {
      expect(row.gateReasons.length).toBeGreaterThan(0);
    }
  });

  it("declares a query on every listing page", async () => {
    const board = await seoStatusBoard();
    const listings = board.rows.filter((row) => row.path.startsWith("/listing/"));
    expect(listings.length).toBeGreaterThan(0);
    for (const row of listings) expect(row.declaredQuery).toBeTruthy();
    expect(board.totals.declaringQuery).toBeGreaterThanOrEqual(listings.length);
  });

  it("gives no page a duplicate sitemap segment", async () => {
    // A page in two child sitemaps is a duplicate submission.
    const board = await seoStatusBoard();
    for (const row of board.rows) expect(row.sitemapSegmentCount).toBeLessThanOrEqual(1);
  });

  it("has every indexable page in a sitemap", async () => {
    // The inverse of the discovery problem: an indexable page outside every
    // sitemap depends on a crawl finding it by accident.
    const board = await seoStatusBoard();
    const orphans = board.rows.filter((row) => row.indexable && !row.inSitemap);
    expect(orphans).toEqual([]);
  });
});
