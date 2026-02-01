import { SupabaseClient } from "@supabase/supabase-js";
import type { MappedAccess } from "../types.ts";

export class AccessRepository {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async upsert(
    data: MappedAccess & { repeater_id: string },
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeater_access")
      .upsert(
        {
          ...data,
          source: "hamqrg",
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
