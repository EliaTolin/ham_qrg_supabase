import { RepeaterRepository } from "../../_shared/repository/repeater-repository.ts";
import { SpotError } from "../types.ts";

/** Validates that the repeater exists. */
export class ValidateRepeaterUseCase {
  constructor(private repeaterRepo: RepeaterRepository) {}

  async execute(repeaterId: string): Promise<void> {
    const repeater = await this.repeaterRepo.findById(repeaterId);
    if (!repeater) {
      throw new SpotError("REPEATER_NOT_FOUND", 404);
    }
  }
}
