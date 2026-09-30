import { FETCH_UA, sleep } from "./fetch.js";
import { cleanImageUrl } from "./images.js";
import { supabase } from "./supabase.js";

/** Listings older than this drop off the site and are no longer checked. */
export const MAX_LISTING_AGE_DAYS = 60;

const DEFAULT_BUDGET = 600;
// ~1.5 requests/sec. Craigslist rate-limits (and IP-blocks) anything much faster.
const CONCURRENCY = 2;
const DELAY_MS = 1000;
/** Stop hitting a host for the rest of the run after this many blocked/errored responses in a row. */
const HOST_FAILURE_LIMIT = 8;

/** Apartments.com blocks plain HTTP (Akamai), so a check would never be conclusive. */
const UNCHECKABLE_SOURCES = new Set(["apartments_com"]);

type Verdict =
  | {
      status: "live";
      postedAt: string | null;
      imageUrl: string | null;
      address: string | null;
      coords: { lat: number; lng: number } | null;
    }
  | { status: "gone" }
  | { status: "unknown"; reason: string };

export type Candidate = {
  id: string;
  source: string;
  url: string;
  posted_at: string | null;
  image_url: string | null;
  address: string | null;
  latitude: number | null;
};

const GONE_MARKERS =
  /This posting has been deleted|This posting has expired|flagged for removal|no longer available/i;

async function checkUrl(candidate: Candidate): Promise<Verdict> {
  let original: URL;
  try {
    original = new URL(candidate.url);
  } catch {
    return { status: "unknown", reason: "invalid url" };
  }
  if (!/^https?:$/.test(original.protocol)) {
    return { status: "unknown", reason: "invalid url" };
  }

  let res: Response;
  try {
    res = await fetch(original, {
      headers: { "User-Agent": FETCH_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return {
      status: "unknown",
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  if (res.status === 404 || res.status === 410) return { status: "gone" };
  if (!res.ok) return { status: "unknown", reason: `HTTP ${res.status}` };

  // Sites like UrbanAbodes send removed units back to their homepage.
  const final = new URL(res.url);
  if (original.pathname !== "/" && final.pathname === "/") {
    return { status: "gone" };
  }

  const html = await res.text();
  if (candidate.source === "craigslist" && GONE_MARKERS.test(html)) {
    return { status: "gone" };
  }

  return {
    status: "live",
    postedAt: parseCraigslistPostedAt(html),
    imageUrl: parseOgImage(html),
    address: parseStreetAddress(html),
    coords: parseCoordinates(html),
  };
}

/** Map coordinates from embedded JSON (UrbanAbodes, JSON-LD) or Craigslist's map div. */
function parseCoordinates(html: string): { lat: number; lng: number } | null {
  const m =
    html.match(/\\?"latitude\\?"\s*:\s*"?(-?\d{1,3}\.\d+)"?\s*,\s*\\?"longitude\\?"\s*:\s*"?(-?\d{1,3}\.\d+)/) ??
    html.match(/data-latitude="(-?\d{1,3}\.\d+)"\s+data-longitude="(-?\d{1,3}\.\d+)"/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function parseOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
  return cleanImageUrl(m?.[1]?.replace(/&amp;/g, "&"));
}

/** Street line from a Craigslist posting (`h2.street-address` or the map caption). */
function parseStreetAddress(html: string): string | null {
  const raw =
    html.match(/<h2 class="street-address">([^<]+)<\/h2>/i)?.[1] ??
    html.match(/<div class="mapaddress">([^<]+)<\/div>/i)?.[1];
  const text = raw?.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return text || null;
}

function parseCraigslistPostedAt(html: string): string | null {
  const m = html.match(
    /id="display-date"[\s\S]{0,200}?<time[^>]*datetime="([^"]+)"/,
  );
  if (!m) return null;
  const date = new Date(m[1]!.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadCandidates(budget: number): Promise<Candidate[]> {
  const cutoff = new Date(
    Date.now() - MAX_LISTING_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // PostgREST caps each response at 1000 rows, so page through larger budgets.
  const candidates: Candidate[] = [];
  while (candidates.length < budget) {
    const from = candidates.length;
    const to = Math.min(budget, from + 1000) - 1;
    const { data, error } = await supabase
      .from("listings")
      .select("id, source, url, posted_at, image_url, address, latitude")
      .eq("is_active", true)
      .gte("listed_at", cutoff)
      .not("source", "in", `(${[...UNCHECKABLE_SOURCES].join(",")})`)
      .order("latitude", { ascending: true, nullsFirst: true })
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .order("id")
      .range(from, to);
    if (error) throw new Error(`Failed to load listings to check: ${error.message}`);
    candidates.push(...((data ?? []) as Candidate[]));
    if (!data || data.length < to - from + 1) break;
  }
  return candidates;
}

/**
 * Re-visits active listings (least recently checked first) and marks the ones
 * whose page is gone as inactive, so the site never shows rented units.
 * Also back-fills Craigslist's real "posted" timestamp.
 */
export async function checkListingsStillOnline(
  budget = Number(process.env.LIVENESS_BUDGET) || DEFAULT_BUDGET,
): Promise<{ checked: number; gone: number; unknown: number }> {
  const candidates = await loadCandidates(budget);
  const hostFailures = new Map<string, number>();
  let gone = 0;
  let unknown = 0;
  let checked = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++]!;
      let host = "";
      try {
        host = new URL(candidate.url).host;
      } catch {
        /* checkUrl reports invalid urls */
      }
      if ((hostFailures.get(host) ?? 0) >= HOST_FAILURE_LIMIT) {
        unknown++;
        continue;
      }

      const verdict = await checkUrl(candidate);
      checked++;
      const now = new Date().toISOString();

      if (verdict.status === "unknown") {
        unknown++;
        hostFailures.set(host, (hostFailures.get(host) ?? 0) + 1);
      } else {
        hostFailures.set(host, 0);
        const update: Record<string, unknown> = { last_checked_at: now };
        if (verdict.status === "gone") {
          gone++;
          update.is_active = false;
        } else {
          if (verdict.postedAt && !candidate.posted_at) {
            update.posted_at = verdict.postedAt;
          }
          if (verdict.imageUrl && !cleanImageUrl(candidate.image_url)) {
            update.image_url = verdict.imageUrl;
          }
          if (verdict.address && !candidate.address) {
            update.address = verdict.address;
          }
          if (verdict.coords && candidate.latitude == null) {
            update.latitude = verdict.coords.lat;
            update.longitude = verdict.coords.lng;
          }
        }
        const { error } = await supabase
          .from("listings")
          .update(update)
          .eq("id", candidate.id);
        if (error) console.warn(`Failed to update listing ${candidate.id}: ${error.message}`);
      }

      await sleep(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  for (const [host, failures] of hostFailures) {
    if (failures >= HOST_FAILURE_LIMIT) {
      console.warn(`Stopped checking ${host} after ${failures} failed requests in a row.`);
    }
  }

  return { checked, gone, unknown };
}
