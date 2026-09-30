export default function Loading() {
  return (
    <div className="rise">
      <div className="mb-8 border-b border-ink/15 pb-6">
        <div className="h-3 w-28 bg-brass/30" />
        <div className="mt-3 h-14 w-24 bg-ink/10" />
      </div>
      <div className="sheet mb-8 h-36" />
      <p className="font-display text-3xl italic text-ink">Looking…</p>
      <div className="mt-8 grid gap-px bg-ink/20 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-96 animate-pulse bg-bg-elevated" />
        ))}
      </div>
    </div>
  );
}
