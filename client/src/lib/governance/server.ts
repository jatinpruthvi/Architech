import "server-only";
import { listOutreach, listRegistryAssets, recordOutreach, registerAuthorityAsset, type OutreachRecord, type RegistryAsset, type RegistryResult } from "./registry";
import { validateOutreach, type AuthorityAsset, type OutreachEntry, type OutreachOutcome } from "./authority";
import { isPrismaAuthorityStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type AuthorityPrismaClient = ReturnType<typeof getPrismaClient> & {
  authorityAsset: {
    upsert(args: unknown): Promise<unknown>;
    findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
  };
  authorityOutreach: {
    create(args: unknown): Promise<unknown>;
    findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as AuthorityPrismaClient;

function trustString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** DB row → registry asset (updatedAt is set by Prisma on upsert via @updatedAt). */
function assetFromRow(row: Record<string, unknown>): RegistryAsset {
  return {
    id: String(row.id ?? ""),
    type: trustString(row.type) as AuthorityAsset["type"],
    title: String(row.title ?? ""),
    url: typeof row.url === "string" && row.url ? row.url : undefined,
    isNofollow: Boolean(row.isNofollow),
    paidForLink: Boolean(row.paidForLink),
    disclosure: trustString(row.disclosure) as AuthorityAsset["disclosure"],
    relationshipRegistry: typeof row.relationshipRegistry === "string" && row.relationshipRegistry ? row.relationshipRegistry : undefined,
    createdAt: safeIso(row.createdAt),
    updatedAt: safeIso(row.updatedAt),
  };
}

function outreachFromRow(row: Record<string, unknown>): OutreachRecord {
  return {
    id: String(row.id ?? ""),
    date: String(row.date ?? ""),
    target: String(row.target ?? ""),
    assetId: typeof row.assetId === "string" && row.assetId ? row.assetId : undefined,
    outcome: trustString(row.outcome) as OutreachOutcome,
    reviewedBy: String(row.reviewedBy ?? ""),
    createdAt: safeIso(row.createdAt),
  };
}

export async function registerAuthorityAssetForServer(input: Omit<AuthorityAsset, "id">): Promise<RegistryResult<RegistryAsset>> {
  const result = registerAuthorityAsset(input);
  if (!result.ok) return result;
  if (isPrismaAuthorityStorage()) {
    const db = prisma();
    /* B-8: Prisma mode previously wrote only an audit event — the asset lived
       in the in-memory registry and vanished on restart. The row is persisted
       with the same deterministic id the memory registry uses, so reads in
       either source agree. */
    await db.authorityAsset.upsert({
      where: { id: result.value.id },
      update: {
        type: result.value.type,
        title: result.value.title,
        url: result.value.url ?? null,
        isNofollow: result.value.isNofollow,
        paidForLink: result.value.paidForLink,
        disclosure: result.value.disclosure,
        relationshipRegistry: result.value.relationshipRegistry ?? null,
      },
      create: {
        id: result.value.id,
        type: result.value.type,
        title: result.value.title,
        url: result.value.url ?? null,
        isNofollow: result.value.isNofollow,
        paidForLink: result.value.paidForLink,
        disclosure: result.value.disclosure,
        relationshipRegistry: result.value.relationshipRegistry ?? null,
      },
    });
    await db.auditEvent.create({
      data: { action: "authority.asset.registered", entityType: "AuthorityAsset", entityId: result.value.id, metadata: { title: result.value.title, type: result.value.type, source: "api.authority.assets.prisma" } },
    });
  }
  return result;
}

export async function listRegistryAssetsForServer(): Promise<RegistryAsset[]> {
  if (!isPrismaAuthorityStorage()) return listRegistryAssets();
  const db = prisma();
  const rows = (await db.authorityAsset.findMany({ orderBy: { updatedAt: "desc" } })) as Array<Record<string, unknown>>;
  return rows.map(assetFromRow);
}

export async function recordOutreachForServer(input: Omit<OutreachEntry, "id"> & { reviewedBy: string }): Promise<RegistryResult<OutreachRecord>> {
  if (!isPrismaAuthorityStorage()) return recordOutreach(input);

  /* In Prisma mode the registry lives in the database, so validation must
     happen against the database rows, not the in-memory registry. */
  const db = prisma();
  const rows = (await db.authorityAsset.findMany()) as Array<Record<string, unknown>>;
  const assets = rows.map(assetFromRow).map((asset): AuthorityAsset => ({
    id: asset.id,
    type: asset.type,
    title: asset.title,
    url: asset.url,
    isNofollow: asset.isNofollow,
    paidForLink: asset.paidForLink,
    disclosure: asset.disclosure,
    relationshipRegistry: asset.relationshipRegistry,
  }));

  const id = registerAuthorityAssetIdForOutreach(input);
  const decision = validateOutreach({ ...input, id }, assets);
  if (!decision.ok) return { ok: false, status: 400, errors: decision.reasons };

  const existing = (await db.authorityOutreach.findFirst({ where: { id } })) as Record<string, unknown> | null;
  if (!existing) {
    await db.authorityOutreach.create({
      data: {
        id,
        date: input.date,
        target: input.target,
        assetId: input.assetId ?? null,
        outcome: input.outcome,
        reviewedBy: input.reviewedBy,
      },
    });
  }
  await db.auditEvent.create({
    data: { action: `authority.outreach.${input.outcome}`, entityType: "Outreach", entityId: id, metadata: { target: input.target, assetId: input.assetId, source: "api.authority.outreach.prisma" } },
  });

  return { ok: true, value: outreachFromRow(existing ?? { id, ...input, reviewedBy: input.reviewedBy }), duplicate: Boolean(existing) };
}

export async function listOutreachForServer(): Promise<OutreachRecord[]> {
  if (!isPrismaAuthorityStorage()) return listOutreach();
  const db = prisma();
  const rows = (await db.authorityOutreach.findMany({ orderBy: { createdAt: "desc" } })) as Array<Record<string, unknown>>;
  return rows.map(outreachFromRow);
}

/** Deterministic outreach id shared with the memory path (registry.ts). */
function registerAuthorityAssetIdForOutreach(input: Omit<OutreachEntry, "id">): string {
  let hash = 0;
  const seed = `${input.target}:${input.assetId ?? ""}:${input.date}`;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `outreach_${hash.toString(36)}`;
}

export type { OutreachOutcome };
