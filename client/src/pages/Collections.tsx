"use client";

import { ArrowUpRight, FolderHeart, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import PropertyCard from "@/components/architech/PropertyCard";
import { useCollections } from "@/contexts/CollectionsContext";
import { useSaved } from "@/contexts/SavedContext";
import { getListings } from "@/lib/repositories";
import useTitle from "@/hooks/useTitle";

export default function Collections() {
  useTitle("Collections");
  const { saved } = useSaved();
  const { collections, add, update, toggleListing, remove } = useCollections();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const listings = useMemo(() => getListings().filter((listing) => saved.includes(listing.id)), [saved]);

  const create = () => {
    if (!name.trim()) return;
    add(name, note);
    setName("");
    setNote("");
  };

  return <main className="bg-paper pt-[78px] text-ink">
    <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20"><div className="container">
      <p className="kicker text-brick">Private working set · this device</p>
      <h1 className="display mt-5 max-w-3xl text-[clamp(38px,5vw,72px)]">Arrange the places <em className="text-brick">you return to</em>.</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/60">Create small, named collections for a site visit, a family shortlist, or a second look. Nothing leaves this device until you choose a future account sync.</p>
    </div></section>
    <section className="container py-12 md:py-16">
      <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <form className="h-fit border border-ink/12 bg-card p-6" onSubmit={(event) => { event.preventDefault(); create(); }}>
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-t-full bg-brick/10 text-brick"><Plus size={17} /></span><div><p className="kicker text-brick">New collection</p><h2 className="mt-1 font-display text-2xl">Give the search a shape.</h2></div></div>
          <label className="mt-7 block"><span className="stamp text-ink/60">Collection name</span><input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-11 w-full border border-ink/15 bg-paper px-3 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brick/20" placeholder="Saturday site visits" /></label>
          <label className="mt-4 block"><span className="stamp text-ink/60">Optional note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full resize-y border border-ink/15 bg-paper px-3 py-3 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brick/20" placeholder="What should I compare here?" /></label>
          <button type="submit" className="clay-fill btn-sweep motion-press mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-brick px-4 stamp !text-[11px] font-semibold text-cream">Create collection <ArrowUpRight size={14} /></button>
          <p className="mt-4 text-xs leading-5 text-ink/50">Collections are private, local, and excluded from search indexing.</p>
        </form>
        <div>
          {collections.length === 0 ? <div className="border border-dashed border-ink/20 bg-sand/45 p-8 md:p-10"><FolderHeart size={23} className="text-brick" /><h2 className="mt-6 font-display text-3xl">No collections yet.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-ink/60">Start with one practical group, then add homes from your saved shortlist below.</p></div> : <div className="space-y-4">{collections.map((collection) => { const items = listings.filter((listing) => collection.listingIds.includes(listing.id)); return <article key={collection.id} className="border border-ink/12 bg-card p-5 md:p-6"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0 flex-1"><input value={collection.name} aria-label={`Name for ${collection.name}`} onChange={(event) => update(collection.id, { name: event.target.value })} className="w-full bg-transparent font-display text-2xl outline-none focus:underline focus:decoration-brick" /><textarea value={collection.note} aria-label={`Note for ${collection.name}`} onChange={(event) => update(collection.id, { note: event.target.value })} className="mt-2 w-full resize-none bg-transparent text-sm leading-6 text-ink/60 outline-none focus:ring-1 focus:ring-brick/25" rows={2} placeholder="Add a note for this collection" /></div><button type="button" onClick={() => remove(collection.id)} className="inline-flex min-h-11 items-center gap-2 self-start border border-ink/15 px-3 stamp !text-[10px] font-semibold text-ink/55 hover:border-brick hover:text-brick"><Trash2 size={13} /> Remove</button></div><div className="mt-5 grid gap-2 border-t border-ink/10 pt-4">{listings.length === 0 ? <p className="text-sm text-ink/55">Save a home first, then return here to arrange it.</p> : listings.map((listing) => <label key={listing.id} className="flex min-h-11 items-center gap-3 border border-ink/10 px-3 text-sm hover:border-brick/45"><input type="checkbox" checked={collection.listingIds.includes(listing.id)} onChange={() => toggleListing(collection.id, listing.id)} className="h-4 w-4 accent-[var(--brick)]" /><span className="min-w-0 flex-1 truncate">{listing.title}</span><span className="stamp text-ink/45">{listing.locality}</span></label>)}</div>{items.length > 0 ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{items.slice(0, 2).map((property, index) => <PropertyCard key={property.id} property={property} index={index} />)}</div> : null}</article>; })}</div>}
          <div className="mt-8 flex items-center justify-between border-t border-ink/10 pt-5"><p className="stamp text-ink/50">{saved.length} saved home{saved.length === 1 ? "" : "s"} available</p><Link href="/saved" className="inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick">Open shortlist <ArrowUpRight size={13} /></Link></div>
        </div>
      </div>
    </section>
  </main>;
}
