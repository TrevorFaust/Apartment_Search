import { supabaseAdmin } from "./supabase";

export type Frequency = "daily" | "weekly" | "off";

export interface SubscriberRow {
  user_id: string;
  email: string;
  frequency: Frequency;
  cities: string[];
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

/** Active cities with listing counts, most listings first. */
export async function fetchCityCounts(): Promise<Array<{ city: string; count: number }>> {
  const counts = new Map<string, number>();
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin()
      .from("listings")
      .select("city")
      .eq("is_active", true)
      .gte("listed_at", cutoff)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.city) counts.set(row.city, (counts.get(row.city) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}
