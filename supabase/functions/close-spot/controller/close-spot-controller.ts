import type { Database } from "../../_shared/database.types.ts";
import { LoadSpotUseCase } from "../usecase/load-spot-usecase.ts";
import { CloseSpotUseCase } from "../usecase/close-spot-usecase.ts";

type RepeaterSpot = Database["public"]["Tables"]["repeater_spots"]["Row"];

export class CloseSpotController {
  constructor(
    private loadSpotUseCase: LoadSpotUseCase,
    private closeSpotUseCase: CloseSpotUseCase,
  ) {}

  async execute(userId: string, spotId: string): Promise<RepeaterSpot> {
    const spot = await this.loadSpotUseCase.execute(spotId);
    return await this.closeSpotUseCase.execute(spot, userId);
  }
}
