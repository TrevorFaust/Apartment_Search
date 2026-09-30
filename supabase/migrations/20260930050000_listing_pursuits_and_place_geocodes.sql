-- Track outreach on a listing (messaged, tour time, who it's with),
-- and cache neighborhood geocodes so photo-less cards can show an area map.
ALTER TABLE public.listing_marks
  ADD COLUMN IF NOT EXISTS pursuing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS messaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS tour_at timestamptz,
  ADD COLUMN IF NOT EXISTS tour_with text;

CREATE TABLE IF NOT EXISTS public.place_geocodes (
  query text PRIMARY KEY,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.place_geocodes ENABLE ROW LEVEL SECURITY;
