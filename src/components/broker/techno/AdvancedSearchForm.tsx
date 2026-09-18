"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Crown, Home, MapPin, Search, XCircle } from "lucide-react";
import { buildBrokerSearchUrl } from "@/lib/technoproperty/search-url";

const CATEGORIES = [
  { id: "ResidentialRent", label: "Residential rent", icon: Home },
  { id: "ResidentialSell", label: "Residential sale", icon: Home },
  { id: "CommercialRent", label: "Commercial rent", icon: Building2 },
  { id: "CommercialSell", label: "Commercial sale", icon: Building2 },
] as const;

const POPULAR_AREAS = [
  "Bodakdev",
  "SG Highway",
  "Satellite",
  "South Bopal",
  "Gota",
  "Jagatpur",
  "Shilaj",
  "Prahlad Nagar",
  "Navrangpura",
  "Vastrapur",
  "Thaltej",
  "Ambawadi",
];

export function AdvancedSearchForm() {
  const router = useRouter();
  const [category, setCategory] = useState("ResidentialRent");
  const [query, setQuery] = useState("");
  const [premium, setPremium] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    router.push(buildBrokerSearchUrl({ category, query, premium }));
  }

  function clear() {
    setCategory("ResidentialRent");
    setQuery("");
    setPremium(false);
  }

  return (
    <form className="tp-card space-y-6" onSubmit={submit}>
      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--tp-ink-soft)]">I’m looking for</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="tp-search-choice"
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              <Icon size={18} /> <span>{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tp-ink-soft)]">Area, project, owner, or phone</legend>
        <label className="tp-search min-h-12 rounded-xl" htmlFor="broker-inventory-query">
          <Search size={18} className="shrink-0 text-[var(--tp-muted)]" />
          <input
            id="broker-inventory-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: Thaltej or Shaligram Arcade"
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--tp-muted)]">Pick a popular area or type any listing detail.</p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Popular areas">
          {POPULAR_AREAS.map((area) => (
            <button key={area} type="button" className="tp-area-chip" aria-pressed={query === area} onClick={() => setQuery(query === area ? "" : area)}>
              <MapPin size={13} /> {area}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--tp-border)] bg-[#f8fbff] px-4 py-3">
        <input type="checkbox" checked={premium} onChange={(event) => setPremium(event.target.checked)} className="h-5 w-5 accent-[var(--tp-accent)]" />
        <Crown size={18} className="text-[#b27b0b]" />
        <span>
          <span className="block text-sm font-semibold text-[var(--tp-ink)]">Premium properties only</span>
          <span className="block text-xs text-[var(--tp-muted)]">Limit results to highlighted inventory</span>
        </span>
      </label>

      <div className="tp-search-actions grid grid-cols-2 gap-2 sm:ml-auto sm:max-w-sm">
        <button type="button" className="tp-btn tp-btn-ghost min-h-11 justify-center" onClick={clear}><XCircle size={16} /> Clear</button>
        <button type="submit" className="tp-btn tp-btn-primary min-h-11 justify-center"><Search size={16} /> Show results</button>
      </div>
    </form>
  );
}
