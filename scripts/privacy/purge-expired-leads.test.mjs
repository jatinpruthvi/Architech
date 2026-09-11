import test from "node:test";
import assert from "node:assert/strict";
import { expiredLeadWhere, purgeExpiredLeads } from "./purge-expired-leads.mjs";

const asOf = new Date("2026-09-10T00:00:00.000Z");

test("expiredLeadWhere targets expired, undeleted leads only", () => {
  assert.deepEqual(expiredLeadWhere(asOf), {
    retentionUntil: { not: null, lte: asOf },
    deletedAt: null,
  });
});

test("dry run counts without writing", async () => {
  let updates = 0;
  const prisma = {
    lead: {
      count: async () => 2,
      updateMany: async () => { updates += 1; return { count: 2 }; },
    },
  };
  const result = await purgeExpiredLeads(prisma, { apply: false, asOf });
  assert.deepEqual(result, { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible: 2, purged: 0 });
  assert.equal(updates, 0);
});

test("apply clears the recoverable contact data and keeps the tombstone", async () => {
  const calls = [];
  const prisma = {
    lead: {
      count: async (args) => { calls.push(["count", args]); return 2; },
      updateMany: async (args) => { calls.push(["updateMany", args]); return { count: 2 }; },
    },
  };
  const result = await purgeExpiredLeads(prisma, { apply: true, asOf });
  assert.deepEqual(result, { mode: "APPLY", asOf: asOf.toISOString(), eligible: 2, purged: 2 });
  assert.deepEqual(calls, [
    ["count", { where: expiredLeadWhere(asOf) }],
    ["updateMany", { where: expiredLeadWhere(asOf), data: { phoneCiphertext: null, phoneLast4: null, deletedAt: asOf } }],
  ]);
});
