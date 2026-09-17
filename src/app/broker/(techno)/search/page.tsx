import { Search, Bookmark, Filter, XCircle, Save } from "lucide-react";

export const dynamic = "force-dynamic";

const AREAS = ["100 Feet Road", "Ambli", "Bavlu", "Adalaj", "Ashram Road", "Bhadaj", "Ambawadi", "Bavla", "Bhat", "Bodakdev", "SG Highway", "Satellite", "South Bopal", "Gota", "Jagatpur", "Shilaj"];

export default function AdvancedSearchPage() {
  return (
    <div className="space-y-5">
      <h1 className="tp-section-title text-2xl"><Search size={22} /> Advanced Property Search</h1>

      <div className="tp-card tp-card-accent">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--tp-accent)] text-white"><Bookmark size={20} /></span>
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--tp-ink)]">Saved searches</h2>
            <p className="text-sm text-[var(--tp-muted)]">Load a saved filter set or save this search for later.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select className="tp-input flex-1"><option>-- Select a saved search --</option></select>
          <button type="button" className="tp-btn tp-btn-primary"><Bookmark size={14}/>Load &amp; Search</button>
          <button type="button" className="tp-btn tp-btn-ghost text-[var(--tp-rose)]">Delete</button>
        </div>
      </div>

      <form className="tp-card space-y-5" action="/broker/owners/ResidentialRent" method="get">
        <FilterSection label="Property type" icon={<Filter size={16} />}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { id: "rr", label: "Residential Rent", defaultChecked: true },
              { id: "rs", label: "Residential Sell" },
              { id: "cr", label: "Commercial Rent" },
              { id: "cs", label: "Commercial Sell" },
            ].map((c) => (
              <label key={c.id} className="tp-check tp-pill cursor-pointer border">
                <input type="checkbox" defaultChecked={c.defaultChecked} /> {c.label}
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Area">
          <input className="tp-input" placeholder="Ambawadi, SG Highway…" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {AREAS.slice(0, 8).map((a) => (
              <label key={a} className="tp-check"><input type="checkbox" /> {a}</label>
            ))}
          </div>
          <button type="button" className="mt-2 text-xs font-semibold text-[var(--tp-accent)]">Show more ▾</button>
        </FilterSection>

        <div className="grid gap-4 md:grid-cols-2">
          <FilterSection label="Availability"><input className="tp-input" placeholder="1 BHK, 2 BHK…" /></FilterSection>
          <FilterSection label="Type"><input className="tp-input" placeholder="Apartment, bungalow…" /></FilterSection>
          <FilterSection label="Condition"><input className="tp-input" placeholder="Furnished, unfurnished…" /></FilterSection>
          <FilterSection label="Available for"><input className="tp-input" placeholder="Family, bachelor…" /></FilterSection>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FilterSection label="Budget">
            <div className="flex items-center gap-2">
              <input className="tp-input flex-1" placeholder="Min" />
              <input className="tp-input flex-1" placeholder="Max" />
            </div>
          </FilterSection>
          <FilterSection label="Sqft">
            <div className="flex items-center gap-2">
              <input className="tp-input flex-1" placeholder="From" />
              <input className="tp-input flex-1" placeholder="To" />
            </div>
          </FilterSection>
        </div>

        <FilterSection label="Options">
          <label className="tp-check"><input type="checkbox" /> Show Premium</label>
        </FilterSection>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="reset" className="tp-btn tp-btn-ghost"><XCircle size={14}/>Clear All</button>
          <button type="button" className="tp-btn tp-btn-ghost"><Save size={14}/>Save Search</button>
          <button type="submit" className="tp-btn tp-btn-primary"><Search size={14}/>Search</button>
        </div>
      </form>
    </div>
  );
}

function FilterSection({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--tp-ink-soft)]">
        {icon}<span>{label}</span>
      </label>
      {children}
    </div>
  );
}
