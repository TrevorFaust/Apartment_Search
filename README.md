# Apartment Hunt

Personal apartment-hunting pipeline: scrapes listings once a day, stores them
in Supabase, emails you a newsletter of anything new in the last 24 hours, and
gives you a small web app to browse, filter, and favorite listings.

## Sources

| Source | Method | Notes |
| --- | --- | --- |
| Craigslist | Playwright | RSS feeds were removed in 2023, so we scrape the search page. Filters (price/beds/baths/sqft) are passed in the URL. |
| Apartments.com | Playwright (real Chrome) | No public API. Their bot protection (Akamai) blocks headless Chromium but lets real Chrome through — and blocks are intermittent regardless. The scraper retries once and the pipeline carries on with the other sources if it's blocked that day. |
| SeattleRentals.com | fetch + cheerio | Fully server-rendered; plain HTTP works. |

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

## How dedupe works

Each listing is keyed by `(source, external_id)`. Re-scraped listings update
`last_seen_at` but keep their original `first_seen_at`, favorite, and hidden
flags. A listing is "new" if that key has never been seen before.

## Scaling to other cities

Preferences store the city. Craigslist uses `<city>.craigslist.org` and
Apartments.com uses `/<city>-wa/` (currently hard-coded to WA state).
SeattleRentals is Seattle-only and will just be skipped for other cities —
generalizing the state suffix + adding per-city sources is the main TODO.
