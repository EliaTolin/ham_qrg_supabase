import type { OpenMeteoClient } from "../../_shared/api/open-meteo-client.ts";
import type { ProfilePoint, ProfileResult } from "../types.ts";

const DEFAULT_NUM_POINTS = 100;
const MIN_POINTS = 10;
const MAX_POINTS = 200;

export class ComputeElevationProfileUseCase {
  constructor(private elevationClient: OpenMeteoClient) {}

  async execute(
    repeaterLat: number,
    repeaterLon: number,
    userLat: number,
    userLon: number,
    numPoints?: number,
  ): Promise<ProfileResult> {
    const n = Math.min(
      MAX_POINTS,
      Math.max(MIN_POINTS, numPoints ?? DEFAULT_NUM_POINTS),
    );

    console.log(
      `[ElevationProfile] Computing ${n} points from (${repeaterLat}, ${repeaterLon}) to (${userLat}, ${userLon})`,
    );

    // Sample equidistant points along the line
    const latitudes: number[] = [];
    const longitudes: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      latitudes.push(repeaterLat + t * (userLat - repeaterLat));
      longitudes.push(repeaterLon + t * (userLon - repeaterLon));
    }

    // Fetch elevations from Open-Meteo
    const elevations = await this.elevationClient.fetchElevations(
      latitudes,
      longitudes,
    );

    // Compute cumulative distances and build profile points
    const totalDistanceKm = haversineDistance(
      repeaterLat,
      repeaterLon,
      userLat,
      userLon,
    );

    const points: ProfilePoint[] = [];
    for (let i = 0; i < n; i++) {
      const distanceKm = i === 0
        ? 0
        : haversineDistance(
          repeaterLat,
          repeaterLon,
          latitudes[i],
          longitudes[i],
        );

      points.push({
        lat: latitudes[i],
        lon: longitudes[i],
        elevation_m: elevations[i],
        distance_km: Math.round(distanceKm * 1000) / 1000,
      });
    }

    console.log(
      `[ElevationProfile] Done: ${n} points, total distance ${totalDistanceKm.toFixed(2)} km`,
    );

    return {
      points,
      total_distance_km: Math.round(totalDistanceKm * 1000) / 1000,
      num_points: n,
    };
  }
}

/** Haversine distance between two coordinates in km */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}
