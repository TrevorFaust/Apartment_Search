-- Listings: coordinates for radius search
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS state text;

-- Preferences: multi-city search areas + optional radius
ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS locations jsonb NOT NULL DEFAULT '[{"city": "seattle", "state": "wa"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS radius_miles numeric,
  ADD COLUMN IF NOT EXISTS radius_center text,
  ADD COLUMN IF NOT EXISTS radius_center_lat double precision,
  ADD COLUMN IF NOT EXISTS radius_center_lng double precision;

UPDATE public.preferences
SET locations = jsonb_build_array(
  jsonb_build_object('city', lower(city), 'state', 'wa')
)
WHERE locations = '[{"city": "seattle", "state": "wa"}]'::jsonb
  AND lower(city) <> 'seattle';

CREATE INDEX IF NOT EXISTS listings_neighborhood_idx ON public.listings (neighborhood)
  WHERE neighborhood IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_lat_lng_idx ON public.listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
