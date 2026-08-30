import "server-only";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createRequirement, requirementIdempotencyKey, validateRequirementInput, type RequirementInput, type RequirementLocationValidator } from "@/lib/requirements";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type RequirementRow = { id: string; createdAt: Date; idempotencyKey: string | null };
type RequirementPrisma = ReturnType<typeof getPrismaClient> & {
  city: { findUnique(args: unknown): Promise<{ id: string; slug: string } | null> };
  locality: { findMany(args: unknown): Promise<Array<{ id: string; slug: string; cityId: string }>> };
  requirement: {
    create(args: unknown): Promise<RequirementRow>;
    findUnique(args: unknown): Promise<RequirementRow | null>;
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
export async function createRequirementForServer(input: RequirementInput) {
  if (!isPrismaPersistence()) return createRequirement(input);
  const prisma = getPrismaClient() as RequirementPrisma;

  const city = input.citySlug ? await prisma.city.findUnique({ where: { slug: input.citySlug } }) : null;
  const normalizedSlugs = (input.localitySlugs ?? []).map((slug) => slug.trim()).filter(Boolean);
  const requestedSlugs = [...new Set(normalizedSlugs)];
  const normalizedInput: RequirementInput = { ...input, localitySlugs: normalizedSlugs };
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
        intent: input.intent,
        category: input.category,
        subtype: input.subtype.trim(),
        role: input.role,
        name: input.name.trim(),
        phoneCiphertext: encryptPhone(input.phone),
        phoneLast4: input.phone.replace(/\D/g, "").slice(-4),
        consentText: input.consentText.trim(),
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
