import { PrismaClient } from "@prisma/client";
import { CITIES, LOCALITIES } from "./seed-registry.mjs";

const prisma = new PrismaClient();

const listings = [
  { stableId: "garden-courtyard", slug: "garden-courtyard", title: "A garden courtyard in Paldi", localitySlug: "paldi", priceLabel: "₹1.85 Cr", priceInr: 18_500_000, pricePerSqft: "₹12,480 / sq ft", bhk: 3, areaSqft: 1482, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "RERA_VERIFIED", description: "Old trees, kota stone floors, and a courtyard that carries the whole house.", image: "prop-courtyard" },
  { stableId: "light-filled-home", slug: "light-filled-home", title: "Light across every room", localitySlug: "prahlad-nagar", priceLabel: "₹1.24 Cr", priceInr: 12_400_000, pricePerSqft: "₹11,350 / sq ft", bhk: 2, areaSqft: 1092, propertyType: "APARTMENT", availability: "NEW_LAUNCH", verification: "VERIFIED_PARTNER", description: "Morning sun through sheer curtains; a single brick wall keeps it grounded.", image: "prop-light" },
  { stableId: "thaltej-dusk-house", slug: "thaltej-dusk-house", title: "A quieter edge of Thaltej", localitySlug: "thaltej", priceLabel: "₹2.40 Cr", priceInr: 24_000_000, pricePerSqft: "₹10,860 / sq ft", bhk: 4, areaSqft: 2210, propertyType: "VILLA", availability: "RESALE", verification: "RERA_VERIFIED", description: "Brick and white plaster volumes glowing at blue hour, west of the city's rush.", image: "prop-thaltej" },
  { stableId: "neem-lane-rowhouse", slug: "neem-lane-rowhouse", title: "Under the neem canopy", localitySlug: "navrangpura", priceLabel: "₹98 L", priceInr: 9_800_000, pricePerSqft: "₹10,420 / sq ft", bhk: 2, areaSqft: 940, propertyType: "ROWHOUSE", availability: "RESALE", verification: "SOURCE_REVIEWED", description: "A tree-lined lane where the street itself is the amenity.", image: "locality-street" },
];

