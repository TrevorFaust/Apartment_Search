import { createClient } from "@supabase/supabase-js";
import type { Preferences, ScrapedListing, SearchLocation } from "./types.js";
import { cleanImageUrl } from "./images.js";
import { normalizeLocations } from "./types.js";
import {
  buildListingGeocodeQuery,
  geocodeAddress,
  GEOCODE_BUDGET_PER_RUN,
} from "./geocode.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

export async function loadPreferences(): Promise<Preferences> {
  const { data, error } = await supabase
    .from("preferences")
    .select("*")
    .eq("key", "default")
    .single();
  if (error) throw new Error(`Failed to load preferences: ${error.message}`);
  const prefs = data as Preferences;
  prefs.locations = normalizeLocations(prefs);
  return prefs;
}

// Each extra city adds a Craigslist + Apartments.com pass, so keep the run
// inside the workflow timeout.
const MAX_SUBSCRIBER_CITIES = 5;

/** Cities active subscribers picked that the owner's settings don't already cover, most requested first. */
export async function loadSubscriberLocations(
  covered: SearchLocation[],
): Promise<SearchLocation[]> {
  const { data, error } = await supabase
    .from("listing_alerts")
    .select("locations")
    .neq("frequency", "off")
    .not("onboarded_at", "is", null);
  if (error) throw new Error(`Failed to load subscriber cities: ${error.message}`);

  const skip = new Set(covered.map((l) => l.city.toLowerCase()));
  const tally = new Map<string, { loc: SearchLocation; count: number }>();
  for (const row of data ?? []) {
    for (const raw of (row.locations ?? []) as Array<{ city?: string; state?: string }>) {
      const city = String(raw.city ?? "").trim().toLowerCase();
      const state = String(raw.state ?? "").trim().toLowerCase();
      if (!city || !/^[a-z]{2}$/.test(state) || skip.has(city)) continue;
      const entry = tally.get(city) ?? { loc: { city, state }, count: 0 };
      entry.count += 1;
      tally.set(city, entry);
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SUBSCRIBER_CITIES)
    .map((e) => e.loc);
}

async function enrichWithCoordinates(
  listings: ScrapedListing[],
): Promise<ScrapedListing[]> {
  let budget = GEOCODE_BUDGET_PER_RUN;
  const out: ScrapedListing[] = [];

  for (const listing of listings) {
    if (listing.latitude != null && listing.longitude != null) {
      out.push(listing);
      continue;
    }

    if (budget <= 0) {
      out.push(listing);
      continue;
    }

    const query = buildListingGeocodeQuery({
      address: listing.address,
      neighborhood: listing.neighborhood,
      city: listing.city,
      state: listing.state,
    });

    if (!query) {
      out.push(listing);
      continue;
    }

    const coords = await geocodeAddress(query);
    budget--;
    out.push(
      coords
        ? { ...listing, latitude: coords.lat, longitude: coords.lng }
        : listing,
    );
  }

  return out;
}

type ExistingRow = {
  source: string;
  external_id: string;
  latitude: number | null;
  longitude: number | null;
};

/** Looks up only the rows being upserted; a bare select is capped at 1000 rows. */
async function loadExistingRows(
  listings: ScrapedListing[],
): Promise<ExistingRow[]> {
  const ids = [...new Set(listings.map((l) => l.externalId))];
  const rows: ExistingRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("listings")
      .select("source, external_id, latitude, longitude")
      .in("external_id", ids.slice(i, i + 100));
    if (error) throw new Error(`Failed to read existing listings: ${error.message}`);
    rows.push(...((data ?? []) as ExistingRow[]));
  }
  return rows;
}

/**
 * Upserts scraped listings and returns the ones that were new (not seen before).
 * first_seen_at / is_favorite / is_hidden are intentionally excluded from the
 * upsert payload so they survive re-scrapes.
 */
