import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { locatorToLatLon } from "../functions/_shared/utils.ts";

// Reference test vectors from Giangrandi QTH locator calculator
// https://www.giangrandi.ch/electronics/radio/qthlocator.shtml

Deno.test("locatorToLatLon - JN58rj (N 48.396, E 11.458)", () => {
  const result = locatorToLatLon("JN58rj");
  assertEquals(result, { lat: 48.39583, lon: 11.45833 });
});

Deno.test("locatorToLatLon - KF29oh (S 30.688, E 25.208)", () => {
  const result = locatorToLatLon("KF29oh");
  assertEquals(result, { lat: -30.6875, lon: 25.20833 });
});

Deno.test("locatorToLatLon - FE62es (S 47.229, W 67.625)", () => {
  const result = locatorToLatLon("FE62es");
  assertEquals(result, { lat: -47.22917, lon: -67.625 });
});

Deno.test("locatorToLatLon - DN15ga (N 45.021, W 117.458)", () => {
  const result = locatorToLatLon("DN15ga");
  assertEquals(result, { lat: 45.02083, lon: -117.45833 });
});

// Original test cases

Deno.test("locatorToLatLon - 6-char locator JN54io", () => {
  const result = locatorToLatLon("JN54io");
  assertEquals(result, { lat: 44.60417, lon: 10.70833 });
});

Deno.test("locatorToLatLon - 6-char locator JM55IO", () => {
  const result = locatorToLatLon("JM55IO");
  assertEquals(result, { lat: 35.60417, lon: 10.70833 });
});

Deno.test("locatorToLatLon - 4-char locator GM54", () => {
  const result = locatorToLatLon("GM54");
  assertEquals(result, { lat: 34.5, lon: -49 });
});

Deno.test("locatorToLatLon - null for empty string", () => {
  assertEquals(locatorToLatLon(""), null);
});

Deno.test("locatorToLatLon - null for short input", () => {
  assertEquals(locatorToLatLon("JN"), null);
});

Deno.test("locatorToLatLon - case insensitive", () => {
  assertEquals(locatorToLatLon("jn54io"), locatorToLatLon("JN54IO"));
});
