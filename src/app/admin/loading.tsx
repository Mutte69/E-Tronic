export default function AdminLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center">
          <div className="h-4 w-28 rounded bg-surface-raised animate-pulse" />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-4 h-4 rounded-full border-2 border-copper border-t-transparent animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            Loading…
          </span>
        </div>

        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-line bg-surface animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
