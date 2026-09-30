import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function supabaseAdmin() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

export interface SearchLocation {
  city: string;
  state: string;
  center_lat?: number | null;
  center_lng?: number | null;
}

export interface ListingRow {
  id: string;
  source: string;
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  neighborhood: string | null;
  address: string | null;
  city: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  amenities: string[];
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_checked_at: string | null;
  listed_at: string;
  is_active: boolean;
  is_favorite: boolean;
  is_hidden: boolean;
}

export interface PreferencesRow {
  key: string;
  city: string;
  locations: SearchLocation[];
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  max_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  neighborhoods: string[];
  keywords: string[];
  email_to: string | null;
  radius_miles: number | null;
  radius_center: string | null;
  radius_center_lat: number | null;
  radius_center_lng: number | null;
}

export function normalizeLocations(prefs: PreferencesRow): SearchLocation[] {
  if (prefs.locations?.length) {
    return prefs.locations.map((l) => ({
      city: l.city.toLowerCase().trim(),
      state: l.state.toLowerCase().trim(),
      center_lat: l.center_lat ?? null,
      center_lng: l.center_lng ?? null,
    }));
  }
  return [{ city: prefs.city.toLowerCase().trim(), state: "wa" }];
}
