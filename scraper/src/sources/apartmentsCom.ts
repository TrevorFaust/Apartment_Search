import type { BrowserContext } from "playwright";
import type { Preferences, ScrapedListing } from "../types.js";

/**
 * Apartments.com has no public API; this is a gentle once-a-day Playwright
 * scrape of the first results page. Filters are encoded in the URL path,
 * e.g. /seattle-wa/1-to-2-bedrooms-1500-to-2500/
 *
 * Note: requires real Chrome (see browser.ts) — their bot protection blocks
 * bundled headless Chromium.
 */
export async function scrapeApartmentsCom(
  context: BrowserContext,
  prefs: Preferences,
): Promise<ScrapedListing[]> {
  const citySlug = `${prefs.city.toLowerCase().replace(/\s+/g, "-")}-wa`;
  const url = `https://www.apartments.com/${citySlug}/${buildFilterSegment(prefs)}`;

  const page = await context.newPage();
  try {
    // Akamai blocks are intermittent; retry once after a pause.
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page
        .waitForSelector("article.placard, article[data-listingid]", { timeout: 20_000 })
        .catch(() => {});
      const blocked = /access denied/i.test(await page.title());
      if (!blocked) break;
      if (attempt === 0) {
        console.warn("apartments.com: access denied, retrying in 30s...");
        await page.waitForTimeout(30_000);
      } else {
        throw new Error("apartments.com blocked the request (Access Denied)");
      }
    }

    const items = await page.evaluate(() => {
      const results: Array<{
        id: string;
        url: string;
        title: string;
        priceText: string;
        bedsText: string;
        address: string;
        imageUrl: string | null;
        amenities: string[];
      }> = [];

      document
        .querySelectorAll("article.placard, article[data-listingid]")
        .forEach((el) => {
          const url =
            el.getAttribute("data-url") ??
            el.querySelector<HTMLAnchorElement>("a.property-link")?.href ??
            "";
          if (!url) return;
          const id = el.getAttribute("data-listingid") ?? url;
          const title = (
            el.querySelector(".js-placardTitle, .property-title")?.textContent ?? ""
          ).trim();
          const address = (
            el.querySelector(".property-address")?.textContent ?? ""
          ).trim();

          // Pricing comes as one or more "bedRentBox" rows: bed type + price,
          // e.g. "Studio / $2,140+", "1 Bed / $2,456+". Take the cheapest row.
          let priceText = "";
          let bedsText = "";
          const rentBoxes = el.querySelectorAll(".bedRentBox");
          if (rentBoxes.length > 0) {
            priceText = (rentBoxes[0].querySelector(".priceTextBox")?.textContent ?? "").trim();
            bedsText = (rentBoxes[0].querySelector(".bedTextBox")?.textContent ?? "").trim();
          } else {
            priceText = (
              el.querySelector(".property-pricing, .price-range, .property-rents")?.textContent ?? ""
            ).trim();
            bedsText = (
              el.querySelector(".property-beds, .bed-range")?.textContent ?? ""
            ).trim();
          }

          const img = el.querySelector<HTMLImageElement>(".imageContainer img, .media img");
          const amenities = Array.from(el.querySelectorAll(".property-amenities span"))
            .map((s) => (s.textContent ?? "").trim())
            .filter(Boolean);

          results.push({
            id,
            url,
            title: title || address,
            priceText,
            bedsText,
            address,
            imageUrl: img?.src ?? null,
            amenities,
          });
        });

      return results;
    });

    return items
      .filter((i) => i.title && i.url)
      .map((i) => {
        const priceMatch = i.priceText.replace(/,/g, "").match(/\$\s*(\d+)/);
        const bedsMatch = i.bedsText.match(/(\d+(?:\.\d+)?)\s*(?:bed|bd|br)/i);
        const isStudio = /studio/i.test(i.bedsText);
        return {
          source: "apartments_com" as const,
          externalId: String(i.id),
          url: i.url,
          title: i.title,
          price: priceMatch ? Number(priceMatch[1]) : null,
          bedrooms: isStudio ? 0 : bedsMatch ? Number(bedsMatch[1]) : null,
          bathrooms: null,
          sqft: null,
          neighborhood: null,
          address: i.address || null,
          city: prefs.city,
          imageUrl: i.imageUrl,
          amenities: i.amenities,
          postedAt: null,
        };
      });
  } finally {
    await page.close();
  }
}

function buildFilterSegment(prefs: Preferences): string {
  const parts: string[] = [];

  const minBeds = prefs.min_beds != null ? Math.floor(prefs.min_beds) : null;
  const maxBeds = prefs.max_beds != null ? Math.ceil(prefs.max_beds) : null;
  if (minBeds === 0 && (maxBeds === 0 || maxBeds == null)) {
    parts.push("studios");
  } else if (minBeds != null && maxBeds != null && minBeds === maxBeds) {
    parts.push(`${minBeds}-bedrooms`);
  } else if (minBeds != null && maxBeds != null) {
    parts.push(`${minBeds}-to-${maxBeds}-bedrooms`);
  } else if (minBeds != null && minBeds > 0) {
    parts.push(`min-${minBeds}-bedrooms`);
  }

  if (prefs.min_price != null && prefs.max_price != null) {
    parts.push(`${prefs.min_price}-to-${prefs.max_price}`);
  } else if (prefs.max_price != null) {
    parts.push(`under-${prefs.max_price}`);
  } else if (prefs.min_price != null) {
    parts.push(`over-${prefs.min_price}`);
  }

  return parts.length > 0 ? `${parts.join("-")}/` : "";
}
