# Apartment Hunt

Personal apartment-hunting pipeline: scrapes listings once a day, stores them
in Supabase, emails you a newsletter of anything new in the last 24 hours, and
gives you a small web app to browse, filter, sort, and favorite listings.

The list is meant for finding overlooked gems, not an ever-growing archive:
only listings posted in the last **60 days** that are **still online** show up.
Each card shows when it was posted (when the source says), when it was added
here, and when it was last verified as still available.

## Sources

| Source | Method | Notes |
| --- | --- | --- |
| Craigslist | Playwright | RSS feeds were removed in 2023, so we scrape the search page. Filters (price/beds/baths/sqft) are passed in the URL. Runs for every city in Preferences. |
| Apartments.com | Playwright (real Chrome) | No public API. Their bot protection (Akamai) blocks headless Chromium but lets real Chrome through — and blocks are intermittent regardless. The scraper retries once and the pipeline carries on with the other sources if it's blocked that day. Runs for every city in Preferences. |
| SeattleRentals.com | fetch + cheerio | Fully server-rendered; plain HTTP works. Seattle only. |
| ChicagoRentals.com | WP REST API + cheerio | Communities via REST; individual units scraped from each community page. Chicago, IL only. |
| ChicagoApartmentFinders | fetch + cheerio | RealtyMX browser search with POST pagination. Chicago, IL only. |
| UrbanAbodes | Playwright | Next.js client-rendered search page. Chicago, IL only. |
| Domu | Playwright | Map search page (JS-rendered). Chicago, IL only. |

All scraping is once daily, low volume, for personal use. Be kind to the sites.

## Layout

- `scraper/` — Node + TypeScript pipeline (`npm run scrape`)
- `web/` — Next.js app: browse listings, set preferences, mark favorites (`npm run dev`)
- `.github/workflows/scrape.yml` — daily cron on GitHub Actions

## Setup

### 1. Install

```bash
npm install
npx playwright install chromium
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

- `SUPABASE_URL` — already set to the `apartment-hunt` project
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project Settings → API Keys
  → `service_role`. Keep this secret; it bypasses row-level security.
- `RESEND_API_KEY` — sign up at [resend.com](https://resend.com) (Google
  sign-in works), then API Keys → Create. On the free tier you can send to the
  email address you signed up with — no domain setup needed.
- `EMAIL_TO` — where the newsletter goes (your Resend signup email)

### 3. Set your search preferences

Run the web app and fill in the Preferences page:

```bash
npm run dev
```

City, price range, beds/baths, neighborhoods, and keywords drive both the
scrapers' search URLs and which new listings make it into the newsletter.

### 4. Run a scrape manually

```bash
npm run scrape
```

The first run seeds the database (no email — everything is "new" on day one,
so the newsletter would be useless). After that, any listing that hasn't been
seen before counts as new and gets emailed.

> Note: the email is skipped when there are no new matching listings, so you
> only hear about actual news.

### 5. Schedule it on GitHub Actions

1. Push this repo to GitHub (private repo recommended).
2. Repo → Settings → Secrets and variables → Actions → add:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_TO`.
3. The workflow runs every day at 15:00 UTC (7/8am Pacific). You can also
   trigger it manually from the Actions tab ("Run workflow").

> GitHub pauses scheduled workflows after 60 days without repo activity. If
> listings stop updating, re-enable it with
> `gh workflow enable "Daily apartment scrape"`.

## How dedupe works

Each listing is keyed by `(source, external_id)`. Re-scraped listings update
`last_seen_at` but keep their original `first_seen_at`, favorite, and hidden
flags. A listing is "new" if that key has never been seen before.

## Freshness and availability checks

- `listed_at` is the source's real posted date when known, otherwise the date
  the listing was first pulled. Anything older than 60 days drops off the site
  (Favorites keep showing, flagged if the listing is gone).
- After each scrape, an availability check re-visits up to 600 listings
  (least recently checked first). A 404/410, a redirect to the site's
  homepage, or Craigslist's "deleted/expired" notice marks the listing
  inactive and hides it. Blocked or erroring requests never hide anything.
- The same check back-fills Craigslist's real posted date and photo, which
  the search page doesn't expose.
- Apartments.com is skipped (its bot protection makes checks inconclusive).

Run the check on its own (e.g. with a bigger budget) with:

```bash
LIVENESS_BUDGET=3000 npm run check-listings
```

## Browsing

Filter by price, beds, size, city, neighborhood, radius, source, and how
recently a listing was posted (24 hours to 2 months). Sort by newest/oldest
posted, price, size, or bedrooms. Colors follow the shared palette used across
my other sites (warm gray `#e6e3db` base, forest green `#3d6f5f` accent).

## Scaling to other cities

Preferences store one or more **locations** (`city` + 2-letter `state`).
Each location is scraped separately:

- Craigslist → `<city>.craigslist.org` (any US city with a Craigslist subdomain)
- Apartments.com → `/<city>-<state>/` (e.g. `seattle-wa`, `chicago-il`)
- SeattleRentals → Seattle only; skipped for other cities
- ChicagoRentals, ChicagoApartmentFinders, UrbanAbodes, Domu → Chicago, IL only

Add Chicago by clicking **+ Add location** on the Preferences page
(`chicago` / `il`), save, then run `npm run scrape`. You can keep multiple
cities at once (e.g. Seattle + Chicago) — national sources scrape both.

## Radius filter

Set **radius in miles** on Preferences. The center for each search city is
geocoded automatically as that city&apos;s downtown (no address to type).
Save Preferences after adding/changing cities so centers are refreshed.
Listings are geocoded during scrapes (up to 120 per run).
