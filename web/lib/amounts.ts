/** Keeps only digits (and one decimal point when allowed), so amounts can't go negative. */
export function cleanAmount(raw: string, decimals = false): string {
  if (!decimals) return raw.replace(/\D/g, "");
  const [whole, ...rest] = raw.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole!;
}

/** A non-negative number from form/query input, or null. */
export function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
