import type { MarketCategory, MarketIntent, SortId } from "@/lib/filters";
import type { Property } from "@/lib/properties";
import type { PaginationMeta } from "./pagination";
import type { DerivedFacetValue, FacetCounts, Relaxation } from "./facets";

export type SearchSource = "fixture-repository" | "postgres-fts-trigram";
export type FacetProjection = "consumer" | "desk";

export type AppliedFacet = { groupId: string; groupLabel: string; valueId: string; label: string };

export type SearchResponse = {
  query: string;
  /** Echoes the resolved city scope: a city slug, or "all" for nationwide. */
  city: string;
  /** Echoes the resolved PIN filter, or null when none was applied. */
  pincode: string | null;
  /** Canonical serialisation of the active facet state. */
  filters: string[];
  category: MarketCategory;
  intent: MarketIntent;
  sort: SortId;
  count: number;
  source: SearchSource;
  /* Remaining states, newest first, and what each one MEANS operationally:
     - executed:        the SQL candidate narrowing ran; the DB read was bound
                        by FTS/trigram/ILIKE and then the unchanged JS filter
                        produced the result. Recall parity holds by the
                        superset contract in lib/search/sql.ts.
     - fallback-js:     the SQL candidate narrowing THREW this request; the
                        response was served by the JS filter over the bounded
                        scoped read and the failure was logged (never silent).
     - ready:           prisma source, narrowing flag off: the full scoped,
                        bounded row set was read and filtered in JS.
     - deterministic-…: fixture repository everywhere (demo build). */
  indexPlan:
    | "deterministic-parser-now-postgres-fts-trigram-next"
    | "postgres-fts-trigram-ready"
    | "postgres-fts-trigram-executed"
    | "postgres-fts-trigram-fallback-js";
  /** True when the underlying read hit its row ceiling (5000), so `count` is a
      bounded total rather than the real one. Set by the server path. */
  truncated?: boolean;
  page: PaginationMeta;
  results: Property[];
  projection: FacetProjection;
  facets: FacetCounts;
  applied: AppliedFacet[];
  relaxations: Relaxation[];
  widening: DerivedFacetValue[];
};
