import type { RepeaterRepository } from "../repository/repeater-repository.ts";
import type { HamQRGRecord } from "../types.ts";

/**
 * Migrates repeaters.external_id to the API's native ID.
 *
 * Strategy:
 * 1. Try matching the old composite format ({freqHz}_{locator})
 * 2. Fallback: match by frequency_hz + locator directly in DB
 */
export class MigrateExternalIdUseCase {
  constructor(private repeaterRepo: RepeaterRepository) {}

  async execute(rec: HamQRGRecord): Promise<void> {
    const freqHz = Math.round(parseFloat(rec.Frequenza) * 1_000_000);
    const oldExternalId = `${freqHz}_${rec.Locator}`;
    const newExternalId = rec.ID;

    // 1) Try old composite format
    const migrated = await this.repeaterRepo.migrateExternalId(
      oldExternalId,
      newExternalId,
    );

    if (migrated) return;

    // 2) Fallback: match by frequency_hz + locator
    await this.repeaterRepo.migrateByFreqLocator(
      freqHz,
      rec.Locator,
      newExternalId,
    );
  }
}
