import type { HamQRGClient } from "../../_shared/api/hamqrg-client.ts";
import type { HamQRGUpdateRecord } from "../../_shared/types.ts";

export class FetchLatestUpdatesUseCase {
  constructor(private apiClient: HamQRGClient) {}

  async execute(): Promise<HamQRGUpdateRecord[]> {
    return await this.apiClient.fetchLatestUpdates();
  }
}
