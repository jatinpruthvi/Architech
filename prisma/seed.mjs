import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const localities = [
  { slug: "paldi", name: "Paldi", hindiName: "पालडी", note: "Tree-lined, central, quietly established", demoHomeCount: 42, latitude: "23.011000", longitude: "72.559000", bbox: "72.5350,22.9950,72.5850,23.0270", landmarks: [["Law Garden", "≈ 1.4 km"], ["Sabarmati Riverfront", "≈ 1.8 km"], ["Tagore Hall", "≈ 0.9 km"], ["IIM Ahmedabad", "≈ 5.2 km"], ["SVP Airport", "≈ 11.6 km"]] },
  { slug: "navrangpura", name: "Navrangpura", hindiName: "नवरंगपुरा", note: "Lively streets with a familiar pulse", demoHomeCount: 31, latitude: "23.039000", longitude: "72.561000", bbox: "72.5400,23.0250,72.5820,23.0530", landmarks: [["Gujarat College", "≈ 0.8 km"], ["Law Garden", "≈ 1.2 km"], ["Sabarmati Riverfront", "≈ 1.6 km"], ["SVP Airport", "≈ 9.4 km"]] },
  { slug: "prahlad-nagar", name: "Prahlad Nagar", hindiName: "प्रह्लाद नगर", note: "Newer buildings, easy everyday rhythm", demoHomeCount: 68, latitude: "23.011000", longitude: "72.507000", bbox: "72.4880,22.9970,72.5260,23.0250" },
  { slug: "thaltej", name: "Thaltej", hindiName: "थलतेज", note: "Room to breathe at the western edge", demoHomeCount: 54, latitude: "23.052000", longitude: "72.509000", bbox: "72.4900,23.0380,72.5280,23.0660" },
  { slug: "bopal", name: "Bopal", hindiName: "बोपल", note: "Young families, wide roads, new schools", demoHomeCount: 47, latitude: "23.033000", longitude: "72.464000", bbox: "72.4450,23.0190,72.4830,23.0470" },
  { slug: "satellite", name: "Satellite", hindiName: "सैटेलाइट", note: "Connected, confident, always awake", demoHomeCount: 39, latitude: "23.023000", longitude: "72.519000", bbox: "72.5000,23.0090,72.5380,23.0370" },
];

const listings = [
  { stableId: "garden-courtyard", slug: "garden-courtyard", title: "A garden courtyard in Paldi", localitySlug: "paldi", priceLabel: "₹1.85 Cr", priceInr: 18_500_000, pricePerSqft: "₹12,480 / sq ft", bhk: 3, areaSqft: 1482, propertyType: "APARTMENT", availability: "Ready to move", verification: "RERA_VERIFIED", description: "Old trees, kota stone floors, and a courtyard that carries the whole house.", image: "prop-courtyard" },
  { stableId: "light-filled-home", slug: "light-filled-home", title: "Light across every room", localitySlug: "prahlad-nagar", priceLabel: "₹1.24 Cr", priceInr: 12_400_000, pricePerSqft: "₹11,350 / sq ft", bhk: 2, areaSqft: 1092, propertyType: "APARTMENT", availability: "New launch", verification: "VERIFIED_PARTNER", description: "Morning sun through sheer curtains; a single brick wall keeps it grounded.", image: "prop-light" },
  { stableId: "thaltej-dusk-house", slug: "thaltej-dusk-house", title: "A quieter edge of Thaltej", localitySlug: "thaltej", priceLabel: "₹2.40 Cr", priceInr: 24_000_000, pricePerSqft: "₹10,860 / sq ft", bhk: 4, areaSqft: 2210, propertyType: "VILLA", availability: "Resale", verification: "RERA_VERIFIED", description: "Brick and white plaster volumes glowing at blue hour, west of the city's rush.", image: "prop-thaltej" },
  { stableId: "neem-lane-rowhouse", slug: "neem-lane-rowhouse", title: "Under the neem canopy", localitySlug: "navrangpura", priceLabel: "₹98 L", priceInr: 9_800_000, pricePerSqft: "₹10,420 / sq ft", bhk: 2, areaSqft: 940, propertyType: "ROWHOUSE", availability: "Resale", verification: "SOURCE_REVIEWED", description: "A tree-lined lane where the street itself is the amenity.", image: "locality-street" },
];

async function main() {
  const city = await prisma.city.upsert({
    where: { slug: "ahmedabad" },
    update: { name: "Ahmedabad", hindiName: "अहमदाबाद", state: "Gujarat", country: "IN", latitude: "23.030000", longitude: "72.580000" },
    create: { slug: "ahmedabad", name: "Ahmedabad", hindiName: "अहमदाबाद", state: "Gujarat", country: "IN", latitude: "23.030000", longitude: "72.580000" },
  });

  const localityBySlug = new Map();
  for (const locality of localities) {
    const record = await prisma.locality.upsert({
      where: { cityId_slug: { cityId: city.id, slug: locality.slug } },
      update: { ...locality, aliases: [locality.name.toLowerCase(), locality.hindiName], landmarks: locality.landmarks ?? undefined },
      create: { ...locality, aliases: [locality.name.toLowerCase(), locality.hindiName], landmarks: locality.landmarks ?? undefined, cityId: city.id },
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
      update: { url: `/images/${listing.image}.jpg`, alt: `${listing.title}, ${locality.name}, Ahmedabad`, moderationStatus: "APPROVED", derivatives: { webp: `/images/${listing.image}.webp`, mobileWebp: `/images/${listing.image}-800.webp` } },
      create: { id: `media-${listing.slug}-primary`, listingId: saved.id, url: `/images/${listing.image}.jpg`, alt: `${listing.title}, ${locality.name}, Ahmedabad`, moderationStatus: "APPROVED", derivatives: { webp: `/images/${listing.image}.webp`, mobileWebp: `/images/${listing.image}-800.webp` }, exifStripped: true, sortOrder: 0 },
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
      availability: "Ready to move",
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
      availability: "Ready to move",
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
      metadata: { localities: localities.length, listings: listings.length, source: "prisma/seed.mjs" },
    },
  });

  console.log(`Seeded ${localities.length} Ahmedabad localities and ${listings.length} demo listings.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