async function main() {
  // Every city in the registry is provisioned, so the database matches the
  // routes, sitemap, and SEO registry the application generates.
  const cityBySlug = new Map();
  for (const city of CITIES) {
    const record = await prisma.city.upsert({
      where: { slug: city.slug },
      update: { ...city },
      create: { ...city },
    });
    cityBySlug.set(city.slug, record);
  }

  // The hand-authored demo listings below belong to the reference city.
  const city = cityBySlug.get("ahmedabad");
  if (!city) throw new Error("Seed registry is missing the reference city 'ahmedabad'.");

  const localityBySlug = new Map();
  for (const { citySlug, ...locality } of LOCALITIES) {
    const owner = cityBySlug.get(citySlug);
    if (!owner) throw new Error(`Locality ${locality.slug} references unknown city ${citySlug}.`);
    const record = await prisma.locality.upsert({
      where: { cityId_slug: { cityId: owner.id, slug: locality.slug } },
      update: { ...locality, aliases: [locality.name.toLowerCase(), locality.hindiName], landmarks: locality.landmarks ?? undefined },
      create: { ...locality, aliases: [locality.name.toLowerCase(), locality.hindiName], landmarks: locality.landmarks ?? undefined, cityId: owner.id },
    });
    localityBySlug.set(locality.slug, record);
  }

  const broker = await prisma.brokerOrganization.upsert({
    where: { slug: "nivasa-partners" },
    update: { name: "Nivasa Partners", cityId: city.id, verificationStatus: "VERIFIED_PARTNER", email: "demo-broker@example.com" },
    create: { slug: "nivasa-partners", name: "Nivasa Partners", cityId: city.id, verificationStatus: "VERIFIED_PARTNER", email: "demo-broker@example.com" },
  });

  const rera = await prisma.reraRecord.upsert({
    where: { registrationNumber: "GJ/RERA/AHM/2026/04821-DEMO" },
    update: { state: "Gujarat", promoterName: "Nivasa Partners", verificationStatus: "RERA_VERIFIED", parserVersion: "seed-v1", confidence: "0.9200", evidence: { source: "demo fixture", note: "Illustrative RERA evidence only" } },
    create: { registrationNumber: "GJ/RERA/AHM/2026/04821-DEMO", state: "Gujarat", promoterName: "Nivasa Partners", verificationStatus: "RERA_VERIFIED", parserVersion: "seed-v1", confidence: "0.9200", evidence: { source: "demo fixture", note: "Illustrative RERA evidence only" }, retrievedAt: new Date() },
  });

  for (const listing of listings) {
    const locality = localityBySlug.get(listing.localitySlug);
    const saved = await prisma.listing.upsert({
      where: { stableId: listing.stableId },
      update: {
        title: listing.title,
        description: listing.description,
        lifecycle: "ACTIVE",
        verification: listing.verification,
        propertyType: listing.propertyType,
        priceInr: listing.priceInr,
        priceLabel: listing.priceLabel,
        pricePerSqft: listing.pricePerSqft,
        bhk: listing.bhk,
        areaSqft: listing.areaSqft,
        availability: listing.availability,
        postalCode: locality.pincodes?.[0] ?? null,
        cityId: city.id,
        localityId: locality.id,
        brokerOrgId: broker.id,
        reraRecordId: listing.verification === "RERA_VERIFIED" ? rera.id : undefined,
        sourceSummary: "Seeded from the August 2026 Amdavad Modern prototype fixtures.",
        publishedAt: new Date(),
      },
      create: {
        stableId: listing.stableId,
        slug: listing.slug,
        title: listing.title,
        description: listing.description,
        lifecycle: "ACTIVE",
        verification: listing.verification,
        translationStatus: "ENGLISH_ONLY",
        propertyType: listing.propertyType,
        priceInr: listing.priceInr,
        priceLabel: listing.priceLabel,
        pricePerSqft: listing.pricePerSqft,
        bhk: listing.bhk,
        areaSqft: listing.areaSqft,
        availability: listing.availability,
        addressLocality: locality.name,
        postalCode: locality.pincodes?.[0] ?? null,
        cityId: city.id,
        localityId: locality.id,
        brokerOrgId: broker.id,
        reraRecordId: listing.verification === "RERA_VERIFIED" ? rera.id : undefined,
        sourceSummary: "Seeded from the August 2026 Amdavad Modern prototype fixtures.",
        publishedAt: new Date(),
      },
    });

    await prisma.propertyMedia.upsert({
      where: { id: `media-${listing.slug}-primary` },
      update: { url: `/images/${listing.image}.jpg`, alt: `${listing.title}, ${locality.name}, ${city.name}`, moderationStatus: "APPROVED", derivatives: { webp: `/images/${listing.image}.webp`, mobileWebp: `/images/${listing.image}-800.webp` } },
      create: { id: `media-${listing.slug}-primary`, listingId: saved.id, url: `/images/${listing.image}.jpg`, alt: `${listing.title}, ${locality.name}, ${city.name}`, moderationStatus: "APPROVED", derivatives: { webp: `/images/${listing.image}.webp`, mobileWebp: `/images/${listing.image}-800.webp` }, exifStripped: true, sortOrder: 0 },
    });
  }

  // A demo broker draft (DRAFT) demonstrating the persistence adapter path for
  // the moderation queue. In the demo it stays in review; in prisma mode it is
  // the durable record the moderation API reads back.
  const draftLocality = localityBySlug.get("paldi");
  const draft = await prisma.listing.upsert({
    where: { stableId: "courtyard-draft-01" },
    update: {
      title: "Garden courtyard in Paldi — draft",
      lifecycle: "IN_REVIEW",
      verification: "DEMO",
      priceInr: 18_500_000,
      bhk: 3,
      areaSqft: 1482,
      availability: "READY_TO_MOVE",
      description: "Draft submission awaiting moderation review and source checks.",
      cityId: city.id,
      localityId: draftLocality.id,
      brokerOrgId: broker.id,
    },
    create: {
      stableId: "courtyard-draft-01",
      slug: "courtyard-draft-01",
      title: "Garden courtyard in Paldi — draft",
      description: "Draft submission awaiting moderation review and source checks.",
      lifecycle: "IN_REVIEW",
      verification: "DEMO",
      translationStatus: "ENGLISH_ONLY",
      propertyType: "APARTMENT",
      priceInr: 18_500_000,
      priceLabel: "₹1.85 Cr",
      bhk: 3,
      areaSqft: 1482,
      availability: "READY_TO_MOVE",
      cityId: city.id,
      localityId: draftLocality.id,
      brokerOrgId: broker.id,
    },
  });

  await prisma.propertyMedia.upsert({
    where: { id: "media-courtyard-draft-01-pending" },
    update: { url: "/media/pending/courtyard-draft-01.jpg", moderationStatus: "PENDING" },
    create: { id: "media-courtyard-draft-01-pending", listingId: draft.id, url: "/media/pending/courtyard-draft-01.jpg", alt: "Garden courtyard draft — pending review", moderationStatus: "PENDING", exifStripped: true, sortOrder: 0 },
  });

  await prisma.auditEvent.create({
    data: {
      action: "seed.phase1_domain_schema",
      entityType: "database",
      entityId: "phase1-demo-fixtures",
      metadata: { localities: LOCALITIES.length, listings: listings.length, source: "prisma/seed.mjs" },
    },
  });

  console.log(`Seeded ${CITIES.length} cities, ${LOCALITIES.length} localities, and ${listings.length} demo listings.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
