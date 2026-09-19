import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import {
  createBuyerLead,
  listBuyerLeads,
  type BuyerLeadInput,
} from "@/lib/technoproperty/repository";

export const runtime = "nodejs";

async function scopedAccess(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return { deny: access.response, orgId: null as string | null, userId: null as string | null };
  const orgId = access.session.organization?.id;
  if (!orgId) {
    return {
      deny: NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED" }, { status: 403 }),
      orgId: null,
      userId: null,
    };
  }
  return { deny: null, orgId, userId: access.session.user.id };
}

const LEAD_SOURCES = ["WALK_IN", "CALL", "SOCIAL", "REFERRAL"] as const;

/* Parse one create/update payload into a BuyerLeadInput, or a 400 code.
   Ownership (org/broker) never comes from the payload. */
export function parseLeadBody(body: unknown): BuyerLeadInput | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID" };
  const v = body as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name : "";
  const phone = typeof v.phone === "string" ? v.phone : "";
  const dealType = v.dealType === "SELL" ? "SELL" : v.dealType === "RENT" ? "RENT" : null;
  if (!dealType) return { error: "INVALID_DEAL_TYPE" };
  let bhk: number | null = null;
  if (v.bhk != null && v.bhk !== "") {
    const n = Number(v.bhk);
    if (!Number.isInteger(n) || n < 1 || n > 4) return { error: "INVALID_BHK" };
    bhk = n;
  }
  let budgetValue: number | null = null;
  if (v.budgetValue != null && v.budgetValue !== "") {
    const n = Number(v.budgetValue);
    /* ₹10 crore, the documented ceiling and the same bound the repository
       enforces (MAX_INR in @/lib/technoproperty/repository — BUG-R5-001). */
    if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return { error: "INVALID_BUDGET" };
    budgetValue = n;
  }
  const strOrNull = (x: unknown, max: number) =>
    typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null;
  let moveInAt: Date | null = null;
  if (typeof v.moveInAt === "string" && v.moveInAt.trim()) {
    const d = new Date(v.moveInAt);
    if (Number.isNaN(d.getTime())) return { error: "INVALID_MOVE_IN" };
    moveInAt = d;
  }
  const source =
    v.source == null ? "CALL" : (LEAD_SOURCES as readonly string[]).includes(v.source as string)
      ? (v.source as BuyerLeadInput["source"])
      : null;
  if (source == null) return { error: "INVALID_SOURCE" };
  return {
    name,
    phone,
    dealType,
    bhk,
    budgetValue,
    area: strOrNull(v.area, 160),
    furniture: strOrNull(v.furniture, 40),
    moveInAt,
    source,
    notes: strOrNull(v.notes, 2000),
  };
}

/** The broker's buyer inventory, newest first. */
export async function GET(request: Request) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const dealType = url.searchParams.get("dealType");
  const leads = await listBuyerLeads(gate.orgId!, gate.userId!, {
    q,
    dealType: dealType === "RENT" || dealType === "SELL" ? dealType : undefined,
  });
  return NextResponse.json({ ok: true, leads }, { headers: { "Cache-Control": "no-store" } });
}

/** Add a buyer lead. */
export async function POST(request: Request) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const body = (await request.json().catch(() => null)) as unknown;
  const input = parseLeadBody(body);
  if ("error" in input) {
    return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  }
  try {
    const id = await createBuyerLead(gate.orgId!, gate.userId!, input);
    return NextResponse.json({ ok: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID";
    if (code === "BUYER_LEAD_EMPTY_NAME" || code === "INVALID_PHONE" || code === "INVALID_BUDGET") {
      return NextResponse.json({ ok: false, error: code }, { status: 400 });
    }
    throw error;
  }
}
