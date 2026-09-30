import { supabaseAdmin } from "@/lib/supabase";
import {
  applyListingFilters,
  fetchDistinctNeighborhoods,
  parseFilters,
} from "@/lib/listings-query";
import { fetchCityCounts } from "@/lib/subscribers";

export async function loadAlertOptions() {
  const [cityCounts, neighborhoodOptions] = await Promise.all([
    fetchCityCounts(),
    fetchDistinctNeighborhoods(() =>
      applyListingFilters(supabaseAdmin().from("listings"), parseFilters({}), {
        select: "id",
      }),
    ).catch((err) => {
      console.error("Failed to load neighborhood options:", err);
      return [];
    }),
  ]);
  return { cityCounts, neighborhoodOptions };
}
