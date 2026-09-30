-- Per-user saves and hides (guests keep theirs in a session cookie instead).
-- Replaces the old site-wide listings.is_favorite / is_hidden flags.
CREATE TABLE IF NOT EXISTS public.listing_marks (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  favorite boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

ALTER TABLE public.listing_marks ENABLE ROW LEVEL SECURITY;

-- City + state for each alert city, so the scraper can cover cities that
-- subscribers pick beyond the owner's search areas.
ALTER TABLE public.listing_alerts
  ADD COLUMN IF NOT EXISTS locations jsonb NOT NULL DEFAULT '[]'::jsonb;
