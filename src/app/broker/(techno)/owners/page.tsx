import { OwnersList } from "./OwnersList";

export const dynamic = "force-dynamic";

export default function AllOwnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OwnersList category="All" searchParams={searchParams as Promise<Record<string, string | undefined>>} />;
}
