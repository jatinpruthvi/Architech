import { permanentRedirect } from "next/navigation";
import { keywordSlugToSearchUrl } from "@/lib/search/keyword-slug";

/* Keyword URLs → canonical search (contestant F §1 and §4).

   "/property/2bhk-rent-bandra-west" is the URL shape behind F's example
   queries. It used to be answered by sniffing the joined slug for the word
   "gandhinagar" and defaulting everything else to Ahmedabad, so a Mumbai or
   Bengaluru slug redirected to an Ahmedabad search. `keywordSlugToSearchUrl`
   resolves against the live registry instead — see that module.

   Permanent, not temporary: the slug is a permanent alias for a query, so a
   308 lets crawlers and browsers collapse the alias onto the canonical search
   URL instead of re-following it (F §4's 301 strategy). The destination is
   noindex by design; these slugs are entry points, not pages to rank. */
export default async function Page({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  permanentRedirect(keywordSlugToSearchUrl(segments));
}
