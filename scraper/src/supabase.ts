import { createClient } from "@supabase/supabase-js";
import type { Preferences, ScrapedListing } from "./types.js";
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

  const { data: existing, error: selectError } = await supabase
    .from("listings")
    .select("source, external_id, latitude, longitude");
  if (selectError) throw new Error(`Failed to read existing listings: ${selectError.message}`);

  const existingCoords = new Map<string, { lat: number; lng: number }>();
  for (const row of existing ?? []) {
    if (row.latitude != null && row.longitude != null) {
      existingCoords.set(`${row.source}:${row.external_id}`, {
        lat: row.latitude,
        lng: row.longitude,
      });
    }
  }

  const seen = new Set((existing ?? []).map((r) => `${r.source}:${r.external_id}`));
  const newOnes = listings.filter((l) => !seen.has(`${l.source}:${l.externalId}`));

  const now = new Date().toISOString();
  const rows = listings.map((l) => {
    const cached = existingCoords.get(`${l.source}:${l.externalId}`);
    const latitude = l.latitude ?? cached?.lat ?? null;
    const longitude = l.longitude ?? cached?.lng ?? null;
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
      image_url: l.imageUrl,
      amenities: l.amenities,
      posted_at: l.postedAt,
      last_seen_at: now,
      is_active: true,
    };
  });

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from("listings")
      .upsert(chunk, { onConflict: "source,external_id" });
    if (error) throw new Error(`Failed to upsert listings: ${error.message}`);
  }

  return newOnes.map((l) => {
    const row = rows.find(
      (r) => r.source === l.source && r.external_id === l.externalId,
    );
    return row
      ? {
          ...l,
          latitude: row.latitude,
          longitude: row.longitude,
        }
      : l;
  });
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
