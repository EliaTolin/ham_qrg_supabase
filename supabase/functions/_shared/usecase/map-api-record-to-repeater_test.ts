import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MapApiRecordToRepeaterUseCase } from "./map-api-record-to-repeater.ts";
import type { HamQRGRecord } from "../types.ts";

// Mock NetworkRepository — returns a fixed ID or null
function mockNetworkRepo(returnId: string | null = "net-123") {
  return {
    resolveNetworkId: async (_rete: string | null) => returnId,
    unknownRete: [] as string[],
    missingNetworks: [] as string[],
    // deno-lint-ignore no-explicit-any
  } as any;
}

function makeRecord(overrides: Partial<HamQRGRecord> = {}): HamQRGRecord {
  return {
    ID: "100",
    Ripetitore: "RV50",
    Frequenza: "145.625000",
    Shift: "-0.600000",
    Tono: "82.5",
    ColorCode: null,
    Stanza: null,
    Rete: null,
    Lat: "44.46751",
    Long: "8.08858",
    Localita: "Mombarcaro",
    Locator: "JN44BL",
    Identificativo: "IR1D",
    Tipologia: "FM",
    Ultima_Modifica: "2026-04-06",
    QRB: "0",
    ...overrides,
  };
}

Deno.test("FM record → mode ANALOG, freq/shift parsed correctly", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord());

  assertEquals(result!.repeater.frequency_hz, 145625000);
  assertEquals(result!.repeater.shift_hz, -600000);
  assertEquals(result!.access!.mode, "ANALOG");
  assertEquals(result!.repeater.callsign, "IR1D");
  assertEquals(result!.repeater.name, "RV50");
  assertEquals(result!.repeater.locality, "Mombarcaro");
});

Deno.test("DMR record with ColorCode → color_code set", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(
    makeRecord({ Tipologia: "DMR", ColorCode: "7" }),
  );

  assertEquals(result!.access!.mode, "DMR");
  assertEquals(result!.access!.color_code, 7);
});

Deno.test("DMR record with invalid ColorCode → color_code null", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(
    makeRecord({ Tipologia: "DMR", ColorCode: "20" }),
  );

  assertEquals(result!.access!.color_code, null);
});

Deno.test("Record with Stanza → node_id parsed", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Stanza: "34405" }));

  assertEquals(result!.access!.node_id, 34405);
});

Deno.test("Record with non-numeric Stanza → node_id null", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Stanza: "abc" }));

  assertEquals(result!.access!.node_id, null);
});

Deno.test("Unknown Tipologia → access null", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Tipologia: "UNKNOWN_MODE" }));

  assertEquals(result!.access, null);
  assertNotEquals(result!.repeater, null);
});

Deno.test("Tono 0 → ctcss null", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Tono: "0.0" }));

  assertEquals(result!.access!.ctcss_tx_hz, null);
});

Deno.test("Valid CTCSS tone → ctcss set", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Tono: "127.3" }));

  assertEquals(result!.access!.ctcss_tx_hz, 127.3);
});

Deno.test("Invalid Lat/Long → lat/lon null", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Lat: "abc", Long: "xyz" }));

  assertEquals(result!.repeater.lat, null);
  assertEquals(result!.repeater.lon, null);
});

Deno.test("Locality with newlines → cleaned", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(
    makeRecord({ Localita: "Monte\nRosa" }),
  );

  assertEquals(result!.repeater.locality, "Monte Rosa");
});

Deno.test("C4FM tipologia → mode C4FM", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Tipologia: "C4FM" }));

  assertEquals(result!.access!.mode, "C4FM");
});

Deno.test("DS tipologia → mode DSTAR", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo());
  const result = await uc.execute(makeRecord({ Tipologia: "DS" }));

  assertEquals(result!.access!.mode, "DSTAR");
});

Deno.test("Network ID is passed from repository", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo("my-net-id"));
  const result = await uc.execute(makeRecord({ Rete: "BrandMeister" }));

  assertEquals(result!.access!.network_id, "my-net-id");
});

Deno.test("Null network repo response → network_id null", async () => {
  const uc = new MapApiRecordToRepeaterUseCase(mockNetworkRepo(null));
  const result = await uc.execute(makeRecord({ Rete: "Unknown" }));

  assertEquals(result!.access!.network_id, null);
});
