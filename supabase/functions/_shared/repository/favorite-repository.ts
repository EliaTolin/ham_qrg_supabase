import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";

export interface EligibleFavoriteRecipient {
  user_id: string;
}

export class FavoriteRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Find users who have a repeater in their favorites, with both
   * cluster notification flags enabled (global + per-favorite),
   * excluding a specific user (the spot author).
   */
  async findEligibleForClusterNotification(
    repeaterId: string,
    excludeUserId: string,
  ): Promise<EligibleFavoriteRecipient[]> {
    const { data, error } = await this.supabase
      .from("user_favorite_repeaters")
      .select("user_id, profiles!inner(cluster_notifications_enabled)")
      .eq("repeater_id", repeaterId)
      .eq("cluster_notifications_enabled", true)
      .neq("user_id", excludeUserId);

    if (error) {
      console.error("[FavoriteRepo] findEligibleForClusterNotification failed:", error);
      return [];
    }

    if (!data) return [];

    // Filter by global opt-in (profiles.cluster_notifications_enabled)
    return (data as unknown as Array<{
      user_id: string;
      profiles: { cluster_notifications_enabled: boolean };
    }>)
      .filter((r) => r.profiles?.cluster_notifications_enabled === true)
      .map((r) => ({ user_id: r.user_id }));
  }
}
