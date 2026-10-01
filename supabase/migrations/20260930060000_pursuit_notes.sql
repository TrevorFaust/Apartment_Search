-- A freeform note on a pursuit, next to messaged / tour / with.
ALTER TABLE public.listing_marks
  ADD COLUMN IF NOT EXISTS notes text;
