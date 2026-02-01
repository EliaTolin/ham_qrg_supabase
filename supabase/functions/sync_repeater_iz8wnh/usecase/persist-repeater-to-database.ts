import type { MappedRecord, SyncRecordResult } from "../types.ts";
import type { RepeaterRepository } from "../repository/repeater-repository.ts";
import type { AccessRepository } from "../repository/access-repository.ts";

export class PersistRepeaterToDatabaseUseCase {
  constructor(
    private repeaterRepo: RepeaterRepository,
    private accessRepo: AccessRepository,
  ) {}

  async execute(mapped: MappedRecord): Promise<SyncRecordResult> {
    console.log(`[Persist] Upserting repeater ${mapped.repeater.external_id}`);
    const result = await this.repeaterRepo.upsert(mapped.repeater);
    if (!result) {
      console.error(`[Persist] Repeater upsert failed: ${mapped.repeater.external_id}`);
      return { repeaterOk: false, repeaterCreated: false, accessOk: false };
    }

    if (!mapped.access) {
      console.log(`[Persist] Repeater ${result.id}: no access data`);
      return { repeaterOk: true, repeaterCreated: result.created, accessOk: false };
    }

    const accessOk = await this.accessRepo.upsert({
      ...mapped.access,
      repeater_id: result.id,
    });

    console.log(`[Persist] Repeater ${result.id}: access ${mapped.access.mode} ${accessOk ? "OK" : "FAILED"}`);
    return { repeaterOk: true, repeaterCreated: result.created, accessOk };
  }
}
