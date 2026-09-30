"use server";

import { redirect } from "next/navigation";
import { getViewer, supabaseUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getSubscriber, parseAlertLocations, type Frequency } from "@/lib/subscribers";

export type AuthState = {
  error: string | null;
  mode: "signin" | "signup";
  email: string;
};

export async function authenticate(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", mode, email };
  }
  if (password.length < 8) {
    return { error: "Passwords need at least 8 characters.", mode, email };
  }

  // Created server-side and pre-confirmed: Supabase's built-in mailer only
  // delivers to project members, so a confirmation email would never arrive.
  if (mode === "signup") {
    const { error } = await supabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return {
        error: taken
          ? "That email already has an account. Sign in instead."
          : error.message,
        mode: taken ? "signin" : mode,
        email,
      };
    }
  }

  const supabase = await supabaseUser();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "That email and password don't match.", mode, email };
  }

  await supabaseAdmin()
    .from("listing_alerts")
    .upsert(
      { user_id: data.user.id, email },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  const subscriber = await getSubscriber(data.user.id);
  redirect(subscriber?.onboarded_at ? "/" : "/welcome");
}

export async function signOut() {
  const supabase = await supabaseUser();
  await supabase.auth.signOut();
  redirect("/");
}

export async function saveAlerts(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");

  const num = (name: string): number | null => {
    const v = formData.get(name);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const list = (name: string) =>
    formData.getAll(name).map((v) => String(v).trim()).filter(Boolean);

  const rawFrequency = String(formData.get("frequency") ?? "");
  const frequency: Frequency = ["daily", "weekly", "off"].includes(rawFrequency)
    ? (rawFrequency as Frequency)
    : "daily";

  const existing = await getSubscriber(viewer.id);
  const now = new Date().toISOString();
  const locations = parseAlertLocations(formData.get("locations_json"));
  const cities = locations.map((l) => l.city);
  const neighborhoods = list("neighborhoods");
  const maxPrice = num("max_price");
  const minBeds = num("min_beds");
  const minSqft = num("min_sqft");

  const { error } = await supabaseAdmin()
    .from("listing_alerts")
    .upsert(
      {
        user_id: viewer.id,
        email: viewer.email,
        frequency,
        cities,
        locations,
        neighborhoods,
        max_price: maxPrice,
        min_beds: minBeds,
        min_baths: num("min_baths"),
        min_sqft: minSqft,
        // Digests only carry listings that show up after sign-up.
        onboarded_at: existing?.onboarded_at ?? now,
        last_digest_at: existing?.last_digest_at ?? now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);

  if (formData.get("from") !== "welcome") redirect("/account?saved=1");

  const qs = new URLSearchParams();
  for (const c of cities) qs.append("city", c);
  for (const n of neighborhoods) qs.append("neighborhood", n);
  if (maxPrice != null) qs.set("max_price", String(maxPrice));
  if (minBeds != null && minBeds > 0) qs.set("beds", String(minBeds));
  if (minSqft != null) qs.set("min_sqft", String(minSqft));
  const query = qs.toString();
  redirect(query ? `/?${query}` : "/");
}

export async function unsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect("/unsubscribe");
  await supabaseAdmin()
    .from("listing_alerts")
    .update({ frequency: "off", updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token);
  redirect(`/unsubscribe?token=${token}&done=1`);
}
