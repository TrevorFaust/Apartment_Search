import Link from "next/link";
import { supabaseAdmin, type ListingRow, type SearchLocation } from "@/lib/supabase";
import { ListingCard } from "./listing-card";
import { CityMultiSelect, NeighborhoodMultiSelect } from "./filter-multi-selects";
import { AutoSubmitSelect } from "./auto-submit-select";
import { FilterForm } from "./filter-form";
import { LinkPending } from "./link-pending";
import { PageStrip } from "./page-strip";
import { FilterInput } from "./filter-input";
import { SOURCE_OPTIONS } from "@/lib/sources";
import { getViewer } from "@/lib/auth";
import { getMarks } from "@/lib/marks";
import {
  applyListingFilters,
  applyListingSort,
  buildFilterQueryString,
  buildRadiusCenters,
  fetchDistinctCities,
  fetchDistinctNeighborhoods,
  distinctNeighborhoodOptionsFromListings,
  filterByRadius,
  hasActiveFilters,
  MAX_LISTING_AGE_DAYS,
  PAGE_SIZE,
  parseFilters,
  parsePage,
  POSTED_WITHIN_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/listings-query";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const FORM_ID = "listing-filters";

const TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New (24h)" },
  { id: "favorites", label: "Favorites" },
  { id: "hidden", label: "Hidden" },
] as const;

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const page = parsePage(filters.page);
  const now = Date.now();
  const marks = await getMarks(await getViewer());
  const favoriteIds = new Set(marks.favorites);
  const hiddenIds = new Set(marks.hidden);

  // Preferences only supply geocoded city centers for optional radius — not browse filters.
  const { data: prefsData } = await supabaseAdmin()
    .from("preferences")
    .select("locations")
    .eq("key", "default")
    .single();

  const prefLocations: SearchLocation[] = (prefsData?.locations ?? []).map(
    (l: SearchLocation) => ({
      city: l.city.toLowerCase(),
      state: l.state.toLowerCase(),
      center_lat: l.center_lat ?? null,
      center_lng: l.center_lng ?? null,
    }),
  );

  const searchLocations = buildRadiusCenters(filters.cities, prefLocations);

  const buildFacetQuery = () =>
    applyListingFilters(supabaseAdmin().from("listings"), filters, {
      includeNeighborhoodFilter: false,
      includeCityFilter: false,
      select: "id",
      marks,
    });

  const facetsPromise = (async () => {
    try {
      const [neighborhoodOptions, cityOptions] = await Promise.all([
        fetchDistinctNeighborhoods(buildFacetQuery, filters.cities),
        fetchDistinctCities(buildFacetQuery),
      ]);
      return { neighborhoodOptions, cityOptions };
    } catch (err) {
      console.error("Failed to load filter facets:", err);
      return {
        neighborhoodOptions: [] as Awaited<
          ReturnType<typeof fetchDistinctNeighborhoods>
        >,
        cityOptions: [] as string[],
      };
    }
  })();

  const radiusActive =
    filters.radiusMiles && Number.isFinite(Number(filters.radiusMiles));
  const hasRadius =
    radiusActive &&
    searchLocations.some((l) => l.center_lat != null && l.center_lng != null);

  let listings: ListingRow[] = [];
  let totalCount = 0;

  if (hasRadius) {
    const { data, error } = await applyListingSort(
      applyListingFilters(supabaseAdmin().from("listings").select("*"), filters, { marks }),
      filters.sort,
    ).limit(10000);

    if (error) {
      return <LoadError message={error.message} />;
    }

    const allFiltered = filterByRadius(
      (data ?? []) as ListingRow[],
      filters.radiusMiles,
      searchLocations,
    );
    totalCount = allFiltered.length;
    const offset = (page - 1) * PAGE_SIZE;
    listings = allFiltered.slice(offset, offset + PAGE_SIZE);
  } else {
    const { count, error: countError } = await applyListingFilters(
      supabaseAdmin()
        .from("listings")
        .select("id", { count: "exact", head: true }),
      filters,
      { marks },
    );

    if (countError) {
      return <LoadError message={countError.message} />;
    }

    totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * PAGE_SIZE;

    const { data, error } = await applyListingSort(
      applyListingFilters(supabaseAdmin().from("listings").select("*"), filters, { marks }),
      filters.sort,
    ).range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      return <LoadError message={error.message} />;
    }

    listings = (data ?? []) as ListingRow[];
  }

  let { neighborhoodOptions, cityOptions } = await facetsPromise;

  if (neighborhoodOptions.length === 0 && listings.length > 0) {
    neighborhoodOptions = distinctNeighborhoodOptionsFromListings(
      listings,
      filters.cities,
    );
  }
  if (cityOptions.length === 0 && listings.length > 0) {
    cityOptions = [...new Set(listings.map((l) => l.city).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const showingFrom = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, totalCount);

  const tabHref = (id: string) => {
    const qs = buildFilterQueryString(filters, { tab: id, page: "1" });
    return qs ? `/?${qs}` : "/";
  };

  const clearAllQs = new URLSearchParams();
  if (filters.tab !== "all") clearAllQs.set("tab", filters.tab);
  if (filters.sort !== "newest") clearAllQs.set("sort", filters.sort);
  const clearAllHref = clearAllQs.size ? `/?${clearAllQs}` : "/";

  return (
    <div className="rise">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full border border-line/70 bg-bg-elevated/70 p-1 shadow-soft">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={tabHref(t.id)}
              aria-current={filters.tab === t.id ? "page" : undefined}
              className={`press rounded-full px-4 py-1.5 text-sm ${
                filters.tab === t.id
                  ? "bg-ink text-bg-elevated shadow-soft hover:bg-accent-dim"
                  : "text-ink-soft hover:bg-accent-wash hover:text-accent-dim"
              }`}
            >
              <LinkPending>{t.label}</LinkPending>
            </Link>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <span className="font-display text-sm italic text-ink-soft">
            {totalCount === 0
              ? "0 listings"
              : `Showing ${showingFrom}–${showingTo} of ${totalCount}`}
          </span>
          <AutoSubmitSelect
            label="Sort"
            name="sort"
            form={FORM_ID}
            defaultValue={filters.sort}
            options={SORT_OPTIONS}
            inline
          />
        </div>
      </div>

      <FilterForm
        id={FORM_ID}
        className="mb-3 grid grid-cols-2 gap-3 rounded-3xl border border-line/70 bg-bg-elevated/60 p-5 shadow-soft sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {filters.tab !== "all" && (
          <input type="hidden" name="tab" value={filters.tab} />
        )}
        <FilterInput
          label="Max $"
          name="max_price"
          defaultValue={filters.maxPrice}
          type="number"
        />
        <FilterInput
          label="Beds ≥"
          name="beds"
          defaultValue={filters.beds}
          type="number"
        />
        <FilterInput
          label="Sqft ≥"
          name="min_sqft"
          defaultValue={filters.minSqft}
          type="number"
        />
        <AutoSubmitSelect
          label="Posted within"
          name="posted_within"
          defaultValue={filters.postedWithin}
          options={POSTED_WITHIN_OPTIONS}
          clearable
        />
        <CityMultiSelect options={cityOptions} selected={filters.cities} />
        <NeighborhoodMultiSelect
          options={neighborhoodOptions}
          selected={filters.neighborhoods}
        />
        <FilterInput
          label="Radius (mi)"
          name="radius_miles"
          defaultValue={filters.radiusMiles}
          type="number"
          hint="from downtown; pick a city first"
        />
        <AutoSubmitSelect
          label="Source"
          name="source"
          defaultValue={filters.source}
          options={SOURCE_OPTIONS}
          clearable
        />
        {/* Same label row + control height as the fields, so the buttons line up with them. */}
        <div className="flex flex-col gap-1 self-start">
          <span aria-hidden className="min-h-4" />
          <div className="flex h-[2.4375rem] items-center gap-2">
            <button
              suppressHydrationWarning
              type="submit"
              className="press flex h-full items-center rounded-full bg-ink px-5 text-sm text-bg-elevated shadow-soft hover:bg-accent hover:shadow-glow group-aria-busy:cursor-progress group-aria-busy:opacity-60"
            >
              <span className="group-aria-busy:hidden">Filter</span>
              <span className="hidden animate-pulse group-aria-busy:inline">Filtering…</span>
            </button>
            {hasActiveFilters(filters) && (
              <Link
                href={clearAllHref}
                className="press flex h-full items-center rounded-full border border-line px-4 text-sm text-ink-soft hover:border-accent hover:bg-accent-wash hover:text-accent-dim"
              >
                <LinkPending>Clear all</LinkPending>
              </Link>
            )}
          </div>
        </div>
      </FilterForm>

      <p className="mb-8 pl-2 text-[11px] text-ink-faint">
        {`Only listings posted in the last ${MAX_LISTING_AGE_DAYS} days that are still online. `}
        Each one is re-checked daily and dropped once it&apos;s taken down.
      </p>

      {radiusActive && !hasRadius && (
        <p className="mb-4 rounded-2xl border border-dashed border-ink/25 p-4 text-xs text-ink-soft">
          Radius needs at least one city selected that has a geocoded downtown
          center (currently the cities the scraper searches).
        </p>
      )}

      {hasRadius && listings.length === 0 && totalCount === 0 && (
        <p className="mb-4 rounded-2xl border border-dashed border-ink/25 p-4 text-xs text-ink-soft">
          No listings within {filters.radiusMiles} mi. Listings may lack
          coordinates yet — run <code>npm run scrape</code> to geocode them.
        </p>
      )}

      {totalCount === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink/25 bg-bg-elevated/40 p-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">
            Nothing here yet.
          </p>
          <p className="mt-2 text-sm text-ink-faint">
            Try widening the filters. New listings arrive with each morning&apos;s
            scrape.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                index={i}
                now={now}
                favorite={favoriteIds.has(l.id)}
                hidden={hiddenIds.has(l.id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <PageStrip
              current={safePage}
              total={totalPages}
              query={buildFilterQueryString(filters, { page: "1" })}
            />
          )}
        </>
      )}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-ink/20 bg-bg-deep p-4 text-sm text-ink">
      Couldn&apos;t load listings: {message}
    </p>
  );
}
