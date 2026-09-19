import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listBuyerLeads } from "@/lib/technoproperty/repository";
import { BuyerInventory } from "@/components/broker/techno/BuyerInventory";
import type { BuyerLeadView } from "@/components/broker/techno/BuyerLeadForm";

export const dynamic = "force-dynamic";

interface BuyersSearchParams {
  q?: string;
  dealType?: string;
}

export default async function BuyersPage({ searchParams }: { searchParams: Promise<BuyersSearchParams> }) {
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const dealType = sp.dealType === "RENT" || sp.dealType === "SELL" ? sp.dealType : undefined;
  const leads = await listBuyerLeads(orgId, userId, { q: sp.q, dealType });

  const views: BuyerLeadView[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    phoneLast4: l.phoneLast4,
    dealType: l.dealType,
    bhk: l.bhk,
    budgetValue: l.budgetValue,
    area: l.area,
    furniture: l.furniture,
    moveInAt: l.moveInAt ? l.moveInAt.toISOString() : null,
    source: l.source,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <BuyerInventory
      leads={views}
      activeTab={dealType ?? "all"}
      initialQuery={sp.q ?? ""}
    />
  );
}
