"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ListingRow } from "@/lib/supabase";
import type { MapPoint } from "@/lib/area-maps";
import { formatFull } from "@/lib/dates";
import { MapThumb } from "./map-thumb";

/**
 * Side panel with a listing's details. Most rental sites refuse to load
 * inside another page, so this shows what we scraped plus a link out.
 */
export function ListingPreview({
  listing,
  sourceLabel,
  facts,
  listedAt,
  listedHint,
  mapPoint,
  onClose,
}: {
  listing: ListingRow;
  sourceLabel: string;
  facts: string[];
  listedAt: string;
  listedHint: string;
  mapPoint: MapPoint | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const pricePerSqft =
    listing.price != null && listing.sqft
      ? `$${(listing.price / listing.sqft).toFixed(2)} per sqft`
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={listing.title}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-bg-elevated shadow-lift animate-[preview-in_220ms_var(--ease-out-soft)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/15 bg-bg-elevated px-5 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-brass">{sourceLabel}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="press flex size-9 items-center justify-center text-lg text-ink-soft hover:bg-ink hover:text-metal"
          >
            ×
          </button>
        </div>

        {listing.image_url?.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="aspect-[4/3] w-full bg-bg-deep object-cover"
          />
        ) : null}

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-end justify-between gap-3 border-b border-metal/70 pb-3">
            <span className="font-display text-4xl leading-none font-medium tracking-tight text-ink tabular-nums">
              {listing.price != null ? `$${listing.price.toLocaleString()}` : "—"}
            </span>
            {pricePerSqft && <span className="mb-1 text-xs text-ink-faint">{pricePerSqft}</span>}
          </div>

          <h2 className="font-display text-xl leading-snug font-medium text-ink">{listing.title}</h2>

          {(facts.length > 0 || listing.neighborhood) && (
            <div className="flex flex-wrap gap-1.5">
              {facts.map((fact) => (
                <span
                  key={fact}
                  className="border border-ink/15 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-ink-soft"
                >
                  {fact}
                </span>
              ))}
              {listing.neighborhood && (
                <span className="border border-brass/40 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-brass">
                  {listing.neighborhood}
                </span>
              )}
            </div>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {listing.address && (
              <>
                <dt className="text-ink-faint">Address</dt>
                <dd className="text-ink">{listing.address}</dd>
              </>
            )}
            <dt className="text-ink-faint">City</dt>
            <dd className="text-ink capitalize">
              {[listing.city, listing.state?.toUpperCase()].filter(Boolean).join(", ")}
            </dd>
            <dt className="text-ink-faint">Listed</dt>
            <dd className="text-ink" title={listedHint}>
              {formatFull(listedAt)}
            </dd>
            {!listing.is_active && (
              <>
                <dt className="text-ink-faint">Status</dt>
                <dd className="text-ink">Taken down</dd>
              </>
            )}
          </dl>

          {listing.amenities?.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-brass">Amenities</p>
              <ul className="flex flex-wrap gap-1.5">
                {listing.amenities.map((amenity) => (
                  <li key={amenity} className="bg-bg px-2 py-1 text-xs text-ink-soft">
                    {amenity}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mapPoint && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-brass">
                {mapPoint.approximate ? "General area" : "Location"}
              </p>
              <div className="h-56 border border-ink/15">
                <MapThumb
                  lat={mapPoint.lat}
                  lng={mapPoint.lng}
                  zoom={mapPoint.approximate ? 13 : 15}
                  label={mapPoint.label}
                />
              </div>
            </div>
          )}

          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            className="press mt-2 flex min-h-12 items-center justify-center bg-ink px-5 text-xs uppercase tracking-[0.18em] text-bg-elevated hover:bg-metal hover:text-ink"
          >
            Open on {sourceLabel}
          </a>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
