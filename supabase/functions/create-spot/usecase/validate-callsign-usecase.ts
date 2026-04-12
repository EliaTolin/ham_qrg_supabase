import { ProfileRepository } from "../../_shared/repository/profile-repository.ts";
import { SpotError } from "../types.ts";

/** Validates that the user has a non-blank callsign and returns it as snapshot. */
export class ValidateCallsignUseCase {
  constructor(private profileRepo: ProfileRepository) {}

  async execute(userId: string): Promise<string> {
    const callsign = await this.profileRepo.getCallsign(userId);
    if (!callsign) {
      throw new SpotError("CALLSIGN_REQUIRED", 422);
    }
    return callsign;
  }
}
