import type { Database } from "../../_shared/database.types.ts";
import { SpotRepository } from "../../_shared/repository/spot-repository.ts";
import { SpotError } from "../types.ts";

type RepeaterSpot = Database["public"]["Tables"]["repeater_spots"]["Row"];

/** Loads a spot by ID, throwing if not found. */
export class LoadSpotUseCase {
  constructor(private spotRepo: SpotRepository) {}

  async execute(spotId: string): Promise<RepeaterSpot> {
    const spot = await this.spotRepo.findById(spotId);
    if (!spot) {
      throw new SpotError("SPOT_NOT_FOUND", 404);
    }
    return spot;
  }
}
