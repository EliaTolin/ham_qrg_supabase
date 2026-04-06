import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { PendingChangeInsert } from "../types.ts";

export class PendingChangeRepository {
  private lastInsertedId: string | null = null;

  constructor(private supabase: SupabaseClient) {}

  getLastInsertedId(): string | null {
    return this.lastInsertedId;
  }

  async insert(change: PendingChangeInsert, status = "pending"): Promise<boolean> {
    const { data, error } = await this.supabase
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
        status,
      } as never)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        console.log(
          `[PendingChangeRepo] Already pending for ${change.external_id}, skipped`,
        );
        this.lastInsertedId = null;
        return false;
      }
      console.error(
        `[PendingChangeRepo] Insert failed for ${change.external_id}:`,
        error,
      );
      this.lastInsertedId = null;
      return false;
    }

    this.lastInsertedId = (data as { id: string })?.id ?? null;
    return true;
  }

  async markApproved(changeId: string): Promise<void> {
    await this.supabase
      .from("sync_pending_changes" as never)
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", changeId);
  }
}
