import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INDIA_STATES_AND_UTS } from "@/lib/location/india-states";
import { getLocalBodiesForStateForServer } from "@/lib/location/server/directory";
import { canonicalUrl } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ state: string }>; searchParams: Promise<{ page?: string }> };

function pageNumber(value: string | undefined) {
  return value && /^\d+$/.test(value) ? Math.max(1, Number(value)) : 1;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const entry = INDIA_STATES_AND_UTS.find((item) => item.slug === state);
  if (!entry) return {};
  return {
    title: `${entry.name} LGD local bodies and PIN coverage — Architech`,
    description: `Inspect sourced administrative and postal reference coverage for ${entry.name}, using stable LGD identifiers without treating post-office labels as property localities.`,
    alternates: { canonical: canonicalUrl(`/locations/${entry.slug}/`) },
    // Individual jurisdiction pages become indexable only after a dedicated
    // database-backed quality gate is added for their official body records.
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ state }, query] = await Promise.all([params, searchParams]);
  const directory = await getLocalBodiesForStateForServer(state, pageNumber(query.page), 50);
  if (!directory) notFound();
  const { pagination } = directory;

  return (
    <main className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb"><Link href="/" className="link-rail">Home</Link><span>/</span><Link href="/locations/" className="link-rail">India locations</Link><span>/</span><span>{directory.state.name}</span></nav>
          <p className="kicker mt-12 text-brick">{directory.state.type} · LGD {directory.state.lgdCode}</p>
          <h1 className="display mt-6 text-[clamp(42px,7vw,88px)]">{directory.state.name} <em className="text-brick">directory.</em></h1>
          {directory.state.nativeName ? <p className="mt-4 font-display text-2xl ink-2">{directory.state.nativeName}</p> : null}
          <p className="mt-7 max-w-[760px] text-base leading-8 ink-2">Official-reference local bodies and their sourced PIN associations. This administrative directory does not imply that Architech has listings, product cities, or reviewed neighbourhoods for every row.</p>
        </div>
      </section>

      <section className="container py-12 md:py-16">
        <div className={`border-l-4 p-5 text-sm leading-7 ${directory.mode === "prisma" ? "border-trust bg-trust/5" : "border-brick bg-brick/5"}`}>
          {directory.disclaimer}
        </div>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-5">
          <div><p className="kicker text-brick">Administrative evidence</p><h2 className="font-display mt-3 text-3xl md:text-5xl">LGD local bodies</h2></div>
          <p className="stamp ink-3">{new Intl.NumberFormat("en-IN").format(pagination.total)} records</p>
        </div>

        {directory.localBodies.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <caption className="sr-only">LGD local bodies and associated PIN codes in {directory.state.name}</caption>
              <thead><tr className="border-b border-ink/20 stamp ink-3"><th className="py-3 pr-4 font-medium">Local body</th><th className="py-3 pr-4 font-medium">LGD code</th><th className="py-3 pr-4 font-medium">Type</th><th className="py-3 font-medium">Associated PINs</th></tr></thead>
              <tbody>{directory.localBodies.map((body) => <tr key={body.id} className="border-b border-ink/10 align-top"><th scope="row" className="py-4 pr-4 text-left font-normal">{body.name}</th><td className="py-4 pr-4 font-mono text-sm">{body.lgdCode}</td><td className="py-4 pr-4 text-sm ink-2">{body.type ?? "Local body"}</td><td className="py-4"><div className="flex flex-wrap gap-2">{body.postalCodes.map((code) => <Link key={code} href={`/locations/postal-codes/${code}/`} className="border border-ink/20 px-2 py-1 font-mono text-sm transition hover:border-brick hover:text-brick">{code}</Link>)}</div></td></tr>)}</tbody>
            </table>
          </div>
        ) : <div className="border-b border-ink/10 py-12"><h3 className="font-display text-2xl">No activated bulk records</h3><p className="mt-3 max-w-[660px] text-sm leading-7 ink-2">The jurisdiction remains in the official 36-entry reference registry. Its local-body rows will appear only after a complete, provenance-verified LGD snapshot passes production activation gates.</p></div>}

        {pagination.totalPages > 1 ? <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Local-body pages">
          {pagination.page > 1 ? <Link className="link-rail stamp" href={`/locations/${state}/?page=${pagination.page - 1}`}>← Previous</Link> : <span />}
          <span className="stamp-sm ink-3">Page {pagination.page} of {pagination.totalPages}</span>
          {pagination.page < pagination.totalPages ? <Link className="link-rail stamp" href={`/locations/${state}/?page=${pagination.page + 1}`}>Next →</Link> : <span />}
        </nav> : null}
      </section>
    </main>
  );
}
