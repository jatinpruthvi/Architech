import "server-only";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createRequirement, listRequirementsForOrganization, propertyTypeFromRequirement, requirementIdempotencyKey, validateRequirementInput, type RequirementInput, type RequirementLocationValidator, type RequirementRecord } from "@/lib/requirements";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import type { AuthSession } from "@/lib/auth/roles";

type RequirementRow = { id: string; createdAt: Date; idempotencyKey: string | null; intent?: string; category?: string; subtype?: string; role?: string; propertyType?: string | null; bhkMin?: number | null; bhkMax?: number | null; areaMinSqft?: number | null; areaMaxSqft?: number | null; budgetMinInr?: bigint | number | null; budgetMaxInr?: bigint | number | null; organizationId?: string | null; status?: string; city?: { slug: string } | null; localities?: Array<{ locality?: { slug: string } | null; priority?: number }> };
type RequirementPrisma = ReturnType<typeof getPrismaClient> & {
  city: { findUnique(args: unknown): Promise<{ id: string; slug: string } | null> };
  locality: { findMany(args: unknown): Promise<Array<{ id: string; slug: string; cityId: string }>> };
  requirement: {
    create(args: unknown): Promise<RequirementRow>;
    findUnique(args: unknown): Promise<RequirementRow | null>;
    findMany(args: unknown): Promise<RequirementRow[]>;
  };
};

function contactEncryptionKey(value = process.env.ARCHITECH_CONTACT_ENCRYPTION_KEY): Buffer {
  if (!value) throw new Error("ARCHITECH_CONTACT_ENCRYPTION_KEY is required for durable requirement capture.");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error("ARCHITECH_CONTACT_ENCRYPTION_KEY must be canonical base64 for exactly 32 random bytes.");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("ARCHITECH_CONTACT_ENCRYPTION_KEY must be canonical base64 for exactly 32 random bytes.");
  }
  return key;
}

/** Versioned AES-256-GCM envelope: magic + IV + auth tag + ciphertext. */
function encryptPhone(phone: string): Buffer {
  const digits = phone.replace(/\D/g, "");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", contactEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("ARQ1"), iv, cipher.getAuthTag(), ciphertext]);
}

function maskedPhone(phone: string) {
  return `•••• ••• ${phone.replace(/\D/g, "").slice(-4)}`;
}

function requirementRetentionDays(value = process.env.ARCHITECH_REQUIREMENT_RETENTION_DAYS): number {
  if (value === undefined || value === "") return 180;
  if (!/^\d+$/.test(value)) throw new Error("ARCHITECH_REQUIREMENT_RETENTION_DAYS must be a whole number of days.");
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > 3_650) {
    throw new Error("ARCHITECH_REQUIREMENT_RETENTION_DAYS must be between 1 and 3650.");
  }
  return days;
}

