import { supabaseAdmin } from "./supabase";

export type Frequency = "daily" | "weekly" | "off";

export interface SubscriberRow {
  user_id: string;
  email: string;
  frequency: Frequency;
  cities: string[];
  locations: AlertLocation[];
  neighborhoods: string[];
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  onboarded_at: string | null;
  last_digest_at: string | null;
  unsubscribe_token: string;
}

export type Choice = { value: string; label: string };

// Picked from the live listings: median rent is ~$2,200, most units are 1+
// bedrooms, and most don't list more than one bath.
export const BUDGET_CHOICES: Choice[] = [
  { value: "1500", label: "$1,500" },
  { value: "2000", label: "$2,000" },
  { value: "2500", label: "$2,500" },
  { value: "3000", label: "$3,000" },
  { value: "4000", label: "$4,000" },
  { value: "", label: "No limit" },
];

export const BED_CHOICES: Choice[] = [
  { value: "0", label: "Studio+" },
  { value: "1", label: "1+ bed" },
  { value: "2", label: "2+ beds" },
  { value: "3", label: "3+ beds" },
];

export const BATH_CHOICES: Choice[] = [
  { value: "", label: "Any" },
  { value: "1", label: "1+ bath" },
  { value: "2", label: "2+ baths" },
];

export const SIZE_CHOICES: Choice[] = [
  { value: "", label: "Any size" },
  { value: "500", label: "500+ sqft" },
  { value: "750", label: "750+ sqft" },
  { value: "1000", label: "1,000+ sqft" },
];

export const FREQUENCY_CHOICES: Choice[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "No emails" },
];

export const DEFAULT_CRITERIA = {
  maxPrice: "2500",
  minBeds: "1",
  minBaths: "",
  minSqft: "",
  frequency: "daily" as Frequency,
};

export async function getSubscriber(userId: string): Promise<SubscriberRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("listing_alerts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SubscriberRow | null;
}

export type AlertLocation = { city: string; state: string };

export type CityCount = AlertLocation & { count: number };

/** Active cities with listing counts, most listings first. */
export async function fetchCityCounts(): Promise<CityCount[]> {
  const counts = new Map<string, CityCount>();
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin()
      .from("listings")
      .select("city, state")
      .eq("is_active", true)
      .gte("listed_at", cutoff)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.city) continue;
      const entry = counts.get(row.city) ?? {
        city: row.city,
        state: (row.state ?? "").toLowerCase(),
        count: 0,
      };
      entry.count += 1;
      if (!entry.state && row.state) entry.state = row.state.toLowerCase();
      counts.set(row.city, entry);
    }
    if (!data || data.length < 1000) break;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/** Validates the city picker's JSON: lowercase `{city, state}` pairs, deduped. */
export function parseAlertLocations(raw: unknown): AlertLocation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Map<string, AlertLocation>();
  for (const item of parsed) {
    const city = String(item?.city ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const state = String(item?.state ?? "").trim().toLowerCase();
    if (!/^[a-z][a-z .'-]{1,49}$/.test(city) || !/^[a-z]{2}$/.test(state)) continue;
    seen.set(city, { city, state });
    if (seen.size >= 10) break;
  }
  return [...seen.values()];
}
