import {
  assertEquals,
  assertGreater,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MapApiRecordToRepeaterUseCase } from "../functions/_shared/usecase/map-api-record-to-repeater.ts";
import { EnqueueGridsUseCase } from "../functions/sync_repeater_iz8wnh/usecase/enqueue-grids.ts";
import type { CoverageStation } from "../functions/sync_repeater_iz8wnh/usecase/enqueue-grids.ts";
import type { HamQRGRecord } from "../functions/_shared/types.ts";

// =============================================================================
// CSV loading (points_to_sync.csv)
// =============================================================================

async function loadCsv(): Promise<string[]> {
  const csv = await Deno.readTextFile(
    new URL(
      "../functions/sync_repeater_iz8wnh/points_to_sync.csv",
      import.meta.url,
    ),
  );
  return csv.trim().split("\n");
}

Deno.test("CSV - file is readable and has header", async () => {
  const lines = await loadCsv();
  assertEquals(lines[0], "area,id,lat,lon,radius_km");
});

Deno.test("CSV - has 456 data rows", async () => {
  const lines = await loadCsv();
  assertEquals(lines.length - 1, 456);
});

Deno.test("CSV - every row has 5 columns", async () => {
  const lines = await loadCsv();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    assertEquals(cols.length, 5, `Row ${i + 1} has ${cols.length} columns`);
  }
});

Deno.test("CSV - lat/lon/radius_km are valid numbers", async () => {
  const lines = await loadCsv();
  for (let i = 1; i < lines.length; i++) {
    const [, , lat, lon, radius_km] = lines[i].split(",");
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const radiusNum = parseInt(radius_km);
    assertEquals(isNaN(latNum), false, `Row ${i + 1}: invalid lat "${lat}"`);
    assertEquals(isNaN(lonNum), false, `Row ${i + 1}: invalid lon "${lon}"`);
    assertEquals(
      isNaN(radiusNum),
      false,
      `Row ${i + 1}: invalid radius_km "${radius_km}"`,
    );
  }
});

Deno.test("CSV - lat in range [-90, 90], lon in range [-180, 180]", async () => {
  const lines = await loadCsv();
  for (let i = 1; i < lines.length; i++) {
    const [, , lat, lon] = lines[i].split(",");
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    assertEquals(
      latNum >= -90 && latNum <= 90,
      true,
      `Row ${i + 1}: lat ${latNum} out of range`,
    );
    assertEquals(
      lonNum >= -180 && lonNum <= 180,
      true,
      `Row ${i + 1}: lon ${lonNum} out of range`,
    );
  }
});

Deno.test("CSV - radius_km is positive", async () => {
  const lines = await loadCsv();
  for (let i = 1; i < lines.length; i++) {
    const radiusNum = parseInt(lines[i].split(",")[4]);
    assertGreater(radiusNum, 0, `Row ${i + 1}: radius_km must be > 0`);
  }
});

Deno.test("CSV - first data row matches expected values", async () => {
  const lines = await loadCsv();
  const [area, id, lat, lon, radius_km] = lines[1].split(",");
  assertEquals(area, "Area1");
  assertEquals(id, "S1");
  assertEquals(parseFloat(lat), 72.682138);
  assertEquals(parseFloat(lon), 91.658782);
  assertEquals(parseInt(radius_km), 300);
});

// =============================================================================
// EnqueueGridsUseCase
// =============================================================================

Deno.test("EnqueueGridsUseCase - maps stations to correct message count", async () => {
  const sent: unknown[][] = [];
  const fakeQueueRepo = {
    sendBatch: (msgs: unknown[]) => {
      sent.push(msgs);
      return Promise.resolve();
    },
  };

  const useCase = new EnqueueGridsUseCase(fakeQueueRepo as never);
  const stations: CoverageStation[] = [
    { lat: 45.0, lon: 9.0, radius_km: 300 },
    { lat: 46.0, lon: 10.0, radius_km: 150 },
  ];

  const count = await useCase.execute(stations, "run-123", false);
  assertEquals(count, 2);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].length, 2);
});

