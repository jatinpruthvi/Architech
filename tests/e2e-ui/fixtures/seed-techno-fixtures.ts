#!/usr/bin/env tsx
/** Deterministic inventory for the browser-only broker workspace journeys. */
import { createCipheriv, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });

const require = createRequire(import.meta.url);
const { PrismaClient, TechnoCategory, TechnoSourceStatus } = require(path.join(root, "node_modules/@prisma/client"));
const { PrismaPg } = require(path.join(root, "node_modules/@prisma/adapter-pg"));

const databaseUrl = process.env.DATABASE_URL;
const encodedKey = process.env.ARCHITECH_CONTACT_ENCRYPTION_KEY;
if (!databaseUrl || !encodedKey) {
  throw new Error("Techno UI fixtures require DATABASE_URL and ARCHITECH_CONTACT_ENCRYPTION_KEY");
}

const key = Buffer.from(encodedKey, "base64");
if (key.length !== 32) throw new Error("ARCHITECH_CONTACT_ENCRYPTION_KEY must decode to 32 bytes");

function encryptContact(value: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("ARQ1"), iv, cipher.getAuthTag(), ciphertext]);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const orgId = "demo-org-nivasa-partners";
const now = new Date();
const ownerPhone = "+919825054306";

try {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    externalId: `e2e-ui-residential-rent-${String(index + 1).padStart(2, "0")}`,
    orgId,
    category: TechnoCategory.RESIDENTIAL_RENT,
    propertyType: "Residential Rent",
    datePosted: now,
    address: `${index + 1}00, Test Residency, Bodakdev, Ahmedabad`,
    premiseName: `Test Residency ${index + 1}`,
    area: "Bodakdev",
    rentPriceRaw: `₹ ${(25_000 + index * 500).toLocaleString("en-IN")} / month`,
    rentPriceValue: BigInt(25_000 + index * 500),
    availabilityRaw: "Immediate",
    sqftRaw: `${1_000 + index * 10} sqft`,
    sqftValue: 1_000 + index * 10,
    keyInfo: "2 BHK",
    isPremium: true,
    ownerName: `Test Owner ${index + 1}`,
    ownerPhoneCipher: encryptContact(ownerPhone),
    ownerPhoneLast4: ownerPhone.slice(-4),
    sourceStatus: TechnoSourceStatus.ACTIVE,
    firstSeenAt: now,
    lastSeenAt: now,
    lastModifiedAt: now,
    rowHash: `e2e-ui-residential-rent-${index + 1}`,
    active: true,
  }));

  const [, result] = await prisma.$transaction([
    prisma.technoProperty.deleteMany({ where: { orgId, externalId: { startsWith: "e2e-ui-" } } }),
    prisma.technoProperty.createMany({ data: rows }),
  ]);
  console.log(`Techno UI fixtures ready (${result.count} current rows).`);
} finally {
  await prisma.$disconnect();
}
