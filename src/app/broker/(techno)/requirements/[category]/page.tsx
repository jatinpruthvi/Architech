import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listOwnerProperties } from "@/lib/technoproperty/repository";
import { categoryLabel } from "@/lib/technoproperty/categories";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
import { serializeListSearch } from "@/components/broker/techno/list-controls";
import RequirementTable from "@/components/broker/techno/RequirementTable";
import Link from "next/link";

const TABS = ["ResidentialRent", "ResidentialSell", "CommercialRent", "CommercialSell"];

export const dynamic = "force-dynamic";

export default async function RequirementsByCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; perPage?: string; q?: string }>;
}) {
  const { category } = await params;
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(sp.perPage) || 25));
  const safeCat = /^(ResidentialRent|ResidentialSell|CommercialRent|CommercialSell)$/.test(category)
    ? category
    : "ResidentialRent";
  const basePath = `/broker/requirements/${safeCat}`;

  // Requirements reuse owner inventory (matching a requirement means finding a
  // property that fits). The requirement view filters inventory to listings
  // with phones available & active, which is the set brokers actually match
  // buyers/tenants against.
  const data = await listOwnerProperties(orgId, userId, {
    page,
    perPage,
    q: sp.q,
    category: safeCat,
  });

  return (
    <div className="space-y-5">
      <ListPageHeader
        title={`${categoryLabel(safeCat)} Requirements`}
        searchLabel="Search requirements by budget, BHK, area…"
        initialQuery={sp.q || ""}
        basePath={basePath}
        resultCount={data.total}
        showStatusFilter={false}
      />
      <div className="tp-tabs-rail flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link key={t} href={`/broker/requirements/${t}`} className={`tp-tab ${safeCat === t ? "active" : ""}`}>
            {categoryLabel(t)}
          </Link>
        ))}
      </div>
      <div className="tp-card flex flex-wrap items-center gap-3 text-sm leading-6 text-[var(--tp-muted)]">
        <span className="tp-chip tp-chip-violet">Requirements feed</span>
        Showing matches against {data.total.toLocaleString("en-IN")} active {categoryLabel(safeCat)} listings.
        Full buyer/tenant requirement posts will appear here once the crawler pulls them from brokersproperty.php.
      </div>
      <RequirementTable
        rows={data.rows}
        total={data.total}
        page={data.page}
        perPage={data.perPage}
        basePath={basePath}
        currentSearch={serializeListSearch({ q: sp.q, page: sp.page, perPage: sp.perPage })}
      />
    </div>
  );
}
