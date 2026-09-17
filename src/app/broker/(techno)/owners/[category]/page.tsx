import { requireTechnoSession } from "@/lib/technoproperty/session";
import { listOwnerProperties } from "@/lib/technoproperty/repository";
import { categoryLabel } from "@/lib/technoproperty/categories";
import { PropertyTable } from "@/components/broker/techno/PropertyTable";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
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
      <ListPageHeader title={title} searchLabel="Search Premise, Phone, Description, Special Note…" initialQuery={sp.q || ""} basePath={basePath} />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/broker/owners/${t}`} className={`tp-tab ${category === t ? "active" : ""}`}>
            {categoryLabel(t)}
          </Link>
        ))}
      </div>
      <PropertyTable rows={data.rows} total={data.total} page={data.page} perPage={data.perPage} basePath={basePath} />
    </div>
  );
}
