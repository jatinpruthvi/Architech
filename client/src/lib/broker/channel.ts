import { requirePermission, type AuthSession } from "@/lib/auth/roles";

export type ChannelRequestType = "DEMAND" | "SUPPLY";
export type ChannelRequestStatus = "DRAFT" | "OPEN" | "MATCHED" | "CLOSED" | "CANCELLED" | "EXPIRED";
export type ChannelMatchStatus = "SUGGESTED" | "ACCEPTED" | "REJECTED" | "DEAL_CREATED";
export type ChannelDealStatus = "OPEN" | "PENDING_OTHER_CLOSE" | "CLOSED" | "CANCELLED";
export type ChannelDealCloseMode = "SINGLE" | "DUAL";
export type ErpnextSyncStatus = "PENDING" | "IN_FLIGHT" | "SUCCESS" | "FAILED" | "RECONCILED";
export type CommissionEntryType = "COMMISSION_INCOME" | "COMMISSION_EXPENSE";

export type MatchReason = {
  factor: "locality" | "propertyType" | "budgetFit" | "bhkAreaFit" | "recency";
  weight: number;
  points: number;
  note: string;
};

export type ChannelRequestInput = {
  type: ChannelRequestType;
  cityId: string;
  localitySlug?: string | null;
  intent: "BUY" | "RENT" | string;
  propertyType: string;
  bhkMin?: number | null;
  bhkMax?: number | null;
  areaMinSqft?: number | null;
  areaMaxSqft?: number | null;
  budgetMinInr?: number | null;
  budgetMaxInr?: number | null;
  priceInr?: number | null;
  detailSummary?: string | null;
  sourceListingId?: string | null;
  sourceRequirementId?: string | null;
  expiresAt?: string | Date | null;
};

