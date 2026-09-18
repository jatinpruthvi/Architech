import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listOwnerProperties } from "@/lib/technoproperty/repository";
import { PropertyTable } from "@/components/broker/techno/PropertyTable";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
import { currentListFilter, serializeListSearch } from "@/components/broker/techno/list-controls";

export const dynamic = "force-dynamic";

export default async function PremiumPage({ searchParams }: { searchParams: Promise<{ page?: string; perPage?: string; q?: string; rented?: string }> }) {
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(sp.perPage) || 25));
  const data = await listOwnerProperties(orgId, userId, { page, perPage, q: sp.q, rented: sp.rented, category: "Premium" });
  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Premium Properties"
        searchLabel="Search premium inventory"
        initialQuery={sp.q || ""}
        basePath="/broker/premium"
        resultCount={data.total}
        activeFilter={currentListFilter({ rented: sp.rented })}
        filterAllLabel="All premium"
        showPremiumOption={false}
      />
      <PropertyTable
        rows={data.rows}
        total={data.total}
        page={data.page}
        perPage={data.perPage}
        basePath="/broker/premium"
        currentSearch={serializeListSearch({ q: sp.q, rented: sp.rented, page: sp.page, perPage: sp.perPage })}
      />
    </div>
  );
}
