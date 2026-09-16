import { PrismaClient } from '@prisma/client'
// We just need to check if TS compiler is happy with { updatedAt: new Date() }
const prisma = new PrismaClient()
async function test() {
  await prisma.reraRecord.update({
    where: { id: "test" },
    data: { updatedAt: new Date() }
  })
}