export type ChannelRequestRecord = Required<Omit<ChannelRequestInput, "expiresAt" | "detailSummary" | "localitySlug" | "sourceListingId" | "sourceRequirementId" | "bhkMin" | "bhkMax" | "areaMinSqft" | "areaMaxSqft" | "budgetMinInr" | "budgetMaxInr" | "priceInr">> & {
  id: string;
  organizationId: string;
  createdById: string;
  localitySlug: string | null;
  bhkMin: number | null;
  bhkMax: number | null;
  areaMinSqft: number | null;
  areaMaxSqft: number | null;
  budgetMinInr: number | null;
  budgetMaxInr: number | null;
  priceInr: number | null;
  detailSummary: string;
  sourceListingId: string | null;
  sourceRequirementId: string | null;
  status: ChannelRequestStatus;
  expiresAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type ChannelMatchRecord = {
  id: string;
  demandRequestId: string;
  supplyRequestId: string;
  score: number;
  reasons: MatchReason[];
  status: ChannelMatchStatus;
  createdBy: "system" | string;
  createdAt: string;
  updatedAt: string;
};

export type ChannelDealRecord = {
  id: string;
  matchId: string;
  demandOrganizationId: string;
  supplyOrganizationId: string;
  demandContactUserId: string | null;
  supplyContactUserId: string | null;
  status: ChannelDealStatus;
  closeMode: ChannelDealCloseMode;
  splitAgreement: Record<string, unknown> | null;
  totalCommissionInr: number | null;
  demandBrokerShareInr: number | null;
  supplyBrokerShareInr: number | null;
  demandBrokerConfirmAt: string | null;
  supplyBrokerConfirmAt: string | null;
  closedAt: string | null;
  closeVersion: number;
  erpnextSyncStatus: ErpnextSyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type CommissionEntryRecord = {
  id: string;
  organizationId: string;
  dealId: string;
  entryType: CommissionEntryType;
  amountInr: number;
  employeeId: string | null;
  description: string;
  entryDate: string;
  recordedById: string;
  erpnextDocId: string | null;
  createdAt: string;
};

export type ChannelNotificationRecord = {
  id: string;
  organizationId: string;
  userId: string | null;
  eventType: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
};

export type ErpnextCloseWriteRecord = {
  id: string;
  channelDealId: string;
  organizationId: string;
  idempotencyKey: string;
  payloadHash: string;
  status: ErpnextSyncStatus;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: string | null;
  erpnextDocId: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SanitizedChannelMatch = ChannelMatchRecord & {
  ownRequest: PublicChannelRequest;
  counterpartyRequest: PublicChannelRequest;
  counterpartyBroker: {
    organizationId: string;
    organizationName: string;
    verificationStatus: string;
    contactName: string | null;
    contactRole: "assigned-agent";
    businessPhoneMasked: string | null;
    businessPhoneProvided: boolean;
    waMeLink: string | null;
  };
};

export type PublicChannelRequest = Omit<ChannelRequestRecord, "sourceListingId" | "sourceRequirementId" | "createdById">;
export type ChannelResult<T> = { ok: true } & T | { ok: false; status: number; errors: string[] };

export const BROKER_CHANNEL_TOP_MATCH_LIMIT = 10;
const VERIFIED_STATUSES = new Set(["VERIFIED_PARTNER", "RERA_VERIFIED"]);
const ORGANIZATIONS = new Map<string, { id: string; name: string; verificationStatus: string; businessPhoneE164?: string; businessPhoneMasked?: string }>();
const REQUESTS = new Map<string, ChannelRequestRecord>();
const MATCHES = new Map<string, ChannelMatchRecord>();
const DEALS = new Map<string, ChannelDealRecord>();
const COMMISSIONS = new Map<string, CommissionEntryRecord>();
const ERP_WRITES = new Map<string, ErpnextCloseWriteRecord>();
const NOTIFICATIONS = new Map<string, ChannelNotificationRecord>();
let sequence = 1;

function notifyChannel(organizationId: string, eventType: string, title: string, body: string, entityType: string, entityId: string, userId: string | null = null) {
  const notification: ChannelNotificationRecord = { id: nextId("channel_note"), organizationId, userId, eventType, title, body, entityType, entityId, readAt: null, createdAt: nowIso() };
  NOTIFICATIONS.set(notification.id, notification);
  return notification;
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix: string) {
  return `${prefix}_${sequence++}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeSlug(value?: string | null) {
  const cleaned = String(value ?? "").trim().toLowerCase();
  return cleaned ? cleaned.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : null;
}

function normalizeIntent(value: string) {
  return String(value).trim().toUpperCase() === "RENT" ? "RENT" : "BUY";
}

function normalizePropertyType(value: string) {
  return String(value || "APARTMENT").trim().toUpperCase().replace(/[^A-Z_]/g, "_");
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

export function isVerifiedForBrokerChannel(session: AuthSession | null | undefined): boolean {
  return Boolean(session?.organization && VERIFIED_STATUSES.has(session.organization.verificationStatus));
}

function canRead(session: AuthSession | null | undefined) {
  return requirePermission(session, "broker.channel.read") || requirePermission(session, "broker.dashboard.read");
}

function canWrite(session: AuthSession | null | undefined) {
  return requirePermission(session, "broker.channel.write");
}

const CONTACT_LIKE = /(?:\+?\d[\d\s().-]{7,}\d|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|whats\s*app|wa\.me|telegram|call\s*me|phone|mobile|contact)/i;

export function sanitizeChannelSummary(input: ChannelRequestInput): ChannelResult<{ summary: string }> {
  const raw = String(input.detailSummary ?? "").trim();
  if (raw && CONTACT_LIKE.test(raw)) {
    return { ok: false, status: 400, errors: ["Channel summary cannot contain contact details, raw messages, or identifying text."] };
  }
  const pieces = [
    normalizeIntent(input.intent),
    normalizePropertyType(input.propertyType).replaceAll("_", " ").toLowerCase(),
    input.localitySlug ? `in ${normalizeSlug(input.localitySlug)}` : "city-wide",
    input.type === "DEMAND" ? `budget ${toNumberOrNull(input.budgetMinInr) ?? 0}-${toNumberOrNull(input.budgetMaxInr) ?? 0}` : `price ${toNumberOrNull(input.priceInr) ?? 0}`,
    input.bhkMin || input.bhkMax ? `${toNumberOrNull(input.bhkMin) ?? toNumberOrNull(input.bhkMax)}-${toNumberOrNull(input.bhkMax) ?? toNumberOrNull(input.bhkMin)} BHK` : null,
    input.areaMinSqft || input.areaMaxSqft ? `${toNumberOrNull(input.areaMinSqft) ?? 0}-${toNumberOrNull(input.areaMaxSqft) ?? 0} sqft` : null,
  ].filter(Boolean).join(" · ");
  const summary = raw ? `${pieces} · ${raw.slice(0, 240)}` : pieces;
  return { ok: true, summary };
}

export function validateChannelRequest(input: Partial<ChannelRequestInput>, session: AuthSession | null | undefined): string[] {
  const errors: string[] = [];
  if (!session?.organization) errors.push("Broker organization is required.");
  if (!canWrite(session)) errors.push("Broker channel write permission is required.");
  if (!input.type || !["DEMAND", "SUPPLY"].includes(input.type)) errors.push("type must be DEMAND or SUPPLY.");
  if (!String(input.cityId ?? "").trim()) errors.push("cityId is required.");
  if (!String(input.intent ?? "").trim()) errors.push("intent is required.");
  if (!String(input.propertyType ?? "").trim()) errors.push("propertyType is required.");

  const budgetMin = toNumberOrNull(input.budgetMinInr);
  const budgetMax = toNumberOrNull(input.budgetMaxInr);
  const price = toNumberOrNull(input.priceInr);

  if (input.type === "DEMAND") {
    if (!input.sourceRequirementId || !String(input.sourceRequirementId).trim()) errors.push("DEMAND channel requests must be generated from an existing buyer requirement.");
    if (!budgetMin || !budgetMax) errors.push("DEMAND requires budgetMinInr and budgetMaxInr.");
    if (budgetMin && budgetMax && budgetMin > budgetMax) errors.push("DEMAND budgetMinInr cannot exceed budgetMaxInr.");
    if (price !== null) errors.push("DEMAND must not include priceInr.");
  }
  if (input.type === "SUPPLY") {
    if (!input.sourceListingId || !String(input.sourceListingId).trim()) errors.push("SUPPLY channel requests must be generated from an existing listing.");
    if (!price) errors.push("SUPPLY requires priceInr.");
    if (budgetMin !== null || budgetMax !== null) errors.push("SUPPLY must not include budgetMinInr or budgetMaxInr.");
  }
  const bhkMin = toNumberOrNull(input.bhkMin);
  const bhkMax = toNumberOrNull(input.bhkMax);
  if (bhkMin !== null && bhkMax !== null && bhkMin > bhkMax) errors.push("bhkMin cannot exceed bhkMax.");
  const areaMin = toNumberOrNull(input.areaMinSqft);
  const areaMax = toNumberOrNull(input.areaMaxSqft);
  if (areaMin !== null && areaMax !== null && areaMin > areaMax) errors.push("areaMinSqft cannot exceed areaMaxSqft.");
  const summary = sanitizeChannelSummary(input as ChannelRequestInput);
  if (!summary.ok) errors.push(...summary.errors);
  return errors;
}

export function createChannelRequest(input: ChannelRequestInput, session: AuthSession | null | undefined): ChannelResult<{ request: ChannelRequestRecord }> {
  const errors = validateChannelRequest(input, session);
  if (errors.length) return { ok: false, status: errors.some((error) => error.includes("permission") || error.includes("organization")) ? 403 : 400, errors };
  const summary = sanitizeChannelSummary(input);
  if (!summary.ok) return summary;
  if (input.type === "DEMAND" && input.sourceRequirementId) {
    const duplicate = [...REQUESTS.values()].find((request) => request.organizationId === session!.organization!.id && request.sourceRequirementId === String(input.sourceRequirementId));
    if (duplicate) return { ok: false, status: 409, errors: ["This requirement already has a broker-channel demand request. Publish or update the existing request instead of duplicating it."] };
  }
  if (input.type === "SUPPLY" && input.sourceListingId) {
    const duplicate = [...REQUESTS.values()].find((request) => request.organizationId === session!.organization!.id && request.sourceListingId === String(input.sourceListingId));
    if (duplicate) return { ok: false, status: 409, errors: ["This listing already has a broker-channel supply request. Publish or update the existing request instead of duplicating it."] };
  }
  const timestamp = nowIso();
  ORGANIZATIONS.set(session!.organization!.id, { id: session!.organization!.id, name: session!.organization!.name, verificationStatus: session!.organization!.verificationStatus, businessPhoneE164: session!.organization!.businessPhoneE164, businessPhoneMasked: session!.organization!.businessPhoneMasked });
  const request: ChannelRequestRecord = {
    id: nextId("channel_req"),
    organizationId: session!.organization!.id,
    createdById: session!.user.id,
    type: input.type,
    cityId: String(input.cityId).trim(),
    localitySlug: normalizeSlug(input.localitySlug),
    intent: normalizeIntent(input.intent),
    propertyType: normalizePropertyType(input.propertyType),
    bhkMin: toNumberOrNull(input.bhkMin),
    bhkMax: toNumberOrNull(input.bhkMax),
    areaMinSqft: toNumberOrNull(input.areaMinSqft),
    areaMaxSqft: toNumberOrNull(input.areaMaxSqft),
    budgetMinInr: input.type === "DEMAND" ? toNumberOrNull(input.budgetMinInr) : null,
    budgetMaxInr: input.type === "DEMAND" ? toNumberOrNull(input.budgetMaxInr) : null,
    priceInr: input.type === "SUPPLY" ? toNumberOrNull(input.priceInr) : null,
    detailSummary: summary.summary,
    sourceListingId: input.sourceListingId ? String(input.sourceListingId) : null,
    sourceRequirementId: input.sourceRequirementId ? String(input.sourceRequirementId) : null,
    status: "DRAFT",
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : addDays(new Date(), 30).toISOString(),
    publishedAt: null,
    closedAt: null,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  REQUESTS.set(request.id, request);
  return { ok: true, request };
}

export function publicChannelRequest(request: ChannelRequestRecord): PublicChannelRequest {
  return {
    id: request.id,
    organizationId: request.organizationId,
    type: request.type,
    cityId: request.cityId,
    localitySlug: request.localitySlug,
    intent: request.intent,
    propertyType: request.propertyType,
    bhkMin: request.bhkMin,
    bhkMax: request.bhkMax,
    areaMinSqft: request.areaMinSqft,
    areaMaxSqft: request.areaMaxSqft,
    budgetMinInr: request.budgetMinInr,
    budgetMaxInr: request.budgetMaxInr,
    priceInr: request.priceInr,
    detailSummary: request.detailSummary,
    status: request.status,
    expiresAt: request.expiresAt,
    publishedAt: request.publishedAt,
    closedAt: request.closedAt,
    revision: request.revision,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function listOwnChannelRequests(session: AuthSession | null | undefined): ChannelResult<{ requests: ChannelRequestRecord[] }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  return { ok: true, requests: [...REQUESTS.values()].filter((request) => request.organizationId === session.organization!.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
}

export function getOwnChannelRequest(id: string, session: AuthSession | null | undefined): ChannelResult<{ request: ChannelRequestRecord }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  const request = REQUESTS.get(id);
  if (!request || request.organizationId !== session.organization.id) return { ok: false, status: 404, errors: ["Channel request was not found for this organization."] };
  return { ok: true, request };
}

function isOpen(request: ChannelRequestRecord) {
  return request.status === "OPEN" && new Date(request.expiresAt).getTime() > Date.now();
}

function rangesOverlap(aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null) {
  if (aMin === null && aMax === null) return true;
  if (bMin === null && bMax === null) return true;
  const leftMin = aMin ?? aMax ?? 0;
  const leftMax = aMax ?? aMin ?? Number.MAX_SAFE_INTEGER;
  const rightMin = bMin ?? bMax ?? 0;
  const rightMax = bMax ?? bMin ?? Number.MAX_SAFE_INTEGER;
  return leftMin <= rightMax && rightMin <= leftMax;
}

function hardFiltersPass(demand: ChannelRequestRecord, supply: ChannelRequestRecord) {
  if (demand.organizationId === supply.organizationId) return false;
  if (!isOpen(demand) || !isOpen(supply)) return false;
  if (demand.cityId !== supply.cityId) return false;
  if (demand.intent !== supply.intent) return false;
  if (demand.propertyType !== supply.propertyType) return false;
  if (demand.localitySlug && supply.localitySlug && demand.localitySlug !== supply.localitySlug) return false;
  if (!rangesOverlap(demand.bhkMin, demand.bhkMax, supply.bhkMin, supply.bhkMax)) return false;
  if (supply.priceInr === null || demand.budgetMaxInr === null) return false;
  if (supply.priceInr > Math.round(demand.budgetMaxInr * 1.1)) return false;
  return true;
}

function pushReason(reasons: MatchReason[], factor: MatchReason["factor"], weight: number, ratio: number, note: string) {
  reasons.push({ factor, weight, points: Math.max(0, Math.min(weight, Math.round(weight * ratio))), note });
}

function areaCloseness(demand: ChannelRequestRecord, supply: ChannelRequestRecord) {
  const demandMid = demand.areaMinSqft || demand.areaMaxSqft ? ((demand.areaMinSqft ?? demand.areaMaxSqft ?? 0) + (demand.areaMaxSqft ?? demand.areaMinSqft ?? 0)) / 2 : null;
  const supplyMid = supply.areaMinSqft || supply.areaMaxSqft ? ((supply.areaMinSqft ?? supply.areaMaxSqft ?? 0) + (supply.areaMaxSqft ?? supply.areaMinSqft ?? 0)) / 2 : null;
  if (!demandMid || !supplyMid) return 0.75;
  return Math.max(0, 1 - Math.abs(supplyMid - demandMid) / demandMid);
}

export function scoreChannelMatch(demand: ChannelRequestRecord, supply: ChannelRequestRecord): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  const localityRatio = demand.localitySlug && supply.localitySlug && demand.localitySlug === supply.localitySlug ? 1 : demand.localitySlug || supply.localitySlug ? 0.5 : 0.75;
  pushReason(reasons, "locality", 35, localityRatio, localityRatio === 1 ? "Exact locality match." : "Same city with partial locality specificity.");
  pushReason(reasons, "propertyType", 25, demand.propertyType === supply.propertyType ? 1 : 0, "Same property type.");
  const budgetMid = ((demand.budgetMinInr ?? demand.budgetMaxInr ?? 0) + (demand.budgetMaxInr ?? demand.budgetMinInr ?? 0)) / 2;
  const budgetRatio = budgetMid > 0 && supply.priceInr ? Math.max(0, 1 - Math.abs(supply.priceInr - budgetMid) / budgetMid) : 0;
  pushReason(reasons, "budgetFit", 20, budgetRatio, "Supply price compared with demand budget midpoint.");
  const bhkRatio = rangesOverlap(demand.bhkMin, demand.bhkMax, supply.bhkMin, supply.bhkMax) ? 1 : 0.5;
  pushReason(reasons, "bhkAreaFit", 10, (bhkRatio + areaCloseness(demand, supply)) / 2, "BHK and area compatibility.");
  const oldest = Math.min(new Date(demand.createdAt).getTime(), new Date(supply.createdAt).getTime());
  const recencyRatio = Math.max(0, 1 - (Date.now() - oldest) / (30 * 24 * 60 * 60 * 1000));
  pushReason(reasons, "recency", 10, recencyRatio, "Newer channel records are prioritized.");
  return { score: Math.max(0, Math.min(100, reasons.reduce((sum, reason) => sum + reason.points, 0))), reasons };
}

function matchKey(demandId: string, supplyId: string) {
  return `${demandId}:${supplyId}`;
}

export function createMatchesForRequest(requestId: string): ChannelMatchRecord[] {
  const request = REQUESTS.get(requestId);
  if (!request || !isOpen(request)) return [];
  const candidates: Array<{ demand: ChannelRequestRecord; supply: ChannelRequestRecord; score: number; reasons: MatchReason[] }> = [];
  for (const candidate of REQUESTS.values()) {
    const demand = request.type === "DEMAND" ? request : candidate;
    const supply = request.type === "SUPPLY" ? request : candidate;
    if (demand.type !== "DEMAND" || supply.type !== "SUPPLY") continue;
    if (!hardFiltersPass(demand, supply)) continue;
    const { score, reasons } = scoreChannelMatch(demand, supply);
    if (score < 40) continue;
    candidates.push({ demand, supply, score, reasons });
  }
  const created: ChannelMatchRecord[] = [];
  for (const { demand, supply, score, reasons } of candidates.sort((a, b) => b.score - a.score || b.supply.updatedAt.localeCompare(a.supply.updatedAt)).slice(0, BROKER_CHANNEL_TOP_MATCH_LIMIT)) {
    const pair = matchKey(demand.id, supply.id);
    const existing = [...MATCHES.values()].find((match) => matchKey(match.demandRequestId, match.supplyRequestId) === pair);
    if (existing) {
      created.push(existing);
      continue;
    }
    const timestamp = nowIso();
    const match: ChannelMatchRecord = { id: nextId("channel_match"), demandRequestId: demand.id, supplyRequestId: supply.id, score, reasons, status: "SUGGESTED", createdBy: "system", createdAt: timestamp, updatedAt: timestamp };
    MATCHES.set(match.id, match);
    notifyChannel(demand.organizationId, "channel.match.suggested", "Top broker-channel match", `A ${score}/100 supply match is available.`, "ChannelMatch", match.id);
    notifyChannel(supply.organizationId, "channel.match.suggested", "Top broker-channel match", `A ${score}/100 demand match is available.`, "ChannelMatch", match.id);
    created.push(match);
  }
  return created;
}

export function publishChannelRequest(id: string, session: AuthSession | null | undefined): ChannelResult<{ request: ChannelRequestRecord; matches: ChannelMatchRecord[] }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  if (!isVerifiedForBrokerChannel(session)) return { ok: false, status: 403, errors: ["Only verified partner or RERA-verified broker organizations can publish channel requests."] };
  const request = REQUESTS.get(id);
  if (!request || request.organizationId !== session.organization.id) return { ok: false, status: 404, errors: ["Channel request was not found for this organization."] };
  if (["CLOSED", "CANCELLED", "EXPIRED"].includes(request.status)) return { ok: false, status: 409, errors: ["Closed, cancelled, or expired channel requests cannot be published."] };
  const timestamp = nowIso();
  request.status = "OPEN";
  request.publishedAt = request.publishedAt ?? timestamp;
  request.updatedAt = timestamp;
  const matches = createMatchesForRequest(id);
  return { ok: true, request, matches };
}

export function transitionOwnChannelRequest(id: string, status: "CLOSED" | "CANCELLED", session: AuthSession | null | undefined): ChannelResult<{ request: ChannelRequestRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const request = REQUESTS.get(id);
  if (!request || request.organizationId !== session.organization.id) return { ok: false, status: 404, errors: ["Channel request was not found for this organization."] };
  if (request.status === "CLOSED" || request.status === "CANCELLED") return { ok: true, request };
  request.status = status;
  request.closedAt = status === "CLOSED" ? nowIso() : request.closedAt;
  request.updatedAt = nowIso();
  return { ok: true, request };
}

function requestInvolvesOrg(match: ChannelMatchRecord, organizationId: string) {
  const demand = REQUESTS.get(match.demandRequestId);
  const supply = REQUESTS.get(match.supplyRequestId);
  return Boolean((demand?.organizationId === organizationId || supply?.organizationId === organizationId) && demand && supply);
}

function orgPublicProfile(organizationId: string) {
  const organization = ORGANIZATIONS.get(organizationId);
  const digits = organization?.businessPhoneE164?.replace(/\D/g, "") ?? "";
  return { organizationId, organizationName: organization?.name ?? organizationId, verificationStatus: organization?.verificationStatus ?? "UNKNOWN", contactName: null, contactRole: "assigned-agent" as const, businessPhoneMasked: organization?.businessPhoneMasked ?? null, businessPhoneProvided: Boolean(digits), waMeLink: digits ? `https://wa.me/${digits}` : null };
}

export function listChannelMatches(session: AuthSession | null | undefined): ChannelResult<{ matches: SanitizedChannelMatch[] }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  const matches = [...MATCHES.values()].filter((match) => requestInvolvesOrg(match, session.organization!.id)).sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)).slice(0, BROKER_CHANNEL_TOP_MATCH_LIMIT).map((match) => {
    const demand = REQUESTS.get(match.demandRequestId)!;
    const supply = REQUESTS.get(match.supplyRequestId)!;
    const ownRequest = demand.organizationId === session.organization!.id ? demand : supply;
    const counterpartyRequest = demand.organizationId === session.organization!.id ? supply : demand;
    return { ...match, ownRequest: publicChannelRequest(ownRequest), counterpartyRequest: publicChannelRequest(counterpartyRequest), counterpartyBroker: orgPublicProfile(counterpartyRequest.organizationId) };
  });
  return { ok: true, matches };
}

