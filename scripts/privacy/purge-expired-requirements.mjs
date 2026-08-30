#!/usr/bin/env node
/**
 * Purge requirement contact records after their configured retention window.
 *
 * Safety model:
 *   - dry-run by default (counts only)
 *   - --apply is required to delete
 *   - one explicit UTC cutoff is printed with every result
 *   - RequirementLocality rows cascade from the parent delete
 *
 * Schedule this command at least daily in every Prisma-backed environment:
 *   pnpm privacy:requirements:purge -- --apply
 */
import { pathToFileURL } from "node:url";

export function parsePurgeArgs(argv) {
  const options = { apply: false, asOf: new Date() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--as-of") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--as-of requires an ISO date or timestamp.");
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) throw new Error("--as-of must be a valid ISO date or timestamp.");
      options.asOf = parsed;
      index += 1;
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

export function expiredRequirementWhere(asOf) {
  return { retentionUntil: { not: null, lte: asOf } };
}

export async function purgeExpiredRequirements(prisma, { apply, asOf }) {
  const where = expiredRequirementWhere(asOf);
  const eligible = await prisma.requirement.count({ where });
  if (!apply) return { mode: "DRY_RUN", asOf: asOf.toISOString(), eligible, deleted: 0 };
  const result = await prisma.requirement.deleteMany({ where });
  return { mode: "APPLY", asOf: asOf.toISOString(), eligible, deleted: result.count };
}

function usage() {
  return [
    "Usage: node scripts/privacy/purge-expired-requirements.mjs [--apply] [--as-of <ISO>]",
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
  const prisma = new PrismaClient();
  try {
    const result = await purgeExpiredRequirements(prisma, options);
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
