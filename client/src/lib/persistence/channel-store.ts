import "server-only";
import { createHash } from "node:crypto";
import {
  BROKER_CHANNEL_TOP_MATCH_LIMIT,
  acceptChannelMatch,
  cancelChannelDeal,
  channelDashboard,
  closeChannelDeal,
  confirmChannelDeal,
  createChannelRequest,
  getChannelDeal,
  getOwnChannelRequest,
  isVerifiedForBrokerChannel,
  listChannelDeals,
  listChannelMatches,
  listChannelNotifications,
  listOwnChannelRequests,
  markChannelNotificationRead,
  publishChannelRequest,
  rejectChannelMatch,
  saveChannelDealSplit,
  sanitizeChannelSummary,
  scoreChannelMatch,
  transitionOwnChannelRequest,
  validateChannelRequest,
  type ChannelDealCloseMode,
  type ChannelDealRecord,
  type ChannelMatchRecord,
  type ChannelNotificationRecord,
  type ChannelRequestInput,
  type ChannelRequestRecord,
  type ErpnextCloseWriteRecord,
  type MatchReason,
  type SanitizedChannelMatch,
} from "@/lib/broker/channel";
import type { AuthSession } from "@/lib/auth/roles";
import { listBrokerDrafts, type ListingDraft } from "@/lib/broker/workflow";
import { getRequirementForOrganization, propertyTypeFromRequirement, type RequirementCategory, type RequirementRecord, type RequirementRole } from "@/lib/requirements";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type ChannelPrismaClient = ReturnType<typeof getPrismaClient> & {
  $transaction<T>(fn: (tx: ChannelPrismaClient) => Promise<T>): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  $queryRawUnsafe<T = unknown[]>(query: string, ...values: unknown[]): Promise<T>;
  brokerOrganization: { findUnique(args: unknown): Promise<unknown | null> };
  city: { findFirst(args: unknown): Promise<{ id: string; slug: string } | null> };
  listing: { findFirst(args: unknown): Promise<ListingSourceRow | null> };
  requirement: { findFirst(args: unknown): Promise<RequirementSourceRow | null> };
  channelRequest: { create(args: unknown): Promise<ChannelRequestRow>; findMany(args: unknown): Promise<ChannelRequestRow[]>; findFirst(args: unknown): Promise<ChannelRequestRow | null>; update(args: unknown): Promise<ChannelRequestRow>; updateMany(args: unknown): Promise<{ count: number }>; count(args: unknown): Promise<number> };
  channelMatch: { create(args: unknown): Promise<ChannelMatchRow>; findMany(args: unknown): Promise<ChannelMatchWithRequestsRow[]>; findFirst(args: unknown): Promise<ChannelMatchWithRequestsRow | null>; update(args: unknown): Promise<ChannelMatchRow>; count(args: unknown): Promise<number> };
  channelDeal: { create(args: unknown): Promise<ChannelDealRow>; findMany(args: unknown): Promise<ChannelDealRow[]>; findFirst(args: unknown): Promise<ChannelDealRow | null>; update(args: unknown): Promise<ChannelDealRow>; count(args: unknown): Promise<number> };
  commissionEntry: { create(args: unknown): Promise<unknown>; findMany(args: unknown): Promise<unknown[]>; count(args: unknown): Promise<number>; aggregate(args: unknown): Promise<{ _sum: { amountInr: bigint | number | null } }> };
  erpnextCloseWrite: { create(args: unknown): Promise<unknown>; findMany(args: unknown): Promise<ErpnextCloseWriteRow[]>; count(args: unknown): Promise<number>; update(args: unknown): Promise<ErpnextCloseWriteRow> };
  channelNotification: { create(args: unknown): Promise<ChannelNotificationRow>; findMany(args: unknown): Promise<ChannelNotificationRow[]>; count(args: unknown): Promise<number>; update(args: unknown): Promise<ChannelNotificationRow> };
  channelRequestSource: { create(args: unknown): Promise<unknown>; findFirst(args: unknown): Promise<unknown | null> };
};

const prisma = () => getPrismaClient() as unknown as ChannelPrismaClient;


type JsonObject = Record<string, unknown>;
type ChannelSourceRow = { sourceListingId?: string | null; sourceRequirementId?: string | null };
type ChannelRequestRow = JsonObject & {
  id: string; organizationId: string; createdById?: string | null; type: ChannelRequestRecord["type"]; cityId: string; localitySlug?: string | null; intent: string; propertyType: string; bhkMin?: unknown; bhkMax?: unknown; areaMinSqft?: unknown; areaMaxSqft?: unknown; budgetMinInr?: unknown; budgetMaxInr?: unknown; priceInr?: unknown; detailSummary: string; sourceListingId?: string | null; sourceRequirementId?: string | null; source?: ChannelSourceRow | null; status: ChannelRequestRecord["status"]; expiresAt: unknown; publishedAt?: unknown; closedAt?: unknown; revision?: unknown; createdAt: unknown; updatedAt: unknown;
};
type ChannelMatchRow = JsonObject & { id: string; demandRequestId: string; supplyRequestId: string; score: unknown; reasons?: unknown; status: ChannelMatchRecord["status"]; createdBy?: string | null; createdAt: unknown; updatedAt: unknown };
type ChannelDealRow = JsonObject & { id: string; matchId: string; demandOrganizationId: string; supplyOrganizationId: string; demandContactUserId?: string | null; supplyContactUserId?: string | null; status: ChannelDealRecord["status"]; closeMode: ChannelDealCloseMode; splitAgreement?: Record<string, unknown> | null; totalCommissionInr?: unknown; demandBrokerShareInr?: unknown; supplyBrokerShareInr?: unknown; demandBrokerConfirmAt?: unknown; supplyBrokerConfirmAt?: unknown; closedAt?: unknown; closeVersion?: unknown; erpnextSyncStatus: ChannelDealRecord["erpnextSyncStatus"]; createdAt: unknown; updatedAt: unknown };
type ChannelNotificationRow = JsonObject & { id: string; organizationId: string; userId?: string | null; eventType: string; title: string; body: string; entityType: string; entityId: string; readAt?: unknown; createdAt: unknown };
type ErpnextCloseWriteRow = JsonObject & { id: string; channelDealId: string; organizationId: string; idempotencyKey: string; payloadHash: string; status: ErpnextCloseWriteRecord["status"]; attemptCount?: unknown; lastError?: string | null; nextRetryAt?: unknown; erpnextDocId?: string | null; processedAt?: unknown; createdAt: unknown; updatedAt: unknown };
type ListingSourceRow = JsonObject & { id: string; stableId?: string | null; lifecycle?: string | null; cityId: string; propertyType?: string | null; bhk?: unknown; areaSqft?: unknown; priceInr?: unknown; locality?: { slug?: string | null } | null };
type RequirementLocalityRow = { locality?: { slug?: string | null } | null };
type RequirementSourceRow = JsonObject & { id: string; intent?: string | null; city?: { slug?: string | null } | null; category?: string | null; subtype?: string | null; propertyType?: string | null; bhkMin?: unknown; bhkMax?: unknown; areaMinSqft?: unknown; areaMaxSqft?: unknown; budgetMinInr?: unknown; budgetMaxInr?: unknown; localities?: RequirementLocalityRow[] | null; role?: string | null; status?: string | null; createdAt?: unknown };
type ChannelMatchWithRequestsRow = ChannelMatchRow & { demandRequest: ChannelRequestRow & { organization?: BrokerOrganizationRow | null }; supplyRequest: ChannelRequestRow & { organization?: BrokerOrganizationRow | null } };
type BrokerOrganizationRow = { id: string; name?: string | null; verificationStatus?: string | null; businessPhoneE164?: string | null; businessPhoneMasked?: string | null };
type ChannelDealWithMatchRow = ChannelDealRow & { match?: { demandRequest?: ChannelRequestRow | null; supplyRequest?: ChannelRequestRow | null } | null };
type ScoredPrismaCandidate = { demand: ChannelRequestRecord; supply: ChannelRequestRecord; score: number; reasons: MatchReason[] };

