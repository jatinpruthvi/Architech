import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideArticle from "@/pages/GuideArticle";
import { getGuideBySlug, getGuideStaticParams } from "@/lib/repositories";
import { guideUrl } from "@/lib/seo/urls";

const ROUTE_KIND = "city" as const;

export function generateStaticParams() {
  return getGuideStaticParams(ROUTE_KIND);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide || guide.routeKind !== ROUTE_KIND) return { title: "Not found" };
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: guideUrl(guide.path.replace(/^\/guide\//, "").replace(/\/$/, "")) },
    robots: guide.status === "published" ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: guide.title, description: guide.summary, url: guide.path, images: [{ url: `/images/${guide.image}.jpg` }] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide || guide.routeKind !== ROUTE_KIND) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    author: { "@type": "Organization", name: guide.author },
    dateModified: guide.updatedAt,
    datePublished: guide.updatedAt,
    mainEntityOfPage: guideUrl(guide.path.replace(/^\/guide\//, "").replace(/\/$/, "")),
    image: `/images/${guide.image}.jpg`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GuideArticle guide={guide} />
    </>
  );
}
