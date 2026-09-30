import { cookies } from "next/headers";
import type { Viewer } from "./auth";
import { supabaseAdmin } from "./supabase";

export type Marks = { favorites: string[]; hidden: string[] };
export type MarkKind = "favorite" | "hidden";

// Guests' saves live in a session cookie (no expiry), so they last across
// refreshes and vanish when the browser closes.
const GUEST_COOKIE = "ll_marks";
// ~100 ids keeps the cookie under the 4KB browser limit.
const GUEST_LIMIT = 100;
const UUID = /^[0-9a-f-]{36}$/i;

async function readGuestMarks(): Promise<Marks> {
  const raw = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!raw) return { favorites: [], hidden: [] };
  try {
    const parsed = JSON.parse(raw) as { f?: unknown; h?: unknown };
    const ids = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [];
    return { favorites: ids(parsed.f), hidden: ids(parsed.h) };
  } catch {
    return { favorites: [], hidden: [] };
  }
}

export async function getMarks(viewer: Viewer | null): Promise<Marks> {
  if (!viewer) return readGuestMarks();

  const { data, error } = await supabaseAdmin()
    .from("listing_marks")
    .select("listing_id, favorite, hidden")
    .eq("user_id", viewer.id)
    .or("favorite.eq.true,hidden.eq.true")
    .limit(1000);
  if (error) throw new Error(error.message);
  return {
    favorites: (data ?? []).filter((r) => r.favorite).map((r) => r.listing_id),
    hidden: (data ?? []).filter((r) => r.hidden).map((r) => r.listing_id),
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

  while (marks.favorites.length + marks.hidden.length > GUEST_LIMIT) {
    (marks.hidden.length > marks.favorites.length ? marks.hidden : marks.favorites).shift();
  }

  (await cookies()).set(
    GUEST_COOKIE,
    JSON.stringify({ f: marks.favorites, h: marks.hidden }),
    { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
  );
}
