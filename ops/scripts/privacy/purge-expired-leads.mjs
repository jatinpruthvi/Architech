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
 *   - pending, in-flight, and ambiguous WhatsApp dispatches are made terminal
 *     in the same transaction before the lead tombstone is written. A worker
 *     cannot claim an expired lead while this transaction is in progress.
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
  if (!apply) return { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible, purged: 0, dispatchesTerminal: 0 };

  const work = async (tx) => {
    const expired = await tx.lead.findMany({ where, select: { id: true } });
    const leadIds = expired.map((lead) => lead.id).filter((id) => typeof id === "string" && id.length > 0);
    let dispatchesTerminal = 0;
    if (leadIds.length > 0) {
      const dispatches = await tx.whatsappDispatch.updateMany({
        where: { leadId: { in: leadIds }, status: { in: ["PENDING", "IN_FLIGHT", "UNKNOWN"] } },
        data: { status: "SKIPPED", skipReason: "LEAD_EXPIRED", lastErrorCode: "LEAD_EXPIRED", completedAt: asOf },
      });
      dispatchesTerminal = dispatches.count;
    }
    const result = await tx.lead.updateMany({ where, data: { phoneCiphertext: null, phoneLast4: null, deletedAt: asOf } });
    return { purged: result.count, dispatchesTerminal };
  };

  const result = typeof prisma.$transaction === "function" ? await prisma.$transaction(work) : await work(prisma);
  return { mode: "APPLY", asOf: asOf.toISOString(), eligible, purged: result.purged, dispatchesTerminal: result.dispatchesTerminal };
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
