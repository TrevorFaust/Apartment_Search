import { cookies } from "next/headers";
import type { Viewer } from "./auth";
import { supabaseAdmin } from "./supabase";

export type Pursuit = {
  messagedAt: string | null;
  tourAt: string | null;
  tourWith: string | null;
  notes: string | null;
};

const NOTE_MAX = 400;
const WITH_MAX = 120;
const COOKIE_BUDGET = 3600;

export type Marks = {
  favorites: string[];
  hidden: string[];
  pursuits: Record<string, Pursuit>;
};
export type MarkKind = "favorite" | "hidden";

// Guests' saves live in a session cookie (no expiry), so they last across
// refreshes and vanish when the browser closes.
const GUEST_COOKIE = "ll_marks";
const GUEST_LIMIT = 80;
const GUEST_PURSUITS = 20;
const UUID = /^[0-9a-f-]{36}$/i;

const EMPTY: Marks = { favorites: [], hidden: [], pursuits: {} };

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanPursuit(value: unknown): Pursuit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { m?: unknown; t?: unknown; w?: unknown; n?: unknown };
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    messagedAt: text(row.m),
    tourAt: text(row.t),
    tourWith: clip(row.w, WITH_MAX),
    notes: clip(row.n, NOTE_MAX),
  };
}

async function readGuestMarks(): Promise<Marks> {
  const raw = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!raw) return { ...EMPTY, pursuits: {} };
  try {
    const parsed = JSON.parse(raw) as { f?: unknown; h?: unknown; p?: unknown };
    const ids = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [];
    const pursuits: Record<string, Pursuit> = {};
    if (Array.isArray(parsed.p)) {
      for (const entry of parsed.p) {
        if (!Array.isArray(entry) || typeof entry[0] !== "string" || !UUID.test(entry[0])) continue;
        const pursuit = cleanPursuit({ m: entry[1], t: entry[2], w: entry[3], n: entry[4] });
        if (pursuit) pursuits[entry[0]] = pursuit;
      }
    }
    return { favorites: ids(parsed.f), hidden: ids(parsed.h), pursuits };
  } catch {
    return { ...EMPTY, pursuits: {} };
  }
}

async function writeGuestMarks(marks: Marks): Promise<void> {
  const favoriteIds = marks.favorites.filter((id) => UUID.test(id));
  const hiddenIds = marks.hidden.filter((id) => UUID.test(id));
  let pursuitEntries = Object.entries(marks.pursuits);
  while (favoriteIds.length + hiddenIds.length > GUEST_LIMIT) {
    (hiddenIds.length > favoriteIds.length ? hiddenIds : favoriteIds).shift();
  }
  if (pursuitEntries.length > GUEST_PURSUITS) {
    pursuitEntries = pursuitEntries.slice(pursuitEntries.length - GUEST_PURSUITS);
  }
  let payload = {
    f: favoriteIds,
    h: hiddenIds,
    p: pursuitEntries.map(([id, p]) => [id, p.messagedAt, p.tourAt, p.tourWith, p.notes]),
  };
  while (JSON.stringify(payload).length > COOKIE_BUDGET && payload.p.length > 1) {
    payload = { ...payload, p: payload.p.slice(1) };
  }
  (await cookies()).set(GUEST_COOKIE, JSON.stringify(payload), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getMarks(viewer: Viewer | null): Promise<Marks> {
  if (!viewer) return readGuestMarks();

  const { data, error } = await supabaseAdmin()
    .from("listing_marks")
    .select("listing_id, favorite, hidden, pursuing, messaged_at, tour_at, tour_with, notes")
    .eq("user_id", viewer.id)
    .or("favorite.eq.true,hidden.eq.true,pursuing.eq.true")
    .limit(1000);
  if (error) throw new Error(error.message);

  const pursuits: Record<string, Pursuit> = {};
  for (const row of data ?? []) {
    if (!row.pursuing) continue;
    pursuits[row.listing_id] = {
      messagedAt: row.messaged_at,
      tourAt: row.tour_at,
      tourWith: row.tour_with,
      notes: row.notes,
    };
  }
  return {
    favorites: (data ?? []).filter((r) => r.favorite).map((r) => r.listing_id),
    hidden: (data ?? []).filter((r) => r.hidden).map((r) => r.listing_id),
    pursuits,
  };
}

export async function setMark(
  viewer: Viewer | null,
  listingId: string,
  kind: MarkKind,
  value: boolean,
): Promise<void> {
  if (!UUID.test(listingId)) throw new Error("Invalid listing id");

  if (viewer) {
    const { error } = await supabaseAdmin()
      .from("listing_marks")
      .upsert(
        {
          user_id: viewer.id,
          listing_id: listingId,
          [kind]: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,listing_id" },
      );
    if (error) throw new Error(error.message);
    return;
  }

  const marks = await readGuestMarks();
  const key = kind === "favorite" ? "favorites" : "hidden";
  const next = marks[key].filter((id) => id !== listingId);
  if (value) next.push(listingId);
  marks[key] = next;
  await writeGuestMarks(marks);
}

export async function setPursuit(
  viewer: Viewer | null,
  listingId: string,
  pursuit: Pursuit | null,
): Promise<void> {
  if (!UUID.test(listingId)) throw new Error("Invalid listing id");

  if (viewer) {
    const { error } = await supabaseAdmin()
      .from("listing_marks")
      .upsert(
        {
          user_id: viewer.id,
          listing_id: listingId,
          pursuing: pursuit != null,
          messaged_at: pursuit?.messagedAt ?? null,
          tour_at: pursuit?.tourAt ?? null,
          tour_with: clip(pursuit?.tourWith, WITH_MAX),
          notes: clip(pursuit?.notes, NOTE_MAX),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,listing_id" },
      );
    if (error) throw new Error(error.message);
    return;
  }

  const marks = await readGuestMarks();
  if (pursuit) marks.pursuits[listingId] = pursuit;
  else delete marks.pursuits[listingId];
  await writeGuestMarks(marks);
}
