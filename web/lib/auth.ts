import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireEnv } from "./supabase";

/** Supabase client bound to the visitor's session cookies. */
export async function supabaseUser() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components can't set cookies; the proxy refreshes them.
          }
        },
      },
    },
  );
}

export type Viewer = { id: string; email: string };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const cookieStore = await cookies();
  if (!cookieStore.getAll().some((c) => c.name.startsWith("sb-"))) return null;

  const supabase = await supabaseUser();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
});