export async function storeListings(
  listings: ScrapedListing[],
): Promise<ScrapedListing[]> {
  const byKey = new Map<string, ScrapedListing>();
  for (const l of listings) byKey.set(`${l.source}:${l.externalId}`, l);
  listings = [...byKey.values()];

  if (listings.length === 0) return [];

  listings = await enrichWithCoordinates(listings);

  const existing = await loadExistingRows(listings);

  const existingCoords = new Map<string, { lat: number; lng: number }>();
  for (const row of existing) {
    if (row.latitude != null && row.longitude != null) {
      existingCoords.set(`${row.source}:${row.external_id}`, {
        lat: row.latitude,
        lng: row.longitude,
      });
    }
  }

  const seen = new Set(existing.map((r) => `${r.source}:${r.external_id}`));
  const newOnes = listings.filter((l) => !seen.has(`${l.source}:${l.externalId}`));

  const now = new Date().toISOString();
  const rows = listings.map((l) => {
    const cached = existingCoords.get(`${l.source}:${l.externalId}`);
    const latitude = l.latitude ?? cached?.lat ?? null;
    const longitude = l.longitude ?? cached?.lng ?? null;
    const imageUrl = cleanImageUrl(l.imageUrl);
    return {
      source: l.source,
      external_id: l.externalId,
      url: l.url,
      title: l.title,
      price: l.price,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      sqft: l.sqft,
      neighborhood: l.neighborhood,
      address: l.address,
      city: l.city,
      state: l.state,
      latitude,
      longitude,
      amenities: l.amenities,
      last_seen_at: now,
      is_active: true,
      // Omitted when unknown so a re-scrape never wipes a back-filled value.
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(l.postedAt ? { posted_at: l.postedAt } : {}),
    };
  });

  // supabase-js fills keys missing from some rows in a batch with NULL, so
  // rows are batched by which optional columns they carry.
  const batchesByShape = new Map<string, typeof rows>();
  for (const row of rows) {
    const shape = Object.keys(row).sort().join(",");
    batchesByShape.set(shape, [...(batchesByShape.get(shape) ?? []), row]);
  }
  for (const batch of batchesByShape.values()) {
    for (let i = 0; i < batch.length; i += 200) {
      const chunk = batch.slice(i, i + 200);
      const { error } = await supabase
        .from("listings")
        .upsert(chunk, { onConflict: "source,external_id" });
      if (error) throw new Error(`Failed to upsert listings: ${error.message}`);
    }
  }

  return newOnes.map((l) => {
    const row = rows.find(
      (r) => r.source === l.source && r.external_id === l.externalId,
    );
    return {
      ...l,
      imageUrl: cleanImageUrl(l.imageUrl),
      latitude: row?.latitude ?? l.latitude,
      longitude: row?.longitude ?? l.longitude,
    };
  });
}

/** Gives photo-less units a photo from another unit in the same building. */
export async function borrowBuildingPhotos(): Promise<number> {
  const { data, error } = await supabase.rpc("borrow_building_photos");
  if (error) throw new Error(`Failed to borrow building photos: ${error.message}`);
  return (data as number) ?? 0;
}

/** Recomputes per city/bedroom rent cutoffs and flags way-underpriced listings. */
export async function flagPriceOutliers(): Promise<number> {
  const { data, error } = await supabase.rpc("flag_price_outliers");
  if (error) throw new Error(`Failed to flag price outliers: ${error.message}`);
  return (data as number) ?? 0;
}

/** `source:external_id` keys of flagged listings first seen since `since`. */
export async function loadOutlierKeys(since: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("listings")
    .select("source, external_id")
    .eq("price_outlier", true)
    .gte("first_seen_at", since);
  if (error) throw new Error(`Failed to load price outliers: ${error.message}`);
  return new Set((data ?? []).map((r) => `${r.source}:${r.external_id}`));
}

export async function recordRun(run: {
  startedAt: string;
  sourceCounts: Record<string, number>;
  newListingCount: number;
  emailSent: boolean;
  error: string | null;
}): Promise<void> {
  const { error } = await supabase.from("scrape_runs").insert({
    started_at: run.startedAt,
    finished_at: new Date().toISOString(),
    source_counts: run.sourceCounts,
    new_listing_count: run.newListingCount,
    email_sent: run.emailSent,
    error: run.error,
  });
  if (error) console.warn(`Failed to record scrape run: ${error.message}`);
}