function isScoredPrismaCandidate(value: ScoredPrismaCandidate | null): value is ScoredPrismaCandidate {
  return value !== null;
}

function publicRequestForMatch(request: ChannelRequestRecord): SanitizedChannelMatch["ownRequest"] {
  const { sourceListingId: _sourceListingId, sourceRequirementId: _sourceRequirementId, createdById: _createdById, ...publicRequest } = request;
  void _sourceListingId;
  void _sourceRequirementId;
  void _createdById;
  return publicRequest;
}

function brokerSystemSessionForRequest(request: ChannelRequestRecord): AuthSession {
  return {
    user: { id: request.createdById, name: "System", email: "system", role: "BROKER_ADMIN" },
    organization: { id: request.organizationId, slug: request.organizationId, name: request.organizationId, verificationStatus: "VERIFIED_PARTNER" },
    permissions: ["broker.channel.write"],
    source: "better-auth-contract-demo",
  };
}

type Failure = { ok: false; status: number; errors: string[] };
type Success<T> = { ok: true } & T;

function fail(status: number, ...errors: string[]): Failure {
  return { ok: false, status, errors };
}

function isFailure(value: ChannelRequestInput | Failure): value is Failure {
  return "ok" in value && value.ok === false;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toDate(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function toDateOrNull(value: unknown): string | null {
  return value ? toDate(value) : null;
}

function requestFromRow(row: ChannelRequestRow): ChannelRequestRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdById: row.createdById ?? "",
    type: row.type,
    cityId: row.cityId,
    localitySlug: row.localitySlug ?? null,
    intent: row.intent,
    propertyType: row.propertyType,
    bhkMin: toNumber(row.bhkMin),
    bhkMax: toNumber(row.bhkMax),
    areaMinSqft: toNumber(row.areaMinSqft),
    areaMaxSqft: toNumber(row.areaMaxSqft),
    budgetMinInr: toNumber(row.budgetMinInr),
    budgetMaxInr: toNumber(row.budgetMaxInr),
    priceInr: toNumber(row.priceInr),
    detailSummary: row.detailSummary,
    sourceListingId: row.sourceListingId ?? row.source?.sourceListingId ?? null,
    sourceRequirementId: row.sourceRequirementId ?? row.source?.sourceRequirementId ?? null,
    status: row.status,
    expiresAt: toDate(row.expiresAt),
    publishedAt: toDateOrNull(row.publishedAt),
    closedAt: toDateOrNull(row.closedAt),
    revision: Number(row.revision ?? 1),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function matchFromRow(row: ChannelMatchRow): ChannelMatchRecord {
  return {
    id: row.id,
    demandRequestId: row.demandRequestId,
    supplyRequestId: row.supplyRequestId,
    score: Number(row.score),
    reasons: Array.isArray(row.reasons) ? row.reasons as MatchReason[] : [],
    status: row.status,
    createdBy: row.createdBy ?? "system",
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function dealFromRow(row: ChannelDealRow): ChannelDealRecord {
  return {
    id: row.id,
    matchId: row.matchId,
    demandOrganizationId: row.demandOrganizationId,
    supplyOrganizationId: row.supplyOrganizationId,
    demandContactUserId: row.demandContactUserId ?? null,
    supplyContactUserId: row.supplyContactUserId ?? null,
    status: row.status,
    closeMode: row.closeMode,
    splitAgreement: row.splitAgreement ?? null,
    totalCommissionInr: toNumber(row.totalCommissionInr),
    demandBrokerShareInr: toNumber(row.demandBrokerShareInr),
    supplyBrokerShareInr: toNumber(row.supplyBrokerShareInr),
    demandBrokerConfirmAt: toDateOrNull(row.demandBrokerConfirmAt),
    supplyBrokerConfirmAt: toDateOrNull(row.supplyBrokerConfirmAt),
    closedAt: toDateOrNull(row.closedAt),
    closeVersion: Number(row.closeVersion ?? 1),
    erpnextSyncStatus: row.erpnextSyncStatus,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function notificationFromRow(row: ChannelNotificationRow): ChannelNotificationRecord {
  return { id: row.id, organizationId: row.organizationId, userId: row.userId ?? null, eventType: row.eventType, title: row.title, body: row.body, entityType: row.entityType, entityId: row.entityId, readAt: toDateOrNull(row.readAt), createdAt: toDate(row.createdAt) };
}

function erpWriteFromRow(row: ErpnextCloseWriteRow): ErpnextCloseWriteRecord {
  return { id: row.id, channelDealId: row.channelDealId, organizationId: row.organizationId, idempotencyKey: row.idempotencyKey, payloadHash: row.payloadHash, status: row.status, attemptCount: Number(row.attemptCount ?? 0), lastError: row.lastError ?? null, nextRetryAt: toDateOrNull(row.nextRetryAt), erpnextDocId: row.erpnextDocId ?? null, processedAt: toDateOrNull(row.processedAt), createdAt: toDate(row.createdAt), updatedAt: toDate(row.updatedAt) };
}

async function withOrg<T>(db: ChannelPrismaClient, organizationId: string, fn: (tx: ChannelPrismaClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT set_config('app.current_org_id', $1, true)", organizationId);
    return fn(tx);
  });
}

async function setTenantOrg(db: ChannelPrismaClient, organizationId: string) {
  await db.$executeRawUnsafe("SELECT set_config('app.current_org_id', $1, true)", organizationId);
}

async function createNotification(db: ChannelPrismaClient, organizationId: string, eventType: string, title: string, body: string, entityType: string, entityId: string, userId: string | null = null) {
  await setTenantOrg(db, organizationId);
  await db.channelNotification.create({ data: { organizationId, eventType, title, body, entityType, entityId, userId } });
}

function normalizeInput(input: ChannelRequestInput, cityId?: string) {
  const type = input.type;
  return {
    type,
    cityId: cityId ?? String(input.cityId).trim(),
    localitySlug: input.localitySlug ? String(input.localitySlug).trim().toLowerCase() : null,
    intent: String(input.intent).trim().toUpperCase() === "RENT" ? "RENT" : "BUY",
    propertyType: String(input.propertyType || "APARTMENT").trim().toUpperCase().replace(/[^A-Z_]/g, "_"),
    bhkMin: input.bhkMin ?? null,
    bhkMax: input.bhkMax ?? null,
    areaMinSqft: input.areaMinSqft ?? null,
    areaMaxSqft: input.areaMaxSqft ?? null,
    budgetMinInr: type === "DEMAND" && input.budgetMinInr != null ? BigInt(Math.round(Number(input.budgetMinInr))) : null,
    budgetMaxInr: type === "DEMAND" && input.budgetMaxInr != null ? BigInt(Math.round(Number(input.budgetMaxInr))) : null,
    priceInr: type === "SUPPLY" && input.priceInr != null ? BigInt(Math.round(Number(input.priceInr))) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
}

const LISTING_BACKED_SUPPLY_NOTE = "Listing-backed supply; matching facts are read from the source listing.";
const CHANNEL_LISTING_BLOCKED_LIFECYCLES = new Set(["ARCHIVED", "REJECTED", "REMOVED", "DUPLICATE"]);

type ListingBackedSupply = {
  id: string;
  stableId?: string | null;
  lifecycle?: string | null;
  status?: string | null;
  cityId: string;
  citySlug?: string | null;
  localitySlug: string | null;
  propertyType: string;
  bhk: number | null;
  areaSqft: number | null;
  priceInr: number | null;
};

function supplyInputFromListing(input: ChannelRequestInput, listing: ListingBackedSupply): ChannelRequestInput {
  return {
    ...input,
    type: "SUPPLY",
    sourceListingId: listing.id,
    cityId: listing.cityId || listing.citySlug || input.cityId,
    localitySlug: listing.localitySlug,
    propertyType: listing.propertyType,
    bhkMin: listing.bhk,
    bhkMax: listing.bhk,
    areaMinSqft: listing.areaSqft,
    areaMaxSqft: listing.areaSqft,
    budgetMinInr: null,
    budgetMaxInr: null,
    priceInr: listing.priceInr,
    detailSummary: input.detailSummary || LISTING_BACKED_SUPPLY_NOTE,
  };
}

function memoryListingBackedSupply(input: ChannelRequestInput, session: AuthSession): ChannelRequestInput | Failure {
  if (input.type !== "SUPPLY") return input;
  const organizationId = session.organization?.id;
  const sourceId = String(input.sourceListingId ?? "").trim();
  if (!organizationId || !sourceId) return fail(400, "Create a listing first, then generate a SUPPLY channel request from that listing.");
  const draft = listBrokerDrafts(organizationId).find((item: ListingDraft) => item.id === sourceId || item.stableId === sourceId);
  if (!draft) return fail(404, "Source listing was not found for this broker organization.");
  if (CHANNEL_LISTING_BLOCKED_LIFECYCLES.has(draft.status)) return fail(409, "Archived, rejected, removed, or duplicate listings cannot generate broker-channel supply.");
  return supplyInputFromListing(input, { id: draft.stableId, stableId: draft.stableId, lifecycle: draft.status, cityId: draft.citySlug, citySlug: draft.citySlug, localitySlug: draft.localitySlug, propertyType: draft.propertyType, bhk: draft.bhk, areaSqft: draft.areaSqft, priceInr: draft.priceInr });
}

function demandInputFromRequirement(input: ChannelRequestInput, requirement: RequirementRecord): ChannelRequestInput {
  const localitySlug = requirement.localitySlugs[0] ?? null;
  return {
    ...input,
    type: "DEMAND",
    sourceRequirementId: requirement.id,
    cityId: requirement.citySlug,
    localitySlug,
    intent: requirement.intent.toUpperCase(),
    propertyType: propertyTypeFromRequirement(requirement),
    bhkMin: requirement.bhkMin ?? null,
    bhkMax: requirement.bhkMax ?? null,
    areaMinSqft: requirement.areaMinSqft ?? null,
    areaMaxSqft: requirement.areaMaxSqft ?? null,
    budgetMinInr: requirement.budgetMinInr ?? null,
    budgetMaxInr: requirement.budgetMaxInr ?? null,
    priceInr: null,
    detailSummary: input.detailSummary || "Requirement-backed demand; buyer contact and consent stay private.",
  };
}

function memoryRequirementBackedDemand(input: ChannelRequestInput, session: AuthSession): ChannelRequestInput | Failure {
  if (input.type !== "DEMAND") return input;
  const organizationId = session.organization?.id;
  const sourceId = String(input.sourceRequirementId ?? "").trim();
  if (!organizationId || !sourceId) return fail(400, "Create a buyer requirement first, then generate a DEMAND channel request from that requirement.");
  const requirement = getRequirementForOrganization(sourceId, organizationId);
  if (!requirement) return fail(404, "Source requirement was not found for this broker organization.");
  return demandInputFromRequirement(input, requirement);
}

async function prismaListingBackedSupply(dbClient: ChannelPrismaClient, input: ChannelRequestInput, session: AuthSession): Promise<ChannelRequestInput | Failure> {
  if (input.type !== "SUPPLY") return input;
  const organizationId = session.organization?.id;
  const sourceId = String(input.sourceListingId ?? "").trim();
  if (!organizationId || !sourceId) return fail(400, "Create a listing first, then generate a SUPPLY channel request from that listing.");
  const row = await dbClient.listing.findFirst({
    where: { brokerOrgId: organizationId, OR: [{ id: sourceId }, { stableId: sourceId }] },
    select: { id: true, stableId: true, lifecycle: true, cityId: true, propertyType: true, bhk: true, areaSqft: true, priceInr: true, locality: { select: { slug: true } } },
  }) as ListingSourceRow | null;
  if (!row) return fail(404, "Source listing was not found for this broker organization.");
  if (CHANNEL_LISTING_BLOCKED_LIFECYCLES.has(String(row.lifecycle))) return fail(409, "Archived, rejected, removed, or duplicate listings cannot generate broker-channel supply.");
  if (!row.priceInr || !row.propertyType || !row.cityId) return fail(409, "Source listing is missing property facts required for broker-channel matching.");
  const duplicate = await withOrg(dbClient, organizationId, (db) => db.channelRequestSource.findFirst({ where: { organizationId, sourceListingId: row.id } }));
  if (duplicate) return fail(409, "This listing already has a broker-channel supply request. Publish or update the existing request instead of duplicating it.");
  return supplyInputFromListing(input, { id: row.id, stableId: row.stableId, lifecycle: row.lifecycle, cityId: row.cityId, localitySlug: row.locality?.slug ?? null, propertyType: row.propertyType, bhk: toNumber(row.bhk), areaSqft: toNumber(row.areaSqft), priceInr: toNumber(row.priceInr) });
}

async function prismaRequirementBackedDemand(dbClient: ChannelPrismaClient, input: ChannelRequestInput, session: AuthSession, options: { checkDuplicate?: boolean } = { checkDuplicate: true }): Promise<ChannelRequestInput | Failure> {
  if (input.type !== "DEMAND") return input;
  const organizationId = session.organization?.id;
  const sourceId = String(input.sourceRequirementId ?? "").trim();
  if (!organizationId || !sourceId) return fail(400, "Create a buyer requirement first, then generate a DEMAND channel request from that requirement.");
  const row = await dbClient.requirement.findFirst({
    where: { id: sourceId, organizationId, deletedAt: null },
    include: { city: { select: { slug: true } }, localities: { include: { locality: { select: { slug: true } } }, orderBy: { priority: "asc" } } },
  }) as RequirementSourceRow | null;
  if (!row) return fail(404, "Source requirement was not found for this broker organization.");
  if (row.status && row.status !== "NEW") return fail(409, "Only active/new requirements can generate broker-channel demand.");
  if (!row.budgetMaxInr || !row.areaMinSqft || !row.areaMaxSqft) return fail(409, "Source requirement is missing budget and area facts required for broker-channel matching.");
  if (options.checkDuplicate !== false) {
    const duplicate = await withOrg(dbClient, organizationId, (db) => db.channelRequestSource.findFirst({ where: { organizationId, sourceRequirementId: row.id } }));
    if (duplicate) return fail(409, "This requirement already has a broker-channel demand request. Publish or update the existing request instead of duplicating it.");
  }
  const requirement: RequirementRecord = {
    id: row.id,
    intent: row.intent === "rent" ? "rent" : "buy",
    citySlug: row.city?.slug ?? input.cityId,
    category: (row.category ?? "residential") as RequirementCategory,
    subtype: row.subtype ?? "Flat/Apartment",
    propertyType: row.propertyType ?? propertyTypeFromRequirement({ subtype: row.subtype ?? "" }),
    bhkMin: toNumber(row.bhkMin),
    bhkMax: toNumber(row.bhkMax),
    areaMinSqft: toNumber(row.areaMinSqft),
    areaMaxSqft: toNumber(row.areaMaxSqft),
    budgetMinInr: toNumber(row.budgetMinInr),
    budgetMaxInr: toNumber(row.budgetMaxInr),
    organizationId,
    localitySlugs: (row.localities ?? []).map((item) => item.locality?.slug).filter(Boolean) as string[],
    role: (row.role ?? "buyer") as RequirementRole,
    name: "Private buyer",
    phoneMasked: "••••",
    consentText: "Stored privately",
    status: "NEW",
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date().toISOString(),
  };
  return demandInputFromRequirement(input, requirement);
}

async function refreshPrismaDemandFromRequirement(db: ChannelPrismaClient, request: ChannelRequestRecord): Promise<ChannelRequestRecord> {
  if (request.type !== "DEMAND" || !request.sourceRequirementId) return request;
  const row = await db.requirement.findFirst({
    where: { id: request.sourceRequirementId, organizationId: request.organizationId, deletedAt: null },
    include: { city: { select: { slug: true } }, localities: { include: { locality: { select: { slug: true } } }, orderBy: { priority: "asc" } } },
  }) as RequirementSourceRow | null;
  if (!row || (row.status && row.status !== "NEW")) return request;
  const hydrated = await prismaRequirementBackedDemand(db, { ...request, sourceRequirementId: row.id }, brokerSystemSessionForRequest(request), { checkDuplicate: false });
  if (isFailure(hydrated)) return request;
  const city = await db.city.findFirst({ where: { slug: String(hydrated.cityId).replace(/^city-/, "") }, select: { id: true, slug: true } });
  if (!city) return request;
  const normalized = normalizeInput(hydrated, city.id);
  const summary = sanitizeChannelSummary(hydrated);
  if (!summary.ok) return request;
  const updated = await db.channelRequest.update({ where: { id: request.id }, data: { ...normalized, detailSummary: summary.summary, revision: { increment: 1 } } });
  return requestFromRow({ ...(updated as ChannelRequestRow), sourceRequirementId: row.id });
}

async function refreshPrismaSupplyFromListing(db: ChannelPrismaClient, request: ChannelRequestRecord): Promise<ChannelRequestRecord> {
  if (request.type !== "SUPPLY" || !request.sourceListingId) return request;
  const row = await db.listing.findFirst({
    where: { id: request.sourceListingId, brokerOrgId: request.organizationId },
    select: { id: true, stableId: true, lifecycle: true, cityId: true, propertyType: true, bhk: true, areaSqft: true, priceInr: true, locality: { select: { slug: true } } },
  }) as ListingSourceRow | null;
  if (!row || CHANNEL_LISTING_BLOCKED_LIFECYCLES.has(String(row.lifecycle)) || !row.propertyType) return request;
  const hydrated = supplyInputFromListing(request, { id: row.id, stableId: row.stableId, lifecycle: row.lifecycle, cityId: row.cityId, localitySlug: row.locality?.slug ?? null, propertyType: row.propertyType, bhk: toNumber(row.bhk), areaSqft: toNumber(row.areaSqft), priceInr: toNumber(row.priceInr) });
  const normalized = normalizeInput(hydrated, row.cityId);
  const summary = sanitizeChannelSummary(hydrated);
  if (!summary.ok) return request;
  const updated = await db.channelRequest.update({
    where: { id: request.id },
    data: { ...normalized, detailSummary: summary.summary, revision: { increment: 1 } },
  });
  return requestFromRow({ ...(updated as ChannelRequestRow), sourceListingId: row.id });
}

export async function createChannelRequestForServer(input: ChannelRequestInput, session: AuthSession) {
  if (!isPrismaPersistence()) {
    let hydrated = memoryRequirementBackedDemand(input, session);
    if (isFailure(hydrated)) return hydrated;
    hydrated = memoryListingBackedSupply(hydrated, session);
    if (isFailure(hydrated)) return hydrated;
    return createChannelRequest(hydrated, session);
  }
  const organization = session.organization;
  if (!organization) return fail(403, "Broker organization is required.");
  const dbClient = prisma();
  let hydrated = await prismaRequirementBackedDemand(dbClient, input, session);
  if (isFailure(hydrated)) return hydrated;
  hydrated = await prismaListingBackedSupply(dbClient, hydrated, session);
  if (isFailure(hydrated)) return hydrated;
  const errors = validateChannelRequest(hydrated, session);
  if (errors.length) return fail(errors.some((error) => error.includes("permission") || error.includes("organization")) ? 403 : 400, ...errors);
  const summary = sanitizeChannelSummary(hydrated);
  if (!summary.ok) return summary;
  const cityLookup = String(hydrated.cityId).trim();
  const city = await dbClient.city.findFirst({ where: { OR: [{ id: cityLookup }, { slug: cityLookup.replace(/^city-/, "") }] }, select: { id: true, slug: true } });
  if (!city) return fail(400, "cityId must be an existing city id or slug.");
  const normalized = normalizeInput(hydrated, city.id);
  const created = await withOrg(dbClient, organization.id, async (db) => {
    const request = await db.channelRequest.create({
      data: {
        organizationId: organization.id,
        createdById: session.user.id,
        detailSummary: summary.summary,
        ...normalized,
      },
    });
    if (hydrated.sourceListingId || hydrated.sourceRequirementId) {
      await db.channelRequestSource.create({
        data: {
          channelRequestId: (request as { id: string }).id,
          organizationId: organization.id,
          sourceListingId: hydrated.sourceListingId ? String(hydrated.sourceListingId) : null,
          sourceRequirementId: hydrated.sourceRequirementId ? String(hydrated.sourceRequirementId) : null,
        },
      });
    }
    return request;
  });
  return { ok: true, request: requestFromRow(created) };
}

export async function listChannelRequestsForServer(session: AuthSession) {
  if (!isPrismaPersistence()) return listOwnChannelRequests(session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const rows = await withOrg(prisma(), session.organization.id, (db) => db.channelRequest.findMany({ where: { organizationId: session.organization!.id }, include: { source: true }, orderBy: [{ updatedAt: "desc" }] }));
  return { ok: true, requests: rows.map(requestFromRow) };
}

export async function getChannelRequestForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return getOwnChannelRequest(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelRequest.findFirst({ where: { id, organizationId: session.organization!.id }, include: { source: true } }));
  return row ? { ok: true, request: requestFromRow(row) } : fail(404, "Channel request was not found for this organization.");
}

function rangesOverlapForChannel(aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null) {
  if (aMin === null && aMax === null) return true;
  if (bMin === null && bMax === null) return true;
  const leftMin = aMin ?? aMax ?? 0;
  const leftMax = aMax ?? aMin ?? Number.MAX_SAFE_INTEGER;
  const rightMin = bMin ?? bMax ?? 0;
  const rightMax = bMax ?? bMin ?? Number.MAX_SAFE_INTEGER;
  return leftMin <= rightMax && rightMin <= leftMax;
}

async function createMatchesForPrismaRequest(db: ChannelPrismaClient, request: ChannelRequestRecord): Promise<ChannelMatchRecord[]> {
  const opposite = request.type === "DEMAND" ? "SUPPLY" : "DEMAND";
  const demandBudgetMax = request.type === "DEMAND" ? request.budgetMaxInr : null;
  const supplyPrice = request.type === "SUPPLY" ? request.priceInr : null;
  const bhkMin = request.bhkMin;
  const bhkMax = request.bhkMax;
  const localitySlug = request.localitySlug;
  const rows = await db.$queryRawUnsafe<ChannelRequestRow[]>(`
    SELECT r.*, o."name" as "organizationName", o."verificationStatus" as "orgVerificationStatus"
    FROM "ChannelRequestSanitized" r
    JOIN "BrokerOrganization" o ON o."id" = r."organizationId"
    WHERE r."status" = 'OPEN'
      AND r."type" = $1
      AND r."organizationId" <> $2
      AND r."cityId" = $3
      AND r."intent" = $4
      AND r."propertyType" = $5
      AND r."expiresAt" > now()
      AND o."verificationStatus" IN ('VERIFIED_PARTNER', 'RERA_VERIFIED')
      AND ($6::text IS NULL OR r."localitySlug" IS NULL OR r."localitySlug" = $6::text)
      AND ($7::integer IS NULL OR r."bhkMax" IS NULL OR r."bhkMax" >= $7::integer)
      AND ($8::integer IS NULL OR r."bhkMin" IS NULL OR r."bhkMin" <= $8::integer)
      AND ($9::bigint IS NULL OR r."priceInr" IS NULL OR r."priceInr" <= ($9::bigint * 110 / 100))
      AND ($10::bigint IS NULL OR r."budgetMaxInr" IS NULL OR $10::bigint <= (r."budgetMaxInr" * 110 / 100))
    ORDER BY r."publishedAt" DESC NULLS LAST, r."updatedAt" DESC
    LIMIT 200
  `, opposite, request.organizationId, request.cityId, request.intent, request.propertyType, localitySlug, bhkMin, bhkMax, demandBudgetMax, supplyPrice);
  const scored = rows.map((candidateRow) => {
    const candidate = requestFromRow({ ...candidateRow, createdById: "", sourceListingId: null, sourceRequirementId: null });
    const demand = request.type === "DEMAND" ? request : candidate;
    const supply = request.type === "SUPPLY" ? request : candidate;
    if (demand.localitySlug && supply.localitySlug && demand.localitySlug !== supply.localitySlug) return null;
    if (!rangesOverlapForChannel(demand.bhkMin, demand.bhkMax, supply.bhkMin, supply.bhkMax)) return null;
    if (supply.priceInr === null || demand.budgetMaxInr === null || supply.priceInr > Math.round(demand.budgetMaxInr * 1.1)) return null;
    const { score, reasons } = scoreChannelMatch(demand, supply);
    return score >= 40 ? { demand, supply, score, reasons } : null;
  }).filter(isScoredPrismaCandidate);
  const created: ChannelMatchRecord[] = [];
  for (const { demand, supply, score, reasons } of scored.sort((a, b) => b.score - a.score || b.supply.updatedAt.localeCompare(a.supply.updatedAt)).slice(0, BROKER_CHANNEL_TOP_MATCH_LIMIT)) {
    const existing = await db.channelMatch.findFirst({ where: { demandRequestId: demand.id, supplyRequestId: supply.id } });
    if (existing) {
      created.push(matchFromRow(existing));
      continue;
    }
    const match = matchFromRow(await db.channelMatch.create({ data: { demandRequestId: demand.id, supplyRequestId: supply.id, score, reasons, createdBy: "system" } }));
    await createNotification(db, demand.organizationId, "channel.match.suggested", "Top broker-channel match", `A ${score}/100 supply match is available.`, "ChannelMatch", match.id);
    await createNotification(db, supply.organizationId, "channel.match.suggested", "Top broker-channel match", `A ${score}/100 demand match is available.`, "ChannelMatch", match.id);
    created.push(match);
  }
  return created;
}

export async function publishChannelRequestForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return publishChannelRequest(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  if (!isVerifiedForBrokerChannel(session)) return fail(403, "Only verified partner or RERA-verified broker organizations can publish channel requests.");
  return withOrg(prisma(), session.organization.id, async (db) => {
    const existing = await db.channelRequest.findFirst({ where: { id, organizationId: session.organization!.id }, include: { source: true } });
    if (!existing) return fail(404, "Channel request was not found for this organization.");
    const current = requestFromRow(existing);
    if (["CLOSED", "CANCELLED", "EXPIRED"].includes(current.status)) return fail(409, "Closed, cancelled, or expired channel requests cannot be published.");
    const sourceFresh = current.type === "SUPPLY" ? await refreshPrismaSupplyFromListing(db, current) : await refreshPrismaDemandFromRequirement(db, current);
    const row = await db.channelRequest.update({ where: { id }, data: { status: "OPEN", publishedAt: sourceFresh.publishedAt ? new Date(sourceFresh.publishedAt) : new Date() } });
    const request = requestFromRow({ ...(row as ChannelRequestRow), sourceListingId: sourceFresh.sourceListingId, sourceRequirementId: sourceFresh.sourceRequirementId });
    const matches = await createMatchesForPrismaRequest(db, request);
    return { ok: true, request, matches };
  });
}

export async function closeChannelRequestForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return transitionOwnChannelRequest(id, "CLOSED", session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelRequest.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } }));
  return { ok: true, request: requestFromRow(row) };
}

export async function cancelChannelRequestForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return transitionOwnChannelRequest(id, "CANCELLED", session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelRequest.update({ where: { id }, data: { status: "CANCELLED" } }));
  return { ok: true, request: requestFromRow(row) };
}

export async function listChannelMatchesForServer(session: AuthSession) {
  if (!isPrismaPersistence()) return listChannelMatches(session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const rows = await withOrg(prisma(), session.organization.id, (db) => db.channelMatch.findMany({ where: { OR: [{ demandRequest: { organizationId: session.organization!.id } }, { supplyRequest: { organizationId: session.organization!.id } }] }, include: { demandRequest: { include: { organization: true } }, supplyRequest: { include: { organization: true } } }, orderBy: [{ score: "desc" }, { updatedAt: "desc" }], take: BROKER_CHANNEL_TOP_MATCH_LIMIT }));
  const matches: SanitizedChannelMatch[] = rows.map((row) => {
    const match = matchFromRow(row);
    const demand = requestFromRow(row.demandRequest);
    const supply = requestFromRow(row.supplyRequest);
    const ownRequest = demand.organizationId === session.organization!.id ? demand : supply;
    const counterpartyRequest = demand.organizationId === session.organization!.id ? supply : demand;
    const org = counterpartyRequest.organizationId === row.demandRequest?.organization?.id ? row.demandRequest.organization : row.supplyRequest?.organization;
    const digits = String(org?.businessPhoneE164 ?? "").replace(/\D/g, "");
    return { ...match, ownRequest: publicRequestForMatch(ownRequest), counterpartyRequest: publicRequestForMatch(counterpartyRequest), counterpartyBroker: { organizationId: counterpartyRequest.organizationId, organizationName: org?.name ?? counterpartyRequest.organizationId, verificationStatus: org?.verificationStatus ?? "UNKNOWN", contactName: null, contactRole: "assigned-agent", businessPhoneMasked: org?.businessPhoneMasked ?? null, businessPhoneProvided: Boolean(digits), waMeLink: digits ? `https://wa.me/${digits}` : null } };
  });
  return { ok: true, matches };
}

export async function acceptChannelMatchForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return acceptChannelMatch(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  if (!isVerifiedForBrokerChannel(session)) return fail(403, "Only verified broker organizations can accept channel matches.");
  return withOrg(prisma(), session.organization.id, async (db) => {
    const row = await db.channelMatch.findFirst({ where: { id, OR: [{ demandRequest: { organizationId: session.organization!.id } }, { supplyRequest: { organizationId: session.organization!.id } }] }, include: { demandRequest: true, supplyRequest: true } });
    if (!row) return fail(404, "Channel match was not found for this organization.");
    const existingDeal = await db.channelDeal.findFirst({ where: { matchId: id } });
    if (existingDeal) return { ok: true, match: matchFromRow(row), deal: dealFromRow(existingDeal) };
    const match = matchFromRow(row);
    if (match.status !== "SUGGESTED") return fail(409, "Only suggested matches can be accepted.");
    const demand = requestFromRow(row.demandRequest);
    const supply = requestFromRow(row.supplyRequest);
    await db.channelMatch.update({ where: { id }, data: { status: "ACCEPTED" } });
    const deal = dealFromRow(await db.channelDeal.create({ data: { matchId: id, demandOrganizationId: demand.organizationId, supplyOrganizationId: supply.organizationId, demandContactUserId: demand.createdById || null, supplyContactUserId: supply.createdById || null } }));
    await db.channelMatch.update({ where: { id }, data: { status: "DEAL_CREATED" } });
    await setTenantOrg(db, demand.organizationId);
    await db.channelRequest.update({ where: { id: demand.id }, data: { status: "MATCHED" } });
    await setTenantOrg(db, supply.organizationId);
    await db.channelRequest.update({ where: { id: supply.id }, data: { status: "MATCHED" } });
    await createNotification(db, demand.organizationId, "channel.deal.created", "Broker-channel deal created", "A suggested match has been accepted and moved into deal workflow.", "ChannelDeal", deal.id);
    await createNotification(db, supply.organizationId, "channel.deal.created", "Broker-channel deal created", "A suggested match has been accepted and moved into deal workflow.", "ChannelDeal", deal.id);
    return { ok: true, match: { ...match, status: "DEAL_CREATED" as const }, deal };
  });
}

export async function rejectChannelMatchForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return rejectChannelMatch(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelMatch.update({ where: { id }, data: { status: "REJECTED" } }));
  return { ok: true, match: matchFromRow(row) };
}

export async function listChannelDealsForServer(session: AuthSession) {
  if (!isPrismaPersistence()) return listChannelDeals(session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const rows = await withOrg(prisma(), session.organization.id, (db) => db.channelDeal.findMany({ where: { OR: [{ demandOrganizationId: session.organization!.id }, { supplyOrganizationId: session.organization!.id }] }, orderBy: { updatedAt: "desc" } }));
  return { ok: true, deals: rows.map(dealFromRow) };
}

export async function getChannelDealForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return getChannelDeal(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelDeal.findFirst({ where: { id, OR: [{ demandOrganizationId: session.organization!.id }, { supplyOrganizationId: session.organization!.id }] } }));
  return row ? { ok: true, deal: dealFromRow(row) } : fail(404, "Channel deal was not found for this organization.");
}

export async function saveChannelDealSplitForServer(id: string, input: { totalCommissionInr?: unknown; demandBrokerShareInr?: unknown; supplyBrokerShareInr?: unknown; splitAgreement?: Record<string, unknown>; closeMode?: ChannelDealCloseMode }, session: AuthSession) {
  if (!isPrismaPersistence()) return saveChannelDealSplit(id, input, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const total = toNumber(input.totalCommissionInr);
  const demandShare = toNumber(input.demandBrokerShareInr);
  const supplyShare = toNumber(input.supplyBrokerShareInr);
  if (total === null || demandShare === null || supplyShare === null) return fail(400, "totalCommissionInr, demandBrokerShareInr, and supplyBrokerShareInr are required.");
  if (demandShare + supplyShare !== total) return fail(400, "Commission split must add up to totalCommissionInr.");
  const row = await withOrg(prisma(), session.organization.id, async (db) => {
    const deal = await db.channelDeal.update({ where: { id }, data: { totalCommissionInr: BigInt(total), demandBrokerShareInr: BigInt(demandShare), supplyBrokerShareInr: BigInt(supplyShare), splitAgreement: input.splitAgreement ?? { type: "negotiated", summary: "Negotiated broker-channel split." }, closeMode: input.closeMode === "SINGLE" ? "SINGLE" : "DUAL" } });
    const parsed = dealFromRow(deal);
    await createNotification(db, parsed.demandOrganizationId, "channel.deal.split_saved", "Commission split saved", "A negotiated broker-channel commission split was recorded.", "ChannelDeal", parsed.id);
    await createNotification(db, parsed.supplyOrganizationId, "channel.deal.split_saved", "Commission split saved", "A negotiated broker-channel commission split was recorded.", "ChannelDeal", parsed.id);
    return deal;
  });
  return { ok: true, deal: dealFromRow(row) };
}

async function createCloseRecordsForPrisma(db: ChannelPrismaClient, deal: ChannelDealRecord, session: AuthSession) {
  if (await db.commissionEntry.count({ where: { dealId: deal.id } })) return;
  const entries = [
    { organizationId: deal.demandOrganizationId, amount: deal.demandBrokerShareInr ?? 0 },
    { organizationId: deal.supplyOrganizationId, amount: deal.supplyBrokerShareInr ?? 0 },
  ];
  for (const entry of entries) {
    await setTenantOrg(db, entry.organizationId);
    await db.commissionEntry.create({ data: { organizationId: entry.organizationId, dealId: deal.id, entryType: "COMMISSION_INCOME", amountInr: BigInt(entry.amount), employeeId: session.user.id, description: `Broker channel commission for ${deal.id}`, entryDate: new Date(), recordedById: session.user.id } });
    const idempotencyKey = `channel.close.v${deal.closeVersion}.${deal.id}.${entry.organizationId}`;
    const payloadHash = createHash("sha256").update(`${idempotencyKey}:${entry.amount}`).digest("hex");
    await db.erpnextCloseWrite.create({ data: { channelDealId: deal.id, organizationId: entry.organizationId, idempotencyKey, payloadHash } });
  }
}

async function closeOrConfirmPrisma(id: string, session: AuthSession) {
  const organization = session.organization;
  if (!organization) return fail(403, "Broker organization is required.");
  return withOrg(prisma(), organization.id, async (db) => {
    const row = await db.channelDeal.findFirst({ where: { id, OR: [{ demandOrganizationId: organization.id }, { supplyOrganizationId: organization.id }] } });
    if (!row) return fail(404, "Channel deal was not found for this organization.");
    const deal = dealFromRow(row);
    if (deal.status === "CLOSED") return { ok: true, deal };
    if (deal.totalCommissionInr === null || (deal.demandBrokerShareInr ?? 0) + (deal.supplyBrokerShareInr ?? 0) !== deal.totalCommissionInr) return fail(400, "Commission split must be saved before close.");
    const data: Record<string, unknown> = {};
    if (organization.id === deal.demandOrganizationId) data.demandBrokerConfirmAt = deal.demandBrokerConfirmAt ? new Date(deal.demandBrokerConfirmAt) : new Date();
    if (organization.id === deal.supplyOrganizationId) data.supplyBrokerConfirmAt = deal.supplyBrokerConfirmAt ? new Date(deal.supplyBrokerConfirmAt) : new Date();
    const dualComplete = (data.demandBrokerConfirmAt || deal.demandBrokerConfirmAt) && (data.supplyBrokerConfirmAt || deal.supplyBrokerConfirmAt);
    data.status = deal.closeMode === "SINGLE" || dualComplete ? "CLOSED" : "PENDING_OTHER_CLOSE";
    if (data.status === "CLOSED") data.closedAt = new Date();
    const updated = dealFromRow(await db.channelDeal.update({ where: { id }, data }));
    if (updated.status === "CLOSED") {
      await createCloseRecordsForPrisma(db, updated, session);
      await createNotification(db, updated.demandOrganizationId, "channel.deal.closed", "Broker-channel deal closed", "Commission entries and ERPNext sync jobs were created.", "ChannelDeal", updated.id);
      await createNotification(db, updated.supplyOrganizationId, "channel.deal.closed", "Broker-channel deal closed", "Commission entries and ERPNext sync jobs were created.", "ChannelDeal", updated.id);
    }
    return { ok: true, deal: updated };
  });
}

export async function confirmChannelDealForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return confirmChannelDeal(id, session);
  return closeOrConfirmPrisma(id, session);
}

export async function closeChannelDealForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return closeChannelDeal(id, session);
  return closeOrConfirmPrisma(id, session);
}

