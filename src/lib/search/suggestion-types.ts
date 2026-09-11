export type SearchSuggestionKind = "locality" | "listing" | "popular" | "query" | "city" | "pincode" | "structured";

export type SearchSuggestion = {
  kind: SearchSuggestionKind;
  label: string;
  query: string;
  /** Optional human hint (e.g. "42 homes · Paldi"). */
  hint?: string;
  /** Canonical destination when the suggestion maps to a structured search. */
  href?: string;
};
