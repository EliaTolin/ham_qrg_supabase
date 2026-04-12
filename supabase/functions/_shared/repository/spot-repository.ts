import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";

type RepeaterSpot = Database["public"]["Tables"]["repeater_spots"]["Row"];

export class SpotRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /** Atomic close-previous + insert-new via internal plpgsql function. */
  async createSpotAtomic(
    userId: string,
    repeaterId: string,
    accessId: string | null,
    callsignSnapshot: string,
    durationMinutes: number | null,
    spottedCallsign: string | null = null,
  ): Promise<RepeaterSpot> {
    const { data, error } = await this.supabase.rpc("_create_spot_atomic", {
      p_user_id: userId,
      p_repeater_id: repeaterId,
      p_access_id: accessId,
      p_callsign_snapshot: callsignSnapshot,
      p_duration_minutes: durationMinutes,
      p_spotted_callsign: spottedCallsign,
    });

    if (error) throw error;
    return data as unknown as RepeaterSpot;
  }

  /** Find a spot by ID. */
  async findById(spotId: string): Promise<RepeaterSpot | null> {
    const { data, error } = await this.supabase
      .from("repeater_spots")
      .select("*")
      .eq("id", spotId)
      .maybeSingle();

    if (error) {
      console.error(`[SpotRepo] findById ${spotId}: FAILED`, error);
      return null;
    }
    return data;
  }

  /** Close a spot by setting closed_at and closed_by. */
  async closeSpot(spotId: string, closedBy: string): Promise<RepeaterSpot> {
    const { data, error } = await this.supabase
      .from("repeater_spots")
      .update({
        closed_at: new Date().toISOString(),
        closed_by: closedBy,
      })
      .eq("id", spotId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }
}
