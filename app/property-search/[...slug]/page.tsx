import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string[] }> };

function toSearch(slug: string[]) {
  const value = slug.join("-").toLowerCase();
  const intent = value.includes("rent") ? "rent" : "buy";
  const category = value.includes("commercial") || value.includes("office") || value.includes("shop") ? "commercial" : value.includes("plot") ? "plot" : value.includes("land") ? "land" : value.includes("auction") ? "auction" : "residential";
  const locality = ["bopal", "paldi", "thaltej", "satellite", "navrangpura", "prahlad-nagar", "maninagar", "gota", "nikol", "science-city"].find((item) => value.includes(item));
  const query = locality ? locality.replaceAll("-", " ") : "";
  const params = new URLSearchParams({ intent, category });
  if (query) params.set("q", query);
  redirect(`/search/?${params.toString()}`);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  toSearch(slug);
}