export async function cancelChannelDealForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return cancelChannelDeal(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelDeal.update({ where: { id }, data: { status: "CANCELLED" } }));
  return { ok: true, deal: dealFromRow(row) };
}

export async function listChannelNotificationsForServer(session: AuthSession) {
  if (!isPrismaPersistence()) return listChannelNotifications(session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const rows = await withOrg(prisma(), session.organization.id, (db) => db.channelNotification.findMany({ where: { organizationId: session.organization!.id }, orderBy: { createdAt: "desc" }, take: 100 }));
  return { ok: true, notifications: rows.map(notificationFromRow) };
}

export async function markChannelNotificationReadForServer(id: string, session: AuthSession) {
  if (!isPrismaPersistence()) return markChannelNotificationRead(id, session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const row = await withOrg(prisma(), session.organization.id, (db) => db.channelNotification.update({ where: { id }, data: { readAt: new Date() } }));
  return { ok: true, notification: notificationFromRow(row) };
}

export async function channelDashboardForServer(session: AuthSession) {
  if (!isPrismaPersistence()) return channelDashboard(session);
  if (!session.organization) return fail(403, "Broker organization is required.");
  const dashboard = await withOrg(prisma(), session.organization.id, async (db) => {
    const [openRequests, suggestedMatches, activeDeals, closedDeals, commission, erpnextPendingWrites, unreadNotifications] = await Promise.all([
      db.channelRequest.count({ where: { organizationId: session.organization!.id, status: "OPEN" } }),
      db.channelMatch.count({ where: { status: "SUGGESTED", OR: [{ demandRequest: { organizationId: session.organization!.id } }, { supplyRequest: { organizationId: session.organization!.id } }] } }),
      db.channelDeal.count({ where: { OR: [{ demandOrganizationId: session.organization!.id }, { supplyOrganizationId: session.organization!.id }], status: { in: ["OPEN", "PENDING_OTHER_CLOSE"] } } }),
      db.channelDeal.count({ where: { OR: [{ demandOrganizationId: session.organization!.id }, { supplyOrganizationId: session.organization!.id }], status: "CLOSED" } }),
      db.commissionEntry.aggregate({ where: { organizationId: session.organization!.id }, _sum: { amountInr: true } }),
      db.erpnextCloseWrite.count({ where: { organizationId: session.organization!.id, status: { in: ["PENDING", "FAILED"] } } }),
      db.channelNotification.count({ where: { organizationId: session.organization!.id, readAt: null } }),
    ]);
    return { openRequests, suggestedMatches, activeDeals, closedDeals, commissionTotalInr: toNumber(commission._sum.amountInr) ?? 0, erpnextPendingWrites, unreadNotifications };
  });
  return { ok: true, dashboard };
}

export async function expireChannelRequestsForServer(session: AuthSession, now = new Date()): Promise<Success<{ expired: number }> | Failure> {
  if (!isPrismaPersistence()) return { ok: true, expired: 0 };
  if (!session.organization) return fail(403, "Broker organization is required.");
  const result = await withOrg(prisma(), session.organization.id, (db) => db.channelRequest.updateMany({ where: { organizationId: session.organization!.id, status: "OPEN", expiresAt: { lt: now } }, data: { status: "EXPIRED" } })) as { count?: number };
  return { ok: true, expired: Number(result.count ?? 0) };
}

export async function pendingErpnextCloseWritesForServer(limit = 25, organizationId?: string): Promise<ErpnextCloseWriteRecord[]> {
  if (!isPrismaPersistence() || !organizationId) return [];
  const rows = await withOrg(prisma(), organizationId, (db) => db.erpnextCloseWrite.findMany({ where: { organizationId, status: { in: ["PENDING", "FAILED"] }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] }, orderBy: { createdAt: "asc" }, take: limit }));
  return rows.map(erpWriteFromRow);
}

export async function markErpnextCloseWriteForServer(id: string, organizationId: string, status: "IN_FLIGHT" | "SUCCESS" | "FAILED" | "RECONCILED", data: { erpnextDocId?: string | null; lastError?: string | null } = {}) {
  if (!isPrismaPersistence()) return null;
  return withOrg(prisma(), organizationId, (db) => db.erpnextCloseWrite.update({ where: { id }, data: { status, ...data, processedAt: status === "SUCCESS" ? new Date() : undefined, attemptCount: status === "IN_FLIGHT" ? { increment: 1 } : undefined, nextRetryAt: status === "FAILED" ? new Date(Date.now() + 15 * 60 * 1000) : undefined } }));
}

export async function processPendingErpnextCloseWritesForServer(session: AuthSession, limit = 10) {
  const endpoint = process.env.BROKER_CHANNEL_ERPNEXT_URL;
  const token = process.env.BROKER_CHANNEL_ERPNEXT_TOKEN;
  if (!endpoint) return { ok: true as const, processed: 0, skipped: true, reason: "BROKER_CHANNEL_ERPNEXT_URL is not configured." };
  if (!session.organization) return { ok: false as const, processed: 0, errors: ["Broker organization is required."] };
  if (!isPrismaPersistence()) return { ok: true as const, processed: 0, skipped: true, reason: "ERPNext sync worker requires Prisma persistence." };
  const writes = await pendingErpnextCloseWritesForServer(limit, session.organization.id);
  let processed = 0;
  const errors: string[] = [];
  for (const write of writes) {
    await markErpnextCloseWriteForServer(write.id, write.organizationId, "IN_FLIGHT");
    try {
      const db = prisma();
      const dealRow = await withOrg(db, write.organizationId, (tx) => tx.channelDeal.findFirst({ where: { id: write.channelDealId }, include: { match: { include: { demandRequest: true, supplyRequest: true } } } })) as ChannelDealWithMatchRow | null;
      const deal = dealRow ? dealFromRow(dealRow) : null;
      const demand = dealRow?.match?.demandRequest ? requestFromRow(dealRow.match.demandRequest) : null;
      const supply = dealRow?.match?.supplyRequest ? requestFromRow(dealRow.match.supplyRequest) : null;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          idempotencyKey: write.idempotencyKey,
          source: "architech",
          channelDealId: write.channelDealId,
          closeVersion: deal?.closeVersion ?? 1,
          closeMode: deal?.closeMode ?? "DUAL",
          closedAt: deal?.closedAt,
          organizationId: write.organizationId,
          deal: deal ? {
            demandOrganizationId: deal.demandOrganizationId,
            supplyOrganizationId: deal.supplyOrganizationId,
            totalCommissionInr: deal.totalCommissionInr,
            demandBrokerShareInr: deal.demandBrokerShareInr,
            supplyBrokerShareInr: deal.supplyBrokerShareInr,
            splitAgreement: deal.splitAgreement,
          } : null,
          sanitizedProperty: {
            cityId: demand?.cityId ?? supply?.cityId ?? null,
            locality: demand?.localitySlug ?? supply?.localitySlug ?? null,
            propertyType: demand?.propertyType ?? supply?.propertyType ?? null,
            intent: demand?.intent ?? supply?.intent ?? null,
            bhk: supply?.bhkMin ?? demand?.bhkMin ?? null,
            priceInr: supply?.priceInr ?? null,
          },
        }),
      });
      const payload = await response.json().catch(() => ({})) as { erpnextChannelDealId?: string; erpnextDocId?: string; name?: string; message?: string };
      if (!response.ok) throw new Error(payload.message || `ERPNext sync failed with HTTP ${response.status}`);
      await markErpnextCloseWriteForServer(write.id, write.organizationId, "SUCCESS", { erpnextDocId: payload.erpnextChannelDealId ?? payload.erpnextDocId ?? payload.name ?? null });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ERPNext sync failure.";
      errors.push(`${write.id}: ${message}`);
      await markErpnextCloseWriteForServer(write.id, write.organizationId, "FAILED", { lastError: message });
    }
  }
  return { ok: errors.length === 0, processed, errors };
}
