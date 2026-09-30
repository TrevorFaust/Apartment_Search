-- Stock "coming soon" / "no photo" images and lazy-load stubs aren't photos.
UPDATE public.listings
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND (
    image_url !~* '^https?://'
    OR image_url ~* '(coming[_-]?soon|photo[_-]?not[_-]?available|no[_-]?(image|photo)|placeholder)'
  );

-- Building-based sources list one row per unit under the building's name, so a
-- photo-less unit can show a photo of its building from a sibling unit.
-- Craigslist titles are free-form ad text, so it's excluded.
CREATE OR REPLACE FUNCTION public.borrow_building_photos()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH donors AS (
    SELECT DISTINCT ON (source, lower(title)) source, lower(title) AS building, image_url
    FROM listings
    WHERE image_url IS NOT NULL AND source <> 'craigslist'
    ORDER BY source, lower(title), last_seen_at DESC
  ),
  updated AS (
    UPDATE listings l
    SET image_url = d.image_url
    FROM donors d
    WHERE l.image_url IS NULL
      AND l.source <> 'craigslist'
      AND l.source = d.source
      AND lower(l.title) = d.building
    RETURNING 1
  )
  SELECT count(*)::integer FROM updated;
$$;

REVOKE EXECUTE ON FUNCTION public.borrow_building_photos() FROM PUBLIC, anon, authenticated;

SELECT public.borrow_building_photos();
