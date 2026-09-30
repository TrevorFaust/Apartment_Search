"use server";

import { revalidatePath } from "next/cache";
import { geocodeCityCenter } from "@/lib/geocode";
import { redirect } from "next/navigation";
import { getViewer, isOwner } from "@/lib/auth";
import { setMark } from "@/lib/marks";
import { supabaseAdmin, type SearchLocation } from "@/lib/supabase";

export async function toggleFavorite(id: string, value: boolean) {
  await setMark(await getViewer(), id, "favorite", value);
  revalidatePath("/");
}

export async function toggleHidden(id: string, value: boolean) {
  await setMark(await getViewer(), id, "hidden", value);
  revalidatePath("/");
}

function parseLocations(formData: FormData): SearchLocation[] {
  const raw = String(formData.get("locations_json") ?? "");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SearchLocation[];
      return parsed
        .map((l) => ({
          city: String(l.city ?? "").toLowerCase().trim(),
          state: String(l.state ?? "").toLowerCase().trim(),
        }))
        .filter((l) => l.city && l.state);
    } catch {
      /* fall through */
    }
  }

  const city = String(formData.get("city") || "seattle").toLowerCase().trim();
  const state = String(formData.get("state") || "wa").toLowerCase().trim();
  return [{ city, state }];
}

async function attachCityCenters(
  locations: SearchLocation[],
  radiusMiles: number | null,
): Promise<SearchLocation[]> {
  if (radiusMiles == null) {
    return locations.map((l) => ({
      ...l,
      center_lat: null,
      center_lng: null,
    }));
  }

  const enriched: SearchLocation[] = [];
  for (const loc of locations) {
    const coords = await geocodeCityCenter(loc.city, loc.state);
    enriched.push({
      ...loc,
      center_lat: coords?.lat ?? null,
      center_lng: coords?.lng ?? null,
    });
  }
  return enriched;
}

export async function savePreferences(formData: FormData) {
  if (!isOwner(await getViewer())) redirect("/account");

  const num = (name: string): number | null => {
    const v = formData.get(name);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const neighborhoods = formData
    .getAll("neighborhoods")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = parseLocations(formData);
  const radiusMiles = num("radius_miles");
  const locations = await attachCityCenters(parsed, radiusMiles);

  const { error } = await supabaseAdmin()
    .from("preferences")
    .update({
      city: locations[0]?.city ?? "seattle",
      locations,
      min_price: num("min_price"),
      max_price: num("max_price"),
      min_beds: num("min_beds"),
      max_beds: null,
      min_baths: num("min_baths"),
      min_sqft: num("min_sqft"),
      neighborhoods,
      keywords,
      email_to: String(formData.get("email_to") || "") || null,
      radius_miles: radiusMiles,
      radius_center: null,
      radius_center_lat: locations[0]?.center_lat ?? null,
      radius_center_lng: locations[0]?.center_lng ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("key", "default");
  if (error) throw new Error(error.message);
  revalidatePath("/preferences");
  revalidatePath("/");
}
