export default function Loading() {
  return (
    <div className="rise">
      <div className="mb-6 flex gap-1 border-b border-line pb-4">
        <div className="h-8 w-16 bg-ink/10" />
        <div className="h-8 w-24 bg-ink/10" />
        <div className="h-8 w-24 bg-ink/10" />
      </div>
      <div className="mb-8 h-28 border border-line bg-paper-deep/60" />
      <p className="font-display text-2xl italic text-ink-soft">Looking…</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-64 border border-line bg-paper shadow-[3px_3px_0_0_var(--color-line)]"
          />
        ))}
      </div>
    </div>
  );
}
