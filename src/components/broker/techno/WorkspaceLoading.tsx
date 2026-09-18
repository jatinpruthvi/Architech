export function WorkspaceLoading() {
  return (
    <div role="status" aria-label="Loading broker workspace" className="space-y-5">
      <span className="sr-only">Loading your workspace…</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="h-7 w-52 animate-pulse rounded-lg bg-[var(--tp-border)] motion-reduce:animate-none" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--tp-border)] bg-white motion-reduce:animate-none" />
          ))}
        </div>
        <div className="space-y-3 rounded-2xl border border-[var(--tp-border)] bg-white p-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--tp-ink)_6%,var(--tp-surface))] motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
