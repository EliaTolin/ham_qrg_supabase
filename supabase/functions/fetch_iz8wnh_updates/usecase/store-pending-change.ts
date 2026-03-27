import type { PendingChangeRepository } from "../../_shared/repository/pending-change-repository.ts";
import type { PendingChangeInsert } from "../../_shared/types.ts";

export class StorePendingChangeUseCase {
  constructor(private pendingChangeRepo: PendingChangeRepository) {}

  async execute(change: PendingChangeInsert): Promise<boolean> {
    console.log(
      `[StorePendingChange] Storing ${change.change_type} for ${change.external_id}`,
    );
    return await this.pendingChangeRepo.insert(change);
  }
}
