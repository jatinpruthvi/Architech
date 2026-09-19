import { OwnersList, OWNER_TABS, type OwnerTab } from "../OwnersList";

export const dynamic = "force-dynamic";

export default async function OwnersByCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await params;
  /* Unknown segments (old deep links, typos) land on the All list instead of
     silently re-scoping to a single category. */
  const tab: OwnerTab = (OWNER_TABS as readonly string[]).includes(category) ? (category as OwnerTab) : "All";
  return <OwnersList category={tab} searchParams={searchParams as Promise<Record<string, string | undefined>>} />;
}
