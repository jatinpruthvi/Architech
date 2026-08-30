import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideArticle from "@/pages/GuideArticle";
import { getGuideBySlug, getGuideStaticParams } from "@/lib/repositories";
import { guideJsonLd, guideMetadata } from "@/lib/seo/guide-jsonld";

const ROUTE_KIND = "city" as const;

export function generateStaticParams() {
  return getGuideStaticParams(ROUTE_KIND);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide || guide.routeKind !== ROUTE_KIND) return { title: "Not found" };
  return guideMetadata(guide);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide || guide.routeKind !== ROUTE_KIND) notFound();

  const jsonLd = guideJsonLd(guide);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GuideArticle guide={guide} />
    </>
  );
}
