"use client";

import { useId, useState } from "react";
import { Search, UserPlus, UsersRound } from "lucide-react";
import { BuyerLeadCard } from "./BuyerLeadCard";
import { BuyerLeadForm, type BuyerLeadView } from "./BuyerLeadForm";

const TABS: { key: string; label: string; href: string }[] = [
  { key: "all", label: "All buyers", href: "/broker/buyers" },
  { key: "RENT", label: "Rent", href: "/broker/buyers?dealType=RENT" },
  { key: "SELL", label: "Buy", href: "/broker/buyers?dealType=SELL" },
];

export function BuyerInventory({
  leads,
  activeTab,
  initialQuery,
}: {
  leads: BuyerLeadView[];
  activeTab: "all" | "RENT" | "SELL";
  initialQuery: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const searchId = useId();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="tp-section-title">
            <UsersRound size={20} aria-hidden="true" /> Buyer Inventory
            <span className="live">{leads.length} {leads.length === 1 ? "lead" : "leads"}</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--tp-muted)]">
            The buyers you work with — add a lead, then let Find matches pull the right sellers from today&rsquo;s inventory.
          </p>
        </div>
        <button type="button" className="tp-btn tp-btn-primary min-h-11" onClick={() => setShowAdd((v) => !v)}>
          <UserPlus size={16} aria-hidden="true" /> Add buyer
        </button>
      </div>

      {showAdd ? (
        <div className="tp-card tp-card-accent">
          <h2 className="tp-section-title !mb-3 text-lg">
            <UserPlus size={16} aria-hidden="true" /> New buyer lead
          </h2>
          <BuyerLeadForm onDone={() => setShowAdd(false)} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="tp-tabs-rail flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter buyers by deal type">
          {TABS.map((t) => (
            <a key={t.key} href={t.href} className={`tp-tab min-h-11 ${activeTab === t.key ? "active" : ""}`}>
              {t.label}
            </a>
          ))}
        </div>
        <form className="tp-search w-full md:max-w-xs" role="search" action="/broker/buyers" method="GET">
          {activeTab !== "all" ? <input type="hidden" name="dealType" value={activeTab} /> : null}
          <label htmlFor={searchId} className="sr-only">
            Search buyers by name, phone or area
          </label>
          <Search size={16} aria-hidden="true" className="shrink-0 text-[var(--tp-muted)]" />
          <input
            id={searchId}
            name="q"
            type="search"
            defaultValue={initialQuery}
            placeholder="Name, phone or area…"
            aria-label="Search buyers by name, phone or area"
          />
          <button type="submit" className="tp-search-submit">
            Search
          </button>
        </form>
      </div>

      {leads.length === 0 ? (
        <div className="tp-card tp-empty">
          <UsersRound size={26} className="mx-auto text-[var(--tp-muted)]" aria-hidden="true" />
          <p className="mt-2 font-semibold text-[var(--tp-ink)]">
            {initialQuery || activeTab !== "all" ? "No buyers match this view." : "No buyer leads yet."}
          </p>
          <p className="mt-1 text-sm text-[var(--tp-muted)]">
            {initialQuery || activeTab !== "all"
              ? "Clear the search or filter to see the full inventory."
              : "Add your first buyer with “Add buyer” — their requirements drive the match engine."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead, index) => (
            <BuyerLeadCard key={lead.id} lead={lead} riseIndex={index} />
          ))}
        </div>
      )}
    </div>
  );
}