export function acceptChannelMatch(matchId: string, session: AuthSession | null | undefined): ChannelResult<{ match: ChannelMatchRecord; deal: ChannelDealRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  if (!isVerifiedForBrokerChannel(session)) return { ok: false, status: 403, errors: ["Only verified broker organizations can accept channel matches."] };
  const match = MATCHES.get(matchId);
  if (!match || !requestInvolvesOrg(match, session.organization.id)) return { ok: false, status: 404, errors: ["Channel match was not found for this organization."] };
  const existingDeal = [...DEALS.values()].find((deal) => deal.matchId === matchId);
  if (existingDeal) return { ok: true, match, deal: existingDeal };
  if (match.status !== "SUGGESTED") return { ok: false, status: 409, errors: ["Only suggested matches can be accepted."] };
  const demand = REQUESTS.get(match.demandRequestId)!;
  const supply = REQUESTS.get(match.supplyRequestId)!;
  const timestamp = nowIso();
  match.status = "ACCEPTED";
  match.updatedAt = timestamp;
  const deal: ChannelDealRecord = { id: nextId("channel_deal"), matchId, demandOrganizationId: demand.organizationId, supplyOrganizationId: supply.organizationId, demandContactUserId: demand.createdById, supplyContactUserId: supply.createdById, status: "OPEN", closeMode: "DUAL", splitAgreement: null, totalCommissionInr: null, demandBrokerShareInr: null, supplyBrokerShareInr: null, demandBrokerConfirmAt: null, supplyBrokerConfirmAt: null, closedAt: null, closeVersion: 1, erpnextSyncStatus: "PENDING", createdAt: timestamp, updatedAt: timestamp };
  DEALS.set(deal.id, deal);
  notifyChannel(demand.organizationId, "channel.deal.created", "Broker-channel deal created", "A suggested match has been accepted and moved into deal workflow.", "ChannelDeal", deal.id);
  notifyChannel(supply.organizationId, "channel.deal.created", "Broker-channel deal created", "A suggested match has been accepted and moved into deal workflow.", "ChannelDeal", deal.id);
  match.status = "DEAL_CREATED";
  demand.status = "MATCHED";
  supply.status = "MATCHED";
  return { ok: true, match, deal };
}

