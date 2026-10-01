import Link from "next/link";
import { supabaseAdmin, type ListingRow, type SearchLocation } from "@/lib/supabase";
import { ListingCard } from "./listing-card";
import { PursuitFlights } from "./pursuit-flight";
import { CityMultiSelect, NeighborhoodMultiSelect } from "./filter-multi-selects";
import { AutoSubmitSelect } from "./auto-submit-select";
import { FilterForm } from "./filter-form";
import { LinkPending } from "./link-pending";
import { PageStrip } from "./page-strip";
import { FilterInput } from "./filter-input";
import { SOURCE_OPTIONS, titleCase } from "@/lib/sources";
import { parseAreas } from "@/lib/geo";
import { AreaFilter } from "./area-filter";
import { getViewer } from "@/lib/auth";
import { resolveMapPoints } from "@/lib/area-maps";
import { getMarks } from "@/lib/marks";
import {
  applyListingFilters,
  applyListingSort,
  buildFilterQueryString,
  buildRadiusCenters,
  fetchDistinctCities,
  fetchDistinctNeighborhoods,
  distinctNeighborhoodOptionsFromListings,
  fetchMatchStats,
  filterByGeoScope,
  hasActiveFilters,
  hasGeoScope,
  narrowToGeoScope,
  type GeoScope,
  MAX_LISTING_AGE_DAYS,
  neighborhoodFilterLabel,
  PAGE_SIZE,
  parseFilters,
  parsePage,
  POSTED_WITHIN_OPTIONS,
  SORT_OPTIONS,
  summarizeListings,
  type MatchStats,
} from "@/lib/listings-query";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const FORM_ID = "listing-filters";

const TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New (24h)" },
  { id: "favorites", label: "Favorites" },
  { id: "pursuing", label: "Pursuing" },
  { id: "hidden", label: "Hidden" },
] as const;

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

function matchCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "listing" : "listings"}`;
}

function matchSummary(stats: MatchStats | null, neighborhoodCount: number): string {
  const parts: string[] = [];
  if (stats?.medianPrice != null) {
    const range =
      stats.minPrice != null && stats.maxPrice != null && stats.minPrice !== stats.maxPrice
        ? `, ranging ${dollars(stats.minPrice)} to ${dollars(stats.maxPrice)}`
        : "";
    parts.push(`Median rent ${dollars(stats.medianPrice)}${range}`);
  }
  if (neighborhoodCount > 0) {
    parts.push(
      `${parts.length ? "across" : "Across"} ${neighborhoodCount} ${neighborhoodCount === 1 ? "neighborhood" : "neighborhoods"}`,
    );
  }
  const sentence = parts.length ? `${parts.join(" ")}.` : "";
  const fresh =
    stats && stats.newToday > 0
      ? ` ${stats.newToday.toLocaleString("en-US")} arrived in the last day.`
      : "";
  return `${sentence}${fresh}`.trim();
}

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

  const radiusActive =
    filters.radiusMiles && Number.isFinite(Number(filters.radiusMiles));
  const hasRadius =
    radiusActive &&
    searchLocations.some((l) => l.center_lat != null && l.center_lng != null);
  const drawnArea = parseAreas(filters.area);
  const geoScope: GeoScope = {
    radius: hasRadius ? { miles: filters.radiusMiles, locations: searchLocations } : undefined,
    area: drawnArea ?? undefined,
  };
  const geoActive = hasGeoScope(geoScope);

  const radiusCities = searchLocations
    .filter((l) => l.center_lat != null && l.center_lng != null)
    .map((l) => titleCase(l.city));
  const radiusHint = radiusCities.length
    ? `from downtown ${radiusCities.join(" and ")}`
    : "from downtown; pick a city first";

  const mapCenters = (filters.cities.length ? searchLocations : prefLocations)
    .filter((l) => l.center_lat != null && l.center_lng != null)
    .map((l) => ({ lat: l.center_lat!, lng: l.center_lng! }));

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
        fetchDistinctNeighborhoods(buildFacetQuery, filters.cities, geoScope),
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

  let listings: ListingRow[] = [];
  let totalCount = 0;
  let stats: MatchStats | null = null;

  if (geoActive) {
    const { data, error } = await applyListingSort(
      narrowToGeoScope(
        applyListingFilters(supabaseAdmin().from("listings").select("*"), filters, { marks }),
        geoScope,
      ),
      filters.sort,
    ).limit(10000);

    if (error) {
      return <LoadError message={error.message} />;
    }

    const allFiltered = filterByGeoScope((data ?? []) as ListingRow[], geoScope);
    totalCount = allFiltered.length;
    stats = summarizeListings(allFiltered);
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

    const [{ data, error }, matchStats] = await Promise.all([
      applyListingSort(
        applyListingFilters(supabaseAdmin().from("listings").select("*"), filters, { marks }),
        filters.sort,
      ).range(offset, offset + PAGE_SIZE - 1),
      fetchMatchStats(
        () => applyListingFilters(supabaseAdmin().from("listings"), filters, { marks }),
        totalCount,
      ).catch((err) => {
        console.error("Failed to load match stats:", err);
        return null;
      }),
    ]);

    if (error) {
      return <LoadError message={error.message} />;
    }

    listings = (data ?? []) as ListingRow[];
    stats = matchStats;
  }

  let { neighborhoodOptions, cityOptions } = await facetsPromise;

  if (neighborhoodOptions.length === 0 && listings.length > 0) {
    neighborhoodOptions = distinctNeighborhoodOptionsFromListings(
      listings,
      filters.cities,
    );
  }
  const availableNeighborhoods = neighborhoodOptions.length;
  // A picked neighborhood can fall outside new filters; keep it listed so it can be unchecked.
  const optionValues = new Set(neighborhoodOptions.map((o) => o.value));
  const strandedPicks = filters.neighborhoods
    .filter((value) => !optionValues.has(value))
    .map((value) => ({ value, label: neighborhoodFilterLabel(value, filters.cities) }));
  if (strandedPicks.length) neighborhoodOptions = [...neighborhoodOptions, ...strandedPicks];
  if (cityOptions.length === 0 && listings.length > 0) {
    cityOptions = [...new Set(listings.map((l) => l.city).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const mapPoints = await resolveMapPoints(listings);
  const pursuingCount = Object.keys(marks.pursuits).length;

  const tabHref = (id: string) => {
    const qs = buildFilterQueryString(filters, { tab: id, page: "1" });
    return qs ? `/?${qs}` : "/";
  };

  const clearAllQs = new URLSearchParams();
  if (filters.tab !== "all") clearAllQs.set("tab", filters.tab);
  if (filters.sort !== "newest") clearAllQs.set("sort", filters.sort);
  const clearAllHref = clearAllQs.size ? `/?${clearAllQs}` : "/";
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="rise">
      <PursuitFlights />
      <div className="mb-8 border-b border-ink/15 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-brass">
            {filtersActive ? "Matching your filters" : "On the board"}
          </p>
          <p className="mt-2 font-display text-4xl leading-none font-medium tracking-tight text-ink sm:text-5xl">
            {totalCount > 0 ? matchCountLabel(totalCount) : "No matches"}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            {totalCount > 0
              ? matchSummary(stats, filters.neighborhoods.length || availableNeighborhoods) ||
                "Track a place, add a note if you want, then send it to Pursuing."
              : filters.tab === "pursuing"
                ? "Track a place from the board, then send it here."
                : filtersActive
                  ? "No matches. Loosen a filter."
                  : "A new batch of places shows up every morning."}
          </p>
        </div>
        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap border border-ink/20 bg-bg-elevated">
            {TABS.map((t) => (
              <Link
                key={t.id}
                id={t.id === "pursuing" ? "pursuing-tab" : undefined}
                href={tabHref(t.id)}
                aria-current={filters.tab === t.id ? "page" : undefined}
                className={`press inline-flex min-h-11 items-center px-3 text-xs uppercase tracking-[0.12em] sm:px-4 sm:tracking-[0.14em] ${
                  filters.tab === t.id
                    ? "bg-ink text-bg-elevated"
                    : "text-ink-soft hover:bg-accent-wash hover:text-ink"
                }`}
              >
                <LinkPending>
                  {t.id === "pursuing" && pursuingCount > 0
                    ? `Pursuing ${pursuingCount}`
                    : t.label}
                </LinkPending>
              </Link>
            ))}
          </div>
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
        className="sheet mb-4 grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {filters.tab !== "all" && (
          <input type="hidden" name="tab" value={filters.tab} />
        )}
        <FilterInput
          label="Max $"
          name="max_price"
          defaultValue={filters.maxPrice}
        />
        <FilterInput
          label="Beds ≥"
          name="beds"
          defaultValue={filters.beds}
        />
        <FilterInput
          label="Sqft ≥"
          name="min_sqft"
          defaultValue={filters.minSqft}
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
          decimals
          hint={radiusHint}
        />
        <AreaFilter value={filters.area} centers={mapCenters} />
        <AutoSubmitSelect
          label="Source"
          name="source"
          defaultValue={filters.source}
          options={SOURCE_OPTIONS}
          clearable
        />
        {/* Same label row + control height as the fields, so the buttons line up with them. */}
        <div className="flex flex-col gap-1 self-start">
          <span aria-hidden className="min-h-5" />
          <div className="flex h-11 items-center gap-2">
            <button
              suppressHydrationWarning
              type="submit"
              className="press flex h-full items-center bg-ink px-5 text-xs uppercase tracking-[0.16em] text-bg-elevated hover:bg-metal hover:text-ink group-aria-busy:cursor-progress group-aria-busy:opacity-60"
            >
              <span className="group-aria-busy:hidden">Filter</span>
              <span className="hidden animate-pulse group-aria-busy:inline">Filtering…</span>
            </button>
            {hasActiveFilters(filters) && (
              <Link
                href={clearAllHref}
                className="press flex h-full items-center border border-ink/20 px-4 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
              >
                <LinkPending>Clear all</LinkPending>
              </Link>
            )}
          </div>
        </div>
      </FilterForm>

      <p className="mb-8 text-xs leading-relaxed tracking-wide text-ink-faint">
        {filtersActive && (
          <span className="font-medium text-ink">
            {`${matchCountLabel(totalCount)} ${totalCount === 1 ? "matches" : "match"} these filters. `}
          </span>
        )}
        {`Only listings posted in the last ${MAX_LISTING_AGE_DAYS} days that are still online. `}
        Each one is re-checked daily and dropped once it&apos;s taken down.
      </p>

      {radiusActive && !hasRadius && (
        <p className="mb-4 border border-dashed border-brass/60 bg-bg-elevated p-4 text-sm text-ink-soft">
          Radius needs a city that already has a downtown pin. Pick one Lease
          Locator checks each morning.
        </p>
      )}

      {geoActive && listings.length === 0 && totalCount === 0 && (
        <p className="mb-4 border border-dashed border-brass/60 bg-bg-elevated p-4 text-sm text-ink-soft">
          {drawnArea ? "No listings inside the drawn area" : `No listings within ${filters.radiusMiles} mi`}.
          Only listings with an exact map pin can match, and many don&apos;t have one yet.
        </p>
      )}

      {totalCount === 0 ? (
        <div className="sheet px-8 py-20 text-center">
          <p className="font-display text-4xl italic text-ink">
            {filters.tab === "pursuing" ? "Nothing in pursuit." : "Nothing here yet."}
          </p>
          <p className="mt-2 text-sm text-ink-faint">
            {emptyHint(filters.tab, filtersActive)}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                index={i}
                now={now}
                favorite={favoriteIds.has(l.id)}
                hidden={hiddenIds.has(l.id)}
                pursuit={marks.pursuits[l.id] ?? null}
                fileAway={filters.tab !== "pursuing"}
                mapPoint={mapPoints.get(l.id) ?? null}
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

function emptyHint(tab: string, filtersActive: boolean): string {
  if (tab === "pursuing") {
    return "Hit Track on a listing, jot a tour or a note if you have one, then send it here.";
  }
  if (tab === "favorites") return "Save a place from the board and it keeps a seat here.";
  if (tab === "hidden") return "Hide a listing when you are done looking at it.";
  if (filtersActive) {
    return "Picky, picky. Drop a filter and look again. New places show up every morning.";
  }
  return "A new batch of places shows up every morning.";
}

function LoadError({ message }: { message: string }) {
  return (
    <p className="border border-ink/20 bg-bg-deep p-4 text-sm text-ink">
      Couldn&apos;t load listings: {message}
    </p>
  );
}
