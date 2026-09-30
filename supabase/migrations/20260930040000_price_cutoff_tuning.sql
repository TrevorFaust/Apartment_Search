-- Tighter markets (Seattle's rents cluster closely) made mean - 2.5 SD only
-- ~28% below average, catching real deals. A cutoff is now never stricter
-- than 40% below the group's average, and never lower than the cutoff for
-- fewer bedrooms (thin 4+ data put it under the 3-bedroom cutoff).
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
  ),
  stats AS (
    SELECT city, grp, count(*) AS n, avg(price) AS mean, stddev_samp(price) AS sd
    FROM clean
    GROUP BY city, grp
    HAVING count(*) >= 8
  )
  INSERT INTO price_cutoffs (city, beds_group, listings, mean, sd, cutoff)
  SELECT city, grp, n, round(mean), round(sd),
         -- grp sorts '0' < '1' < '2' < '3' < '4+'
         round(max(least(mean - 2.5 * sd, 0.6 * mean))
               OVER (PARTITION BY city ORDER BY grp ROWS UNBOUNDED PRECEDING))
  FROM stats;

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
