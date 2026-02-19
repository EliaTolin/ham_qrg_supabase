import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { CoverageStation } from "../../sync_repeater_iz8wnh/usecase/enqueue-grids.ts";

export class CoverageStationRepository {
  constructor(private supabase: SupabaseClient) {}

  async findAll(): Promise<CoverageStation[]> {
    const { data, error } = await this.supabase
      .from("iz8wnh_points_to_sync")
      .select("lat, lon, radius_km");

    if (error) {
      throw new Error(`Failed to load coverage stations: ${error.message}`);
    }

    return data as CoverageStation[];
  }
}
