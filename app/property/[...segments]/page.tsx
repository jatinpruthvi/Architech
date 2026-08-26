import { redirect } from "next/navigation";

type Props = { params: Promise<{ segments: string[] }> };

export default async function Page({ params }: Props) {
  const { segments } = await params;
  const raw = segments.join("-").toLowerCase();
  const intent = raw.includes("rent") ? "rent" : "buy";
  const category = raw.includes("commercial") ? "commercial" : raw.includes("plot") ? "plot" : raw.includes("land") ? "land" : raw.includes("auction") ? "auction" : "residential";
  const city = raw.includes("gandhinagar") ? "gandhinagar" : "ahmedabad";
  const paramsForSearch = new URLSearchParams({ intent, category, q: city });
  redirect(`/search/?${paramsForSearch.toString()}`);
}
