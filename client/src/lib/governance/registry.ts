/* Authority asset & outreach registry (P1-OFF-001).
   A durable, audited record of off-page authority assets and every outreach
   that references one. Uses the same compliance rules (validateAuthorityAsset /
   validateOutreach) already defined in `authority.ts`, and augments them with
   idempotency + listing. Deterministic, memory-backed default; prisma-backed via
   the server adapter. */

import { validateAuthorityAsset, validateOutreach, type AuthorityAsset, type OutreachEntry } from "./authority";

export type RegistryAsset = AuthorityAsset & { createdAt: string; updatedAt: string };

export type OutreachRecord = OutreachEntry & { reviewedBy: string; createdAt: string };

const assets = new Map<string, RegistryAsset>();
const outreach = new Map<string, OutreachRecord>();

function stableId(prefix: string, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

export type RegistryResult<T> = { ok: true; value: T; duplicate: boolean } | { ok: false; status: number; errors: string[] };

export function registerAuthorityAsset(input: Omit<AuthorityAsset, "id">): RegistryResult<RegistryAsset> {
  const asset: AuthorityAsset = { ...input, id: stableId("asset", `${input.title}:${input.type}`) };
  const decision = validateAuthorityAsset(asset);
  if (!decision.ok) return { ok: false, status: 400, errors: decision.reasons };

  const existing = assets.get(asset.id);
  if (existing) return { ok: true, value: existing, duplicate: true };

  const now = new Date().toISOString();
  const record: RegistryAsset = { ...asset, createdAt: now, updatedAt: now };
  assets.set(record.id, record);
  return { ok: true, value: record, duplicate: false };
}

export function listRegistryAssets(): RegistryAsset[] {
  return [...assets.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function recordOutreach(input: Omit<OutreachEntry, "id"> & { reviewedBy: string }): RegistryResult<OutreachRecord> {
  const id = stableId("outreach", `${input.target}:${input.assetId ?? ""}:${input.date}`);
  const registeredAssets = listRegistryAssets().map((asset): AuthorityAsset => ({ id: asset.id, type: asset.type, title: asset.title, url: asset.url, isNofollow: asset.isNofollow, paidForLink: asset.paidForLink, disclosure: asset.disclosure, relationshipRegistry: asset.relationshipRegistry }));
  const decision = validateOutreach({ ...input, id }, registeredAssets);
  if (!decision.ok) return { ok: false, status: 400, errors: decision.reasons };

  const existing = outreach.get(id);
  if (existing) return { ok: true, value: existing, duplicate: true };

  const now = new Date().toISOString();
  const record: OutreachRecord = { ...input, id, reviewedBy: input.reviewedBy, createdAt: now };
  outreach.set(id, record);
  return { ok: true, value: record, duplicate: false };
}

export function listOutreach(): OutreachRecord[] {
  return [...outreach.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resetAuthorityRegistryForTests() {
  assets.clear();
  outreach.clear();
}
