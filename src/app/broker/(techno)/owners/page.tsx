import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AllOwnersRedirect() {
  redirect("/broker/owners/ResidentialRent");
}
