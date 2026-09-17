import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
(async () => {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  await p.technoProperty.updateMany({
    where: { externalId: { startsWith: "demo-" } },
    data: { sourceShortlisted: false },
  });
  const mine = await p.technoProperty.count({ where: { shortlists: { some: {} } } });
  const srcImportant = await p.technoProperty.count({ where: { OR: [{ sourceShortlisted: true }, { category: "IMPORTANT" }] } });
  console.log("user-shortlisted rows:", mine);
  console.log("source-side Important rows:", srcImportant);
  await p.$disconnect();
})();
