import type { ComputeElevationProfileUseCase } from "../usecase/compute-elevation-profile.ts";
import type { ProfileRequest, ProfileResult } from "../types.ts";

export class ProfileController {
  constructor(
    private computeElevationProfileUseCase: ComputeElevationProfileUseCase,
  ) {}

  async handle(body: ProfileRequest): Promise<ProfileResult> {
    this.validate(body);

    console.log(
      `[Profile] Request: repeater=(${body.repeater_lat}, ${body.repeater_lon}), user=(${body.user_lat}, ${body.user_lon}), points=${
        body.num_points ?? "default"
      }`,
    );

    const result = await this.computeElevationProfileUseCase.execute(
      body.repeater_lat,
      body.repeater_lon,
      body.user_lat,
      body.user_lon,
      body.num_points,
    );

    console.log(
      `[Profile] Done: ${result.num_points} points, ${result.total_distance_km} km`,
    );

    return result;
  }

  private validate(body: ProfileRequest): void {
    const { repeater_lat, repeater_lon, user_lat, user_lon } = body;

    if (
      repeater_lat == null || repeater_lon == null ||
      user_lat == null || user_lon == null
    ) {
      throw new Error(
        "Missing required fields: repeater_lat, repeater_lon, user_lat, user_lon",
      );
    }

    if (!isValidLat(repeater_lat) || !isValidLat(user_lat)) {
      throw new Error("Latitude must be between -90 and 90");
    }

    if (!isValidLon(repeater_lon) || !isValidLon(user_lon)) {
      throw new Error("Longitude must be between -180 and 180");
    }
  }
}

function isValidLat(lat: number): boolean {
  return typeof lat === "number" && lat >= -90 && lat <= 90;
}

function isValidLon(lon: number): boolean {
  return typeof lon === "number" && lon >= -180 && lon <= 180;
}
