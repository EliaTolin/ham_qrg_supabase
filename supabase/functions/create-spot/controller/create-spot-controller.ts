import type { Database } from "../../_shared/database.types.ts";
import { ValidateCallsignUseCase } from "../usecase/validate-callsign-usecase.ts";
import { ValidateDurationUseCase } from "../usecase/validate-duration-usecase.ts";
import { ValidateRepeaterUseCase } from "../usecase/validate-repeater-usecase.ts";
import { ValidateAccessUseCase } from "../usecase/validate-access-usecase.ts";
import { NotifyFavoritesUseCase } from "../usecase/notify-favorites-usecase.ts";
import { SpotRepository } from "../../_shared/repository/spot-repository.ts";
import type { CreateSpotRequest } from "../types.ts";

type RepeaterSpot = Database["public"]["Tables"]["repeater_spots"]["Row"];

export class CreateSpotController {
  constructor(
    private validateCallsignUseCase: ValidateCallsignUseCase,
    private validateDurationUseCase: ValidateDurationUseCase,
    private validateRepeaterUseCase: ValidateRepeaterUseCase,
    private validateAccessUseCase: ValidateAccessUseCase,
    private notifyFavoritesUseCase: NotifyFavoritesUseCase,
    private spotRepo: SpotRepository,
  ) {}

  async execute(
    userId: string,
    request: CreateSpotRequest,
  ): Promise<RepeaterSpot> {
    const isOtherSpot = !!request.spotted_callsign?.trim();

    // 1. Validate caller's callsign → captures snapshot
    const callsignSnapshot = await this.validateCallsignUseCase.execute(userId);

    // 2. Validate duration (required for self-spot, forbidden for other-spot)
    this.validateDurationUseCase.execute(
      request.duration_minutes ?? null,
      isOtherSpot,
    );

    // 3. Validate repeater exists
    await this.validateRepeaterUseCase.execute(request.repeater_id);

    // 4. Validate access belongs to repeater (if provided)
    await this.validateAccessUseCase.execute(
      request.access_id ?? null,
      request.repeater_id,
    );

    // 5. Atomic operation (self-spot: close-previous + insert; other-spot: insert only)
    const spot = await this.spotRepo.createSpotAtomic(
      userId,
      request.repeater_id,
      request.access_id ?? null,
      callsignSnapshot,
      isOtherSpot ? null : request.duration_minutes!,
      isOtherSpot ? request.spotted_callsign!.trim() : null,
    );

    // 6. Notify favorites (push notifications)
    try {
      const sent = await this.notifyFavoritesUseCase.execute(spot);
      console.log(`[create-spot] Notified ${sent} favorites`);
    } catch (err) {
      console.error("[create-spot] Notification fan-out failed:", err);
    }

    return spot;
  }
}
