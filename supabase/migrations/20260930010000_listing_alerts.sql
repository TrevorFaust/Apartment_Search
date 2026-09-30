-- One row per signed-in Lease Locator user: their search criteria and digest
-- schedule. (This Supabase project is shared with the job-search app, which
-- owns public.subscribers.) Only the server (service role) touches this
-- table; it verifies the signed-in user itself, so RLS is on with no policies.
CREATE TABLE IF NOT EXISTS public.listing_alerts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'off')),
  cities text[] NOT NULL DEFAULT '{}',
  neighborhoods text[] NOT NULL DEFAULT '{}',
  min_price integer,
  max_price integer,
  min_beds numeric,
  min_baths numeric,
  min_sqft integer,
  onboarded_at timestamptz,
  -- Digests include listings first seen after this; advanced on every due run.
  last_digest_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS listings_first_seen_at_idx
  ON public.listings (first_seen_at DESC) WHERE is_active;
