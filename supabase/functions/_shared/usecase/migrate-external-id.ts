import type { RepeaterRepository } from "../repository/repeater-repository.ts";
import type { HamQRGRecord } from "../types.ts";

/**
 * One-shot use case: migrates repeaters.external_id from the old
 * composite format ({freqHz}_{locator}) to the API's native ID.
 *
 * Safe to call multiple times – skips records already migrated.
 * Remove this use case once the first full sync succeeds.
 */
export class MigrateExternalIdUseCase {
  constructor(private repeaterRepo: RepeaterRepository) {}

  async execute(rec: HamQRGRecord): Promise<void> {
    const freqHz = Math.round(parseFloat(rec.Frequenza) * 1_000_000);
    const oldExternalId = `${freqHz}_${rec.Locator}`;
    const newExternalId = rec.ID;

    await this.repeaterRepo.migrateExternalId(oldExternalId, newExternalId);
  }
}
