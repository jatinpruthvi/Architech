"use client";
/* Managed saved-search list. Reads saved searches from /api/saved-searches, lets
   the buyer re-run each query, and delete one. Consent/no-PII by design. */
import { BellRing, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SavedSearchState } from "@/lib/saved-search/saved-search";
import { savedSearchRunUrl } from "@/lib/saved-search/urls";
import useTitle from "@/hooks/useTitle";
import EmptyState from "@/components/architech/EmptyState";
import LoadingSkeleton from "@/components/architech/LoadingSkeleton";

export default function SavedSearches() {
  useTitle("Saved searches");
  const [searches, setSearches] = useState<SavedSearchState[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/saved-searches", { cache: "no-store" });
      const payload = await response.json();
      setSearches(Array.isArray(payload.savedSearches) ? payload.savedSearches : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    const response = await fetch(`/api/saved-searches/${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      toast("Could not delete this saved search.", { description: "Please try again." });
      return;
    }
    setSearches((current) => current.filter((item) => item.id !== id));
    toast("Saved search removed.");
  };

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/60" aria-label="Breadcrumb">
            <Link href="/" className="link-rail hover:text-brick">Home</Link><span>/</span>
            <span className="text-ink/80">Saved searches</span>
          </nav>
          <p className="kicker mt-10 text-brick">Saved searches · notify when they match</p>
          <h1 className="display mt-6 max-w-[720px] text-[clamp(40px,6vw,80px)]">Searches you saved, <em className="text-brick">waiting</em>.</h1>
          <p className="mt-6 max-w-[480px] text-base leading-8 text-ink/65">Each one re-runs your exact query and filters, and is saved without personal data.</p>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        {loading && <div className="space-y-4" role="status" aria-label="Loading saved searches"><LoadingSkeleton className="h-24 w-full" /><LoadingSkeleton className="h-24 w-full" /><span className="sr-only">Loading saved searches…</span></div>}

        {!loading && searches.length === 0 && (
          <EmptyState
            eyebrow="Saved searches"
            title="No saved searches yet"
            description="Run a search, then tap “Save this search” — it will wait here and alert you when a matching home arrives."
            icon={<BellRing size={24} />}
            action={<Link href="/search" className="clay-fill btn-sweep motion-press inline-flex items-center gap-2 bg-brick px-7 py-4 stamp !text-[12px] font-semibold text-cream">Search homes <Search size={15} /></Link>}
          />
        )}

        {!loading && searches.length > 0 && (
          <div className="space-y-4">
            {searches.map((saved) => (
              <article key={saved.id} className="flex flex-wrap items-center justify-between gap-4 border border-ink/15 bg-card p-6">
                <div>
                  <p className="font-display text-xl font-medium tracking-[-0.01em]">
                    {saved.query || "All homes"}
                    {saved.filters?.length ? <span className="ml-2 text-sm text-ink/55">· {saved.filters.join(" + ")}</span> : null}
                  </p>
                  <p className="stamp mt-1 !text-[10px] text-ink/55">Updated {new Date(saved.updatedAt).toLocaleDateString("en-IN")}{saved.notify ? " · Notify on" : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={savedSearchRunUrl(saved)} className="clay-fill btn-sweep touch-44 inline-flex items-center gap-2 bg-brick px-5 py-3 stamp !text-[11px] font-semibold text-cream">Run <Search size={13} /></Link>
                  <button onClick={() => void remove(saved.id)} aria-label={`Delete saved search ${saved.query || "all homes"}`} className="touch-44 grid h-11 w-11 place-items-center border border-ink/20 text-ink/60 hover:border-brick hover:text-brick"><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
