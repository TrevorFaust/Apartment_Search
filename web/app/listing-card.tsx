"use client";

import { useTransition } from "react";
import type { ListingRow } from "@/lib/supabase";
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
}: {
  listing: ListingRow;
  index: number;
}) {
  const [pending, startTransition] = useTransition();
  const isNew =
    Date.now() - new Date(listing.first_seen_at).getTime() < 24 * 60 * 60 * 1000;

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
      className="rise group relative flex flex-col border border-line bg-paper shadow-[3px_3px_0_0_var(--color-line)] transition-shadow hover:shadow-[5px_5px_0_0_var(--color-rust)]"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <a href={listing.url} target="_blank" rel="noreferrer" className="block">
        <div className="relative h-40 overflow-hidden border-b border-line bg-paper-deep">
          {listing.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-4xl italic text-ink-faint">
              no photo
            </div>
          )}
          {isNew && (
            <span className="absolute left-2 top-2 bg-rust px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-paper">
              New
            </span>
          )}
        </div>
      </a>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl font-semibold text-moss">
            {listing.price != null ? `$${listing.price.toLocaleString()}` : "—"}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">
            {SOURCE_LABELS[listing.source] ?? listing.source}
          </span>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="font-display text-base leading-snug hover:text-rust"
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

        <div className="mt-auto flex gap-1 pt-3">
          <button
            // Browser autofill extensions inject attributes (fdprocessedid)
            // before hydration; ignore those mismatches.
            suppressHydrationWarning
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                toggleFavorite(listing.id, !listing.is_favorite),
              )
            }
            className={`flex-1 border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
              listing.is_favorite
                ? "border-rust bg-rust text-paper"
                : "border-ink/25 hover:border-rust hover:text-rust"
            }`}
          >
            {listing.is_favorite ? "★ Saved" : "☆ Save"}
          </button>
          <button
            suppressHydrationWarning
            disabled={pending}
            onClick={() =>
              startTransition(() => toggleHidden(listing.id, !listing.is_hidden))
            }
            className="border border-ink/25 px-2 py-1 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {listing.is_hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      </div>
    </article>
  );
}
