-- Way-underpriced listings are usually scams, weekly motel rates, or parking
-- spots. Each run computes rent stats per city + bedroom count and flags
-- anything below mean - 2.5 standard deviations.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS price_outlier boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.price_cutoffs (
  city text NOT NULL,
  beds_group text NOT NULL,
  listings integer NOT NULL,
  mean numeric NOT NULL,
  sd numeric NOT NULL,
  cutoff numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city, beds_group)
);

ALTER TABLE public.price_cutoffs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.flag_price_outliers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flagged integer;
BEGIN
  DELETE FROM price_cutoffs WHERE true;

  WITH base AS (
    SELECT city,
           CASE WHEN bedrooms >= 4 THEN '4+' ELSE floor(bedrooms)::int::text END AS grp,
           price
    FROM listings
    WHERE is_active
      AND listed_at >= now() - interval '60 days'
      AND price > 0
      AND bedrooms IS NOT NULL
  ),
  medians AS (
    SELECT city, grp, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median
    FROM base
    GROUP BY city, grp
  ),
  -- Obvious junk (under 40% of the median) would drag the mean and SD down
  -- and let other junk through, so it's left out of the stats.
  clean AS (
    SELECT b.city, b.grp, b.price
    FROM base b
    JOIN medians m USING (city, grp)
    WHERE b.price >= 0.4 * m.median
  )
  INSERT INTO price_cutoffs (city, beds_group, listings, mean, sd, cutoff)
  SELECT city, grp, count(*),
         round(avg(price)), round(stddev_samp(price)),
         round(avg(price) - 2.5 * stddev_samp(price))
  FROM clean
  GROUP BY city, grp
  HAVING count(*) >= 8;

  -- Groups without enough data (and listings with no bedroom count) use 80%
  -- of the city's lowest cutoff; anything under $400 is always flagged.
  WITH verdicts AS (
    SELECT l.id,
           coalesce(l.price < greatest(400, coalesce(
             (SELECT c.cutoff FROM price_cutoffs c
               WHERE c.city = l.city
                 AND c.beds_group = CASE WHEN l.bedrooms >= 4 THEN '4+' ELSE floor(l.bedrooms)::int::text END),
             (SELECT 0.8 * min(c.cutoff) FROM price_cutoffs c WHERE c.city = l.city),
             0)), false) AS outlier
    FROM listings l
    WHERE l.is_active
  )
  UPDATE listings l
  SET price_outlier = v.outlier
  FROM verdicts v
  WHERE l.id = v.id AND l.price_outlier IS DISTINCT FROM v.outlier;

  SELECT count(*) INTO flagged FROM listings WHERE is_active AND price_outlier;
  RETURN flagged;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.flag_price_outliers() FROM PUBLIC, anon, authenticated;

SELECT public.flag_price_outliers();
