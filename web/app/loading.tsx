export default function Loading() {
  return (
    <div className="rise">
      <div className="mb-6 flex w-fit gap-1 rounded-full border border-line/70 bg-bg-elevated/70 p-1">
        <div className="h-8 w-16 rounded-full bg-ink/10" />
        <div className="h-8 w-24 rounded-full bg-ink/5" />
        <div className="h-8 w-24 rounded-full bg-ink/5" />
      </div>
      <div className="mb-8 h-28 rounded-3xl border border-line/70 bg-bg-elevated/60" />
      <p className="font-display text-2xl italic text-ink-soft">Looking…</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-3xl border border-line/70 bg-bg-elevated shadow-soft"
          />
        ))}
      </div>
    </div>
  );
}
