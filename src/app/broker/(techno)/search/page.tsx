import { Search } from "lucide-react";
import { AdvancedSearchForm } from "@/components/broker/techno/AdvancedSearchForm";

export const dynamic = "force-dynamic";

export default function AdvancedSearchPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="tp-section-title !text-2xl"><Search size={22} /> Property search</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--tp-muted)]">
          Search the live owner inventory using the filters currently supported by the data source.
        </p>
      </div>
      <AdvancedSearchForm />
    </div>
  );
}
