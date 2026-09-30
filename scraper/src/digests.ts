import { sleep } from "./fetch.js";
import { matchesCriteria } from "./filter.js";
import { sendListingsEmail, type EmailListing } from "./email.js";
import { MAX_LISTING_AGE_DAYS } from "./liveness.js";
import { supabase } from "./supabase.js";

type Subscriber = {
  user_id: string;
  email: string;
  frequency: "daily" | "weekly";
  cities: string[];
  neighborhoods: string[];
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  onboarded_at: string;
  last_digest_at: string | null;
  unsubscribe_token: string;
};

type ListingRow = {
  id: string;
  source: string;
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
  first_seen_at: string;
};

const HOUR = 60 * 60 * 1000;
// A little under the nominal cadence so a run that starts a few minutes
// earlier than yesterday's still counts as due.
const DUE_AFTER = { daily: 20 * HOUR, weekly: 6.5 * 24 * HOUR };
// Resend's free tier allows 2 requests/second.
const SEND_GAP_MS = 600;

/** Emails each due subscriber the listings first seen since their last digest. */
export async function sendSubscriberDigests(): Promise<{
  due: number;
  sent: number;
  failed: number;
}> {
  const siteUrl = (process.env.SITE_URL ?? "https://leaselocator.vercel.app").replace(/\/$/, "");
  const now = Date.now();

  const { data, error } = await supabase
    .from("listing_alerts")
    .select("*")
    .in("frequency", ["daily", "weekly"])
    .not("onboarded_at", "is", null);
  if (error) throw new Error(`Failed to load subscribers: ${error.message}`);

  const due = ((data ?? []) as Subscriber[]).filter((s) => {
    const last = new Date(s.last_digest_at ?? s.onboarded_at).getTime();
    return now - last >= DUE_AFTER[s.frequency];
  });
  if (due.length === 0) return { due: 0, sent: 0, failed: 0 };

  const earliest = Math.min(
    ...due.map((s) => Date.parse(s.last_digest_at ?? s.onboarded_at)),
  );
  const [listings, hiddenByUser] = await Promise.all([
    loadListingsSince(new Date(earliest).toISOString()),
    loadHiddenIds(due.map((s) => s.user_id)),
  ]);
  const checkedAt = new Date().toISOString();

  let sent = 0;
  let failed = 0;
  for (const s of due) {
    const since = s.last_digest_at ?? s.onboarded_at;
    const sinceMs = Date.parse(since);
    const cities = new Set(s.cities.map((c) => c.toLowerCase()));
    const hidden = hiddenByUser.get(s.user_id);
    const matches = listings.filter(
      (l) =>
        Date.parse(l.first_seen_at) > sinceMs &&
        !hidden?.has(l.id) &&
        (cities.size === 0 || cities.has(l.city.toLowerCase())) &&
        matchesCriteria(l, s),
    );

    if (matches.length > 0) {
      try {
        await sendListingsEmail({
          to: s.email,
          listings: matches.map(toEmailListing),
          kicker: s.frequency === "daily" ? "Your daily Lease Locator" : "Your weekly Lease Locator",
          subtitle: `new since ${formatShort(since)}`,
          manageUrl: `${siteUrl}/account`,
          unsubscribeUrl: `${siteUrl}/unsubscribe?token=${s.unsubscribe_token}`,
        });
        sent++;
        await sleep(SEND_GAP_MS);
      } catch (err) {
        // Leave last_digest_at alone so these listings go out next time.
        failed++;
        console.error(`Digest to ${s.email} failed:`, err);
        continue;
      }
    }

    const { error: updateError } = await supabase
      .from("listing_alerts")
      .update({ last_digest_at: checkedAt })
      .eq("user_id", s.user_id);
    if (updateError) console.error(`Failed to advance digest for ${s.email}:`, updateError.message);
  }

  return { due: due.length, sent, failed };
}

async function loadListingsSince(since: string): Promise<ListingRow[]> {
  const cutoff = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 24 * HOUR).toISOString();
  const rows: ListingRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, source, url, title, price, bedrooms, bathrooms, sqft, neighborhood, address, city, image_url, first_seen_at",
      )
      .eq("is_active", true)
      .eq("price_outlier", false)
      .gt("first_seen_at", since)
      .gte("listed_at", cutoff)
      .order("first_seen_at", { ascending: false })
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`Failed to load new listings: ${error.message}`);
    rows.push(...((data ?? []) as ListingRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Listings each user has hidden on the site, so their digest skips them too. */
async function loadHiddenIds(userIds: string[]): Promise<Map<string, Set<string>>> {
  const byUser = new Map<string, Set<string>>();
  if (userIds.length === 0) return byUser;
  const { data, error } = await supabase
    .from("listing_marks")
    .select("user_id, listing_id")
    .in("user_id", userIds)
    .eq("hidden", true);
  if (error) {
    console.error("Failed to load hidden listings:", error.message);
    return byUser;
  }
  for (const row of data ?? []) {
    const set = byUser.get(row.user_id) ?? new Set<string>();
    set.add(row.listing_id);
    byUser.set(row.user_id, set);
  }
  return byUser;
}

function toEmailListing(l: ListingRow): EmailListing {
  return {
    source: l.source as EmailListing["source"],
    url: l.url,
    title: l.title,
    price: l.price,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    sqft: l.sqft,
    neighborhood: l.neighborhood,
    address: l.address,
    imageUrl: l.image_url,
  };
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
