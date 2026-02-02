import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";
import type { MappedAccess } from "../types.ts";

export class AccessRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async upsert(
    data: MappedAccess & { repeater_id: string },
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeater_access")
      .upsert(
        {
          ...data,
          source: "iz8wnh",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "external_id" },
      );

    if (error) {
      console.error(
        `Access upsert failed for record ${data.external_id}:`,
        error,
      );
      return false;
    }

    return true;
  }
}
