/* Discovery: turning a publish into something Google can find.

   This is the first consumer of the event spine, and it exists because of a
   measurement in the design doc that is worth repeating: a new listing already
   renders. `/listing/[id]` has no `dynamicParams = false`, so the page exists
   the moment it is approved. It is simply invisible — no sitemap entry, no
   fresh hub link, no ping. Discovery is what closes that gap.

   The ordering here is not arbitrary. Revalidation is first because it is
   free and immediate; the sitemap second because a URL absent from it depends
   on a crawl finding it by accident; the indexing ping last because it is
   quota-limited and should therefore only ever be spent on a page that has
   already passed the gate.

   Paths, not URLs — `revalidatePath` takes the pathname. */
import { revalidatePath } from "next/cache";
import { onListingEvent, type ListingEvent } from "@/lib/listing/events";
import { submitToIndexNow, type IndexNowResult } from "./indexnow";
import type { RuntimeEnvironment } from "./runtime";

/** The child sitemaps a listing publish can change.

    `reports` is in here for a reason that is easy to miss: publishing a
    listing can flip a whole city's price index from withheld to published.
    The index is not merely another page that links to the listing — it is a
    page whose existence depends on it. That is the compounding effect from
    §3.6, and a discovery layer that only revalidated the listing's own
    neighbours would leave it stale. */
const ALWAYS_AFFECTED = ["/sitemap.xml", "/sitemap/listings.xml"] as const;

const PLACE_AFFECTED = [
  "/sitemap/localities.xml",
  "/sitemap/cities.xml",
  "/sitemap/reports.xml",
] as const;

export function pathsForListingEvent(event: ListingEvent): string[] {
  const paths = new Set<string>(ALWAYS_AFFECTED);

  if (event.localitySlug && event.citySlug) {
    paths.add(`/buy/${event.citySlug}/${event.localitySlug}/`);
    paths.add(`/buy/${event.citySlug}/`);
    // Publishing listings is what decides whether this index publishes at all.
    paths.add(`/price-index/${event.citySlug}/`);
    for (const path of PLACE_AFFECTED) paths.add(path);
  }

  return [...paths];
}

/* Revalidation is best-effort by design.

   Outside a Next request context — a unit test, a CLI import — `revalidatePath`
   throws, and there is no cache to invalidate anyway. Letting that escape
   would fail the moderation call for something that is not a moderation
   problem. So failures are collected and returned rather than raised, which
   also makes the behaviour observable: an empty failure list means the
   revalidations were issued, not that they succeeded. */
export async function revalidateForListingEvent(event: ListingEvent): Promise<{ paths: string[]; failed: string[] }> {
  const paths = pathsForListingEvent(event);
  const failed: string[] = [];

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      failed.push(path);
    }
  }

  return { paths, failed };
}

/* What gets pinged.

   Only pages whose content actually changed, and only pages that exist. The
   listing's own URL is deliberately absent: for a draft published through
   moderation there is no public id to build it from, because the SEO page
   registry is built from the fixture repository and a UI-published listing is
   not in it. Inventing a URL to ping would submit a 404.

   So we ping the hubs, which have certainly changed and which are the pages
   carrying the search volume anyway. The new listing is reachable from its
   locality hub in one hop, which is what gets it crawled — and that is step 4,
   not this one.

   This resolves itself when step 0 lands: once the repository reads from
   Prisma, the registry sees published listings and their URLs become
   derivable. Recorded in docs/seo/seo-os-decisions.md. */
export function urlsForIndexingRequest(event: ListingEvent): string[] {
  if (!event.citySlug || !event.localitySlug) return [];
  return [`/buy/${event.citySlug}/${event.localitySlug}/`, `/buy/${event.citySlug}/`, `/price-index/${event.citySlug}/`];
}

export type DiscoveryOutcome = {
  revalidated: string[];
  revalidationFailures: string[];
  indexNow: IndexNowResult;
};

/** The full discovery pass for one event: revalidate, then ping.

    Order matters. Revalidation is immediate and free; the ping is
    quota-limited and should describe a page that is already correct. */
export async function discoverListingEvent(
  event: ListingEvent,
  env: RuntimeEnvironment = process.env,
): Promise<DiscoveryOutcome> {
  const { paths, failed } = await revalidateForListingEvent(event);
  // A blocked listing changed nothing, so nothing is submitted. This is the
  // "only spend quota on pages that passed the gate" rule from §3.4.
  const indexNow = event.type === "listing.gate_blocked" ? { submitted: false, reason: "empty" } as const : await submitToIndexNow(urlsForIndexingRequest(event), env);
  return { revalidated: paths, revalidationFailures: failed, indexNow };
}

let registered = false;

/** Register the discovery subscriber. Idempotent.

    Called once at server startup from `instrumentation.ts`. Idempotent
    because Next may evaluate a module more than once across runtimes and a
    duplicate subscriber would double every revalidation. */
export function registerSeoDiscovery(): void {
  if (registered) return;
  registered = true;
  onListingEvent(discoverListingEvent);
}

export function resetSeoDiscoveryForTests(): void {
  registered = false;
}
