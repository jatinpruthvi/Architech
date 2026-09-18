import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listOwnerProperties } from "@/lib/technoproperty/repository";
import { categoryLabel } from "@/lib/technoproperty/categories";
import { PropertyTable } from "@/components/broker/techno/PropertyTable";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
import { currentListFilter, serializeListSearch } from "@/components/broker/techno/list-controls";
import Link from "next/link";

const TABS = ["ResidentialRent", "ResidentialSell", "CommercialRent", "CommercialSell", "Premium", "Important"];

export const dynamic = "force-dynamic";

export default async function OwnersByCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; perPage?: string; q?: string; premium?: string; rented?: string }>;
}) {
  const { category } = await params;
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(sp.perPage) || 25));

  const data = await listOwnerProperties(orgId, userId, {
    page,
    perPage,
    q: sp.q,
    category: /^(ResidentialRent|ResidentialSell|CommercialRent|CommercialSell|Premium|Important)$/.test(category) ? category : "ResidentialRent",
    premium: category === "Premium" ? "1" : sp.premium,
    rented: sp.rented,
  });

  const title = category === "Premium" ? "Premium Properties"
    : category === "Important" ? "Shortlisted (Important) Properties"
    : `${categoryLabel(category)} Properties`;
  const basePath = `/broker/owners/${category}`;

  return (
    <div className="space-y-5">
      <ListPageHeader
        title={title}
        searchLabel="Search premise, phone, owner, or area"
        initialQuery={sp.q || ""}
        basePath={basePath}
        resultCount={data.total}
        activeFilter={currentListFilter(category === "Premium" || category === "Important" ? { rented: sp.rented } : sp)}
        filterAllLabel={category === "Premium" ? "All premium" : category === "Important" ? "All important" : "All active"}
        showPremiumOption={category !== "Premium" && category !== "Important"}
      />
      <div className="tp-tabs-rail flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link key={t} href={`/broker/owners/${t}`} className={`tp-tab ${category === t ? "active" : ""}`}>
            {categoryLabel(t)}
          </Link>
        ))}
      </div>
      <PropertyTable
        rows={data.rows}
        total={data.total}
        page={data.page}
        perPage={data.perPage}
        basePath={basePath}
        currentSearch={serializeListSearch({
          q: sp.q,
          premium: category === "Premium" || category === "Important" ? undefined : sp.premium,
          rented: sp.rented,
          page: sp.page,
          perPage: sp.perPage,
        })}
      />
    </div>
  );
}
