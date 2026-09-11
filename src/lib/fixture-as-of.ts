/* The single "as of" date for the demo fixture corpus.

   This is a LEAF module on purpose: `properties.ts` (which re-exports these)
   and `property-generator.ts` (which consumes the ISO date) form a module
   cycle, and `properties.ts` calls `generatedListings()` at module scope.
   When `property-generator` was the cycle's entry point, its own body had
   not run yet, so `generatedListings` hit the not-yet-initialized
   `BLUEPRINTS` and the whole module graph crashed with
   "Cannot access 'BLUEPRINTS' before initialization" — invisible until
   something imported `property-generator` first. Keeping the constant here
   gives the generator a runtime import path that never passes through
   `properties.ts`, breaking the cycle for good. */

/** ISO `YYYY-MM-DD` the demo inventory is frozen at. */
export const FIXTURE_AS_OF_ISO = "2026-08-26";

/** Human label matching `FIXTURE_AS_OF_ISO`. */
export const FIXTURE_AS_OF_LABEL = "26 Aug 2026";
