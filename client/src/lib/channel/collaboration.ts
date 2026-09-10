import "server-only";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaPersistence } from "@/lib/persistence/source";
import type { AuthSession } from "@/lib/auth/roles";

const prisma = () => getPrismaClient() as unknown as {
  listing: { findFirst(args: unknown): Promise<Record<string, unknown> | null> };
  brokerCollaborationRequest: { create(args: unknown): Promise<Record<string, unknown>>; findFirst(args: unknown): Promise<Record<string, unknown> | null>; update(args: unknown): Promise<Record<string, unknown>> };
};

export async function createCollaborationRequest(session: AuthSession, listingId: string, terms?: string) {
  if (!session.organization?.id) return { ok: false as const, status: 403, errors: ["A verified broker organization is required."] };
  if (!isPrismaPersistence()) return { ok: true as const, request: { id: `collaboration_${listingId}`, status: "REQUESTED", terms: terms?.trim().slice(0, 500) ?? null } };
  const listing = await prisma().listing.findFirst({ where: { OR: [{ id: listingId }, { stableId: listingId }], lifecycle: "ACTIVE", visibility: "BROKER_SHAREABLE" }, select: { id: true, brokerOrgId: true } });
  if (!listing) return { ok: false as const, status: 404, errors: ["This listing is not available for broker collaboration."] };
  if (listing.brokerOrgId === session.organization.id) return { ok: false as const, status: 400, errors: ["Your organization already manages this listing."] };
  const created = await prisma().brokerCollaborationRequest.create({ data: { listingId: String(listing.id), requesterId: session.user.id, requesterOrgId: session.organization.id, recipientOrgId: listing.brokerOrgId, terms: terms?.trim().slice(0, 500) || null, status: "REQUESTED" } });
  return { ok: true as const, request: created };
}

export async function decideCollaborationRequest(session: AuthSession, requestId: string, decision: "ACCEPTED" | "REJECTED") {
  if (!session.organization?.id) return { ok: false as const, status: 403, errors: ["A verified broker organization is required."] };
  if (!isPrismaPersistence()) return { ok: true as const, request: { id: requestId, status: decision } };
  const request = await prisma().brokerCollaborationRequest.findFirst({ where: { id: requestId, recipientOrgId: session.organization.id, status: "REQUESTED" } });
  if (!request) return { ok: false as const, status: 404, errors: ["Collaboration request not found or already decided."] };
  const updated = await prisma().brokerCollaborationRequest.update({ where: { id: requestId }, data: { status: decision, decidedById: session.user.id, decidedAt: new Date() } });
  return { ok: true as const, request: updated };
}
