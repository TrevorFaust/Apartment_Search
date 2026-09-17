import * as cheerio from "cheerio";
import {
  FETCH_UA,
  parseBedrooms,
  parseBathrooms,
  parsePrice,
  sleep,
} from "../fetch.js";
import type { Preferences, ScrapedListing, SearchLocation } from "../types.js";

const BASE = "https://www.chicagoapartmentfinders.com";
const BROWSER_URL = `${BASE}/index.cfm?page=browser`;
const PAGE_SIZE = 36;
const MAX_PAGES = 15;

/**
 * ChicagoApartmentFinders (RealtyMX) renders rental search results server-side.
 * Pagination uses POST with a startAt offset (1, 37, 73, …).
 */
export async function scrapeChicagoApartmentFinders(
  _prefs: Preferences,
  location: SearchLocation,
): Promise<ScrapedListing[]> {
  const listings: ScrapedListing[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const startAt = page * PAGE_SIZE + 1;
    const html = await fetchBrowserPage(startAt);
    const batch = parsePropertyCards(html, location);
    if (batch.length === 0) break;
    listings.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    await sleep(1000);
  }

  return listings;
}

async function fetchBrowserPage(startAt: number): Promise<string> {
  const body = new URLSearchParams({
    status: "2,21",
    thumbs: "false",
    startAt: String(startAt),
    sort: "dataSort, price",
    order: "asc, desc",
  });

  const res = await fetch(BROWSER_URL, {
    method: "POST",
    headers: {
      "User-Agent": FETCH_UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for CAF browser page ${startAt}`);
  return res.text();
}

function parsePropertyCards(
  html: string,
  location: SearchLocation,
): ScrapedListing[] {
  const $ = cheerio.load(html);
  const listings: ScrapedListing[] = [];

  $(".property-card.item").each((_, el) => {
    const card = $(el);
    const link = card.find("a[data-pid]").first();
    const pid = link.attr("data-pid") ?? "";
    const href = link.attr("href") ?? "";
    if (!pid || !href) return;

    const title =
      card.find(".image-caption h3 a").first().text().trim() ||
      link.attr("title")?.trim() ||
      "";
    const neighborhood =
      card.find(".property-grid-area").first().text().trim() || null;
    const priceText = card.find(".price > span").first().text().trim();
    const bedBathText = card.find(".bedrooms").text().replace(/\s+/g, " ");
    const imgStyle = card.find(".mx-property-img").attr("style") ?? "";
    const imgMatch = imgStyle.match(/url\(([^)]+)\)/);

    listings.push({
      source: "chicago_apartment_finders",
      externalId: pid,
      url: href.startsWith("http") ? href : `${BASE}${href}`,
      title: title || `Listing ${pid}`,
      price: parsePrice(priceText),
      bedrooms: parseBedrooms(bedBathText),
      bathrooms: parseBathrooms(bedBathText),
      sqft: null,
      neighborhood,
      address: title || null,
      city: location.city,
      state: location.state,
      latitude: null,
      longitude: null,
      imageUrl: imgMatch?.[1]?.replace(/['"]/g, "") ?? null,
      amenities: [],
      postedAt: null,
    });
  });

  return listings;
}
