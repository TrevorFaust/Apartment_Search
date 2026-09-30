const TILE = 256;

/**
 * Street map centered on a listing, stitched from a 3x3 block of map tiles
 * (enough to cover a card at any width up to 512px).
 */
export function MapThumb({
  lat,
  lng,
  label,
  zoom = 15,
}: {
  lat: number;
  lng: number;
  label: string;
  zoom?: number;
}) {
  const scale = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const x = ((lng + 180) / 360) * scale;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);

  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
        left: (tx - x) * TILE,
        top: (ty - y) * TILE,
      });
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-deep">
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.key}
          src={t.src}
          alt=""
          width={TILE}
          height={TILE}
          loading="lazy"
          draggable={false}
          className="absolute max-w-none saturate-[0.55] sepia-[0.12] transition-transform duration-500 ease-out-soft"
          style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }}
        />
      ))}
      <svg
        viewBox="0 0 24 32"
        aria-hidden
        className="absolute left-1/2 top-1/2 h-9 w-7 -translate-x-1/2 -translate-y-full drop-shadow-[0_4px_6px_rgb(26_28_24/0.35)] transition-transform duration-300 ease-out-soft group-hover:-translate-y-[110%]"
      >
        <path
          d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0Z"
          fill="var(--color-brass)"
        />
        <circle cx="12" cy="11.5" r="4.5" fill="var(--color-bg-elevated)" />
      </svg>
      <span className="absolute bottom-2.5 left-2.5 bg-bg-elevated/95 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      <span className="absolute bottom-0.5 right-2 text-[8px] text-ink/60">
        © OpenStreetMap contributors
      </span>
    </div>
  );
}
