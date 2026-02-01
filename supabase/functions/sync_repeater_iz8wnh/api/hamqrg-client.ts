import { locatorToLatLon } from "../utils.ts";
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

  async fetchFromGrid(grid: string): Promise<HamQRGRecord[]> {
    const coords = locatorToLatLon(grid);
    if (!coords) {
      console.warn(`[API] Grid ${grid}: invalid locator, skipped`);
      return [];
    }

    console.log(
      `[API] Grid ${grid}: fetching (lat=${coords.lat}, lon=${coords.lon})`,
    );

    console.log("USER KEY", this.usr);
    console.log("PSW KEY", this.psw);
    console.log("TOKEN KEY", this.token);

    const response = await fetch(
      "https://www.iz8wnh.it/rpts/privateAPI/HamQRG/HamQRG.php",
      {
        method: "POST",
        headers: {
          "USR": this.usr,
          "PSW": this.psw,
          "TOKEN": this.token,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `lat=${coords.lat}&lng=${coords.lon}&range=150`,
      },
    );

    if (!response.ok) {
      throw new Error(
        `API error for grid ${grid}: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(`[API] data ${grid}: ${JSON.stringify(data)}`);
    if (!Array.isArray(data)) {
      console.warn(`[API] Grid ${grid}: response is not an array, skipped`);
      return [];
    }

    console.log(`[API] Grid ${grid}: ${data.length} records`);
    return data;
  }
}
