import { AccessRepository } from "../../_shared/repository/access-repository.ts";
import { SpotError } from "../types.ts";

/** Validates that the access (if provided) belongs to the given repeater. */
export class ValidateAccessUseCase {
  constructor(private accessRepo: AccessRepository) {}

  async execute(
    accessId: string | null | undefined,
    repeaterId: string,
  ): Promise<void> {
    if (!accessId) return;

    const access = await this.accessRepo.findByIdAndRepeater(
      accessId,
      repeaterId,
    );
    if (!access) {
      throw new SpotError("INVALID_ACCESS", 422);
    }
  }
}
