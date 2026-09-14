const fs = require('fs');
const content = fs.readFileSync('src/lib/repositories/server/prisma.ts', 'utf-8');

const REPLACE = `export async function getCityListingCountsForServer() {
  if (!isPrismaDataSource()) {
    const map = new Map<string, { buy: number; rent: number }>();
    for (const listing of getListings()) {
      const counts = map.get(listing.citySlug) ?? { buy: 0, rent: 0 };
      if (listing.transaction === "rent") counts.rent++;
      else counts.buy++;
      map.set(listing.citySlug, counts);
    }
    return map;
  }
  const prisma = getPrismaClient();
  const grouped = await prisma.listing.groupBy({
    by: ["cityId", "transactionType"],
    where: { lifecycle: "ACTIVE" },
    _count: { _all: true },
  });
  const map = new Map<string, { buy: number; rent: number }>();
  for (const group of grouped) {
    const counts = map.get(group.cityId) ?? { buy: 0, rent: 0 };
    if (group.transactionType === "RENT") counts.rent += group._count._all;
    else counts.buy += group._count._all;
    map.set(group.cityId, counts);
  }
  return map;
}`;

const SEARCH = `export async function getCityListingCountsForServer() {
  if (!isPrismaDataSource()) {
    const map = new Map<string, { buy: number; rent: number }>();
    for (const listing of getListings()) {
      const counts = map.get(listing.citySlug) ?? { buy: 0, rent: 0 };
      if (listing.transaction === "rent") counts.rent++;
      else counts.buy++;
      map.set(listing.citySlug, counts);
    }
    return map;
  }
  // Use extended type for groupBy
  const prisma = getPrismaClient() as unknown as PrismaClientLike;
  const grouped = await prisma.listing.groupBy({
    by: ["citySlug", "transaction"],
    where: { lifecycle: "ACTIVE" },
    _count: { _all: true },
  });
  const map = new Map<string, { buy: number; rent: number }>();
  for (const group of grouped) {
    if (!group.citySlug) continue;
    const counts = map.get(group.citySlug) ?? { buy: 0, rent: 0 };
    if (group.transaction === "rent") counts.rent += group._count._all;
    else counts.buy += group._count._all;
    map.set(group.citySlug, counts);
  }
  return map;
}`;

fs.writeFileSync('src/lib/repositories/server/prisma.ts', content.replace(SEARCH, REPLACE));
console.log("Fixed again");
