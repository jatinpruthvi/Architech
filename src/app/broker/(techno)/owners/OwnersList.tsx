import type { CSSProperties } from "react";
import Link from "next/link";
import {
  findSavedSearch,
  listOwnerProperties,
  markSavedSearchNotified,
  type SavedSearchFilters,
} from "@/lib/technoproperty/repository";
import { categoryLabel } from "@/lib/technoproperty/categories";
import { requireTechnoSession } from "@/lib/technoproperty/session";
import { PropertyTable } from "@/components/broker/techno/PropertyTable";
import { ListPageHeader } from "@/components/broker/techno/ListPageHeader";
import { currentListFilter, serializeListSearch } from "@/components/broker/techno/list-controls";
import { SaveSearchButton } from "@/components/broker/techno/SaveSearchButton";

/* "All" is a first-class tab (not a URL segment): /broker/owners lists every
   active category, while the per-category tabs live at /broker/owners/{cat}.
   The sidebar's "All Properties" link therefore shows all properties, not a
   redirect to the first category. */
export const OWNER_TABS = [
  "All",
  "ResidentialRent",
  "ResidentialSell",
  "CommercialRent",
  "CommercialSell",
  "Premium",
  "Important",
] as const;

export type OwnerTab = (typeof OWNER_TABS)[number];

/* Stagger index for the `.tp-rise` entrance (theme.css). */
const riseStyle = (i: number): CSSProperties => ({ "--tp-i": i }) as CSSProperties;

export function ownerTabHref(tab: OwnerTab): string {
  return tab === "All" ? "/broker/owners" : `/broker/owners/${tab}`;
}

export function ownerTabLabel(tab: OwnerTab): string {
  return tab === "All" ? "All Properties" : categoryLabel(tab);
}

interface OwnersSearchParams {
  page?: string;
  perPage?: string;
  q?: string;
  premium?: string;
  rented?: string;
  savedSearch?: string;
}

export async function OwnersList({
  category,
  searchParams,
}: {
  category: OwnerTab;
  searchParams: Promise<OwnersSearchParams>;
}) {
  const sp = await searchParams;
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(sp.perPage) || 25));
  const effectivePremium = category === "Premium" ? "1" : sp.premium;

  const data = await listOwnerProperties(orgId, userId, {
    page,
    perPage,
    q: sp.q,
    category,
    premium: effectivePremium,
    rented: sp.rented,
  });

  /* Re-opening a saved search (from My Activities) counts as "seen": the
     widget's "new matches" clock resets. Best-effort — the list itself must
     never fail because the seen-mark did not. */
  let savedSearchName: string | null = null;
  if (sp.savedSearch) {
    const found = await findSavedSearch(orgId, userId, sp.savedSearch).catch(() => null);
    if (found) {
      savedSearchName = found.name;
      void markSavedSearchNotified(orgId, userId, found.id).catch(() => {});
    }
  }

  const savedFilters: SavedSearchFilters = {
    category,
    q: sp.q,
    premium: effectivePremium,
    rented: sp.rented,
  };

  const title =
    category === "All" ? "All Properties"
    : category === "Premium" ? "Premium Properties"
    : category === "Important" ? "Shortlisted (Important) Properties"
    : `${categoryLabel(category)} Properties`;
  const basePath = ownerTabHref(category);

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
      >
        <SaveSearchButton filters={savedFilters} />
      </ListPageHeader>
      {savedSearchName ? (
        <p className="tp-chip tp-chip-green w-fit">
          Saved search “{savedSearchName}” — marked as seen, new matches start counting again.
        </p>
      ) : null}
      <div className="tp-tabs-rail tp-rise flex gap-2 overflow-x-auto pb-1" style={riseStyle(0)}>
        {OWNER_TABS.map((t) => (
          <Link key={t} href={ownerTabHref(t)} className={`tp-tab ${category === t ? "active" : ""}`}>
            {ownerTabLabel(t)}
          </Link>
        ))}
      </div>
      <div className="tp-rise" style={riseStyle(1)}>
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
    </div>
  );
}
