"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export async function toggleFavorite(id: string, value: boolean) {
  const { error } = await supabaseAdmin()
    .from("listings")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function toggleHidden(id: string, value: boolean) {
  const { error } = await supabaseAdmin()
    .from("listings")
    .update({ is_hidden: value })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function savePreferences(formData: FormData) {
  const num = (name: string): number | null => {
    const v = formData.get(name);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const list = (name: string): string[] =>
    String(formData.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const { error } = await supabaseAdmin()
    .from("preferences")
    .update({
      city: String(formData.get("city") || "seattle").toLowerCase(),
      min_price: num("min_price"),
      max_price: num("max_price"),
      min_beds: num("min_beds"),
      max_beds: num("max_beds"),
      min_baths: num("min_baths"),
      min_sqft: num("min_sqft"),
      neighborhoods: list("neighborhoods"),
      keywords: list("keywords"),
      email_to: String(formData.get("email_to") || "") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("key", "default");
  if (error) throw new Error(error.message);
  revalidatePath("/preferences");
  revalidatePath("/");
}
