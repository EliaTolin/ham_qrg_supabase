import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { PendingChangeInsert } from "../types.ts";

export class PendingChangeRepository {
  constructor(private supabase: SupabaseClient) {}

  async insert(change: PendingChangeInsert): Promise<boolean> {
    const { error } = await this.supabase
      .from("sync_pending_changes" as never)
      .insert({
        repeater_id: change.repeater_id,
        external_id: change.external_id,
        change_type: change.change_type,
        remote_data: change.remote_data,
        diff: change.diff,
        remote_updated_at: change.remote_updated_at,
        local_updated_at: change.local_updated_at,
        suggested_winner: change.suggested_winner,
      } as never);

    if (error) {
      // Unique constraint violation = already pending for this external_id
      if (error.code === "23505") {
        console.log(
          `[PendingChangeRepo] Already pending for ${change.external_id}, skipped`,
        );
        return false;
      }
      console.error(
        `[PendingChangeRepo] Insert failed for ${change.external_id}:`,
        error,
      );
      return false;
    }

    return true;
  }
}
