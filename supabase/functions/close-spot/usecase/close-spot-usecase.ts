import type { Database } from "../../_shared/database.types.ts";
import { SpotRepository } from "../../_shared/repository/spot-repository.ts";
import { SpotError } from "../types.ts";

type RepeaterSpot = Database["public"]["Tables"]["repeater_spots"]["Row"];

/** Closes a spot after verifying ownership and not-already-closed. */
export class CloseSpotUseCase {
  constructor(private spotRepo: SpotRepository) {}

  async execute(spot: RepeaterSpot, callerId: string): Promise<RepeaterSpot> {
    // Owner check — v1: only the owner can close. No admin moderation (Q5).
    if (spot.user_id !== callerId) {
      throw new SpotError("FORBIDDEN", 403);
    }

    // Not-already-closed check
    if (spot.closed_at !== null) {
      throw new SpotError("ALREADY_CLOSED", 409);
    }

    return await this.spotRepo.closeSpot(spot.id, callerId);
  }
}
