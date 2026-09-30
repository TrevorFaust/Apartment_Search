/** Stock "no photo" images and lazy-load stubs that sources pass off as photos. */
const PLACEHOLDER_PATTERNS = [
  /coming[_-]?soon/i,
  /photo[_-]?not[_-]?available/i,
  /no[_-]?(?:image|photo)/i,
  /placeholder/i,
];

/** Returns the URL only if it's a real, absolute photo URL. */
export function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(url))) return null;
  return url;
}
