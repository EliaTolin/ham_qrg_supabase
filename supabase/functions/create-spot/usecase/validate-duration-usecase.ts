import { SpotError } from "../types.ts";

/**
 * Validates duration:
 * - Self-spot (spotted_callsign is null): duration is required, must be 1–600.
 * - Other-spot (spotted_callsign is set): duration must be null or omitted.
 */
export class ValidateDurationUseCase {
  execute(durationMinutes: number | null | undefined, isOtherSpot: boolean): void {
    if (isOtherSpot) {
      // Other-spots must NOT have a duration
      if (durationMinutes != null) {
        throw new SpotError("DURATION_NOT_ALLOWED", 422,
          "Other-spots (spotted_callsign) cannot have a duration");
      }
      return;
    }

    // Self-spots: duration is required and must be in range
    if (
      durationMinutes == null ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 600
    ) {
      throw new SpotError("INVALID_DURATION", 422);
    }
  }
}
