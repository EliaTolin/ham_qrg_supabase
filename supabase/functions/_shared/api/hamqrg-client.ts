import { API_URL } from "../constants.ts";
import { LocatorUtils } from "../locator-utils.ts";
import type { HamQRGRecord } from "../types.ts";

export class HamQRGClient {
  private usr: string;
  private psw: string;
  private token: string;

  constructor(usr: string, psw: string, token: string) {
    this.usr = usr;
    this.psw = psw;
    this.token = token;
  }

  async fetchFromCoords(lat: number, lon: number): Promise<HamQRGRecord[]> {
    console.log(`[API] Fetching (lat=${lat}, lon=${lon})`);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "USR": this.usr,
        "PSW": this.psw,
        "TOKEN": this.token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `lat=${lat}&lng=${lon}&range=150`,
    });

    if (!response.ok) {
      throw new Error(
        `API error for coords (${lat}, ${lon}): ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn(
        `[API] Coords (${lat}, ${lon}): response is not an array, skipped`,
      );
      return [];
    }

    console.log(`[API] Coords (${lat}, ${lon}): ${data.length} records`);
    return data;
  }

  fetchFromGrid(grid: string): Promise<HamQRGRecord[]> {
    const coords = LocatorUtils.toLatLon(grid);
    if (!coords) {
      console.warn(`[API] Grid ${grid}: invalid locator, skipped`);
      return Promise.resolve([]);
    }

    return this.fetchFromCoords(coords.lat, coords.lon);
  }
}
