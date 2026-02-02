import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { locatorToLatLon } from "../functions/_shared/utils.ts";

Deno.test("locatorToLatLon - 6-char locator JN54io", () => {
  const result = locatorToLatLon("JN54io");
  assertEquals(result, { lat: 44.60417, lon: 10.70833 });
});

Deno.test("locatorToLatLon - 6-char locator JM55IO (uppercase input)", () => {
  const result = locatorToLatLon("JM55IO");
  assertEquals(result, { lat: 35.60417, lon: 10.70833 });
});

Deno.test("locatorToLatLon - 4-char locator GM54", () => {
  const result = locatorToLatLon("GM54");
  assertEquals(result, { lat: 34.5, lon: -49 });
});

Deno.test("locatorToLatLon - null for empty string", () => {
  const result = locatorToLatLon("");
  assertEquals(result, null);
});

Deno.test("locatorToLatLon - null for short input", () => {
  const result = locatorToLatLon("JN");
  assertEquals(result, null);
});

Deno.test("locatorToLatLon - case insensitive", () => {
  const lower = locatorToLatLon("jn54io");
  const upper = locatorToLatLon("JN54IO");
  assertEquals(lower, upper);
});
