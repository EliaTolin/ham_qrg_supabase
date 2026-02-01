import type { SupabaseClient } from "supabase";
import type { Database } from "../../_shared/database.types.ts";
import type { MappedRepeater } from "../types.ts";

export class RepeaterRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

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
