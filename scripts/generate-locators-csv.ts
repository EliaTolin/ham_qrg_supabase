import { EUROPE_GRIDS_UNIQUE } from "../supabase/functions/sync_repeater_iz8wnh/locators.ts";
import { LocatorUtils } from "../supabase/functions/_shared/locator-utils.ts";

const lines = ["locator,lat,lon"];
for (const grid of EUROPE_GRIDS_UNIQUE) {
  // Append "MM" (center subsquare) to get 6-char precision
  const coords = LocatorUtils.toLatLon(grid + "MM");
  if (coords) {
    lines.push(`${grid},${coords.lat},${coords.lon}`);
  }
}

const csv = lines.join("\n") + "\n";
await Deno.writeTextFile("locators.csv", csv);
console.log(`Written ${EUROPE_GRIDS_UNIQUE.length} locators to locators.csv`);
