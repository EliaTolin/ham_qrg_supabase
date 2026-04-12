import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";

export class ProfileRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /** Get the trimmed callsign for a user, or null if blank/missing. */
  async getCallsign(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("callsign")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(`[ProfileRepo] getCallsign ${userId}: FAILED`, error);
      return null;
    }

    const raw = data?.callsign?.trim();
    return raw || null;
  }
}
