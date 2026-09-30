const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Fixed zone so server and client render the same string (no hydration mismatch).
const TIME_ZONE = "America/Los_Angeles";

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: TIME_ZONE,
});

const fullDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
  timeZoneName: "short",
});

/** "3h ago", "5d ago", or "Aug 12" once it's more than two weeks old. */
export function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  if (diff < HOUR) return "just now";
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 14 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return shortDate.format(new Date(iso));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  timeZone: TIME_ZONE,
});

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "Sept 19th" */
export function formatMonthDay(iso: string): string {
  const parts = monthDay.formatToParts(new Date(iso));
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return `${MONTHS[month - 1]} ${ordinal(day)}`;
}

export function formatFull(iso: string): string {
  return fullDate.format(new Date(iso));
}

export function latestIso(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v && (!best || new Date(v) > new Date(best))) best = v;
  }
  return best;
}
