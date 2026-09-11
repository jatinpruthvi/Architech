import { describe, expect, it } from "vitest";
import { demandByListing, draftPortfolio, firstResponseStats, leadFunnel } from "./analytics";
import type { LeadRecord } from "@/lib/leads/lead";
import type { ListingDraft } from "./workflow";

const lead = (over: Partial<LeadRecord>): LeadRecord => ({
  id: over.id ?? "lead_x",
  listingId: "garden-courtyard",
  listingTitle: "A garden courtyard in Paldi",
  organizationId: "org-1",
  organizationName: "Nivasa Partners",
  name: "Test Buyer",
  phoneMasked: "+91-••••",
  message: "Visit this week.",
  mode: "MASKED",
  status: "NEW",
  consentText: "I consent.",
  idempotencyKey: over.id ?? "k",
  auditEvent: { id: "audit_x", action: "lead.created", entityType: "Lead", metadata: { masked: true, source: "api.leads.fixture-store" } },
  statusHistory: [],
  createdAt: over.createdAt ?? "2026-09-05T09:00:00.000Z",
  ...over,
});

describe("leadFunnel", () => {
  it("counts current status truthfully and discloses exclusions", () => {
    const funnel = leadFunnel([
      lead({ id: "a", status: "NEW" }),
      lead({ id: "b", status: "ACKNOWLEDGED" }),
      lead({ id: "c", status: "REPLIED" }),
      lead({ id: "d", status: "CLOSED" }),
      lead({ id: "e", status: "DELETED" }),
    ]);
    expect(funnel).toEqual({ total: 4, fresh: 1, acknowledged: 1, replied: 1, closed: 1, excluded: 1 });
  });

  it("empty inbox is empty, not a story", () => {
    expect(leadFunnel([])).toEqual({ total: 0, fresh: 0, acknowledged: 0, replied: 0, closed: 0, excluded: 0 });
  });
});

describe("firstResponseStats", () => {
  it("medians odd and even samples and discloses n", () => {
    const mk = (id: string, respondedMinutes: number) => lead({
      id,
      status: "REPLIED",
      createdAt: "2026-09-05T09:00:00.000Z",
      statusHistory: [
        { id: `${id}c`, action: "lead.created", at: "2026-09-05T09:00:00.000Z" },
        { id: `${id}r`, action: "lead.replied", at: new Date(new Date("2026-09-05T09:00:00.000Z").getTime() + respondedMinutes * 60_000).toISOString() },
      ],
    });
    const odd = firstResponseStats([mk("m1", 5), mk("m2", 10), mk("m3", 30)]);
    expect(odd).toEqual({ count: 3, medianMinutes: 10 });
    const even = firstResponseStats([mk("m1", 5), mk("m2", 10), mk("m3", 30), mk("m4", 45)]);
    expect(even).toEqual({ count: 4, medianMinutes: 20 });
  });

  it("no responded lead -> null, not 0 minutes", () => {
    expect(firstResponseStats([lead({ id: "n1", status: "NEW" })])).toBeNull();
    expect(firstResponseStats([])).toBeNull();
  });

  it("deleted leads and pre-creation timestamps are excluded; acknowledged counts as a response", () => {
    const acked = lead({
      id: "a1", status: "ACKNOWLEDGED", createdAt: "2026-09-05T09:00:00.000Z",
      statusHistory: [{ id: "a1k", action: "lead.acknowledged", at: "2026-09-05T09:07:00.000Z" }],
    });
    const deleted = lead({
      id: "d1", status: "DELETED", createdAt: "2026-09-05T09:00:00.000Z",
      statusHistory: [{ id: "d1r", action: "lead.replied", at: "2026-09-05T09:02:00.000Z" }],
    });
    const corrupt = lead({
      id: "c1", status: "REPLIED", createdAt: "2026-09-05T09:00:00.000Z",
      statusHistory: [{ id: "c1r", action: "lead.replied", at: "2026-09-05T08:00:00.000Z" }], /* before creation: garbage */
    });
    expect(firstResponseStats([acked, deleted, corrupt])).toEqual({ count: 1, medianMinutes: 7 });
  });
});

describe("demandByListing", () => {
  it("ranks listings by enquiry count, ignores deleted and untitled rows", () => {
    const rows = demandByListing([
      lead({ id: "1", listingTitle: "B" }),
      lead({ id: "2", listingTitle: "A garden courtyard in Paldi" }),
      lead({ id: "3", listingTitle: "B" }),
      lead({ id: "4", status: "DELETED", listingTitle: "B" }),
      lead({ id: "5", listingTitle: "" }),
    ]);
    expect(rows).toEqual([
      { listingTitle: "B", leads: 2 },
      { listingTitle: "A garden courtyard in Paldi", leads: 1 },
    ]);
  });
});

describe("draftPortfolio", () => {
  const draft = (over: Partial<ListingDraft>): ListingDraft => ({
    id: over.id ?? "d1",
    stableId: "st1",
    organizationId: "org-1",
    status: over.status ?? "DRAFT",
    auditTrail: [],
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-08-01T09:00:00.000Z",
    title: "T", citySlug: "ahmedabad", localitySlug: "paldi", postalCode: "380007",
    priceInr: 100, bhk: 2, areaSqft: 500, propertyType: "APARTMENT", availability: "READY_TO_MOVE",
    description: "x".repeat(40), mediaRightsConfirmed: true,
    ...over,
  });

  it("reports per-status counts and portfolio freshness in days", () => {
    const now = new Date("2026-09-05T09:00:00.000Z");
    const portfolio = draftPortfolio([
      draft({ id: "1", status: "DRAFT", updatedAt: "2026-09-04T09:00:00.000Z" }),
      draft({ id: "2", status: "DRAFT", updatedAt: "2026-09-01T09:00:00.000Z" }),
      draft({ id: "3", status: "IN_REVIEW", updatedAt: "2026-08-20T09:00:00.000Z" }),
    ], now);
    expect(portfolio.total).toBe(3);
    expect(portfolio.byStatus).toEqual([{ status: "draft", count: 2 }, { status: "in_review", count: 1 }]);
    expect(portfolio.lastEditDays).toBe(1);
  });

  it("no drafts -> null freshness, not day 0 theater", () => {
    expect(draftPortfolio([]).lastEditDays).toBeNull();
  });
});
