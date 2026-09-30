import { supabaseAdmin, type ListingRow } from "./supabase";

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
  /** Neighborhood or city center, not the building door. */
  approximate: boolean;
};

const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

const STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Place name used when a listing has no map pin of its own. */
export function areaQuery(listing: Pick<ListingRow, "neighborhood" | "city" | "state">): string {
  const state = (listing.state ?? "").trim().toUpperCase();
  const city = listing.city.trim();
  let hood = (listing.neighborhood ?? "").split(/\s*[/|]\s*|\s+[–—-]\s+/)[0]?.trim() ?? "";
  hood = hood.replace(/,?\s+[A-Za-z]{2}\.?$/i, "").trim();
  if (hood.includes(",")) {
    const last = hood.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
    if (last) hood = last;
  }
  if (city) hood = hood.replace(new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
  if (!hood || hood.toLowerCase() === city.toLowerCase() || /^(city|town|village) of$/i.test(hood)) {
    return [city, state].filter(Boolean).join(", ");
  }
  return [hood, state].filter(Boolean).join(", ");
}

function placeLabel(query: string): string {
  const place = query.split(",")[0]?.trim() || query;
  const titled = place.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${titled} area`;
}

function cityQuery(listing: Pick<ListingRow, "city" | "state">): string {
  const state = (listing.state ?? "").trim().toUpperCase();
  return [listing.city.trim(), state].filter(Boolean).join(", ");
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function searchPlace(
  name: string,
  stateName: string | undefined,
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    name,
    count: "8",
    language: "en",
    format: "json",
  });
  try {
    const res = await fetch(`${GEOCODE}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        latitude?: number;
        longitude?: number;
        country_code?: string;
        admin1?: string;
      }>;
    };
    const hit = (data.results ?? []).find((row) => {
      if (row.country_code !== "US") return false;
      if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return false;
      if (!stateName) return true;
      return row.admin1?.toLowerCase() === stateName.toLowerCase();
    });
    if (!hit || hit.latitude == null || hit.longitude == null) return null;
    return { lat: hit.latitude, lng: hit.longitude };
  } catch {
    return null;
  }
}

/**
 * Neighborhood when the geocoder knows it (Shoreline, Bolingbrook).
 * Otherwise the search city, so the card still shows that metro.
 */
async function geocodePlace(
  query: string,
  fallback: string | null,
): Promise<{ lat: number; lng: number; labelQuery: string } | null> {
  const lookup = async (value: string) => {
    const [name, stateAbbrev] = value.split(",").map((part) => part.trim());
    if (!name) return null;
    return searchPlace(name, STATE_NAME[stateAbbrev?.toUpperCase() ?? ""]);
  };
  const direct = await lookup(query);
  if (direct) return { ...direct, labelQuery: query };
  if (!fallback || fallback.toLowerCase() === query.toLowerCase()) return null;
  const city = await lookup(fallback);
  if (!city) return null;
  return { ...city, labelQuery: fallback };
}

/**
 * Exact pin when the listing has one, otherwise a cached neighborhood or
 * city center so a card can show a map instead of an empty frame.
 */
export async function resolveMapPoints(listings: ListingRow[]): Promise<Map<string, MapPoint>> {
  const points = new Map<string, MapPoint>();
  const needed = new Map<string, string>();
  const fallbacks = new Map<string, string | null>();

  for (const listing of listings) {
    if (listing.latitude != null && listing.longitude != null) {
      points.set(listing.id, {
        lat: listing.latitude,
        lng: listing.longitude,
        label: listing.address || listing.neighborhood || listing.city,
        approximate: false,
      });
      continue;
    }
    const query = areaQuery(listing);
    if (!query) continue;
    needed.set(listing.id, query);
    const city = cityQuery(listing);
    fallbacks.set(query, city.toLowerCase() === query.toLowerCase() ? null : city);
  }

  const queries = [...new Set(needed.values())];
  if (queries.length === 0) return points;

  const cached = new Map<string, { lat: number; lng: number } | null>();
  const labels = new Map<string, string>();
  const { data, error } = await supabaseAdmin()
    .from("place_geocodes")
    .select("query, latitude, longitude")
    .in("query", queries);
  if (!error) {
    for (const row of data ?? []) {
      if (row.latitude == null || row.longitude == null) continue;
      cached.set(row.query, { lat: row.latitude, lng: row.longitude });
    }
  }

  const missing = queries.filter((query) => !cached.has(query));
  if (missing.length > 0) {
    const found = await mapPool(missing, 6, async (query) => ({
      query,
      hit: await geocodePlace(query, fallbacks.get(query) ?? null),
    }));
    const rows = found
      .filter(
        (row): row is { query: string; hit: { lat: number; lng: number; labelQuery: string } } =>
          row.hit != null,
      )
      .flatMap(({ query, hit }) => {
        labels.set(query, hit.labelQuery);
        const saved = [
          { query, latitude: hit.lat, longitude: hit.lng },
        ];
        if (hit.labelQuery !== query) {
          saved.push({ query: hit.labelQuery, latitude: hit.lat, longitude: hit.lng });
        }
        return saved;
      });
    if (rows.length > 0) {
      await supabaseAdmin().from("place_geocodes").upsert(rows, { onConflict: "query" });
    }
    for (const row of rows) {
      cached.set(row.query, { lat: row.latitude, lng: row.longitude });
    }
  }

  for (const [id, query] of needed) {
    const hit = cached.get(query);
    if (!hit) continue;
    const city = fallbacks.get(query);
    const cityHit = city ? cached.get(city) : null;
    const showsCity =
      cityHit != null && cityHit.lat === hit.lat && cityHit.lng === hit.lng;
    const freshLabel = labels.get(query);
    points.set(id, {
      lat: hit.lat,
      lng: hit.lng,
      label: placeLabel(freshLabel ?? (showsCity && city ? city : query)),
      approximate: true,
    });
  }

  return points;
}