Deno.test("EnqueueGridsUseCase - message payload contains radius_km", async () => {
  let captured: Record<string, unknown>[] = [];
  const fakeQueueRepo = {
    sendBatch: (msgs: Record<string, unknown>[]) => {
      captured = msgs;
      return Promise.resolve();
    },
  };

  const useCase = new EnqueueGridsUseCase(fakeQueueRepo as never);
  await useCase.execute(
    [{ lat: 45.0, lon: 9.0, radius_km: 250 }],
    "run-456",
    true,
  );

  assertEquals(captured[0].lat, 45.0);
  assertEquals(captured[0].lon, 9.0);
  assertEquals(captured[0].radius_km, 250);
  assertEquals(captured[0].run_id, "run-456");
  assertEquals(captured[0].dry_run, true);
});

Deno.test("EnqueueGridsUseCase - empty stations returns 0", async () => {
  const fakeQueueRepo = {
    sendBatch: () => Promise.resolve(),
  };

  const useCase = new EnqueueGridsUseCase(fakeQueueRepo as never);
  const count = await useCase.execute([], "run-789", false);
  assertEquals(count, 0);
});

// =============================================================================
// MapApiRecordToRepeaterUseCase - uses Lat/Long from API
// =============================================================================

function makeRecord(overrides: Partial<HamQRGRecord> = {}): HamQRGRecord {
  return {
    ID: "9784",
    Ripetitore: "RV50",
    Frequenza: "145.625000",
    Shift: "-0.600000",
    Tono: "67.0",
    ColorCode: null,
    Stanza: null,
    Rete: null,
    Lat: "39.51930",
    Long: "8.52706",
    Localita: "Punta Tintillonis",
    Locator: "JM49GM",
    Identificativo: "IS0HZA",
    Tipologia: "FM",
    Ultima_Modifica: "2021-01-01",
    QRB: "131.020689162388",
    ...overrides,
  };
}

function makeFakeNetworkRepo() {
  return {
    resolveNetworkId: () => Promise.resolve(null),
    unknownRete: [] as string[],
    missingNetworks: [] as string[],
  };
}

Deno.test("MapApiRecord - uses Lat/Long from API record", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(makeRecord());

  assertNotEquals(result, null);
  assertEquals(result!.repeater.lat, 39.5193);
  assertEquals(result!.repeater.lon, 8.52706);
});

Deno.test("MapApiRecord - lat/lon null when invalid", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(
    makeRecord({ Lat: "abc", Long: "xyz" }),
  );

  assertNotEquals(result, null);
  assertEquals(result!.repeater.lat, null);
  assertEquals(result!.repeater.lon, null);
});

Deno.test("MapApiRecord - frequency conversion Hz", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(makeRecord());

  assertEquals(result!.repeater.frequency_hz, 145625000);
  assertEquals(result!.repeater.shift_hz, -600000);
});

Deno.test("MapApiRecord - CTCSS tone parsed", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(makeRecord({ Tono: "88.5" }));

  assertEquals(result!.access!.ctcss_tx_hz, 88.5);
});

Deno.test("MapApiRecord - CTCSS null when out of range", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(makeRecord({ Tono: "999" }));

  assertEquals(result!.access!.ctcss_tx_hz, null);
});

Deno.test("MapApiRecord - DMR color code parsed", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(
    makeRecord({ Tipologia: "DMR", ColorCode: "1" }),
  );

  assertEquals(result!.access!.mode, "DMR");
  assertEquals(result!.access!.color_code, 1);
});

Deno.test("MapApiRecord - color code null for non-DMR", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(
    makeRecord({ Tipologia: "FM", ColorCode: "1" }),
  );

  assertEquals(result!.access!.color_code, null);
});

Deno.test("MapApiRecord - node_id parsed from Stanza", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(makeRecord({ Stanza: "222098501" }));

  assertEquals(result!.access!.node_id, 222098501);
});

Deno.test("MapApiRecord - unknown tipologia returns access null", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(makeRecord({ Tipologia: "UNKNOWN" }));

  assertNotEquals(result, null);
  assertEquals(result!.access, null);
});

Deno.test("MapApiRecord - locality newlines stripped", async () => {
  const useCase = new MapApiRecordToRepeaterUseCase(
    makeFakeNetworkRepo() as never,
  );
  const result = await useCase.execute(
    makeRecord({ Localita: "Monte\nCimone" }),
  );

  assertEquals(result!.repeater.locality, "Monte Cimone");
});
