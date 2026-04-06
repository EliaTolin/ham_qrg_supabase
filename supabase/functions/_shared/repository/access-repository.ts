import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";
import type { MappedAccess } from "../types.ts";

export class AccessRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findByRepeaterId(repeaterId: string) {
    const { data, error } = await this.supabase
      .from("repeater_access")
      .select("*")
      .eq("repeater_id", repeaterId);

    if (error) {
      console.error(`[AccessRepo] findByRepeaterId ${repeaterId}: FAILED`, error);
      return [];
    }
    return data ?? [];
  }

  async findByExternalId(externalId: string) {
    const { data, error } = await this.supabase
      .from("repeater_access")
      .select("*")
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  async deleteByExternalId(externalId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeater_access")
      .delete()
      .eq("external_id", externalId);

    if (error) {
      console.error(`[AccessRepo] deleteByExternalId ${externalId}: FAILED`, error);
      return false;
    }
    return true;
  }

  async updateByExternalId(
    externalId: string,
    fields: Record<string, unknown>,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeater_access")
      .update(fields)
      .eq("external_id", externalId);

    if (error) {
      console.error(`[AccessRepo] updateByExternalId ${externalId}: FAILED`, error);
      return false;
    }
    return true;
  }

  async insertAccess(data: Record<string, unknown>): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeater_access")
      .insert(data);

    if (error) {
      if (error.code === "23505") return false;
      console.error(`[AccessRepo] insertAccess: FAILED`, error);
      return false;
    }
    return true;
  }

  async upsert(
    data: MappedAccess & { repeater_id: string },
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeater_access")
      .upsert(
        {
          ...data,
          source: "www.iz8wnh.it",
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
