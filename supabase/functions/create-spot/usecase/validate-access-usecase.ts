import { AccessRepository } from "../../_shared/repository/access-repository.ts";
import type { Database } from "../../_shared/database.types.ts";
import { SpotError } from "../types.ts";

type AccessMode = Database["public"]["Enums"]["access_mode"];

/**
 * Validates that the access (if provided) belongs to the given repeater.
 * Returns the access mode so the caller can gate mode-specific fields
 * (the talkgroup) on it — the client's choice is never trusted.
 */
export class ValidateAccessUseCase {
  constructor(private accessRepo: AccessRepository) {}

  async execute(
    accessId: string | null | undefined,
    repeaterId: string,
  ): Promise<AccessMode | null> {
    if (!accessId) return null;

    const access = await this.accessRepo.findByIdAndRepeater(
      accessId,
      repeaterId,
    );
    if (!access) {
      throw new SpotError("INVALID_ACCESS", 422);
    }
    return access.mode;
  }
}
