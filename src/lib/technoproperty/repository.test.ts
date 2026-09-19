import { beforeEach, describe, expect, it, vi } from "vitest";
import { TechnoCategory } from "@prisma/client";
import { decryptContact, encryptContact } from "@/lib/interop/contact-crypto";

/* Fixed 32-byte key so the buyer-lead phone encryption under test is
   deterministic (contact-crypto validates env shape at call time). */
process.env.ARCHITECH_CONTACT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

/* In-memory stand-in for the Prisma client (see src/lib/technoproperty/prisma.ts).
   The fakes interpret just enough of each `where` clause to route queries:
   - { id: { in: [...] } }            → the aged-follow-up pull in getCallingQueue
   - { datePosted: { gte: ... } }     → the 2-day freshness window
   - anything else                    → plain owner/broker list
 */
const state = vi.hoisted(() => ({
  props: [] as any[],
  events: [] as any[],
  notes: [] as any[],
  savedSearches: [] as any[],
  savedSearchSeq: 1,
  buyerLeads: [] as any[],
  buyerLeadSeq: 1,
  countWhenSince: 3,
  propertyFindManyCalls: 0,
}));

vi.mock("@/lib/technoproperty/prisma", () => ({
  technoDb: () => ({
    technoProperty: {
      count: async (args?: { where?: any }) =>
        // Saved-search "new matches" counts use firstSeenAt; answer a fixed
        // number for those so the arithmetic under test stays visible.
        args?.where?.firstSeenAt?.gte ? state.countWhenSince : state.props.length,
      findMany: async (args?: { where?: any }) => {
        state.propertyFindManyCalls += 1;
        const where = args?.where ?? {};
        if (where.id?.in) return state.props.filter((p) => where.id.in.includes(p.id));
        if (where.datePosted?.gte) return state.props.filter((p) => p.datePosted >= where.datePosted.gte);
        // Match-candidate pull (and any rented-filtered list): stale flags and
        // deal-kind category sets are interpreted; search clauses are not.
        if (where.isRentedOut !== undefined || where.soldOut !== undefined) {
          return state.props.filter(
            (p) =>
              (!where.orgId || p.orgId === where.orgId) &&
              (where.active === undefined || p.active === where.active) &&
              (!where.category?.in || where.category.in.includes(p.category)) &&
              (where.isRentedOut === undefined || p.isRentedOut === where.isRentedOut) &&
              (where.soldOut === undefined || p.soldOut === where.soldOut),
          );
        }
        return state.props;
      },
      groupBy: async () => [],
    },
    technoSavedSearch: {
      findMany: async (args?: { where?: any }) =>
        state.savedSearches.filter(
          (s) =>
            (!args?.where?.orgId || s.orgId === args.where.orgId) &&
            (!args?.where?.brokerUserId || s.brokerUserId === args.where.brokerUserId),
        ),
      findFirst: async (args?: { where?: any }) => {
        const found = state.savedSearches.find(
          (s) => s.id === args?.where?.id && s.orgId === args?.where?.orgId && s.brokerUserId === args?.where?.brokerUserId,
        );
        return found ? { id: found.id, name: found.name, lastNotifiedAt: found.lastNotifiedAt ?? null } : null;
      },
      create: async (args: { data: any }) => {
        const row = { id: `ss-${state.savedSearchSeq}`, lastNotifiedAt: null, ...args.data };
        state.savedSearchSeq += 1;
        state.savedSearches.push(row);
        return row;
      },
      delete: async () => ({ id: "deleted" }),
      update: async (args: { where: { id: string }; data: any }) => {
        const row = state.savedSearches.find((s) => s.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return {};
      },
    },
    technoBuyerLead: {
      findMany: async (args?: { where?: any }) => {
        const where = args?.where ?? {};
        return state.buyerLeads.filter(
          (b) =>
            (!where.orgId || b.orgId === where.orgId) &&
            (!where.brokerUserId || b.brokerUserId === where.brokerUserId) &&
            (!where.dealType || b.dealType === where.dealType) &&
            (!where.OR ||
              where.OR.some((part: any) =>
                (part.name?.contains && b.name.toLowerCase().includes(String(part.name.contains).toLowerCase())) ||
                (part.phoneLast4?.contains && b.phoneLast4.includes(part.phoneLast4.contains)),
              )),
        );
      },
      findFirst: async (args?: { where?: any }) =>
        state.buyerLeads.find(
          (b) => b.id === args?.where?.id && b.orgId === args?.where?.orgId && b.brokerUserId === args?.where?.brokerUserId,
        ) ?? null,
      create: async (args: { data: any }) => {
        const row = { id: `bl-${state.buyerLeadSeq}`, createdAt: new Date(), ...args.data };
        state.buyerLeadSeq += 1;
        state.buyerLeads.push(row);
        return row;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const row = state.buyerLeads.find((b) => b.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return row ?? {};
      },
      delete: async (args: { where: { id: string } }) => {
        const idx = state.buyerLeads.findIndex((b) => b.id === args.where.id);
        if (idx >= 0) state.buyerLeads.splice(idx, 1);
        return { id: args.where.id };
      },
    },
    technoContactEvent: {
      findMany: async (args?: { where?: any }) => {
        const where = args?.where ?? {};
        return state.events.filter(
          (e) =>
            (!where.outcome || e.outcome === where.outcome) &&
            (!where.orgId || e.orgId === where.orgId) &&
            (!where.brokerUserId || e.brokerUserId === where.brokerUserId) &&
            (!where.listingType || e.listingType === where.listingType),
        );
      },
      create: async () => ({ id: "event-created" }),
    },
    technoNote: { findMany: async () => state.notes },
    technoShortlist: { count: async () => 2 },
  }),
}));

import {
  buildOwnerWhere,
  createBuyerLead,
  deleteBuyerLead,
  deleteSavedSearch,
  getActivities,
  getBuyerLead,
  getCallingQueue,
  listBrokerProperties,
  listBuyerLeads,
  listMatchCandidates,
  listSavedSearches,
  markSavedSearchNotified,
  normalizeSavedSearchFilters,
  saveSavedSearch,
  updateBuyerLead,
  type BuyerLeadInput,
} from "./repository";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

function prop(overrides: Record<string, unknown> = {}): any {
  return {
    id: "prop-1",
    externalId: "ext-1",
    orgId: "org-1",
    active: true,
    soldOut: false,
    rentPriceValue: 22_000n,
    category: TechnoCategory.RESIDENTIAL_RENT,
    propertyType: null,
    datePosted: daysAgo(1),
    address: "Thaltej",
    premiseName: "Test Premise",
    area: "Thaltej",
    rentPriceRaw: null,
    availabilityRaw: null,
    sqftRaw: null,
    keyInfo: "2BHK",
    propertyAge: null,
    descriptionRaw: "2BHK apartment on the ground floor",
    furnitureRaw: null,
    isRentedOut: false,
    hasGallery: false,
    isPremium: false,
    sourceShortlisted: false,
    ownerName: "Owner",
    ownerPhoneCipher: null,
    ownerPhoneLast4: "1234",
    contactBtnId: null,
    notes: [],
    shortlists: [],
    contactEvents: [],
    ...overrides,
  };
}

function event(overrides: Record<string, unknown> = {}): any {
  return {
    id: "event-1",
    orgId: "org-1",
    brokerUserId: "user-1",
    listingType: "OWNER",
    outcome: "follow_up",
    followUpAt: null,
    createdAt: daysAgo(1),
    ...overrides,
  };
}

beforeEach(() => {
  state.props = [];
  state.events = [];
  state.notes = [];
  state.savedSearches = [];
  state.savedSearchSeq = 1;
  state.buyerLeads = [];
  state.buyerLeadSeq = 1;
  state.countWhenSince = 3;
  state.propertyFindManyCalls = 0;
});

describe("buildOwnerWhere", () => {
  it("expresses the Important tab as an OR filter without a search", () => {
    const where = buildOwnerWhere("org-1", { category: "Important" });
    expect(where.AND).toBeUndefined();
    const or = JSON.stringify(where.OR ?? []);
    expect(or).toContain("sourceShortlisted");
    expect(or).toContain(TechnoCategory.IMPORTANT);
  });

  it("ANDs a search into the Important tab instead of replacing it", () => {
    const where = buildOwnerWhere("org-1", { category: "Important", q: "thaltej" });
    // The bug: `where.OR` was reassigned by the search clause, silently
    // dropping the Important filter. The fix keeps both, AND-ed.
    expect(where.OR).toBeUndefined();
    const and = where.AND;
    expect(and).toBeDefined();
    const parts = JSON.stringify(and);
    expect(parts).toContain("sourceShortlisted");
    expect(parts).toContain("thaltej");
    const importantPart = (and as any[]).find((p) => JSON.stringify(p).includes("sourceShortlisted"));
    const searchPart = (and as any[]).find((p) => JSON.stringify(p).includes("thaltej"));
    expect(importantPart).toBeDefined();
    expect(searchPart).toBeDefined();
    expect(importantPart).not.toBe(searchPart);
  });

  it("keeps a plain category search as a top-level OR", () => {
    const where = buildOwnerWhere("org-1", { category: "ResidentialRent", q: "gotap" });
    expect(where.AND).toBeUndefined();
    expect(where.category).toBe(TechnoCategory.RESIDENTIAL_RENT);
    expect(JSON.stringify(where.OR ?? [])).toContain("gotap");
  });

  it("maps the All tab to the four real categories, still searchable", () => {
    const where = buildOwnerWhere("org-1", { category: "All", q: "bopal" });
    expect(where.category).toEqual({
      in: [
        TechnoCategory.RESIDENTIAL_RENT,
        TechnoCategory.RESIDENTIAL_SELL,
        TechnoCategory.COMMERCIAL_RENT,
        TechnoCategory.COMMERCIAL_SELL,
      ],
    });
    expect(JSON.stringify(where.OR ?? [])).toContain("bopal");
  });
});

describe("getCallingQueue follow-up window", () => {
  it("resurfaces promised follow-ups on listings older than the freshness window", async () => {
    const windowNew = prop({ id: "E", datePosted: daysAgo(1), contactEvents: [] });
    // Posted 5 days ago — outside the 2-day window — with a future follow-up.
    const agedScheduled = prop({
      id: "A",
      datePosted: daysAgo(5),
      contactEvents: [event({ followUpAt: new Date(Date.now() + DAY) })],
    });
    // Posted 5 days ago with a follow-up that has no date — due immediately.
    const agedDue = prop({
      id: "B",
      datePosted: daysAgo(5),
      contactEvents: [event({ followUpAt: null, createdAt: daysAgo(2) })],
    });
    // Posted 5 days ago: follow-up logged, then a terminal outcome — LATEST
    // event wins, so it is done and must NOT resurface.
    const agedDone = prop({
      id: "C",
      datePosted: daysAgo(5),
      contactEvents: [
        event({ id: "c-latest", outcome: "connected", createdAt: daysAgo(1) }),
        event({ id: "c-older", outcome: "follow_up", createdAt: daysAgo(3) }),
      ],
    });
    // Posted 6 days ago, never contacted — stays out of the queue.
    const agedUntouched = prop({ id: "D", datePosted: daysAgo(6), contactEvents: [] });

    state.props = [windowNew, agedScheduled, agedDue, agedDone, agedUntouched];
    state.events = state.props.flatMap((p) => p.contactEvents.map((e: any) => ({ ...e, propertyId: p.id })));

    const { rows, scheduledCount } = await getCallingQueue("org-1", "user-1", 50);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Due follow-up beats fresh work (CALL_STATE_RANK: followup < new).
    expect(rows[0].id).toBe("B");
    expect(byId.get("B")?.callState).toBe("followup");
    expect(byId.get("E")?.callState).toBe("new");
    // Aged scheduled follow-up rides along for the collapsed section + chip.
    expect(byId.get("A")?.callState).toBe("scheduled");
    expect(scheduledCount).toBe(1);
    // Closed or untouched older listings do not leak in.
    expect(byId.has("C")).toBe(false);
    expect(byId.has("D")).toBe(false);
  });

  it("keeps completed and retry history scoped to the freshness window", async () => {
    const windowRetry = prop({
      id: "W",
      datePosted: daysAgo(1),
      contactEvents: [event({ outcome: "no_answer", followUpAt: null })],
    });
    // Older listing whose LATEST event is a plain no_answer: a retry, not a
    // promised follow-up — must stay out until the window moves.
    const agedRetry = prop({
      id: "R",
      datePosted: daysAgo(5),
      contactEvents: [event({ outcome: "no_answer", followUpAt: null, createdAt: daysAgo(3) })],
    });
    state.props = [windowRetry, agedRetry];
    state.events = [
      { ...event({ outcome: "no_answer", followUpAt: null }), propertyId: "W" },
      { ...event({ outcome: "no_answer", followUpAt: null, createdAt: daysAgo(3) }), propertyId: "R" },
    ];

    const { rows } = await getCallingQueue("org-1", "user-1", 50);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("W");
    expect(ids).not.toContain("R");
  });
});

describe("listBrokerProperties", () => {
  it("renders stable labels across renders (no Math.random)", async () => {
    state.props = [prop({ id: "broker-1", descriptionRaw: "2BHK apartment near the school" })];
    const labels = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const { rows } = await listBrokerProperties("org-1", { page: 1, perPage: 25 });
      expect(rows).toHaveLength(1);
      labels.add(rows[0].availabilityLabel ?? "");
    }
    // Math.random() used to make this set grow to 2 on repeated renders.
    expect(labels.size).toBe(1);
    const label = [...labels][0];
    expect(label).toMatch(/2BHK\n(High|Low) Rise\nApartment/);
  });
});

describe("getActivities", () => {
  it("returns summaries with real saved searches, no dead followUpDue fetch", async () => {
    state.events = [event({ id: "ev-1", phoneLast4: "1234", property: { address: "Thaltej", premiseName: "P" } })];
    state.notes = [{ id: "note-1", updatedAt: daysAgo(0), text: "call again", property: { address: "Thaltej", premiseName: "P" } }];
    state.savedSearches = [
      { id: "ss-1", orgId: "org-1", brokerUserId: "user-1", name: "Satellite 2BHK", filterJson: { category: "ResidentialRent" }, createdAt: daysAgo(5), lastNotifiedAt: null },
    ];

    const data = await getActivities("org-1", "user-1");
    expect(data.shortlistCount).toBe(2);
    expect(data.recentReveals).toHaveLength(1);
    expect(data.recentNotes).toHaveLength(1);
    expect(data.savedSearches).toHaveLength(1);
    expect(data.savedSearches[0].name).toBe("Satellite 2BHK");
    expect(data.savedSearches[0].newMatches).toBe(state.countWhenSince);
    expect("followUpDue" in data).toBe(false);
    // The removed fetch called technoProperty.findMany; it must not run.
    expect(state.propertyFindManyCalls).toBe(0);
  });
});

describe("saved searches", () => {
  const savedSearchRow = (overrides: Record<string, unknown> = {}): any => ({
    id: "ss-1",
    orgId: "org-1",
    brokerUserId: "user-1",
    name: "Satellite 2BHK",
    filterJson: { category: "ResidentialRent", q: "satellite" },
    createdAt: daysAgo(5),
    lastNotifiedAt: null,
    ...overrides,
  });

  it("normalises arbitrary filterJson into a valid search shape", () => {
    expect(normalizeSavedSearchFilters(null)).toEqual({ category: "All" });
    expect(normalizeSavedSearchFilters({ category: "ResidentialRent", q: " gota ", premium: "1", rented: "0" })).toEqual({
      category: "ResidentialRent",
      q: "gota",
      premium: "1",
    });
    // Unknown categories and junk types fall back to All instead of a broken query.
    expect(normalizeSavedSearchFilters({ category: "Hacked" }).category).toBe("All");
    expect(normalizeSavedSearchFilters({ category: 42, q: 7, premium: true }).category).toBe("All");
  });

  it("saves a search with the broker's ownership from the session, never the payload", async () => {
    const id = await saveSavedSearch("org-1", "user-1", "  Thaltej under 25k  ", { category: "ResidentialRent", q: "thaltej", premium: "1" });
    const row = state.savedSearches.find((s) => s.id === id);
    expect(row).toBeDefined();
    expect(row.name).toBe("Thaltej under 25k");
    expect(row.orgId).toBe("org-1");
    expect(row.brokerUserId).toBe("user-1");
    expect(row.filterJson).toEqual({ category: "ResidentialRent", q: "thaltej", premium: "1" });
  });

  it("counts new matches since the search was last seen (or created)", async () => {
    state.countWhenSince = 7;
    state.savedSearches = [savedSearchRow({ lastNotifiedAt: daysAgo(1) })];
    const [summary] = await listSavedSearches("org-1", "user-1");
    expect(summary.name).toBe("Satellite 2BHK");
    expect(summary.filters).toEqual({ category: "ResidentialRent", q: "satellite" });
    expect(summary.newMatches).toBe(7);
  });

  it("only ever returns the broker's own searches", async () => {
    state.savedSearches = [
      savedSearchRow(),
      savedSearchRow({ id: "ss-other", brokerUserId: "someone-else" }),
    ];
    const all = await listSavedSearches("org-1", "user-1");
    expect(all.map((s) => s.id)).toEqual(["ss-1"]);
  });

  it("deletes only searches the broker owns", async () => {
    state.savedSearches = [savedSearchRow(), savedSearchRow({ id: "ss-other", brokerUserId: "someone-else" })];
    expect(await deleteSavedSearch("org-1", "user-1", "ss-1")).toBe(true);
    expect(await deleteSavedSearch("org-1", "user-1", "ss-other")).toBe(false);
    expect(await deleteSavedSearch("org-1", "user-1", "ghost")).toBe(false);
  });

  it("marks a search seen only when it belongs to the broker", async () => {
    state.savedSearches = [savedSearchRow()];
    expect(await markSavedSearchNotified("org-1", "user-1", "ss-1")).toBe(true);
    expect(state.savedSearches[0].lastNotifiedAt).toBeInstanceOf(Date);
    expect(await markSavedSearchNotified("org-1", "user-1", "ghost")).toBe(false);
  });
});

describe("buyer leads", () => {
  const leadInput = (over: Partial<BuyerLeadInput> = {}): BuyerLeadInput => ({
    name: "  Meera Shah  ",
    phone: "98765 43210",
    dealType: "RENT",
    bhk: 2,
    budgetValue: 25_000,
    area: "Thaltej",
    furniture: "Furnished",
    moveInAt: null,
    source: "CALL",
    notes: null,
    ...over,
  });

  it("creates a lead: trims the name, encrypts the phone, keeps last4", async () => {
    const id = await createBuyerLead("org-1", "user-1", leadInput());
    const row = state.buyerLeads[0];
    expect(id).toBe("bl-1");
    expect(row.name).toBe("Meera Shah");
    expect(row.phoneLast4).toBe("3210");
    expect(decryptContact(row.phoneCipher)).toBe("+919876543210");
    expect(row.budgetValue).toBe(25_000n);
    expect(row.area).toBe("Thaltej");
  });

  it("rejects blank names, bad phones, out-of-range BHK and budgets", async () => {
    await expect(createBuyerLead("org-1", "user-1", leadInput({ name: "   " }))).rejects.toThrow("BUYER_LEAD_EMPTY_NAME");
    await expect(createBuyerLead("org-1", "user-1", leadInput({ phone: "12345" }))).rejects.toThrow("INVALID_PHONE");
    await expect(createBuyerLead("org-1", "user-1", leadInput({ bhk: 9 }))).rejects.toThrow("INVALID_BHK");
    await expect(createBuyerLead("org-1", "user-1", leadInput({ bhk: 0 }))).rejects.toThrow("INVALID_BHK");
    await expect(createBuyerLead("org-1", "user-1", leadInput({ budgetValue: -5 }))).rejects.toThrow("INVALID_BUDGET");
    await expect(createBuyerLead("org-1", "user-1", leadInput({ budgetValue: 2_000_000_000 }))).rejects.toThrow("INVALID_BUDGET");
    expect(state.buyerLeads).toHaveLength(0);
  });

  it("accepts +91 / 0-prefixed phone shapes", async () => {
    await createBuyerLead("org-1", "user-1", leadInput({ phone: "+91 98765 43210" }));
    await createBuyerLead("org-1", "user-1", leadInput({ phone: "09876543210", name: "Second" }));
    expect(state.buyerLeads.map((r) => r.phoneLast4)).toEqual(["3210", "3210"]);
    expect(decryptContact(state.buyerLeads[1].phoneCipher)).toBe("+919876543210");
  });

  it("lists only this broker's leads, with search and deal-type filters", async () => {
    const a = await createBuyerLead("org-1", "user-1", leadInput({ name: "Meera Shah" }));
    const b = await createBuyerLead("org-1", "user-1", leadInput({ name: "Rakesh Iyer", area: "Vasna", dealType: "SELL" }));
    await createBuyerLead("org-2", "user-1", leadInput({ name: "Other Org" }));
    await createBuyerLead("org-1", "user-9", leadInput({ name: "Other Broker" }));

    const all = await listBuyerLeads("org-1", "user-1");
    expect(new Set(all.map((l) => l.id))).toEqual(new Set([a, b]));
    expect(all[0].phone).toBe("+919876543210");

    const rent = await listBuyerLeads("org-1", "user-1", { dealType: "RENT" });
    expect(rent.map((l) => l.id)).toEqual([a]);

    const byName = await listBuyerLeads("org-1", "user-1", { q: "meera" });
    expect(byName.map((l) => l.id)).toEqual([a]);

    const byPhoneTail = await listBuyerLeads("org-1", "user-1", { q: "3210" });
    expect(byPhoneTail).toHaveLength(2);
  });

  it("getBuyerLead is scoped to the owning broker and org", async () => {
    const id = await createBuyerLead("org-1", "user-1", leadInput());
    expect((await getBuyerLead("org-1", "user-1", id))?.name).toBe("Meera Shah");
    expect(await getBuyerLead("org-1", "user-9", id)).toBeNull();
    expect(await getBuyerLead("org-2", "user-1", id)).toBeNull();
  });

  it("update changes the row only for the owning broker", async () => {
    const id = await createBuyerLead("org-1", "user-1", leadInput({ name: "Old Name" }));
    expect(await updateBuyerLead("org-1", "user-1", id, leadInput({ name: "New Name", bhk: 3 }))).toBe(true);
    const updated = await getBuyerLead("org-1", "user-1", id);
    expect(updated?.name).toBe("New Name");
    expect(updated?.bhk).toBe(3);
    expect(await updateBuyerLead("org-1", "user-9", id, leadInput())).toBe(false);
  });

  it("delete removes only the owning broker's row", async () => {
    const id = await createBuyerLead("org-1", "user-1", leadInput());
    expect(await deleteBuyerLead("org-1", "user-9", id)).toBe(false);
    expect(await deleteBuyerLead("org-1", "user-1", id)).toBe(true);
    expect(await getBuyerLead("org-1", "user-1", id)).toBeNull();
  });
});

describe("match candidates", () => {
  it("returns only active, non-stale listings of the deal kind, phones decrypted", async () => {
    state.props = [
      prop({
        id: "c1",
        ownerPhoneCipher: encryptContact("+919811112222"),
        rentPriceValue: 22_000n,
        ownerPhoneLast4: "2222",
      }),
      prop({ id: "c2", category: TechnoCategory.COMMERCIAL_RENT, isRentedOut: true }),
      prop({ id: "c3", category: TechnoCategory.RESIDENTIAL_SELL }),
      prop({ id: "c4", orgId: "org-2" }),
      prop({ id: "c5", active: false }),
    ];
    const rows = await listMatchCandidates("org-1", "RENT");
    expect(rows.map((r) => r.id)).toEqual(["c1"]);
    expect(rows[0].ownerPhone).toBe("+919811112222");
    expect(rows[0].rentPriceValue).toBe(22_000);
    expect(rows[0].ownerPhoneLast4).toBe("2222");
  });

  it("excludes sold listings for sell deals and serves the sell category set", async () => {
    state.props = [
      prop({ id: "s1", category: TechnoCategory.RESIDENTIAL_SELL }),
      prop({ id: "s2", category: TechnoCategory.RESIDENTIAL_SELL, soldOut: true }),
      prop({ id: "s3", category: TechnoCategory.COMMERCIAL_SELL }),
      prop({ id: "s4", category: TechnoCategory.RESIDENTIAL_RENT }),
    ];
    const rows = await listMatchCandidates("org-1", "SELL");
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(["s1", "s3"]));
  });
});
