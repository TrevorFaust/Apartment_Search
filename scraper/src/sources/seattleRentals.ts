import * as cheerio from "cheerio";
import type { Preferences, ScrapedListing, SearchLocation } from "../types.js";

const BASE = "https://www.seattlerentals.com";
const PAGE_SIZE = 10;
const MAX_PAGES = 15;

/**
 * SeattleRentals.com is fully server-rendered, so a plain fetch + cheerio
 * parse works. The site is small (~50 listings), so we scrape everything
 * and let the pipeline apply preference filters.
 */
export async function scrapeSeattleRentals(
  prefs: Preferences,
  location: SearchLocation,
): Promise<ScrapedListing[]> {
  const listings: ScrapedListing[] = [];

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const url = `${BASE}/seattle_apartments/${pageNum}/${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      },
    });
    if (!res.ok) break;

    const $ = cheerio.load(await res.text());
    const rows = $("div.row.mb-3").filter((_, el) =>
      ($(el).attr("onclick") ?? "").includes("/apartment/"),
    );
    if (rows.length === 0) break;

    rows.each((_, el) => {
      const row = $(el);
      const link = row.find("a[href*='/apartment/']").first();
      const href = link.attr("href") ?? "";
      const idMatch = href.match(/\/apartment\/(\d+)/);
      if (!idMatch) return;

      const spans = row
        .find("span.oneLine")
        .map((_, s) => $(s).text().replace(/\s+/g, " ").trim())
        .get();

      const title = row.find("a.oneLine").first().text().trim();
      const address = spans[0] ?? null;
      const neighborhood = spans[1] ?? null;

      const bedBathText = spans.find((s) => /bedroom|studio/i.test(s)) ?? "";
      const isStudio = /studio/i.test(bedBathText);
      const bedsMatch = bedBathText.match(/(\d+(?:\.\d+)?)\s*bedroom/i);
      const bathsMatch = bedBathText.match(/(\d+(?:\.\d+)?)\s*bathroom/i);

      // Prefer the "Monthly $X to $Y" span; fall back to any $ amount.
      const priceText =
        spans.find((s) => /monthly/i.test(s)) ?? spans.find((s) => s.includes("$")) ?? "";
      const priceMatch = priceText.replace(/,/g, "").match(/\$\s*(\d+)/);

      listings.push({
        source: "seattle_rentals",
        externalId: idMatch[1],
        url: href.startsWith("http") ? href : `${BASE}${href}`,
        title: title || `Listing ${idMatch[1]}`,
        price: priceMatch ? Number(priceMatch[1]) : null,
        bedrooms: isStudio ? 0 : bedsMatch ? Number(bedsMatch[1]) : null,
        bathrooms: bathsMatch ? Number(bathsMatch[1]) : null,
        sqft: null,
        neighborhood,
        address,
        city: location.city,
        state: location.state,
        latitude: null,
        longitude: null,
        imageUrl: row.find("img.resultsMainPic").attr("src") ?? null,
        amenities: [],
        postedAt: null,
      });
    });

    // Stop when we've reached the last page, e.g. "41 - 43 of 43".
    const countText = $(".sr-result-cnt").text();
    const countMatch = countText.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/);
    if (countMatch && Number(countMatch[2]) >= Number(countMatch[3])) break;

    await new Promise((r) => setTimeout(r, 1000));
  }

  return listings;
}
