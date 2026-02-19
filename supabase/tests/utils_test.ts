import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { LocatorUtils } from "../functions/_shared/locator-utils.ts";

// Reference test vectors from Giangrandi QTH locator calculator
// https://www.giangrandi.ch/electronics/radio/qthlocator.shtml

Deno.test("LocatorUtils.toLatLon - JN58rj (N 48.396, E 11.458)", () => {
  const result = LocatorUtils.toLatLon("JN58rj");
  assertEquals(result, { lat: 48.395833, lon: 11.458333 });
});

Deno.test("LocatorUtils.toLatLon - KF29oh (S 30.688, E 25.208)", () => {
  const result = LocatorUtils.toLatLon("KF29oh");
  assertEquals(result, { lat: -30.6875, lon: 25.208333 });
});

Deno.test("LocatorUtils.toLatLon - FE62es (S 47.229, W 67.625)", () => {
  const result = LocatorUtils.toLatLon("FE62es");
  assertEquals(result, { lat: -47.229167, lon: -67.625 });
});

Deno.test("LocatorUtils.toLatLon - DN15ga (N 45.021, W 117.458)", () => {
  const result = LocatorUtils.toLatLon("DN15ga");
  assertEquals(result, { lat: 45.020833, lon: -117.458333 });
});

// Original test cases

Deno.test("LocatorUtils.toLatLon - 6-char locator JN54io", () => {
  const result = LocatorUtils.toLatLon("JN54io");
  assertEquals(result, { lat: 44.604167, lon: 10.708333 });
});

Deno.test("LocatorUtils.toLatLon - 6-char locator JM55IO", () => {
  const result = LocatorUtils.toLatLon("JM55IO");
  assertEquals(result, { lat: 35.604167, lon: 10.708333 });
});

Deno.test("LocatorUtils.toLatLon - 4-char locator GM54", () => {
  const result = LocatorUtils.toLatLon("GM54");
  assertEquals(result, { lat: 34.5, lon: -49 });
});

Deno.test("LocatorUtils.toLatLon - null for empty string", () => {
  assertEquals(LocatorUtils.toLatLon(""), null);
});

Deno.test("LocatorUtils.toLatLon - null for short input", () => {
  assertEquals(LocatorUtils.toLatLon("JN"), null);
});

Deno.test("LocatorUtils.toLatLon - case insensitive", () => {
  assertEquals(
    LocatorUtils.toLatLon("jn54io"),
    LocatorUtils.toLatLon("JN54IO"),
  );
});

// fromLatLon test cases - user-provided vectors

Deno.test("LocatorUtils.fromLatLon - Bern (46.951, 7.439) -> JN36rw", () => {
  assertEquals(LocatorUtils.fromLatLon(46.951, 7.439), "JN36rw");
});

Deno.test("LocatorUtils.fromLatLon - (44.604, 10.708) -> JN54io", () => {
  assertEquals(LocatorUtils.fromLatLon(44.604, 10.708), "JN54io");
});

// fromLatLon - reverse of existing toLatLon test vectors

Deno.test("LocatorUtils.fromLatLon - reverse JN58rj", () => {
  assertEquals(LocatorUtils.fromLatLon(48.395833, 11.458333), "JN58rj");
});

Deno.test("LocatorUtils.fromLatLon - reverse KF29oh", () => {
  assertEquals(LocatorUtils.fromLatLon(-30.6875, 25.208333), "KF29oh");
});

Deno.test("LocatorUtils.fromLatLon - reverse FE62es", () => {
  assertEquals(LocatorUtils.fromLatLon(-47.229167, -67.625), "FE62es");
});

Deno.test("LocatorUtils.fromLatLon - reverse DN15ga", () => {
  assertEquals(LocatorUtils.fromLatLon(45.020833, -117.458333), "DN15ga");
});

Deno.test("LocatorUtils.fromLatLon - reverse JN54io", () => {
  assertEquals(LocatorUtils.fromLatLon(44.604167, 10.708333), "JN54io");
});

Deno.test("LocatorUtils.fromLatLon - reverse JM55io", () => {
  assertEquals(LocatorUtils.fromLatLon(35.604167, 10.708333), "JM55io");
});

// fromLatLon - edge cases

Deno.test("LocatorUtils.fromLatLon - null for lat out of range", () => {
  assertEquals(LocatorUtils.fromLatLon(91, 0), null);
});

Deno.test("LocatorUtils.fromLatLon - null for lon out of range", () => {
  assertEquals(LocatorUtils.fromLatLon(0, 181), null);
});

// isValid test cases

Deno.test("LocatorUtils.isValid - valid 4-char locator", () => {
  assertEquals(LocatorUtils.isValid("JN54"), true);
});

Deno.test("LocatorUtils.isValid - valid 6-char locator", () => {
  assertEquals(LocatorUtils.isValid("JN54io"), true);
});

Deno.test("LocatorUtils.isValid - invalid empty string", () => {
  assertEquals(LocatorUtils.isValid(""), false);
});

Deno.test("LocatorUtils.isValid - invalid short input", () => {
  assertEquals(LocatorUtils.isValid("JN"), false);
});

Deno.test("LocatorUtils.isValid - invalid 5-char input", () => {
  assertEquals(LocatorUtils.isValid("JN54i"), false);
});

Deno.test("LocatorUtils.isValid - invalid field letters (S > R)", () => {
  assertEquals(LocatorUtils.isValid("SN54"), false);
});

Deno.test("LocatorUtils.isValid - invalid subsquare letters (Y > X)", () => {
  assertEquals(LocatorUtils.isValid("JN54iy"), false);
});
