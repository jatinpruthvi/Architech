import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function AllBrokersRedirect() { redirect("/broker/brokers/ResidentialRent"); }
