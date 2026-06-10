import { createClient } from "@supabase/supabase-js";
import type { Preferences, ScrapedListing } from "./types.js";

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
  return data as Preferences;
}

/**
 * Upserts scraped listings and returns the ones that were new (not seen before).
 * first_seen_at / is_favorite / is_hidden are intentionally excluded from the
 * upsert payload so they survive re-scrapes.
 */
export async function storeListings(
  listings: ScrapedListing[],
): Promise<ScrapedListing[]> {
  // Sources can repeat a listing on the same page (e.g. featured + organic);
  // Postgres rejects upserting the same key twice in one statement.
  const byKey = new Map<string, ScrapedListing>();
  for (const l of listings) byKey.set(`${l.source}:${l.externalId}`, l);
  listings = [...byKey.values()];

  if (listings.length === 0) return [];

  const { data: existing, error: selectError } = await supabase
    .from("listings")
    .select("source, external_id");
  if (selectError) throw new Error(`Failed to read existing listings: ${selectError.message}`);

  const seen = new Set((existing ?? []).map((r) => `${r.source}:${r.external_id}`));
  const newOnes = listings.filter((l) => !seen.has(`${l.source}:${l.externalId}`));

  const now = new Date().toISOString();
  const rows = listings.map((l) => ({
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
    image_url: l.imageUrl,
    amenities: l.amenities,
    posted_at: l.postedAt,
    last_seen_at: now,
    is_active: true,
  }));

  // Upsert in chunks to stay well under request size limits.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from("listings")
      .upsert(chunk, { onConflict: "source,external_id" });
    if (error) throw new Error(`Failed to upsert listings: ${error.message}`);
  }

  return newOnes;
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
