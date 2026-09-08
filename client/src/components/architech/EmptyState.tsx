import type { ReactNode } from "react";

type EmptyStateProps = { eyebrow?: string; title: string; description?: string; action?: ReactNode; icon?: ReactNode };

/** Shared empty/error surface for search, collections, and saved areas. */
export default function EmptyState({ eyebrow, title, description, action, icon }: EmptyStateProps) {
  return (
    <section className="empty-state border border-ink/12 bg-sand/35 px-6 py-14 text-center md:px-10" aria-live="polite">
      {icon ? <div className="empty-state-icon mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper text-brick shadow-sm">{icon}</div> : null}
      {eyebrow ? <p className="kicker mt-5 text-brick">{eyebrow}</p> : null}
      <h2 className="display mt-4 text-3xl md:text-4xl">{title}</h2>
      {description ? <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink/65">{description}</p> : null}
      {action ? <div className="mt-7 flex justify-center">{action}</div> : null}
    </section>
  );
}
