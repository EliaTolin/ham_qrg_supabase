export class LocatorUtils {
  static toLatLon(locator: string): { lat: number; lon: number } | null {
    if (!locator || locator.length < 4) return null;

    const loc = locator.toUpperCase();

    let lon = (loc.charCodeAt(0) - 65) * 20 - 180;
    let lat = (loc.charCodeAt(1) - 65) * 10 - 90;

    lon += parseInt(loc[2]) * 2;
    lat += parseInt(loc[3]) * 1;

    if (loc.length >= 6) {
      lon += (loc.charCodeAt(4) - 65) * 5 / 60;   // 5' longitude slot
      lat += (loc.charCodeAt(5) - 65) * 2.5 / 60; // 2.5' latitude slot
      lon += 0.5 * 5 / 60;                         // centro del subsquare
      lat += 0.5 * 2.5 / 60;
    } else {
      lon += 0.5 * 2;                               // centro del quadrato 2°
      lat += 0.5 * 1;                               // centro del quadrato 1°
    }

    return {
      lat: Math.round(lat * 1000000) / 1000000,
      lon: Math.round(lon * 1000000) / 1000000,
    };
  }

  static fromLatLon(lat: number, lon: number): string | null {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    const lonNorm = Math.max(0, Math.min(lon + 180, 359.999999));
    const latNorm = Math.max(0, Math.min(lat + 90, 179.999999));

    const lonField = Math.floor(lonNorm / 20);
    const latField = Math.floor(latNorm / 10);
    const lonSquare = Math.floor((lonNorm % 20) / 2);
    const latSquare = Math.floor((latNorm % 10) / 1);
    const lonSub = Math.floor((lonNorm % 2) / (5 / 60));
    const latSub = Math.floor((latNorm % 1) / (2.5 / 60));

    return String.fromCharCode(65 + lonField) +
      String.fromCharCode(65 + latField) +
      lonSquare.toString() +
      latSquare.toString() +
      String.fromCharCode(97 + lonSub) +
      String.fromCharCode(97 + latSub);
  }

  static isValid(locator: string): boolean {
    if (!locator || locator.length < 4) return false;
    const loc = locator.toUpperCase();
    if (loc.length === 4) {
      return /^[A-R]{2}[0-9]{2}$/.test(loc);
    }
    if (loc.length === 6) {
      return /^[A-R]{2}[0-9]{2}[A-X]{2}$/.test(loc);
    }
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
