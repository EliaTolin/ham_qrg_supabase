export function locatorToLatLon(
  locator: string,
): { lat: number; lon: number } | null {
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
