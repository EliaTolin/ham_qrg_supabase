import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";
import type { MappedRepeater } from "../types.ts";

export class RepeaterRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async migrateExternalId(
    oldExternalId: string,
    newExternalId: string,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeaters")
      .update({ external_id: newExternalId })
      .eq("external_id", oldExternalId);

    if (error) {
      // Ignore unique constraint violations (already migrated)
      if (error.code === "23505") return true;
      console.error(
        `[MigrateExternalId] ${oldExternalId} → ${newExternalId}: FAILED`,
        error,
      );
      return false;
    }
    return true;
  }

  async upsert(data: MappedRepeater): Promise<string | null> {
    const { data: repeater, error } = await this.supabase
      .from("repeaters")
      .upsert(
        {
          ...data,
          source: "iz8wnh",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "external_id" },
      )
      .select("id")
      .single();

    if (error || !repeater) {
      console.error(
        `Repeater upsert failed for ${data.external_id}:`,
        error,
      );
      return null;
    }

    return repeater.id;
  }
}
