import * as cheerio from "cheerio";
import { fetchHtml, parseBedrooms, parseBathrooms, parsePrice, sleep } from "../fetch.js";
import type { Preferences, ScrapedListing, SearchLocation } from "../types.js";

const BASE = "https://chicagorentals.com";
const API = `${BASE}/wp-json/wp/v2/apartment`;

interface WpApartment {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
}

/**
 * ChicagoRentals.com (TLC Management) exposes communities via the WordPress
 * REST API. Individual units are server-rendered on each community page.
 */
export async function scrapeChicagoRentals(
  _prefs: Preferences,
  location: SearchLocation,
): Promise<ScrapedListing[]> {
  const communities = await fetchCommunities();
  const listings: ScrapedListing[] = [];

  for (const community of communities) {
    try {
      listings.push(...(await scrapeCommunityPage(community, location)));
    } catch (err) {
      console.warn(`chicago_rentals: skipped ${community.slug}:`, err);
    }
    await sleep(800);
  }

  return listings;
}

async function fetchCommunities(): Promise<WpApartment[]> {
  const all: WpApartment[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${API}?per_page=100&page=${page}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) break;
    const batch = (await res.json()) as WpApartment[];
    if (!batch.length) break;
    all.push(...batch);
    if (page >= Number(res.headers.get("x-wp-totalpages") ?? 1)) break;
  }
  return all;
}

async function scrapeCommunityPage(
  community: WpApartment,
  location: SearchLocation,
): Promise<ScrapedListing[]> {
  const html = await fetchHtml(community.link);
  const $ = cheerio.load(html);
  const communityTitle = community.title.rendered.trim();

  const address =
    ($('a[href*="google.com/maps?daddr="]')
      .first()
      .attr("href")
      ?.match(/daddr=([^&]+)/)?.[1]
      ?.replace(/\+/g, " ")
      .replace(/%2C/g, ",") ??
      $(".prty-address").text().replace(/\s+/g, " ").trim()) || null;

  const imageUrl =
    $('meta[property="og:image"]').attr("content") ??
    $(".property-hero img, .hero img").first().attr("src") ??
    null;

  const listings: ScrapedListing[] = [];

  $(".unit-elm").each((_, el) => {
    const row = $(el);
    const unitName = row.find(".unit-name").first().text().trim();
    if (!unitName) return;

    const bedsText = row.find(".unit-bed").text().trim();
    const bathsText = row.find(".unit-bath").text().trim();
    const priceText = row.find(".unit-price").text().trim();
    const applyHref = row.find(".unit-link a").attr("href") ?? "";
    const unitIdMatch = applyHref.match(/UnitID=(\d+)/);

    listings.push({
      source: "chicago_rentals",
      externalId: unitIdMatch?.[1] ?? `${community.id}-${unitName}`,
      url: community.link,
      title: `${communityTitle} — ${unitName}`,
      price: parsePrice(priceText),
      bedrooms: parseBedrooms(bedsText),
      bathrooms: parseBathrooms(bathsText),
      sqft: null,
      neighborhood: extractNeighborhood(communityTitle, address),
      address,
      city: location.city,
      state: location.state,
      latitude: null,
      longitude: null,
      imageUrl,
      amenities: [],
      postedAt: null,
    });
  });

  return listings;
}

function extractNeighborhood(title: string, address: string | null): string | null {
  const inMatch = title.match(/\bin\s+([^|–]+)/i);
  if (inMatch) return inMatch[1].trim();
  if (address) {
    const parts = address.split(",").map((p) => p.trim());
    if (parts.length >= 2) return parts[parts.length - 2];
  }
  return null;
}
