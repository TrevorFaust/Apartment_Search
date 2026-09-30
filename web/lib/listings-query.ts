import type { ListingRow, SearchLocation } from "./supabase";
import { parseAmount } from "./amounts";
import { withinRadiusMiles } from "./geo";
import {
  buildNeighborhoodOptions,
  looksLikeNeighborhoodName,
  parseNeighborhoodFilter,
  type NeighborhoodOption,
} from "./neighborhoods";

export type { NeighborhoodOption };
export { looksLikeNeighborhoodName, neighborhoodFilterLabel } from "./neighborhoods";
// Supabase query builder types widen as filters chain; keep this loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryLike = any;

export const PAGE_SIZE = 50;

/** Keep in sync with MAX_LISTING_AGE_DAYS in scraper/src/liveness.ts. */
export const MAX_LISTING_AGE_DAYS = 60;

export const POSTED_WITHIN_OPTIONS = [
  { value: "1", label: "24 hours" },
  { value: "3", label: "3 days" },
  { value: "7", label: "Week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "Month" },
  { value: "", label: "2 months" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest posted", column: "listed_at", ascending: false },
  { value: "oldest", label: "Oldest posted", column: "listed_at", ascending: true },
  { value: "price_asc", label: "Price: low → high", column: "price", ascending: true },
  { value: "price_desc", label: "Price: high → low", column: "price", ascending: false },
  { value: "sqft_desc", label: "Size: largest", column: "sqft", ascending: false },
  { value: "sqft_asc", label: "Size: smallest", column: "sqft", ascending: true },
  { value: "beds_desc", label: "Most bedrooms", column: "bedrooms", ascending: false },
] as const;

export type ListingFilters = {
  tab: string;
  maxPrice: string;
  beds: string;
  minSqft: string;
  neighborhoods: string[];
  cities: string[];
  source: string;
  radiusMiles: string;
  postedWithin: string;
  sort: string;
  page: string;
};

export function parseListParam(
  params: { [key: string]: string | string[] | undefined },
  key: string,
): string[] {
  const raw = params[key];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string" && raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function parseFilters(
  params: { [key: string]: string | string[] | undefined },
): ListingFilters {
  const str = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : "";
  const amount = (k: string) => (parseAmount(str(k)) == null ? "" : str(k));

  return {
    tab: str("tab") || "all",
    maxPrice: amount("max_price"),
    beds: amount("beds"),
    minSqft: amount("min_sqft"),
    neighborhoods: parseListParam(params, "neighborhood"),
    cities: parseListParam(params, "city"),
    source: str("source"),
    radiusMiles: amount("radius_miles"),
    postedWithin: POSTED_WITHIN_OPTIONS.some((o) => o.value === str("posted_within"))
      ? str("posted_within")
      : "",
    sort: SORT_OPTIONS.some((o) => o.value === str("sort")) ? str("sort") : "newest",
    page: str("page") || "1",
  };
}

export function applyListingSort(query: QueryLike, sort: string): QueryLike {
  const option = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
  query = query.order(option.column, {
    ascending: option.ascending,
    nullsFirst: false,
  });
  if (option.column !== "listed_at") {
    query = query.order("listed_at", { ascending: false });
  }
  return query.order("id");
}

export function parsePage(page: string | undefined): number {
  const n = Number(page);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** City centers for radius on the browse page — only for cities in the active filter. */
export function buildRadiusCenters(
  filterCities: string[],
  prefLocations: SearchLocation[],
): SearchLocation[] {
  if (filterCities.length === 0) return [];
  return filterCities.map((city) => {
    const c = city.toLowerCase();
    const pref = prefLocations.find((l) => l.city.toLowerCase() === c);
    return (
      pref ?? { city: c, state: "", center_lat: null, center_lng: null }
    );
  });
}

export function applyListingFilters(
  query: QueryLike,
  filters: ListingFilters,
  options?: {
    includeNeighborhoodFilter?: boolean;
    includeCityFilter?: boolean;
    includeFreshnessFilter?: boolean;
    select?: string;
    /** The visitor's saved / hidden listing ids. */
    marks?: { favorites: string[]; hidden: string[] };
  },
): QueryLike {
  // PostgrestQueryBuilder (before .select()) has no .eq(); PostgrestFilterBuilder does.
  if (typeof query.eq !== "function") {
    query = query.select(options?.select ?? "id");
  }

  const includeNeighborhood = options?.includeNeighborhoodFilter !== false;
  const includeCity = options?.includeCityFilter !== false;
  const { tab } = filters;

  // Saved listings stay visible past the age limit (flagged on the card if
  // gone); everything else must be recent and still online.
  if (tab !== "favorites" && options?.includeFreshnessFilter !== false) {
    query = query
      .eq("is_active", true)
      .eq("price_outlier", false)
      .gte("listed_at", daysAgoIso(MAX_LISTING_AGE_DAYS));
  }

  const favorites = options?.marks?.favorites ?? [];
  const hidden = options?.marks?.hidden ?? [];
  const idList = (ids: string[]) => (ids.length > 0 ? ids : [NO_MATCH_ID]);

  if (tab === "hidden") {
    query = query.in("id", idList(hidden));
  } else {
    if (hidden.length > 0) query = query.not("id", "in", `(${hidden.join(",")})`);
    if (tab === "new") {
      query = query.gte("first_seen_at", daysAgoIso(1));
    }
    if (tab === "favorites") query = query.in("id", idList(favorites));
  }

  if (filters.postedWithin) {
    query = query.gte("listed_at", daysAgoIso(Number(filters.postedWithin)));
  }

  if (filters.maxPrice) query = query.lte("price", Number(filters.maxPrice));
  if (filters.beds) query = query.gte("bedrooms", Number(filters.beds));
  if (filters.minSqft) query = query.gte("sqft", Number(filters.minSqft));
  if (includeCity && filters.cities.length > 0) {
    query = query.in("city", filters.cities);
  }
  if (includeNeighborhood && filters.neighborhoods.length > 0) {
    const clauses = filters.neighborhoods.map((token) => {
      const { city, name } = parseNeighborhoodFilter(token);
      const pattern = `%${name.replace(/,/g, "")}%`;
      if (city) {
        return `and(city.eq.${city},neighborhood.ilike.${pattern})`;
      }
      return `neighborhood.ilike.${pattern}`;
    });
    query = query.or(clauses.join(","));
  }
  if (filters.source) query = query.eq("source", filters.source);

  return query;
}

const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function filterByRadius(
  listings: ListingRow[],
  radiusMiles: string | number | null | undefined,
  locations: SearchLocation[],
): ListingRow[] {
  const radius = radiusMiles ? Number(radiusMiles) : null;
  if (!radius || !Number.isFinite(radius)) return listings;

  const centers = new Map<string, { lat: number; lng: number }>();
  for (const loc of locations) {
    if (loc.center_lat != null && loc.center_lng != null) {
      centers.set(`${loc.city}:${loc.state}`, {
        lat: loc.center_lat,
        lng: loc.center_lng,
      });
    }
  }
  if (centers.size === 0) return listings;

  return listings.filter((l) => {
    if (l.latitude == null || l.longitude == null) return false;
    const key = `${l.city.toLowerCase()}:${(l.state ?? "").toLowerCase()}`;
    const center = centers.get(key);
    if (!center) return false;
    return withinRadiusMiles(
      center,
      { lat: l.latitude, lng: l.longitude },
      radius,
    );
  });
}

export function buildFilterQueryString(
  filters: ListingFilters,
  overrides?: Partial<ListingFilters> & { tab?: string },
): string {
  const next = new URLSearchParams();
  const f = { ...filters, ...overrides };

  if (f.tab && f.tab !== "all") next.set("tab", f.tab);
  if (f.maxPrice) next.set("max_price", f.maxPrice);
  if (f.beds) next.set("beds", f.beds);
  if (f.minSqft) next.set("min_sqft", f.minSqft);
  if (f.source) next.set("source", f.source);
  if (f.radiusMiles) next.set("radius_miles", f.radiusMiles);
  if (f.postedWithin) next.set("posted_within", f.postedWithin);
  if (f.sort && f.sort !== "newest") next.set("sort", f.sort);
  if (f.page && f.page !== "1") next.set("page", f.page);
  for (const c of f.cities) next.append("city", c);
  for (const n of f.neighborhoods) next.append("neighborhood", n);

  return next.toString();
}

/** True when any narrowing filter is set (tab and sort don't count). */
export function hasActiveFilters(f: ListingFilters): boolean {
  return Boolean(
    f.maxPrice ||
      f.beds ||
      f.minSqft ||
      f.source ||
      f.radiusMiles ||
      f.postedWithin ||
      f.cities.length ||
      f.neighborhoods.length,
  );
}

type QueryFactory = () => QueryLike;

async function fetchDistinctNeighborhoodPairs(
  buildQuery: QueryFactory,
): Promise<Array<{ city: string; neighborhood: string }>> {
  const pairs = new Map<string, { city: string; neighborhood: string }>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let q = buildQuery().select("city, neighborhood").order("id");
    q = q.not("neighborhood", "is", null);
    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (!row.city || !row.neighborhood) continue;
      const key = `${row.city}\0${row.neighborhood}`;
      pairs.set(key, { city: row.city, neighborhood: row.neighborhood });
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...pairs.values()];
}

async function fetchDistinctColumn(
  buildQuery: QueryFactory,
  column: "neighborhood" | "city",
  notNull = false,
): Promise<string[]> {
  const values = new Set<string>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let q = buildQuery().select(column).order("id");
    if (notNull) q = q.not(column, "is", null);
    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const value = row[column];
      if (value) values.add(value);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...values].sort((a, b) => a.localeCompare(b));
}

export async function fetchDistinctNeighborhoods(
  buildQuery: QueryFactory,
  activeCities: string[] = [],
): Promise<NeighborhoodOption[]> {
  const pairs = await fetchDistinctNeighborhoodPairs(buildQuery);
  return buildNeighborhoodOptions(pairs, activeCities);
}

export async function fetchDistinctCities(
  buildQuery: QueryFactory,
): Promise<string[]> {
  return fetchDistinctColumn(buildQuery, "city");
}

export function distinctNeighborhoodOptionsFromListings(
  listings: Pick<ListingRow, "neighborhood" | "city">[],
  activeCities: string[] = [],
): NeighborhoodOption[] {
  const pairs = listings
    .filter((l) => l.neighborhood && l.city)
    .map((l) => ({ city: l.city, neighborhood: l.neighborhood! }));
  return buildNeighborhoodOptions(pairs, activeCities);
}

export function distinctFromListings(
  listings: Pick<ListingRow, "neighborhood" | "city">[],
  field: "neighborhood" | "city",
  activeCities: string[] = [],
): string[] | NeighborhoodOption[] {
  if (field === "neighborhood") {
    return distinctNeighborhoodOptionsFromListings(listings, activeCities);
  }
  const values = new Set<string>();
  for (const listing of listings) {
    if (listing.city) values.add(listing.city);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}
