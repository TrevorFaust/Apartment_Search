import { FETCH_UA, sleep } from "./fetch.js";
import { supabase } from "./supabase.js";

/** Listings older than this drop off the site and are no longer checked. */
export const MAX_LISTING_AGE_DAYS = 60;

const DEFAULT_BUDGET = 600;
const CONCURRENCY = 3;
const DELAY_MS = 300;
/** Stop hitting a host for the rest of the run after this many blocked/errored responses in a row. */
const HOST_FAILURE_LIMIT = 8;

/** Apartments.com blocks plain HTTP (Akamai), so a check would never be conclusive. */
const UNCHECKABLE_SOURCES = new Set(["apartments_com"]);

type Verdict =
  | { status: "live"; postedAt: string | null; imageUrl: string | null }
  | { status: "gone" }
  | { status: "unknown"; reason: string };

type Candidate = {
  id: string;
  source: string;
  url: string;
  posted_at: string | null;
  image_url: string | null;
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
  };
}

function parseOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
  return m?.[1]?.startsWith("http") ? m[1] : null;
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
      .select("id, source, url, posted_at, image_url")
      .eq("is_active", true)
      .gte("listed_at", cutoff)
      .not("source", "in", `(${[...UNCHECKABLE_SOURCES].join(",")})`)
      .order("is_favorite", { ascending: false })
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
          if (verdict.imageUrl && !candidate.image_url?.startsWith("http")) {
            update.image_url = verdict.imageUrl;
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
