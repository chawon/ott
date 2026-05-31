export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-var(--mobile-bottom-nav-height)-10rem)] space-y-6 bg-background text-foreground">
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}
