// shown while a dashboard page loads its data. it has the same rough shape as
// the pages (title, stat tiles, a list) so nothing jumps when the real page shows
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-muted motion-safe:animate-pulse ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="space-y-2">
        <Bar className="h-3 w-32" />
        <Bar className="h-8 w-56" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tams-card space-y-3 p-6">
            <Bar className="h-3 w-20" />
            <Bar className="h-7 w-12" />
          </div>
        ))}
      </div>

      <div className="tams-card space-y-3 p-6">
        <Bar className="h-5 w-40" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Bar key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
