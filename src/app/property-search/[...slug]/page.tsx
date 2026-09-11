import { permanentRedirect } from "next/navigation";
import { keywordSlugToSearchUrl } from "@/lib/search/keyword-slug";

/* The second keyword-URL shape, now sharing one resolver with `/property/`.

   These two routes were separate copies of the same idea, and the copies had
   drifted: this one carried a hardcoded list of ten Ahmedabad localities, so
   any slug naming one of the other 62 localities produced an empty query.
   Both routes now ask `parseSearchQuery`, which already understands BHK,
   budget, intent, category, PIN codes and place names across every city the
   site covers — see `keyword-slug.ts`.

   Permanent rather than temporary, for the same reason as `/property/`: a
   slug is a permanent alias for a query (F §4's 301 strategy). */
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  permanentRedirect(keywordSlugToSearchUrl(slug));
}
