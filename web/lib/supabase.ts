import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Server-only client using the service role key. Never import this from a
// client component.
export function supabaseAdmin() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
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
  image_url: string | null;
  amenities: string[];
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  is_favorite: boolean;
  is_hidden: boolean;
}

export interface PreferencesRow {
  key: string;
  city: string;
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  max_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  neighborhoods: string[];
  keywords: string[];
  email_to: string | null;
}
