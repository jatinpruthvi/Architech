import type { Metadata } from "next";
import Link from "next/link";
import { getAgentDirectoryForServer } from "@/lib/repositories/server/prisma";
import { isAgentIndexable } from "@/lib/agent/directory";
import { agentUrl, agentsUrl } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = {
  title: "Verified agents & partners · Architech",
  description:
    "Every agent and partner organization on Architech, with its verification tier, review evidence, and live inventory — no profile exists here without one.",
  alternates: { canonical: agentsUrl() },
};

/* Public agent directory (gap-analysis step 3, P1-AGENT-001 public slice).

   The data model (profiles, reviews, verification tiers) existed; what did
   not exist was a way to reach it. A directory that never invents entries is
   the whole point: fixture/demo yields the demo organization, prisma yields
   every organization whose verification tier is public, and if neither has
   one the page says so instead of padding itself. */
export default async function AgentsPage() {
  const agents = await getAgentDirectoryForServer();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: agentsUrl(),
    name: "Verified agents & partners",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: agents.length,
      itemListElement: agents.map((agent, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: agentUrl(agent.slug),
        name: agent.name,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="bg-paper pt-[78px] text-ink">
        <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-20">
          <div className="container">
            <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb">
              <Link href="/" className="link-rail">Home</Link><span>/</span>
              <span>Agents</span>
            </nav>
            <p className="kicker mt-12 text-brick">People behind the listings</p>
            <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Verified <em className="text-brick">agents.</em></h1>
            <p className="mt-7 max-w-[620px] text-base leading-8 ink-2 md:text-lg">
              Every organization listed here carries a verification tier, and every review is labelled by source —
              verified buyer or sample. An organization appears only when Architech can say, on the record,
              which tier of checking it has passed.
            </p>
            <p className="stamp mt-6 ink-3">
              {agents.length > 0
                ? `${agents.length} organization${agents.length === 1 ? "" : "s"} currently listed.`
                : "No organizations currently meet the public tier bar."}
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          {agents.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 bg-sand/40 p-10 text-center">
              <p className="text-lg ink-2">The directory starts with the first verified partner.</p>
              <p className="mt-3 ink-3">
                <Link href="/list-property/" className="link-rail">List your organization for verification →</Link>
              </p>
            </div>
          ) : (
            <ul role="list" className="grid gap-6 md:grid-cols-2">
              {agents.map((agent) => (
                <li key={agent.slug} className="group rounded-2xl border border-ink/10 bg-paper p-8 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl tracking-[-0.02em] md:text-3xl">
                        <Link href={agentUrl(agent.slug)} className="transition-transform group-hover:translate-x-1">
                          {agent.name}
                        </Link>
                      </h2>
                      <p className="stamp mt-2 ink-3">{agent.cityName}</p>
                    </div>
                    <span className="stamp shrink-0 rounded-full border border-ink/15 px-3 py-1 text-ink">{agent.profile.badge}</span>
                  </div>
                  <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-ink/10 pt-5 text-left">
                    <div>
                      <dt className="stamp-sm ink-3">Verification</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">
                        {isAgentIndexable(agent.verificationStatus) ? "Directory-verified" : "Source reviewed"}
                      </dd>
                    </div>
                    <div>
                      <dt className="stamp-sm ink-3">Reviews</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">
                        {agent.profile.reviewCount > 0
                          ? `${agent.profile.rating} / 5 (${agent.profile.reviewCount})`
                          : `${agent.profile.reviews.length} sample${agent.profile.reviews.length === 1 ? "" : "s"}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="stamp-sm ink-3">Live listings</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{agent.listingCount}</dd>
                    </div>
                  </dl>
                  <p className="mt-6">
                    <Link href={agentUrl(agent.slug)} className="link-rail text-sm font-medium">
                      Profile, reviews & inventory →
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-10 text-sm ink-3">
            Are you a broker or developer? <Link href="/list-property/" className="link-rail">Apply for verification</Link> —
            the directory publishes only organizations whose source trail Architech has reviewed.
          </p>
        </section>
      </div>
    </>
  );
}
