import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const database = vi.hoisted(() => ({
  lead: { findUnique: vi.fn() as Mock, findFirst: vi.fn() as Mock, update: vi.fn() as Mock },
  leadCallLog: { create: vi.fn() as Mock },
  auditEvent: { create: vi.fn() as Mock },
  marketplaceSubscription: { findFirst: vi.fn() as Mock },
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));

import { encryptContact } from "@/lib/interop/contact-crypto";
import { logLeadCall, revealLeadContact } from "./calling-server";

/* Fixed test key: canonical base64 of exactly 32 bytes — what contact-crypto
   validates. A test constant, never a production secret. */
const TEST_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
const CANONICAL_PHONE = "+919876543210";

/** The row shape the reveal/log path reads, with the demo broker's org. */
function prismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    organizationId: "org-1",
    phoneCiphertext: encryptContact(CANONICAL_PHONE),
    consentClass: "first-party-form",
    callSuppressedAt: null,
    callAttempts: 0,
    stage: "NEW",
    ...overrides,
  };
}

describe("revealLeadContact (spec §4/§5)", () => {
  beforeEach(() => {
    vi.stubEnv("ARCHITECH_CONTACT_ENCRYPTION_KEY", TEST_KEY);
    // Deterministic clock: 10:00 IST, inside the default 09:00–20:00 window.
    // The suite must pass at any hour in any CI zone — drive the clock, never
    // assume local time. (Fake timers, not a Date.now spy: V8's new Date()
    // reads a native clock that a Date.now override cannot reach.)
    vi.useFakeTimers({ now: Date.UTC(2026, 8, 10, 4, 30, 0) });
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** asBroker — active plan, own org, stored consenting lead, in hours;
      pass overrides for the row / subscription under test. */
  async function asBroker(rowOverrides: Record<string, unknown> = {}, subscription: { status: string } = { status: "ACTIVE" }, organizationId = "org-1") {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
    database.lead.findUnique.mockResolvedValue(prismaRow(rowOverrides));
    database.marketplaceSubscription.findFirst.mockResolvedValue(subscription);
    database.auditEvent.create.mockResolvedValue({ id: "audit-1" });
    return revealLeadContact(new Request("http://localhost/api/broker/leads/lead-1/reveal", { headers: { "x-forwarded-for": "203.0.113.7" } }), "lead-1", organizationId);
  }

  it("returns tel + wa.me links for a stored, consenting, in-hours lead", async () => {
    const result = (await asBroker()) as { ok: boolean; telLink?: string; waMeLink?: string; revealed?: boolean };
    expect(result).toMatchObject({ ok: true, revealed: true });
    expect(result.telLink).toBe(`tel:${CANONICAL_PHONE}`);
    expect(result.waMeLink).toContain("919876543210");
    expect(database.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "lead.contact.revealed", ipHash: expect.any(String) }) }),
    );
  });

  it("gate order: a foreign lead is blocked before any plan or reveal work", async () => {
    // The real assertLeadBelongsToOrg (client/src/lib/leads/server.ts) queries
    // prisma.lead.findUnique({ where: { id } }) — mock that exact shape
    // returning null, giving the real 404 path.
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    database.lead.findUnique.mockResolvedValue(null);
    const result = await revealLeadContact(new Request("http://x/api/broker/leads/other/reveal"), "other", "org-1");
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(database.auditEvent.create).not.toHaveBeenCalled();
    expect(database.marketplaceSubscription.findFirst).not.toHaveBeenCalled();
  });

  it("plan NONE/EXPIRED blocks with 402 before any per-lead check", async () => {
    for (const status of ["NONE", "EXPIRED"]) {
      const result = await asBroker({}, { status });
      expect(result).toMatchObject({ ok: false, status: 402 });
      expect(database.auditEvent.create).not.toHaveBeenCalled();
    }
  });

  it("a consent class without humanFirstTouch is blocked (registry predicate)", async () => {
    const { CONSENT_CLASSES } = await import("@/lib/interop/lead-ingestion");
    // The test must block exactly when the registry says no human first touch:
    const consentClass = CONSENT_CLASSES["imported-unknown"].humanFirstTouch ? "first-party-form" : "imported-unknown";
    const result = await asBroker({ consentClass });
    if (CONSENT_CLASSES["imported-unknown"].humanFirstTouch) {
      expect(result).toMatchObject({ ok: true });
    } else {
      expect(result).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("an unknown consent class fails closed with 403, never a 500", async () => {
    const result = await asBroker({ consentClass: "marketing-outreach" });
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("suppressed leads are blocked with 403", async () => {
    const result = await asBroker({ callSuppressedAt: new Date() });
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("the attempt limit blocks with 429 and names logging the result", async () => {
    const result = await asBroker({ callAttempts: 3 });
    expect(result).toMatchObject({ ok: false, status: 429 });
    expect(String((result as { errors?: string[] }).errors?.join(" "))).toMatch(/log the (last )?call result/i);
  });

  it("outside the configured IST window the message names that window", async () => {
    vi.stubEnv("ARCHITECH_CALLING_HOURS_IST", "00:00-01:00");
    // Move the fake clock: 12:00 UTC is 17:30 IST, guaranteed
    // outside 00:00–01:00 IST.
    vi.setSystemTime(Date.UTC(2026, 8, 10, 12, 0, 0));
    const result = await asBroker();
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(String((result as { errors?: string[] }).errors?.join(" "))).toContain("00:00-01:00");
  });

  it("a pre-migration lead without ciphertext is 422 not-stored, never a 500", async () => {
    const result = await asBroker({ phoneCiphertext: null });
    expect(result).toMatchObject({ ok: false, status: 422 });
  });
});

describe("logLeadCall (spec §3: the plan gate applies to both calling operations)", () => {
  beforeEach(() => {
    vi.stubEnv("ARCHITECH_CONTACT_ENCRYPTION_KEY", TEST_KEY);
    vi.spyOn(global.Date, "now").mockReturnValue(Date.UTC(2026, 8, 10, 4, 30, 0));
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("blocks with 402 when the org plan does not allow reveal", async () => {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
    database.lead.findUnique.mockResolvedValue(prismaRow());
    database.marketplaceSubscription.findFirst.mockResolvedValue({ status: "EXPIRED" });
    const result = await logLeadCall("lead-1", "org-1", "u-1", { outcome: "NO_ANSWER", nextActionAt: "2026-09-11T09:00:00.000Z" });
    expect(result).toMatchObject({ ok: false, status: 402 });
    expect(database.leadCallLog.create).not.toHaveBeenCalled();
    expect(database.lead.update).not.toHaveBeenCalled();
  });

  it("writes the call log and advances the lead's stage/attempts on an active plan", async () => {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "");
    database.lead.findUnique.mockResolvedValue(prismaRow());
    database.marketplaceSubscription.findFirst.mockResolvedValue({ status: "ACTIVE" });
    database.leadCallLog.create.mockResolvedValue({ id: "call-1" });
    database.lead.update.mockResolvedValue({});
    const result = await logLeadCall("lead-1", "org-1", "u-1", { outcome: "NO_ANSWER", nextActionAt: "2026-09-11T09:00:00.000Z", note: "no pickup" });
    expect(result).toMatchObject({ ok: true, call: { outcome: "NO_ANSWER", stageBefore: "NEW", stageAfter: "NEW" } });
    expect(database.leadCallLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "NO_ANSWER", stageBefore: "NEW", stageAfter: "NEW", note: "no pickup" }) }),
    );
    expect(database.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ callAttempts: { increment: 1 } }) }));
  });

  it("still validates the outcome contract before writing", async () => {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    const result = await logLeadCall("lead-1", "org-1", "u-1", { outcome: "SOUND_ASLEEP" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(database.leadCallLog.create).not.toHaveBeenCalled();
  });
});

describe("plan §6 guardrails", () => {
  it("LeadCallLog carries no invented telephony evidence (no duration/connected/recording)", () => {
    const schema = readFileSync(join(__dirname, "../../../../prisma/schema.prisma"), "utf8");
    const start = schema.indexOf("model LeadCallLog {");
    const block = schema.slice(start, schema.indexOf("}", start));
    expect(block).not.toMatch(/\b(duration|connected|recordingUrl|recording)\b/i);
  });
});
