const ELEVATION_API_URL = "https://api.open-meteo.com/v1/elevation";

export interface ElevationResult {
  elevation: number[];
}

export class OpenMeteoClient {
  /**
   * Fetch elevations for a batch of coordinates.
   * Open-Meteo accepts up to 100 coordinate pairs per request.
   */
  async fetchElevations(
    latitudes: number[],
    longitudes: number[],
  ): Promise<number[]> {
    if (latitudes.length !== longitudes.length) {
      throw new Error("latitudes and longitudes must have the same length");
    }

    if (latitudes.length === 0) {
      return [];
    }

    // Open-Meteo limits to 100 coordinates per request
    const BATCH_SIZE = 100;
    const allElevations: number[] = [];

    for (let i = 0; i < latitudes.length; i += BATCH_SIZE) {
      const latBatch = latitudes.slice(i, i + BATCH_SIZE);
      const lonBatch = longitudes.slice(i, i + BATCH_SIZE);

      const latParam = latBatch.map((l) => l.toFixed(6)).join(",");
      const lonParam = lonBatch.map((l) => l.toFixed(6)).join(",");

      const url = `${ELEVATION_API_URL}?latitude=${latParam}&longitude=${lonParam}`;

      console.log(
        `[OpenMeteo] Fetching elevations for ${latBatch.length} points (batch ${Math.floor(i / BATCH_SIZE) + 1})`,
      );

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Open-Meteo API error: ${response.status} ${response.statusText}`,
        );
      }

      const data: ElevationResult = await response.json();

      if (!Array.isArray(data.elevation)) {
        throw new Error("Open-Meteo response missing elevation array");
      }

      allElevations.push(...data.elevation);
    }

    return allElevations;
  }
}