# Design-system hardening

The visual system now has shared primitives for the common states that appear across the product:

- `ActionButton`: async, success, disabled, and accessible progress states.
- `StatusBadge`: trust, freshness, neutral, and danger tones.
- `LoadingSkeleton`: semantic loading surfaces with reduced-motion support.
- `EmptyState`: consistent no-results, empty collection, and recovery surfaces.

## Motion tokens

Use the existing tokens rather than introducing page-local values:

- `--dur-1`: 160ms, taps and toggles
- `--dur-2`: 240ms, hover and lift
- `--dur-3`: 420ms, sheets and drawers
- `--dur-4`: 800ms, reveals and hero choreography
- `--ease-out-expo`: entrances and exits
- `--ease-spring`: tactile movement

## State requirements

Every interactive control should provide:

1. A visible keyboard focus state.
2. A 44px touch target where practical.
3. A disabled state that cannot be mistaken for loading.
4. `aria-busy` for asynchronous work.
5. `aria-live` for result-count and completion changes.
6. Reduced-motion behavior for non-essential animation.

New listing, price, availability, RERA, or partner claims must continue to come from repository-backed facts only.
