"use client";
/* ARCHITECH — Amdavad Modern compare tray: four-home decision surface, shareable state, no payment assumptions. */
import { ArrowUpRight, Scale, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useCompare } from "@/contexts/CompareContext";
import { getListings, type Property } from "@/lib/repositories";
import Pic from "./Pic";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

const rows: [string, (p: Property) => string][] = [
  ["Price", (p) => p.price],
  ["Rate", (p) => p.pricePerSqft],
  ["Layout", (p) => p.meta],
  ["Carpet area", (p) => p.area],
  ["Locality", (p) => p.locality],
  ["Verification", (p) => p.badge],
  ["Availability", (p) => p.status],
  ["Evidence", (p) => p.note],
];

export default function CompareTray() {
  const { compared, toggle, clear } = useCompare();
  const homes = getListings().filter((p) => compared.includes(p.id));
  const [copied, setCopied] = useState(false);
  if (homes.length === 0) return null;

  const share = async () => {
    const url = `${window.location.origin}/compare?ids=${encodeURIComponent(homes.map((home) => home.id).join(","))}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Comparison link copied", { description: "Share this shortlisting with your family or advisor." });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Comparison ready", { description: url });
    }
  };

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 border-brick bg-night text-cream shadow-[0_-12px_40px_rgba(27,22,18,0.35)]">
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <Scale size={16} className="shrink-0 text-ember" aria-hidden="true" />
          {homes.map((p) => (
            <span key={p.id} className="flex items-center gap-2 border border-cream/20 py-1 pl-1 pr-2">
              <span className="block h-8 w-10 overflow-hidden"><Pic name={p.image} alt="" className="h-full w-full object-cover" sizes="40px" /></span>
              <span className="hidden max-w-[140px] truncate text-xs sm:block">{p.title}</span>
              <button onClick={() => toggle(p.id)} className="grid h-8 w-8 place-items-center text-cream/60 hover:text-ember" aria-label={`Remove ${p.title} from compare`}><X size={13} /></button>
            </span>
          ))}
          {homes.length < 2 && <span className="stamp hidden !text-[10px] text-cream/60 md:block">Pick one more home…</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={share} className="touch-44 hidden items-center gap-1.5 px-2 stamp !text-[10px] text-cream/70 hover:text-ember sm:inline-flex" aria-label="Copy comparison link">{copied ? "Copied" : "Share"}</button>
          <button onClick={clear} className="hidden px-2 stamp !text-[10px] text-cream/60 underline underline-offset-4 hover:text-ember sm:block">Clear</button>
          <Drawer>
            <DrawerTrigger asChild>
              <button disabled={homes.length < 2} className="clay-fill btn-solid touch-44 bg-brick px-5 stamp !text-[11px] font-semibold text-cream disabled:cursor-not-allowed">Compare {homes.length >= 2 ? `${homes.length} homes` : ""}</button>
            </DrawerTrigger>
            <DrawerContent className="border-t-2 border-brick bg-paper text-ink">
              <DrawerHeader className="text-left">
                <DrawerTitle className="font-display text-2xl font-medium tracking-[-0.02em]">Decision dossier<span className="text-brick">.</span></DrawerTitle>
              </DrawerHeader>
              <div className="overflow-x-auto px-4 pb-8">
                <div className="grid min-w-[680px] gap-x-4" style={{ gridTemplateColumns: `120px repeat(${homes.length}, minmax(150px, 1fr))` }}>
                  <div />
                  {homes.map((p) => (
                    <Link key={p.id} href={`/listing/${p.id}`} className="group block pb-3">
                      <span className="block aspect-[1.6] overflow-hidden"><Pic name={p.image} alt={p.title} className="h-full w-full object-cover" sizes="45vw" /></span>
                      <span className="mt-2 flex items-center gap-1 font-display text-base font-medium leading-tight group-hover:text-brick">{p.title} <ArrowUpRight size={13} className="text-brick" /></span>
                    </Link>
                  ))}
                  {rows.map(([label, get]) => (
                    <div key={label} className="contents">
                      <div className="border-t border-ink/10 py-3 stamp !text-[10px] text-ink/60">{label}</div>
                      {homes.map((p) => <div key={`${label}-${p.id}`} className={`border-t border-ink/10 py-3 text-sm ${label === "Price" ? "font-display text-lg font-semibold" : "text-ink/80"}`}>{get(p)}</div>)}
                    </div>
                  ))}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
}
