import { API_URL, UPDATES_API_URL } from "../constants.ts";
import type { HamQRGRecord, HamQRGUpdateRecord } from "../types.ts";

export class HamQRGClient {
  private usr: string;
  private psw: string;
  private token: string;

  constructor(usr: string, psw: string, token: string) {
    this.usr = usr;
    this.psw = psw;
    this.token = token;
  }

  async fetchFromCoords(lat: number, lon: number, radiusKm: number): Promise<HamQRGRecord[]> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "USR": this.usr,
        "PSW": this.psw,
        "TOKEN": this.token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `lat=${lat}&lng=${lon}&range=${radiusKm}`,
    });

    if (!response.ok) {
      throw new Error(
        `API error for coords (${lat}, ${lon}): ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data;
  }

  async fetchLatestUpdates(): Promise<HamQRGUpdateRecord[]> {
    const response = await fetch(UPDATES_API_URL, {
      method: "POST",
      headers: {
        "USR": this.usr,
        "PSW": this.psw,
        "TOKEN": this.token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Updates API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data;
  }
}
