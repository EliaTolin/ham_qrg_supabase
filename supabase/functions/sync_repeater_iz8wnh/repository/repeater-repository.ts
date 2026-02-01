import { SupabaseClient } from "@supabase/supabase-js";
import type { MappedRepeater } from "../types.ts";

export interface UpsertResult {
  id: string;
  created: boolean;
}

export class RepeaterRepository {
  private supabase: SupabaseClient;
  private existingIds = new Set<string>();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async loadExistingIds(): Promise<void> {
    const { data, error } = await this.supabase
      .from("repeaters")
      .select("external_id")
      .eq("source", "iz8wnh");

    if (error) {
      console.error("[RepeaterRepo] Failed to load existing IDs:", error);
      return;
    }

    for (const row of data ?? []) {
      this.existingIds.add(row.external_id);
    }
    console.log(`[RepeaterRepo] Loaded ${this.existingIds.size} existing repeaters`);
  }

  async upsert(data: MappedRepeater): Promise<UpsertResult | null> {
    const existed = this.existingIds.has(data.external_id);

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

    this.existingIds.add(data.external_id);
    return { id: repeater.id, created: !existed };
  }
}
