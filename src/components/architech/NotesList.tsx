/* A titled list of notes — methodology, limitations, blockers.

   Lives here rather than inline in the `/price-index` route because of where
   `role="list"` is allowed to appear. Safari + VoiceOver drop a list's
   semantics — and its "N items" announcement — as soon as list-style is
   removed, which Tailwind's preflight does globally, so
   `design-token-discipline.test.ts` requires the explicit role on every
   `<ul>`. `eslint.config.js` permits it for `client/src/**` only; under the
   default jsx-a11y config that covers `app/**` the same attribute is a
   "redundant role" error. Every other `<ul>` in the repo is in a component.
   Moving the markup into one keeps the two rules in agreement instead of
   suppressing either.

   `role="list"` is therefore deliberate, not decoration: on a blockers list
   the item count is the information ("two reasons this is withheld"). */
export default function NotesList({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: readonly string[];
  tone?: "default" | "alert";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className={`font-display text-xl font-medium tracking-[-0.02em] ${tone === "alert" ? "text-brick" : ""}`}>
        {title}
      </h2>
      <ul role="list" className={`mt-4 space-y-2 text-sm leading-7 ${tone === "alert" ? "ink-2" : "ink-2"}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
