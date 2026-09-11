#!/usr/bin/env node
/**
 * Purge lead contact records after their configured retention window.
 *
 * Posture (spec §9, mirrors the requirements purge):
 *   - dry-run by default (counts only)
 *   - --apply is required to purge
 *   - one explicit UTC cutoff is printed with every result
 *   - only the RECOVERABLE contact data is cleared: phoneCiphertext and
 *     phoneLast4. The masked record, consent text, stage and call logs stay
 *     as the non-sensitive audit tombstone.
 *   - billing state never drives this: a lapsed plan does not purge, and an
 *     active plan does not extend retention (consent class + retentionUntil
 *     are the only authorities).
 *
 * Schedule this command at least daily in every Prisma-backed environment:
 *   pnpm privacy:leads:purge -- --apply
 */
import { pathToFileURL } from "node:url";
import { parsePurgeArgs } from "./purge-expired-requirements.mjs";

export { parsePurgeArgs };

export function expiredLeadWhere(asOf) {
  return { retentionUntil: { not: null, lte: asOf }, deletedAt: null };
}

export async function purgeExpiredLeads(prisma, { apply, asOf }) {
  const where = expiredLeadWhere(asOf);
  const eligible = await prisma.lead.count({ where });
  if (!apply) return { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible, purged: 0 };
  const result = await prisma.lead.updateMany({ where, data: { phoneCiphertext: null, phoneLast4: null, deletedAt: asOf } });
  return { mode: "APPLY", asOf: asOf.toISOString(), eligible, purged: result.count };
}

function usage() {
  return [
    "Usage: node ops/scripts/privacy/purge-expired-leads.mjs [--apply] [--as-of <ISO>]",
    "Without --apply, the command only reports how many rows are eligible.",
  ].join("\n");
}

async function main() {
  const options = parsePurgeArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await purgeExpiredLeads(prisma, options);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
