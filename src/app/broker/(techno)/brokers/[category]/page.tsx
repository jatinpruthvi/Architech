import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listBrokerProperties } from "@/lib/technoproperty/repository";
import { categoryLabel } from "@/lib/technoproperty/categories";
import { BrokerPropertyTable } from "@/components/broker/techno/BrokerPropertyTable";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
import { serializeListSearch } from "@/components/broker/techno/list-controls";
import Link from "next/link";

const TABS = ["ResidentialRent", "ResidentialSell", "CommercialRent", "CommercialSell"];

export const dynamic = "force-dynamic";

export default async function BrokersByCategoryPage({
  params, searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; perPage?: string; q?: string }>;
}) {
  const { category } = await params;
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(sp.perPage) || 25));
  const cat = TABS.includes(category) ? category : "ResidentialRent";

  const data = await listBrokerProperties(orgId, { page, perPage, q: sp.q, category: cat });

  return (
    <div className="space-y-5">
      <ListPageHeader
        title={`Broker Properties - ${categoryLabel(cat)}`}
        searchLabel="Search broker, area, premise, mobile"
        filterAllLabel="All"
        initialQuery={sp.q || ""}
        basePath={`/broker/brokers/${cat}`}
        resultCount={data.total}
        showStatusFilter={false}
      />
      <div className="tp-tabs-rail flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link key={t} href={`/broker/brokers/${t}`} className={`tp-tab ${cat === t ? "active" : ""}`}>
            {categoryLabel(t)}
          </Link>
        ))}
      </div>
      <BrokerPropertyTable
        rows={data.rows}
        total={data.total}
        page={data.page}
        perPage={data.perPage}
        basePath={`/broker/brokers/${cat}`}
        currentSearch={serializeListSearch({ q: sp.q, page: sp.page, perPage: sp.perPage })}
      />
    </div>
  );
}
