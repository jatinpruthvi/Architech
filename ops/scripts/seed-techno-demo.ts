#!/usr/bin/env tsx
/**
 * Seed demo TechnoProperty records for a broker organization so the dashboard
 * renders meaningful numbers while the real crawler's SQLite isn't present.
 * Idempotent — re-running it re-uses existing records by externalId.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const require = createRequire(import.meta.url);
const { PrismaClient } = require(path.join(repoRoot, "node_modules/@prisma/client"));
const { PrismaPg } = require(path.join(repoRoot, "node_modules/@prisma/adapter-pg"));

// Inline AES-256-GCM encrypt so the script doesn't need to go through server-only modules.
import { createCipheriv, randomBytes } from "node:crypto";
const MAGIC = Buffer.from("ARQ1");
const IV_BYTES = 12;
const TAG_BYTES = 16;
function contactKey() {
  const v = process.env.ARCHITECH_CONTACT_ENCRYPTION_KEY!;
  const key = Buffer.from(v, "base64");
  if (key.length !== 32) throw new Error("Bad encryption key");
  return key;
}
function encryptContact(value: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", contactKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}
import { TechnoCategory } from "@prisma/client";

const orgId = process.argv[2];
if (!orgId) {
  console.error("usage: pnpm tsx ops/scripts/seed-techno-demo.ts <brokerOrgId>");
  process.exit(2);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATS = ["ResidentialRent", "ResidentialSell", "CommercialRent", "CommercialSell"] as const;
const ENUM: Record<string, TechnoCategory> = {
  ResidentialRent: TechnoCategory.RESIDENTIAL_RENT,
  ResidentialSell: TechnoCategory.RESIDENTIAL_SELL,
  CommercialRent: TechnoCategory.COMMERCIAL_RENT,
  CommercialSell: TechnoCategory.COMMERCIAL_SELL,
};

const areas = ["Bodakdev", "SG Highway", "Satellite", "South Bopal", "Gota", "Jagatpur", "Shilaj", "Prahlad Nagar", "Navrangpura", "Maninagar", "Vastrapur", "Thaltej"];
const premises = [
  "Kavisha Celebration", "Shaligram Arcade", "Vishnudhara Homes", "Ananya Allium",
  "Siddharth Icon", "Sun Shela One", "Aashray Arise", "Shivanta Skyview",
  "Sp Nirvana", "Vr Reflections", "Pramukh Park", "Shubh Vastu Heights",
  "Maruti Apartment", "Saryu Enclave", "Titanium Heights",
];
const names = ["Nilesh Shah", "Hitesh Patel", "Ritaben Desai", "Mahesh Joshi", "Daxeshbhai Patel", "Deepak Balwani", "Abc", "Kavita Mehta", "Rajesh Trivedi", "Bhavin Rathod", "Harshad Panchal", "Mitesh Shah"];
const phones = ["9825054306", "8401298434", "9876543210", "9978654321", "9825012345", "8460987123", "9723456789", "9687654321", "9912345678", "8460123456", "9727098765", "9825099887"];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateInLastNDays(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Math.floor(Math.random() * n));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const totals: Record<string, number> = {
    ResidentialRent: 2000,
    ResidentialSell: 1800,
    CommercialRent: 350,
    CommercialSell: 750,
  };
  let totalCreated = 0;
  let total = 0;

  for (const cat of CATS) {
    const target = totals[cat];
    total += target;
    for (let i = 0; i < target; i++) {
      const posted = dateInLastNDays(i < 110 ? 1 : i < 200 ? 2 : i < 500 ? 15 : 300);
      const rent = 15000 + Math.floor(Math.random() * 80000);
      const price = BigInt(3000000 + Math.floor(Math.random() * 20000000));
      const ownerPhone = rand(phones);
      const hasPhone = Math.random() > 0.05;
      const rented = cat === "ResidentialRent" && Math.random() < 0.05;
      const isPremium = Math.random() < 0.03;
      const premise = rand(premises);
      const area = rand(areas);
      const bhk = Math.ceil((i % 5) + 1);
      const externalId = `demo-${cat}-${i}-${Math.random().toString(36).slice(2, 8)}`;
      const rowHash = `seed-${externalId}`;
      const sqft = 900 + Math.floor(Math.random() * 2000);
      const data = {
        externalId,
        orgId,
        category: ENUM[cat],
        propertyType: cat.replace(/([A-Z])/g, " $1").trim(),
        datePosted: posted,
        address: `${Math.floor(100 + Math.random() * 400)}, ${Math.floor(Math.random() * 20)}th Floor, ${premise}, Near ${rand(["Godrej Garden City", "Sola Overbridge", "SG Highway", "ISRO Cross Road"])}, ${area}`,
        premiseName: premise,
        area,
        rentPriceRaw: cat.includes("Rent") ? `₹ ${rent.toLocaleString("en-IN")} / month` : `₹ ${price.toLocaleString("en-IN")}`,
        rentPriceValue: cat.includes("Rent") ? BigInt(rent) : price,
        availabilityRaw: rand(["Immediate", "Within 15 days", "From next month"]),
        conditionRaw: rand(["Well maintained", "Newly constructed", "Resale"]),
        propertyAge: rand(["0-1 years", "1-3 years", "5-10 years", "10+ years"]),
        descriptionRaw: `${bhk} BHK ${cat.includes("Rent") ? "on rent" : "for sale"}, ${isPremium ? "premium finish" : "standard"}.`,
        furnitureRaw: rand(["Semi-Furnished", "Unfurnished", "Fully Furnished"]),
        sqftRaw: `${sqft} sqft`,
        sqftValue: sqft,
        keyInfo: `${bhk} BHK`,
        brokerage: "1 month",
        isRentedOut: rented,
        soldOut: false,
        hasGallery: Math.random() > 0.3,
        isPremium,
        sourceShortlisted: false,
        ownerName: rand(names),
        ownerPhoneCipher: hasPhone ? encryptContact(ownerPhone) : null,
        ownerPhoneLast4: hasPhone ? ownerPhone.slice(-4) : null,
        contactBtnId: hasPhone ? null : `getcntinfo_${externalId}`,
        imageUrls: isPremium ? ["https://example.com/premium.jpg"] : null,
        sourceStatus: rented ? ("RENTED_OUT" as const) : ("ACTIVE" as const),
        firstSeenAt: posted,
        lastSeenAt: posted,
        lastModifiedAt: posted,
        rowHash,
        active: true,
      };
      await prisma.technoProperty.upsert({
        where: { orgId_externalId: { orgId: data.orgId, externalId: data.externalId } },
        update: data,
        create: data,
      });
      totalCreated++;
      if (totalCreated % 500 === 0) process.stdout.write(`  ${totalCreated}/${total}\n`);
    }
  }

  const now = new Date();
  const today0 = new Date(now); today0.setUTCHours(0, 0, 0, 0);
  const yday0 = new Date(today0); yday0.setUTCDate(yday0.getUTCDate() - 1);
  const d15 = new Date(today0); d15.setUTCDate(d15.getUTCDate() - 15);

  const totalActive = await prisma.technoProperty.count({ where: { orgId, active: true, sourceStatus: "ACTIVE" } });
  const totalToday = await prisma.technoProperty.count({ where: { orgId, firstSeenAt: { gte: today0 } } });
  const totalYday = await prisma.technoProperty.count({ where: { orgId, firstSeenAt: { gte: yday0, lt: today0 } } });
  const last15 = await prisma.technoProperty.count({ where: { orgId, firstSeenAt: { gte: d15 } } });

  await prisma.technoCategoryStat.upsert({
    where: { orgId_categoryKey: { orgId, categoryKey: "TOTAL" } },
    update: { totalActive, todayCount: totalToday, yesterdayCount: totalYday, last15Days: last15, updatedAt: now },
    create: { orgId, categoryKey: "TOTAL", totalActive, todayCount: totalToday, yesterdayCount: totalYday, last15Days: last15, updatedAt: now },
  });
  for (const key of CATS) {
    const enumKey = ENUM[key];
    const active = await prisma.technoProperty.count({ where: { orgId, active: true, sourceStatus: "ACTIVE", category: enumKey } });
    const today = await prisma.technoProperty.count({ where: { orgId, category: enumKey, firstSeenAt: { gte: today0 } } });
    const yday = await prisma.technoProperty.count({ where: { orgId, category: enumKey, firstSeenAt: { gte: yday0, lt: today0 } } });
    await prisma.technoCategoryStat.upsert({
      where: { orgId_categoryKey: { orgId, categoryKey: key } },
      update: { totalActive: active, todayCount: today, yesterdayCount: yday, updatedAt: now },
      create: { orgId, categoryKey: key, totalActive: active, todayCount: today, yesterdayCount: yday, updatedAt: now },
    });
  }

  console.log(`\nSeeded ${totalCreated} technoproperty rows for org ${orgId}.`);
  console.log(`  active=${totalActive}, today=${totalToday}, yesterday=${totalYday}, last15=${last15}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
