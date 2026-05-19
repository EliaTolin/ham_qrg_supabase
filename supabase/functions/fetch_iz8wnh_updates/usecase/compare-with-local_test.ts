import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CompareWithLocalUseCase } from "./compare-with-local.ts";
import type { HamQRGUpdateRecord } from "../../_shared/types.ts";

// --- Helpers ---

function makeRecord(overrides: Partial<HamQRGUpdateRecord> = {}): HamQRGUpdateRecord {
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
    AutoON: "1",
    ManualON: "1",
    ...overrides,
  };
}

function makeLocalRepeater(overrides: Record<string, unknown> = {}) {
  return {
    id: "rep-uuid-1",
    external_id: "145625000_JN44BL",
    name: "RV50",
    callsign: "IR1D",
    frequency_hz: 145625000,
    shift_hz: -600000,
    locality: "Mombarcaro",
    locator: "JN44BL",
    lat: 44.46751,
    lon: 8.08858,
    is_active: true,
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

function makeAccess(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-uuid-1",
    repeater_id: "rep-uuid-1",
    external_id: "100",
    mode: "ANALOG",
    ctcss_tx_hz: 82.5,
    color_code: null,
    node_id: null,
    network_id: null,
    ...overrides,
  };
}

// Mock MapApiRecordToRepeaterUseCase that returns mapped data matching the record
function mockMapUseCase() {
  return {
    execute: async (rec: HamQRGUpdateRecord) => {
      const freqHz = Math.round(parseFloat(rec.Frequenza) * 1_000_000);
      const lat = parseFloat(rec.Lat);
      const lon = parseFloat(rec.Long);
      const ctcssVal = parseFloat(rec.Tono);

      return {
        repeater: {
          external_id: rec.ID,
          name: rec.Ripetitore || null,
          callsign: rec.Identificativo || null,
          frequency_hz: freqHz,
          shift_hz: Math.round(parseFloat(rec.Shift) * 1_000_000),
          shift_raw: rec.Shift,
          locality: rec.Localita?.trim() || null,
          locator: rec.Locator,
          lat: isNaN(lat) ? null : lat,
          lon: isNaN(lon) ? null : lon,
        },
        access: {
          external_id: rec.ID,
          mode: "ANALOG" as const,
          network_id: null,
          ctcss_tx_hz: ctcssVal > 0 ? ctcssVal : null,
          color_code: null,
          node_id: null,
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

function createUseCase() {
  return new CompareWithLocalUseCase(mockMapUseCase());
}

// --- Tests ---

Deno.test("New repeater: localRepeater null → change_type 'new'", async () => {
  const uc = createUseCase();
  const result = await uc.execute(makeRecord(), null);

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "new");
  assertEquals(result!.repeater_id, null);
  assertEquals(result!.suggested_winner, "remote");
});

Deno.test("No diff: same data → null (skip)", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [makeAccess()],
  );

  assertEquals(result, null);
});

Deno.test("Local more recent: updated_at > Ultima_Modifica → null (skip)", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ Ultima_Modifica: "2026-02-01" }),
    makeLocalRepeater({ updated_at: "2026-03-15T00:00:00Z" }),
    [makeAccess()],
  );

  assertEquals(result, null);
});

Deno.test("Remote more recent: changed field → diff with suggested_winner 'remote'", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({
      Localita: "Nuova Localita",
      Ultima_Modifica: "2026-04-06",
    }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [makeAccess()],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "update");
  assertEquals(result!.suggested_winner, "remote");
  assertNotEquals(result!.diff.locality, undefined);
  assertEquals(result!.diff.locality.local, "Mombarcaro");
  assertEquals(result!.diff.locality.remote, "Nuova Localita");
});

Deno.test("Frequency change → diff.frequency_hz", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ Frequenza: "145.700000", Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [makeAccess()],
  );

  assertNotEquals(result, null);
  assertNotEquals(result!.diff.frequency_hz, undefined);
  assertEquals(result!.diff.frequency_hz.local, 145625000);
  assertEquals(result!.diff.frequency_hz.remote, 145700000);
});

