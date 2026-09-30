-- Freshness: when a listing went up, and when we last confirmed it is still online.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS listed_at timestamptz
    GENERATED ALWAYS AS (coalesce(posted_at, first_seen_at)) STORED;

CREATE INDEX IF NOT EXISTS listings_active_listed_at_idx
  ON public.listings (listed_at DESC)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS listings_last_checked_at_idx
  ON public.listings (last_checked_at NULLS FIRST)
  WHERE is_active;
