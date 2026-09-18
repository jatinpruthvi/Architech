import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listOwnerProperties } from "@/lib/technoproperty/repository";
import { PropertyTable } from "@/components/broker/techno/PropertyTable";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
import { currentListFilter, serializeListSearch } from "@/components/broker/techno/list-controls";

export const dynamic = "force-dynamic";

export default async function ShortlistedPage({ searchParams }: { searchParams: Promise<{ page?: string; perPage?: string; q?: string; rented?: string }> }) {
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(sp.perPage) || 25));

  // Shortlisted = properties the broker has personally bookmarked (never source-side Important)
  const all = await listOwnerProperties(orgId, userId, { page, perPage, q: sp.q, rented: sp.rented, category: "Mine" });

  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Shortlisted Properties"
        searchLabel="Search saved properties"
        initialQuery={sp.q || ""}
        basePath="/broker/shortlisted"
        resultCount={all.total}
        activeFilter={currentListFilter({ rented: sp.rented })}
        filterAllLabel="All saved"
        showPremiumOption={false}
      />
      <PropertyTable
        rows={all.rows}
        total={all.total}
        page={all.page}
        perPage={all.perPage}
        basePath="/broker/shortlisted"
        currentSearch={serializeListSearch({ q: sp.q, rented: sp.rented, page: sp.page, perPage: sp.perPage })}
      />
    </div>
  );
}
