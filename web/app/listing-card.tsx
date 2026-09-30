"use client";

import { useState, useTransition } from "react";
import type { ListingRow } from "@/lib/supabase";
import { formatFull, formatRelative, latestIso } from "@/lib/dates";
import { toggleFavorite, toggleHidden } from "./actions";

const SOURCE_LABELS: Record<string, string> = {
  craigslist: "Craigslist",
  apartments_com: "Apartments.com",
  seattle_rentals: "SeattleRentals",
  chicago_rentals: "ChicagoRentals",
  chicago_apartment_finders: "ChicagoApartmentFinders",
  urban_abodes: "UrbanAbodes",
  domu: "Domu",
};

export function ListingCard({
  listing,
  index,
  now,
}: {
  listing: ListingRow;
  index: number;
  now: number;
}) {
  const [pending, startTransition] = useTransition();
  const [imageFailed, setImageFailed] = useState(false);
  const isNew = now - new Date(listing.first_seen_at).getTime() < 24 * 60 * 60 * 1000;
  const isGone = !listing.is_active;
  const verifiedAt = latestIso(listing.last_seen_at, listing.last_checked_at);
  const sourceLabel = SOURCE_LABELS[listing.source] ?? listing.source;

  const facts = [
    listing.bedrooms != null
      ? listing.bedrooms === 0
        ? "Studio"
        : `${listing.bedrooms} bd`
      : null,
    listing.bathrooms != null ? `${listing.bathrooms} ba` : null,
    listing.sqft != null ? `${listing.sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean);

  return (
    <article
      className={`rise group relative flex flex-col border border-line bg-bg-elevated shadow-[3px_3px_0_0_var(--color-line)] transition-[transform,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-1 hover:border-accent/60 hover:shadow-[6px_6px_0_0_var(--color-accent)] ${
        isGone ? "opacity-70 hover:opacity-100" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="relative block"
        aria-label={`Open ${listing.title} on ${sourceLabel}`}
      >
        <div className="relative h-40 overflow-hidden border-b border-line bg-bg-deep">
          {listing.image_url?.startsWith("http") && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-105"
              loading="lazy"
              onError={() => setImageFailed(true)}
              ref={(img) => {
                // Images that failed before hydration never fire onError.
                if (img?.complete && img.currentSrc && img.naturalWidth === 0) {
                  setImageFailed(true);
                }
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-4xl italic text-ink-faint transition-colors group-hover:text-accent">
              no photo
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/15" />
          <span className="pointer-events-none absolute bottom-2 right-2 translate-y-1 bg-bg-elevated px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent-dim opacity-0 shadow-[2px_2px_0_0_var(--color-accent)] transition-all duration-300 ease-out-soft group-hover:translate-y-0 group-hover:opacity-100">
            View on {sourceLabel} ↗
          </span>
          {isGone ? (
            <span className="absolute left-2 top-2 bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-bg-elevated">
              No longer listed
            </span>
          ) : (
            isNew && (
              <span className="absolute left-2 top-2 bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-bg-elevated">
                New
              </span>
            )
          )}
        </div>
      </a>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl font-semibold text-accent">
            {listing.price != null ? `$${listing.price.toLocaleString()}` : "—"}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">
            {sourceLabel}
          </span>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="font-display text-base leading-snug decoration-accent/60 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {listing.title}
        </a>
        <p className="text-xs text-ink-soft">
          {facts.join(" · ")}
          {facts.length > 0 && listing.neighborhood ? " · " : ""}
          {listing.neighborhood ?? ""}
        </p>
        {listing.address && (
          <p className="text-xs text-ink-faint">{listing.address}</p>
        )}

        <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-dashed border-line pt-2 text-[11px] text-ink-faint">
          {listing.posted_at && (
            <DateFact
              label="Posted"
              iso={listing.posted_at}
              now={now}
              hint={`Posted on ${sourceLabel}`}
            />
          )}
          <DateFact
            label="Added"
            iso={listing.first_seen_at}
            now={now}
            hint="First pulled into Lease Locator"
          />
          {verifiedAt && (
            <DateFact
              label={isGone ? "Gone as of" : "Verified"}
              iso={verifiedAt}
              now={now}
              hint={
                isGone
                  ? "The listing page was taken down"
                  : "Last confirmed still online"
              }
            />
          )}
        </dl>

        <div className="mt-auto flex gap-1.5 pt-3">
          <button
            // Browser autofill extensions inject attributes (fdprocessedid)
            // before hydration; ignore those mismatches.
            suppressHydrationWarning
            disabled={pending}
            aria-pressed={listing.is_favorite}
            onClick={() =>
              startTransition(() =>
                toggleFavorite(listing.id, !listing.is_favorite),
              )
            }
            className={`press flex-1 border px-2 py-1 text-xs disabled:opacity-50 ${
              listing.is_favorite
                ? "border-accent bg-accent text-bg-elevated hover:border-accent-dim hover:bg-accent-dim"
                : "border-ink/25 hover:border-accent hover:bg-accent-wash hover:text-accent-dim"
            }`}
          >
            {pending ? "…" : listing.is_favorite ? "★ Saved" : "☆ Save"}
          </button>
          <button
            suppressHydrationWarning
            disabled={pending}
            onClick={() =>
              startTransition(() => toggleHidden(listing.id, !listing.is_hidden))
            }
            className="press border border-ink/25 px-3 py-1 text-xs text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated disabled:opacity-50"
          >
            {listing.is_hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      </div>
    </article>
  );
}

function DateFact({
  label,
  iso,
  now,
  hint,
}: {
  label: string;
  iso: string;
  now: number;
  hint: string;
}) {
  return (
    <div
      title={`${hint}: ${formatFull(iso)}`}
      className="flex cursor-help gap-1 decoration-dotted underline-offset-2 transition-colors hover:text-ink hover:underline"
    >
      <dt>{label}</dt>
      <dd className="font-medium text-ink-soft">{formatRelative(iso, now)}</dd>
    </div>
  );
}
