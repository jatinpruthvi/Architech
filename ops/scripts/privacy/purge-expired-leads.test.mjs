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
  assert.deepEqual(result, { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible: 2, purged: 0, dispatchesTerminal: 0 });
  assert.equal(updates, 0);
});

test("apply clears contact data and terminally closes sendable dispatches in one transaction", async () => {
  const calls = [];
  const prisma = {
    $transaction: async (work) => work(prisma),
    lead: {
      count: async (args) => { calls.push(["count", args]); return 2; },
      findMany: async (args) => { calls.push(["findMany", args]); return [{ id: "lead_1" }, { id: "lead_2" }]; },
      updateMany: async (args) => { calls.push(["lead.updateMany", args]); return { count: 2 }; },
    },
    whatsappDispatch: {
      updateMany: async (args) => { calls.push(["dispatch.updateMany", args]); return { count: 1 }; },
    },
  };
  const result = await purgeExpiredLeads(prisma, { apply: true, asOf });
  assert.deepEqual(result, { mode: "APPLY", asOf: asOf.toISOString(), eligible: 2, purged: 2, dispatchesTerminal: 1 });
  assert.deepEqual(calls, [
    ["count", { where: expiredLeadWhere(asOf) }],
    ["findMany", { where: expiredLeadWhere(asOf), select: { id: true } }],
    ["dispatch.updateMany", { where: { leadId: { in: ["lead_1", "lead_2"] }, status: { in: ["PENDING", "IN_FLIGHT", "UNKNOWN"] } }, data: { status: "SKIPPED", skipReason: "LEAD_EXPIRED", lastErrorCode: "LEAD_EXPIRED", completedAt: asOf } }],
    ["lead.updateMany", { where: expiredLeadWhere(asOf), data: { phoneCiphertext: null, phoneLast4: null, deletedAt: asOf } }],
  ]);
});

test("purge output never contains contact, template, or provider fields", async () => {
  const result = await purgeExpiredLeads({ lead: { count: async () => 0 } }, { apply: false, asOf });
  const serialized = JSON.stringify(result);
  for (const forbidden of ["phone", "template", "provider", "ciphertext", "message"]) assert.equal(serialized.includes(forbidden), false);
});
