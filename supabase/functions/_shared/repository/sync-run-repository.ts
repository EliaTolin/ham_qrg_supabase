import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export class SyncRunRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(params: {
    total_messages: number;
    dry_run: boolean;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from("sync_runs")
      .insert({
        status: "in_progress",
        dry_run: params.dry_run,
        total_messages: params.total_messages,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to create sync run: ${error?.message ?? "no data returned"}`,
      );
    }

    return data.id;
  }

  async incrementStats(
    runId: string,
    stats: {
      repeaters_processed?: number;
      access_processed?: number;
      fetch_errors?: number;
      sync_errors?: number;
    },
  ): Promise<void> {
    const { error } = await this.supabase.rpc("increment_sync_run_stats", {
      p_run_id: runId,
      p_repeaters_processed: stats.repeaters_processed ?? 0,
      p_access_processed: stats.access_processed ?? 0,
      p_fetch_errors: stats.fetch_errors ?? 0,
      p_sync_errors: stats.sync_errors ?? 0,
    });

    if (error) {
      throw new Error(
        `Failed to increment sync run stats: ${error.message}`,
      );
    }
  }
}
