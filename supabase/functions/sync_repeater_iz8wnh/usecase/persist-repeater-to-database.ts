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
    const repeaterId = await this.repeaterRepo.upsert(mapped.repeater);
    if (!repeaterId) {
      console.error(`[Persist] Repeater upsert failed: ${mapped.repeater.external_id}`);
      return { repeaterOk: false, accessOk: false };
    }

    if (!mapped.access) {
      console.log(`[Persist] Repeater ${repeaterId}: no access data`);
      return { repeaterOk: true, accessOk: false };
    }

    const accessOk = await this.accessRepo.upsert({
      ...mapped.access,
      repeater_id: repeaterId,
    });

    console.log(`[Persist] Repeater ${repeaterId}: access ${mapped.access.mode} ${accessOk ? "OK" : "FAILED"}`);
    return { repeaterOk: true, accessOk };
  }
}