function publicRecord(input: RequirementInput, row: RequirementRow) {
  return {
    id: row.id,
    intent: input.intent,
    citySlug: input.citySlug,
    category: input.category,
    subtype: input.subtype.trim(),
    propertyType: propertyTypeFromRequirement(input),
    bhkMin: input.bhkMin ?? null,
    bhkMax: input.bhkMax ?? null,
    areaMinSqft: input.areaMinSqft ?? null,
    areaMaxSqft: input.areaMaxSqft ?? null,
    budgetMinInr: input.budgetMinInr ?? null,
    budgetMaxInr: input.budgetMaxInr ?? null,
    organizationId: input.organizationId ?? null,
    localitySlugs: input.localitySlugs,
    role: input.role,
    name: input.name.trim(),
    phoneMasked: maskedPhone(input.phone),
    consentText: input.consentText.trim(),
    idempotencyKey: row.idempotencyKey ?? undefined,
    status: "NEW" as const,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Database write boundary: resolve public slugs to immutable ids, enforce the
 * city/locality relationship again against the database, and never persist a
 * plaintext phone number. */
export async function createRequirementForServer(input: RequirementInput, session?: AuthSession | null) {
  const scopedInput: RequirementInput = session?.organization ? { ...input, organizationId: session.organization.id } : input;
  if (!isPrismaPersistence()) return createRequirement(scopedInput);
  const prisma = getPrismaClient() as RequirementPrisma;

  const city = scopedInput.citySlug ? await prisma.city.findUnique({ where: { slug: scopedInput.citySlug } }) : null;
  const normalizedSlugs = (scopedInput.localitySlugs ?? []).map((slug) => slug.trim()).filter(Boolean);
  const requestedSlugs = [...new Set(normalizedSlugs)];
  const normalizedInput: RequirementInput = { ...scopedInput, propertyType: propertyTypeFromRequirement(scopedInput), localitySlugs: normalizedSlugs };
  const localities: Array<{ id: string; slug: string; cityId: string }> = city && requestedSlugs.length
    ? await prisma.locality.findMany({ where: { cityId: city.id, slug: { in: requestedSlugs }, retiredAt: null }, select: { id: true, slug: true, cityId: true } }) as Array<{ id: string; slug: string; cityId: string }>
    : [];
  const localityBySlug = new Map<string, { id: string; slug: string; cityId: string }>(
    localities.map((locality) => [locality.slug, locality]),
  );
  const validator: RequirementLocationValidator = {
    cityExists: (slug) => city?.slug === slug,
    localityBelongs: (citySlug, localitySlug) => city?.slug === citySlug && localityBySlug.has(localitySlug),
  };
  const errors = validateRequirementInput(normalizedInput, validator);
  if (errors.length) return { ok: false as const, status: 400, errors };

  const idempotencyKey = requirementIdempotencyKey(normalizedInput);
  const existing = await prisma.requirement.findUnique({ where: { idempotencyKey } });
  if (existing) return { ok: true as const, requirement: publicRecord(normalizedInput, existing), duplicate: true };

  try {
    const retentionUntil = new Date();
    retentionUntil.setUTCDate(retentionUntil.getUTCDate() + requirementRetentionDays());
    const row = await prisma.requirement.create({
      data: {
        cityId: city!.id,
        intent: normalizedInput.intent,
        category: normalizedInput.category,
        subtype: normalizedInput.subtype.trim(),
        propertyType: propertyTypeFromRequirement(normalizedInput),
        bhkMin: normalizedInput.bhkMin ?? null,
        bhkMax: normalizedInput.bhkMax ?? null,
        areaMinSqft: normalizedInput.areaMinSqft ?? null,
        areaMaxSqft: normalizedInput.areaMaxSqft ?? null,
        budgetMinInr: normalizedInput.budgetMinInr != null ? BigInt(Math.round(Number(normalizedInput.budgetMinInr))) : null,
        budgetMaxInr: normalizedInput.budgetMaxInr != null ? BigInt(Math.round(Number(normalizedInput.budgetMaxInr))) : null,
        organizationId: normalizedInput.organizationId ?? null,
        role: normalizedInput.role,
        name: normalizedInput.name.trim(),
        phoneCiphertext: encryptPhone(normalizedInput.phone),
        phoneLast4: normalizedInput.phone.replace(/\D/g, "").slice(-4),
        consentText: normalizedInput.consentText.trim(),
        idempotencyKey,
        retentionUntil,
        localities: { create: requestedSlugs.map((slug, priority) => ({ localityId: localityBySlug.get(slug)!.id, priority })) },
      },
    });
    return { ok: true as const, requirement: publicRecord(normalizedInput, row), duplicate: false };
  } catch (error) {
    // A unique race is resolved as the same idempotent submission. Avoid
    // importing Prisma error classes so this server adapter remains mockable.
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "P2002") {
      const raced = await prisma.requirement.findUnique({ where: { idempotencyKey } });
      if (raced) return { ok: true as const, requirement: publicRecord(normalizedInput, raced), duplicate: true };
    }
    const incident = createHash("sha256").update(`${idempotencyKey}:${Date.now()}`).digest("hex").slice(0, 12);
    console.error("requirement persistence failed", { incident, error });
    return { ok: false as const, status: 503, errors: [`Requirement storage is temporarily unavailable (reference ${incident}).`] };
  }
}


function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function listBrokerRequirementsForServer(session: AuthSession): Promise<{ ok: true; requirements: RequirementRecord[] } | { ok: false; status: number; errors: string[] }> {
  if (!session.organization) return { ok: false, status: 403, errors: ["Broker organization is required."] };
  if (!isPrismaPersistence()) {
    return { ok: true, requirements: listRequirementsForOrganization(session.organization.id) };
  }
  const prisma = getPrismaClient() as RequirementPrisma;
  const rows = await prisma.requirement.findMany({
    where: { organizationId: session.organization.id, deletedAt: null, status: "NEW" },
    include: { city: { select: { slug: true } }, localities: { include: { locality: { select: { slug: true } } }, orderBy: { priority: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    ok: true,
    requirements: rows.map((row) => ({
      id: row.id,
      intent: row.intent === "rent" ? "rent" : "buy",
      citySlug: row.city?.slug ?? "",
      category: (row.category as RequirementRecord["category"]) ?? "residential",
      subtype: row.subtype ?? "Flat/Apartment",
      propertyType: row.propertyType ?? propertyTypeFromRequirement({ subtype: row.subtype ?? "" }),
      bhkMin: numberOrNull(row.bhkMin),
      bhkMax: numberOrNull(row.bhkMax),
      areaMinSqft: numberOrNull(row.areaMinSqft),
      areaMaxSqft: numberOrNull(row.areaMaxSqft),
      budgetMinInr: numberOrNull(row.budgetMinInr),
      budgetMaxInr: numberOrNull(row.budgetMaxInr),
      organizationId: row.organizationId ?? session.organization!.id,
      localitySlugs: (row.localities ?? []).map((item) => item.locality?.slug).filter(Boolean) as string[],
      role: (row.role as RequirementRecord["role"]) ?? "buyer",
      name: "Private buyer",
      phoneMasked: "••••",
      consentText: "Stored privately",
      idempotencyKey: row.idempotencyKey ?? undefined,
      status: "NEW",
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
