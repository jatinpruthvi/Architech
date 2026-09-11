import assert from "node:assert/strict";
import test from "node:test";
import { expiredRequirementWhere, parsePurgeArgs, purgeExpiredRequirements } from "./purge-expired-requirements.mjs";

test("purge arguments are dry-run by default and accept an explicit cutoff", () => {
  const options = parsePurgeArgs(["--as-of", "2026-08-30T00:00:00.000Z"]);
  assert.equal(options.apply, false);
  assert.equal(options.asOf.toISOString(), "2026-08-30T00:00:00.000Z");
  assert.deepEqual(expiredRequirementWhere(options.asOf), {
    retentionUntil: { not: null, lte: options.asOf },
  });
});

test("dry-run counts but never deletes", async () => {
  let deletes = 0;
  const prisma = {
    requirement: {
      count: async () => 7,
      deleteMany: async () => { deletes += 1; return { count: 7 }; },
    },
  };
  const result = await purgeExpiredRequirements(prisma, { apply: false, asOf: new Date("2026-08-30T00:00:00.000Z") });
  assert.deepEqual(result, { mode: "DRY_RUN", asOf: "2026-08-30T00:00:00.000Z", eligible: 7, deleted: 0 });
  assert.equal(deletes, 0);
});

test("apply deletes exactly the eligible parent rows", async () => {
  const calls = [];
  const prisma = {
    requirement: {
      count: async (args) => { calls.push(["count", args]); return 3; },
      deleteMany: async (args) => { calls.push(["deleteMany", args]); return { count: 3 }; },
    },
  };
  const asOf = new Date("2026-08-30T00:00:00.000Z");
  const result = await purgeExpiredRequirements(prisma, { apply: true, asOf });
  assert.equal(result.deleted, 3);
  assert.deepEqual(calls, [
    ["count", { where: expiredRequirementWhere(asOf) }],
    ["deleteMany", { where: expiredRequirementWhere(asOf) }],
  ]);
});
