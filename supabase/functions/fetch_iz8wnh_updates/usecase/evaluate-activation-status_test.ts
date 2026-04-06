import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EvaluateActivationStatusUseCase } from "./evaluate-activation-status.ts";
import type { HamQRGUpdateRecord } from "../../_shared/types.ts";

// --- Helpers ---

function makeRecord(
  overrides: Partial<HamQRGUpdateRecord> = {},
): HamQRGUpdateRecord {
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
    ...overrides,
  };
}

// Dummy mock — executeInMemory doesn't use the accessRepo
// deno-lint-ignore no-explicit-any
const dummyAccessRepo = {} as any;

function createUseCase() {
  return new EvaluateActivationStatusUseCase(dummyAccessRepo);
}

// --- Tests ---

Deno.test("Remote active, local active → null (skip)", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "1", ManualON: "1" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess()],
  );

  assertEquals(result, null);
});

Deno.test("Remote active, local inactive → reactivate", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "1", ManualON: "1" }),
    makeLocalRepeater({ is_active: false }),
    [makeAccess()],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "reactivate");
  assertEquals(result!.diff.is_active.local, false);
  assertEquals(result!.diff.is_active.remote, true);
});

Deno.test("Remote inactive, access present → deactivate with scope 'access'", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "FM" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ mode: "ANALOG" })], // FM maps to ANALOG
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
  assertEquals(result!.diff.scope.remote, "access");
});

Deno.test("Remote inactive, access NOT present → null (skip)", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "DMR", ID: "999" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ mode: "ANALOG", external_id: "200" })], // DMR not in accesses, different ext ID
  );

  assertEquals(result, null);
});

Deno.test("Remote inactive, local already inactive, access present → deactivate access", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "FM" }),
    makeLocalRepeater({ is_active: false }),
    [makeAccess({ mode: "ANALOG" })],
  );

  // Access still exists, so we should propose removing it
  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
  assertEquals(result!.diff.scope.remote, "access");
});

Deno.test("AutoON=0, ManualON=1 → inactive", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "FM" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ mode: "ANALOG" })],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
  assertEquals(result!.diff.AutoON.remote, "0");
  assertEquals(result!.diff.ManualON.remote, "1");
});

Deno.test("AutoON=1, ManualON=0 → inactive", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "1", ManualON: "0", Tipologia: "FM" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ mode: "ANALOG" })],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
});

Deno.test("Both AutoON=1 ManualON=1 → active", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "1", ManualON: "1" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess()],
  );

  assertEquals(result, null);
});

Deno.test("No local repeater → null", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "0" }),
    null,
    [],
  );

  assertEquals(result, null);
});

Deno.test("Access matched by external_id when tipologia unknown", () => {
  const uc = createUseCase();
  // Unknown tipologia → remoteMode is null → falls back to external_id match
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "UNKNOWN", ID: "100" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ external_id: "100", mode: "DMR" })],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
});

Deno.test("Multiple accesses, deactivate one → scope 'access'", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "FM" }),
    makeLocalRepeater({ is_active: true }),
    [
      makeAccess({ mode: "ANALOG" }),
      makeAccess({ id: "acc-2", mode: "DMR", external_id: "200" }),
    ],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
  assertEquals(result!.diff.scope.remote, "access");
});

Deno.test("C4FM tipologia → mode C4FM matched", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "1", Tipologia: "C4FM" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ mode: "C4FM" })],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
});

Deno.test("DS tipologia → mode DSTAR matched", () => {
  const uc = createUseCase();
  const result = uc.executeInMemory(
    makeRecord({ AutoON: "0", ManualON: "0", Tipologia: "DS" }),
    makeLocalRepeater({ is_active: true }),
    [makeAccess({ mode: "DSTAR" })],
  );

  assertNotEquals(result, null);
  assertEquals(result!.change_type, "deactivate");
});
