import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";
import type { MappedRepeater } from "../types.ts";

export class RepeaterRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findByExternalId(externalId: string) {
    const { data, error } = await this.supabase
      .from("repeaters")
      .select("*")
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) {
      console.error(`[RepeaterRepo] findByExternalId ${externalId}: FAILED`, error);
      return null;
    }
    return data;
  }

  /** Find repeater via repeater_access.external_id (iz8wnh record ID → access → repeater) */
  async findByAccessExternalId(accessExternalId: string) {
    const { data, error } = await this.supabase
      .from("repeater_access")
      .select("repeater_id")
      .eq("external_id", accessExternalId)
      .limit(1)
      .maybeSingle();

    if (error || !data?.repeater_id) return null;

    return this.findById(data.repeater_id);
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("repeaters")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(`[RepeaterRepo] findById ${id}: FAILED`, error);
      return null;
    }
    return data;
  }

  async findByCallsignAndLocator(callsign: string, locator: string) {
    if (!callsign) return null;
    const { data, error } = await this.supabase
      .from("repeaters")
      .select("*")
      .eq("callsign", callsign)
      .eq("locator", locator)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error(`[RepeaterRepo] findByCallsignAndLocator ${callsign}/${locator}: FAILED`, error);
      return null;
    }
    return data;
  }

  async findByCallsign(callsign: string) {
    if (!callsign) return null;
    const { data, error } = await this.supabase
      .from("repeaters")
      .select("*")
      .eq("callsign", callsign)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error(`[RepeaterRepo] findByCallsign ${callsign}: FAILED`, error);
      return null;
    }
    return data;
  }

  async findByFreqLocator(frequencyHz: number, locator: string) {
    const { data, error } = await this.supabase
      .from("repeaters")
      .select("*")
      .eq("frequency_hz", frequencyHz)
      .eq("locator", locator)
      .maybeSingle();

    if (error) {
      console.error(`[RepeaterRepo] findByFreqLocator ${frequencyHz}/${locator}: FAILED`, error);
      return null;
    }
    return data;
  }

  async migrateExternalId(
    oldExternalId: string,
    newExternalId: string,
  ): Promise<boolean> {
    const { error, count } = await this.supabase
      .from("repeaters")
      .update({ external_id: newExternalId })
      .eq("external_id", oldExternalId)
      .select("id", { count: "exact", head: true });

    if (error) {
      if (error.code === "23505") return true;
      console.error(
        `[MigrateExternalId] ${oldExternalId} → ${newExternalId}: FAILED`,
        error,
      );
      return false;
    }
    return (count ?? 0) > 0;
  }

  async migrateByFreqLocator(
    frequencyHz: number,
    locator: string,
    newExternalId: string,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("repeaters")
      .update({ external_id: newExternalId })
      .eq("frequency_hz", frequencyHz)
      .eq("locator", locator)
      .neq("external_id", newExternalId);

    if (error) {
      if (error.code === "23505") return true;
      console.error(
        `[MigrateByFreqLocator] ${frequencyHz}/${locator} → ${newExternalId}: FAILED`,
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
