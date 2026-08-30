import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import GuideArticle from "@/pages/GuideArticle";
import { getGuideByScope, getScopedGuideStaticParams } from "@/lib/repositories";
import { guideJsonLd, guideMetadata } from "@/lib/seo/guide-jsonld";

const ROUTE_KIND = "rera" as const;

export function generateStaticParams() {
  return getScopedGuideStaticParams(ROUTE_KIND);
}

export async function generateMetadata({ params }: { params: Promise<{ scope: string; slug: string }> }): Promise<Metadata> {
  const { scope, slug } = await params;
  const guide = getGuideByScope(ROUTE_KIND, scope, slug)
    ?? (scope === "gujarat" ? getGuideByScope(ROUTE_KIND, "india", slug) : undefined);
  return guide ? guideMetadata(guide) : { title: "Not found" };
}

export default async function Page({ params }: { params: Promise<{ scope: string; slug: string }> }) {
  const { scope, slug } = await params;
  const guide = getGuideByScope(ROUTE_KIND, scope, slug);
  // Preserve the launch-era Gujarat URL while keeping one national canonical.
  if (!guide && scope === "gujarat") {
    const nationalGuide = getGuideByScope(ROUTE_KIND, "india", slug);
    if (nationalGuide) permanentRedirect(nationalGuide.path);
  }
  if (!guide) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideJsonLd(guide)) }} />
      <GuideArticle guide={guide} />
    </>
  );
}
