export function locatorToLatLon(
  locator: string,
): { lat: number; lon: number } | null {
  if (!locator || locator.length < 4) return null;

  const loc = locator.toUpperCase();

  let lon = (loc.charCodeAt(0) - 65) * 20 - 180;
  let lat = (loc.charCodeAt(1) - 65) * 10 - 90;

  lon += parseInt(loc[2]) * 2;
  lat += parseInt(loc[3]) * 1;

  // Centro del quadrato 4-char
  lon += 1.0;
  lat += 0.5;

  // Subsquare 6-char (se presente)
  if (loc.length >= 6) {
    lon += (loc.charCodeAt(4) - 65) * (2 / 24) + 1 / 24;
    lat += (loc.charCodeAt(5) - 65) * (1 / 24) + 0.5 / 24;
  }

  return {
    lat: Math.round(lat * 100000) / 100000,
    lon: Math.round(lon * 100000) / 100000,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
