import "server-only";
import { listOutreach, listRegistryAssets, recordOutreach, registerAuthorityAsset, type OutreachRecord, type RegistryAsset, type RegistryResult } from "./registry";
import { isPrismaAuthorityStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import type { AuthorityAsset, OutreachEntry, OutreachOutcome } from "./authority";

type AuthorityPrismaClient = ReturnType<typeof getPrismaClient> & {
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as AuthorityPrismaClient;

export async function registerAuthorityAssetForServer(input: Omit<AuthorityAsset, "id">): Promise<RegistryResult<RegistryAsset>> {
  const result = registerAuthorityAsset(input);
  if (!result.ok) return result;
  if (isPrismaAuthorityStorage()) {
    const db = prisma();
    await db.auditEvent.create({
      data: { action: "authority.asset.registered", entityType: "AuthorityAsset", entityId: result.value.id, metadata: { title: result.value.title, type: result.value.type, source: "api.authority.assets.prisma" } },
    });
  }
  return result;
}

export async function listRegistryAssetsForServer(): Promise<RegistryAsset[]> {
  return listRegistryAssets();
}

export async function recordOutreachForServer(input: Omit<OutreachEntry, "id"> & { reviewedBy: string }): Promise<RegistryResult<OutreachRecord>> {
  const result = recordOutreach(input);
  if (!result.ok) return result;
  if (isPrismaAuthorityStorage()) {
    const db = prisma();
    await db.auditEvent.create({
      data: { action: `authority.outreach.${input.outcome}`, entityType: "Outreach", entityId: result.value.id, metadata: { target: input.target, assetId: input.assetId, source: "api.authority.outreach.prisma" } },
    });
  }
  return result;
}

export async function listOutreachForServer(): Promise<OutreachRecord[]> {
  return listOutreach();
}

export type { OutreachOutcome };