export function rejectChannelMatch(matchId: string, session: AuthSession | null | undefined): ChannelResult<{ match: ChannelMatchRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const match = MATCHES.get(matchId);
  if (!match || !requestInvolvesOrg(match, session.organization.id)) return { ok: false, status: 404, errors: ["Channel match was not found for this organization."] };
  if (match.status === "DEAL_CREATED") return { ok: false, status: 409, errors: ["A deal-created match cannot be rejected."] };
  match.status = "REJECTED";
  match.updatedAt = nowIso();
  return { ok: true, match };
}

function dealInvolvesOrg(deal: ChannelDealRecord, organizationId: string) {
  return deal.demandOrganizationId === organizationId || deal.supplyOrganizationId === organizationId;
}

export function listChannelDeals(session: AuthSession | null | undefined): ChannelResult<{ deals: ChannelDealRecord[] }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  return { ok: true, deals: [...DEALS.values()].filter((deal) => dealInvolvesOrg(deal, session.organization!.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
}

export function getChannelDeal(dealId: string, session: AuthSession | null | undefined): ChannelResult<{ deal: ChannelDealRecord }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  const deal = DEALS.get(dealId);
  if (!deal || !dealInvolvesOrg(deal, session.organization.id)) return { ok: false, status: 404, errors: ["Channel deal was not found for this organization."] };
  return { ok: true, deal };
}

export function saveChannelDealSplit(dealId: string, input: { totalCommissionInr?: unknown; demandBrokerShareInr?: unknown; supplyBrokerShareInr?: unknown; splitAgreement?: Record<string, unknown>; closeMode?: ChannelDealCloseMode }, session: AuthSession | null | undefined): ChannelResult<{ deal: ChannelDealRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const deal = DEALS.get(dealId);
  if (!deal || !dealInvolvesOrg(deal, session.organization.id)) return { ok: false, status: 404, errors: ["Channel deal was not found for this organization."] };
  if (deal.status === "CLOSED" || deal.status === "CANCELLED") return { ok: false, status: 409, errors: ["Closed or cancelled deals cannot be changed."] };
  const total = toNumberOrNull(input.totalCommissionInr);
  const demandShare = toNumberOrNull(input.demandBrokerShareInr);
  const supplyShare = toNumberOrNull(input.supplyBrokerShareInr);
  if (total === null || demandShare === null || supplyShare === null) return { ok: false, status: 400, errors: ["totalCommissionInr, demandBrokerShareInr, and supplyBrokerShareInr are required."] };
  if (demandShare + supplyShare !== total) return { ok: false, status: 400, errors: ["Commission split must add up to totalCommissionInr."] };
  deal.totalCommissionInr = total;
  deal.demandBrokerShareInr = demandShare;
  deal.supplyBrokerShareInr = supplyShare;
  deal.splitAgreement = input.splitAgreement ?? { type: "negotiated", summary: "Negotiated broker-channel split." };
  deal.closeMode = input.closeMode === "SINGLE" ? "SINGLE" : "DUAL";
  deal.updatedAt = nowIso();
  notifyChannel(deal.demandOrganizationId, "channel.deal.split_saved", "Commission split saved", "A negotiated broker-channel commission split was recorded.", "ChannelDeal", deal.id);
  notifyChannel(deal.supplyOrganizationId, "channel.deal.split_saved", "Commission split saved", "A negotiated broker-channel commission split was recorded.", "ChannelDeal", deal.id);
  return { ok: true, deal };
}

function ensureSplitReady(deal: ChannelDealRecord): string[] {
  const errors: string[] = [];
  if (deal.totalCommissionInr === null || deal.demandBrokerShareInr === null || deal.supplyBrokerShareInr === null) errors.push("Commission split must be saved before close.");
  if ((deal.demandBrokerShareInr ?? 0) + (deal.supplyBrokerShareInr ?? 0) !== (deal.totalCommissionInr ?? -1)) errors.push("Commission split must add up to totalCommissionInr.");
  return errors;
}

function createCloseRecords(deal: ChannelDealRecord, session: AuthSession) {
  if ([...COMMISSIONS.values()].some((entry) => entry.dealId === deal.id)) return;
  const timestamp = nowIso();
  const entries = [
    { organizationId: deal.demandOrganizationId, amount: deal.demandBrokerShareInr ?? 0 },
    { organizationId: deal.supplyOrganizationId, amount: deal.supplyBrokerShareInr ?? 0 },
  ];
  for (const entry of entries) {
    const commission: CommissionEntryRecord = { id: nextId("channel_commission"), organizationId: entry.organizationId, dealId: deal.id, entryType: "COMMISSION_INCOME", amountInr: entry.amount, employeeId: session.user.id, description: `Broker channel commission for ${deal.id}`, entryDate: timestamp, recordedById: session.user.id, erpnextDocId: null, createdAt: timestamp };
    COMMISSIONS.set(commission.id, commission);
    const idempotencyKey = `channel.close.v${deal.closeVersion}.${deal.id}.${entry.organizationId}`;
    const write: ErpnextCloseWriteRecord = { id: nextId("erpnext_close"), channelDealId: deal.id, organizationId: entry.organizationId, idempotencyKey, payloadHash: String(idempotencyKey.length + entry.amount), status: "PENDING", attemptCount: 0, lastError: null, nextRetryAt: null, erpnextDocId: null, processedAt: null, createdAt: timestamp, updatedAt: timestamp };
    ERP_WRITES.set(write.id, write);
  }
}

export function confirmChannelDeal(dealId: string, session: AuthSession | null | undefined): ChannelResult<{ deal: ChannelDealRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const deal = DEALS.get(dealId);
  if (!deal || !dealInvolvesOrg(deal, session.organization.id)) return { ok: false, status: 404, errors: ["Channel deal was not found for this organization."] };
  const errors = ensureSplitReady(deal);
  if (errors.length) return { ok: false, status: 400, errors };
  if (deal.status === "CLOSED") return { ok: true, deal };
  if (deal.status === "CANCELLED") return { ok: false, status: 409, errors: ["Cancelled deals cannot be confirmed."] };
  const timestamp = nowIso();
  if (session.organization.id === deal.demandOrganizationId) deal.demandBrokerConfirmAt = deal.demandBrokerConfirmAt ?? timestamp;
  if (session.organization.id === deal.supplyOrganizationId) deal.supplyBrokerConfirmAt = deal.supplyBrokerConfirmAt ?? timestamp;
  deal.status = deal.demandBrokerConfirmAt && deal.supplyBrokerConfirmAt ? "CLOSED" : "PENDING_OTHER_CLOSE";
  deal.closedAt = deal.status === "CLOSED" ? timestamp : null;
  deal.updatedAt = timestamp;
  if (deal.status === "CLOSED") {
    createCloseRecords(deal, session);
    notifyChannel(deal.demandOrganizationId, "channel.deal.closed", "Broker-channel deal closed", "Commission entries and ERPNext sync jobs were created.", "ChannelDeal", deal.id);
    notifyChannel(deal.supplyOrganizationId, "channel.deal.closed", "Broker-channel deal closed", "Commission entries and ERPNext sync jobs were created.", "ChannelDeal", deal.id);
  } else {
    const pendingOrgId = session.organization.id === deal.demandOrganizationId ? deal.supplyOrganizationId : deal.demandOrganizationId;
    notifyChannel(pendingOrgId, "channel.deal.confirm_pending", "Broker-channel close confirmation pending", "The counterparty confirmed close; your confirmation is pending.", "ChannelDeal", deal.id);
  }
  return { ok: true, deal };
}

export function closeChannelDeal(dealId: string, session: AuthSession | null | undefined): ChannelResult<{ deal: ChannelDealRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const deal = DEALS.get(dealId);
  if (!deal || !dealInvolvesOrg(deal, session.organization.id)) return { ok: false, status: 404, errors: ["Channel deal was not found for this organization."] };
  const errors = ensureSplitReady(deal);
  if (errors.length) return { ok: false, status: 400, errors };
  if (deal.status === "CLOSED") return { ok: true, deal };
  if (deal.closeMode === "DUAL") return confirmChannelDeal(dealId, session);
  const timestamp = nowIso();
  deal.status = "CLOSED";
  deal.closedAt = timestamp;
  if (session.organization.id === deal.demandOrganizationId) deal.demandBrokerConfirmAt = deal.demandBrokerConfirmAt ?? timestamp;
  if (session.organization.id === deal.supplyOrganizationId) deal.supplyBrokerConfirmAt = deal.supplyBrokerConfirmAt ?? timestamp;
  deal.updatedAt = timestamp;
  createCloseRecords(deal, session);
  notifyChannel(deal.demandOrganizationId, "channel.deal.closed", "Broker-channel deal closed", "Commission entries and ERPNext sync jobs were created.", "ChannelDeal", deal.id);
  notifyChannel(deal.supplyOrganizationId, "channel.deal.closed", "Broker-channel deal closed", "Commission entries and ERPNext sync jobs were created.", "ChannelDeal", deal.id);
  return { ok: true, deal };
}

export function cancelChannelDeal(dealId: string, session: AuthSession | null | undefined): ChannelResult<{ deal: ChannelDealRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const deal = DEALS.get(dealId);
  if (!deal || !dealInvolvesOrg(deal, session.organization.id)) return { ok: false, status: 404, errors: ["Channel deal was not found for this organization."] };
  if (deal.status === "CLOSED") return { ok: false, status: 409, errors: ["Closed deals cannot be cancelled."] };
  deal.status = "CANCELLED";
  deal.updatedAt = nowIso();
  return { ok: true, deal };
}

export function listChannelNotifications(session: AuthSession | null | undefined): ChannelResult<{ notifications: ChannelNotificationRecord[] }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  return { ok: true, notifications: [...NOTIFICATIONS.values()].filter((notification) => notification.organizationId === session.organization!.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export function markChannelNotificationRead(id: string, session: AuthSession | null | undefined): ChannelResult<{ notification: ChannelNotificationRecord }> {
  if (!session?.organization || !canWrite(session)) return { ok: false, status: 403, errors: ["Broker channel write permission and organization are required."] };
  const notification = NOTIFICATIONS.get(id);
  if (!notification || notification.organizationId !== session.organization.id) return { ok: false, status: 404, errors: ["Channel notification was not found for this organization."] };
  notification.readAt = notification.readAt ?? nowIso();
  return { ok: true, notification };
}

export function listPendingErpnextCloseWritesForTests() {
  return [...ERP_WRITES.values()].filter((write) => ["PENDING", "FAILED"].includes(write.status));
}

export function channelDashboard(session: AuthSession | null | undefined): ChannelResult<{ dashboard: { openRequests: number; suggestedMatches: number; activeDeals: number; closedDeals: number; commissionTotalInr: number; erpnextPendingWrites: number; unreadNotifications: number } }> {
  if (!session?.organization || !canRead(session)) return { ok: false, status: 403, errors: ["Broker channel read permission and organization are required."] };
  const orgId = session.organization.id;
  const requests = [...REQUESTS.values()].filter((request) => request.organizationId === orgId);
  const matches = [...MATCHES.values()].filter((match) => requestInvolvesOrg(match, orgId));
  const deals = [...DEALS.values()].filter((deal) => dealInvolvesOrg(deal, orgId));
  const commissions = [...COMMISSIONS.values()].filter((entry) => entry.organizationId === orgId);
  const erpWrites = [...ERP_WRITES.values()].filter((write) => write.organizationId === orgId && ["PENDING", "FAILED"].includes(write.status));
  return { ok: true, dashboard: { openRequests: requests.filter((request) => request.status === "OPEN").length, suggestedMatches: matches.filter((match) => match.status === "SUGGESTED").length, activeDeals: deals.filter((deal) => deal.status === "OPEN" || deal.status === "PENDING_OTHER_CLOSE").length, closedDeals: deals.filter((deal) => deal.status === "CLOSED").length, commissionTotalInr: commissions.reduce((sum, entry) => sum + entry.amountInr, 0), erpnextPendingWrites: erpWrites.length, unreadNotifications: [...NOTIFICATIONS.values()].filter((notification) => notification.organizationId === orgId && !notification.readAt).length } };
}

export function resetBrokerChannelForTests() {
  ORGANIZATIONS.clear();
  REQUESTS.clear();
  MATCHES.clear();
  DEALS.clear();
  COMMISSIONS.clear();
  ERP_WRITES.clear();
  NOTIFICATIONS.clear();
  sequence = 1;
}