Deno.test("CTCSS change → diff['access.ctcss_tx_hz']", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ Tono: "127.3", Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [makeAccess({ ctcss_tx_hz: 82.5 })],
  );

  assertNotEquals(result, null);
  assertNotEquals(result!.diff["access.ctcss_tx_hz"], undefined);
  assertEquals(result!.diff["access.ctcss_tx_hz"].local, 82.5);
  assertEquals(result!.diff["access.ctcss_tx_hz"].remote, 127.3);
});

Deno.test("New access mode not in local → diff['access_ANALOG']", async () => {
  const uc = createUseCase();
  // Local has no accesses at all
  const result = await uc.execute(
    makeRecord({ Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [], // no accesses
  );

  assertNotEquals(result, null);
  assertNotEquals(result!.diff["access_ANALOG"], undefined);
  assertEquals(result!.diff["access_ANALOG"].local, null);
});

Deno.test("skipTimestampCheck=true → does not skip even if local newer", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({
      Localita: "Changed",
      Ultima_Modifica: "2026-01-01",
    }),
    makeLocalRepeater({ updated_at: "2026-03-15T00:00:00Z" }),
    [makeAccess()],
    true, // skipTimestampCheck
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "update");
  assertNotEquals(result!.diff.locality, undefined);
});

Deno.test("Float tolerance: same lat within 0.0001 → no diff", async () => {
  const uc = createUseCase();
  // Record has Lat "44.46751", local has 44.46751 — should be equal
  const result = await uc.execute(
    makeRecord({ Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({
      lat: 44.46751,
      updated_at: "2026-03-01T00:00:00Z",
    }),
    [makeAccess()],
  );

  assertEquals(result, null);
});

Deno.test("Float tolerance: lat differs by more than 0.0001 → diff", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ Lat: "44.470000", Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({
      lat: 44.46751,
      updated_at: "2026-03-01T00:00:00Z",
    }),
    [makeAccess()],
  );

  assertNotEquals(result, null);
  assertNotEquals(result!.diff.lat, undefined);
});

Deno.test("Both timestamps null → suggested_winner 'unknown'", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({
      Localita: "Changed",
      Ultima_Modifica: "",
    }),
    makeLocalRepeater({ updated_at: null }),
    [makeAccess()],
  );

  assertNotEquals(result, null);
  assertEquals(result!.suggested_winner, "unknown");
});

Deno.test("Hidden remote (AutoON=0, ManualON=1), no local repeater → null", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ AutoON: "0", ManualON: "1" }),
    null,
  );

  assertEquals(result, null);
});

Deno.test("Hidden remote (AutoON=1, ManualON=0), no local repeater → null", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({ AutoON: "1", ManualON: "0" }),
    null,
  );

  assertEquals(result, null);
});

Deno.test("Hidden remote, local repeater exists, no local access → no access_* diff", async () => {
  const uc = createUseCase();
  // This is the bug case: a hidden record must not be enrolled as a new access
  const result = await uc.execute(
    makeRecord({ AutoON: "0", ManualON: "1", Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [], // no local accesses
  );

  // No diff at all (no repeater fields changed, and access not enrolled) → null
  assertEquals(result, null);
});

Deno.test("Hidden remote with repeater field change → update WITHOUT access_* entry", async () => {
  const uc = createUseCase();
  const result = await uc.execute(
    makeRecord({
      AutoON: "0",
      ManualON: "1",
      Localita: "Changed",
      Ultima_Modifica: "2026-04-06",
    }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [], // no local accesses — must NOT trigger access_ANALOG enrollment
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "update");
  assertEquals(result!.diff["access_ANALOG"], undefined);
  assertNotEquals(result!.diff.locality, undefined);
});

Deno.test("Access matched by external_id, not mode", async () => {
  const uc = createUseCase();
  // Access has different mode but same external_id as record
  const result = await uc.execute(
    makeRecord({ Tono: "127.3", Ultima_Modifica: "2026-04-06" }),
    makeLocalRepeater({ updated_at: "2026-03-01T00:00:00Z" }),
    [makeAccess({ external_id: "100", mode: "DMR", ctcss_tx_hz: null })],
  );

  assertNotEquals(result, null);
  // Should detect CTCSS change via external_id match
  assertNotEquals(result!.diff["access.ctcss_tx_hz"], undefined);
});
