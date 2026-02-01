import { SupabaseClient } from "@supabase/supabase-js";
import type { MappedRepeater } from "../types.ts";

export class RepeaterRepository {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async upsert(data: MappedRepeater): Promise<string | null> {
    const { data: repeater, error } = await this.supabase
      .from("repeaters")
      .upsert(
        {
          ...data,
          source: "hamqrg",
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
