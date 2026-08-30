import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequirementInput } from "./requirements";

const database = vi.hoisted(() => ({
  city: { findUnique: vi.fn() },
  locality: { findMany: vi.fn() },
  requirement: { findUnique: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));

import { createRequirementForServer } from "./requirements.server";

const input: RequirementInput = {
  intent: "buy",
  citySlug: "mumbai",
  category: "residential",
  subtype: "Flat/Apartment",
  localitySlugs: ["bandra-west", "powai"],
  role: "buyer",
  name: "Asha Mehta",
  phone: "+91 98765 43210",
  consentText: "I consent to contact about this property requirement.",
  idempotencyKey: "requirement-server-test",
};

const createdAt = new Date("2026-08-30T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
  vi.stubEnv("ARCHITECH_CONTACT_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("ARCHITECH_REQUIREMENT_RETENTION_DAYS", "30");
  database.city.findUnique.mockResolvedValue({ id: "city-mumbai", slug: "mumbai" });
  database.locality.findMany.mockResolvedValue([
    { id: "loc-bandra", slug: "bandra-west", cityId: "city-mumbai" },
    { id: "loc-powai", slug: "powai", cityId: "city-mumbai" },
  ]);
  database.requirement.findUnique.mockResolvedValue(null);
  database.requirement.create.mockResolvedValue({ id: "req-db-1", createdAt, idempotencyKey: input.idempotencyKey });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Prisma-backed requirement capture", () => {
  it("resolves immutable location ids, encrypts contact digits, and sets retention", async () => {
    const result = await createRequirementForServer(input);
    expect(result.ok).toBe(true);
    expect(result.ok && result.duplicate).toBe(false);
    expect(result.ok && result.requirement.phoneMasked).toBe("•••• ••• 3210");

    const args = database.requirement.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data.cityId).toBe("city-mumbai");
    expect(args.data.phoneLast4).toBe("3210");
    expect(args.data).not.toHaveProperty("phone");
    expect(Buffer.isBuffer(args.data.phoneCiphertext)).toBe(true);
    const envelope = args.data.phoneCiphertext as Buffer;
    expect(envelope.subarray(0, 4).toString("ascii")).toBe("ARQ1");
    expect(envelope.toString("utf8")).not.toContain("9876543210");
    expect(args.data.localities).toEqual({
      create: [
        { localityId: "loc-bandra", priority: 0 },
        { localityId: "loc-powai", priority: 1 },
      ],
    });
    const retentionUntil = args.data.retentionUntil as Date;
    const days = (retentionUntil.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("revalidates city membership before writing", async () => {
    database.locality.findMany.mockResolvedValue([{ id: "loc-bandra", slug: "bandra-west", cityId: "city-mumbai" }]);
    const result = await createRequirementForServer({ ...input, localitySlugs: ["bandra-west", "koramangala"] });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(!result.ok && result.errors.join(" ")).toContain("selected city");
    expect(database.requirement.create).not.toHaveBeenCalled();
  });

  it("returns the existing durable row for the same idempotency key", async () => {
    database.requirement.findUnique.mockResolvedValue({ id: "req-existing", createdAt, idempotencyKey: input.idempotencyKey });
    const result = await createRequirementForServer(input);
    expect(result).toMatchObject({ ok: true, duplicate: true, requirement: { id: "req-existing" } });
    expect(database.requirement.create).not.toHaveBeenCalled();
  });

  it("converts a unique-key race into an idempotent success", async () => {
    database.requirement.create.mockRejectedValue({ code: "P2002" });
    database.requirement.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "req-race", createdAt, idempotencyKey: input.idempotencyKey });
    const result = await createRequirementForServer(input);
    expect(result).toMatchObject({ ok: true, duplicate: true, requirement: { id: "req-race" } });
  });

  it.each([
    ["an absent key", ""],
    ["non-canonical key material", `${Buffer.alloc(32, 7).toString("base64")}junk`],
  ])("fails closed for %s", async (_label, key) => {
    vi.stubEnv("ARCHITECH_CONTACT_ENCRYPTION_KEY", key);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await createRequirementForServer(input);
    expect(result).toMatchObject({ ok: false, status: 503 });
    // Argument construction fails before Prisma receives any write call.
    expect(database.requirement.create).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it("fails closed for an invalid retention configuration", async () => {
    vi.stubEnv("ARCHITECH_REQUIREMENT_RETENTION_DAYS", "30days");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await createRequirementForServer(input);
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(database.requirement.create).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });
});
