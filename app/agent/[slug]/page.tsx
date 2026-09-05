import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyCard from "@/components/architech/PropertyCard";
import { getAgentBySlugForServer, getListingsByAgentForServer } from "@/lib/repositories/server/prisma";
import { buildAgentJsonLd } from "@/lib/agent/profile";
import { demoDirectoryAgents } from "@/lib/agent/directory";
import { agentUrl, agentsUrl, homeUrl } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";
import { serpDescription, serpTitle } from "@/lib/seo/serp";

/* One public profile per verified organization. What makes this page more
   than a brochure: the verification badge, the review card wall with every
   review labelled by source, and the live inventory the organization answers
   for — the three things a buyer needs to decide whether to trust a call
   back. */

export function generateStaticParams() {
  // The registry keeps the fixture set; prisma deployments render additional
  // slugs on demand (dynamicParams stays at its default, allowing that).
  return demoDirectoryAgents().map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgentBySlugForServer(decodeURIComponent(slug));
  if (!agent) return {};
  return {
    /* serpTitle budgets within the layout's " · Architech" suffix; badge and
       city go in only while they fit, so a long org name truncates the
       auxiliary parts, never the name itself. */
    title: serpTitle([agent.name, agent.profile.badge, agent.cityName]),
    description: serpDescription([
      `${agent.name} in ${agent.cityName}.`,
      `${agent.listingCount} live listings.`,
      `Verification tier: ${agent.verificationStatus.replaceAll("_", " ").toLowerCase()}.`,
      "Review evidence with sources labelled.",
    ]),
    alternates: { canonical: agentUrl(agent.slug) },
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  /* A slug outside the path-token alphabet is never an organization, and an
     unknown slug is a real 404 — not a redirect. Redirecting garbage to the
     directory would teach crawlers that /agent/* URLs persist. */
  if (!/^[\w-]+$/.test(decoded)) notFound();
  const agent = await getAgentBySlugForServer(decoded);
  if (!agent) notFound();
  const listings = await getListingsByAgentForServer(agent.slug, 12);

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
      { "@type": "ListItem", position: 2, name: "Agents", item: agentsUrl() },
      { "@type": "ListItem", position: 3, name: agent.name, item: agentUrl(agent.slug) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildAgentJsonLd(agent.profile, agentUrl(agent.slug))) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} />
      <div className="bg-paper pt-[78px] text-ink">
        <section className="border-b border-ink/10 bg-sand/70 py-14 md:py-18">
          <div className="container">
            <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb">
              <Link href="/" className="link-rail">Home</Link><span>/</span>
              <Link href={agentsUrl()} className="link-rail">Agents</Link><span>/</span>
              <span>{agent.name}</span>
            </nav>
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <h1 className="display text-[clamp(40px,6vw,84px)]">{agent.name}</h1>
              <span className="stamp rounded-full border border-ink/15 px-3 py-1 text-ink">{agent.profile.badge}</span>
            </div>
            <p className="stamp mt-4 ink-3">
              {agent.cityName} · {agent.listingCount} live listing{agent.listingCount === 1 ? "" : "s"}
              {agent.reraNumber ? ` · ${agent.reraNumber}` : ""}
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-18">
          <h2 className="kicker text-brick">Reviews, sources labelled</h2>
          {agent.profile.reviews.length === 0 ? (
            <p className="mt-6 ink-2">No reviews published yet. Reviews appear only with a stated source — verified buyer or clearly-labelled sample.</p>
          ) : (
            <ul role="list" className="mt-8 grid gap-5 md:grid-cols-2">
              {agent.profile.reviews.map((review) => (
                <li key={review.id} className="rounded-2xl border border-ink/10 bg-paper p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{review.buyerName}</p>
                      <p className="stamp-sm mt-1 ink-3">{review.role} · {review.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl text-ink">{review.rating}<span className="ink-3 text-sm">/5</span></p>
                      <p className="stamp-sm mt-1 ink-3">
                        {review.source === "verified-buyer" ? "Verified buyer" : "Sample review"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 ink-2">“{review.comment}”</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm ink-3">
            Only reviews from verified buyers count towards a rating. Sample reviews demonstrate the format and are never averaged in.
          </p>
        </section>

        <section className="container pb-8 pt-4 md:pb-12">
          <h2 className="kicker text-brick">Inventory this organization answers for</h2>
          {listings.length === 0 ? (
            <p className="mt-6 ink-2">No live listings right now.</p>
          ) : (
            <ul role="list" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((property, index) => (
                <li key={property.id}>
                  <PropertyCard property={property} index={index} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-ink/10 bg-sand/40 py-12">
          <div className="container flex flex-wrap items-center justify-between gap-6">
            <p className="max-w-[520px] text-sm leading-7 ink-2">
              Considering this organization? Listings carry masked-contact leads — you talk on your terms, and your
              number is revealed only after explicit consent to share it.
            </p>
            <Link href={agentsUrl()} className="link-rail text-sm font-medium">← All verified agents</Link>
          </div>
        </section>
      </div>
    </>
  );
}
