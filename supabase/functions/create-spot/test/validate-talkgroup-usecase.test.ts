import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ValidateTalkgroupUseCase } from "../usecase/validate-talkgroup-usecase.ts";
import { SpotError } from "../types.ts";

const usecase = new ValidateTalkgroupUseCase();

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof SpotError) return e.code;
    throw e;
  }
  throw new Error("nessuna eccezione sollevata");
}

Deno.test("talkgroup assente: sempre accettato, su qualsiasi modo", () => {
  assertEquals(usecase.execute(null, "DMR"), null);
  assertEquals(usecase.execute(undefined, "ANALOG"), null);
  assertEquals(usecase.execute(null, null), null);
});

Deno.test("talkgroup su DMR: accettato dentro il range", () => {
  assertEquals(usecase.execute(222, "DMR"), 222);
  assertEquals(usecase.execute(1, "DMR"), 1);
  assertEquals(usecase.execute(16777215, "DMR"), 16777215);
});

Deno.test("talkgroup fuori dal DMR: rifiutato, qualunque sia il modo", () => {
  for (const mode of ["ANALOG", "C4FM", "DSTAR", "NXDN", "P25"] as const) {
    assertEquals(
      codeOf(() => usecase.execute(222, mode)),
      "TALKGROUP_NOT_ALLOWED",
      `modo ${mode}`,
    );
  }
});

Deno.test("talkgroup senza accesso selezionato: rifiutato", () => {
  assertEquals(codeOf(() => usecase.execute(222, null)), "TALKGROUP_NOT_ALLOWED");
});

Deno.test("talkgroup DMR fuori range o non intero: rifiutato", () => {
  for (const bad of [0, -1, 16777216, 1.5, NaN]) {
    assertEquals(
      codeOf(() => usecase.execute(bad, "DMR")),
      "INVALID_TALKGROUP",
      `valore ${bad}`,
    );
  }
});

Deno.test("il codice d'errore viaggia con lo stato HTTP 422", () => {
  assertThrows(() => usecase.execute(0, "DMR"), SpotError);
  try {
    usecase.execute(0, "DMR");
  } catch (e) {
    assertEquals((e as SpotError).httpStatus, 422);
  }
});

Deno.test("il messaggio d'errore è il codice: il client lo mappa sulla traduzione", () => {
  const cases: Array<[number, "ANALOG" | "DMR"]> = [[222, "ANALOG"], [0, "DMR"]];
  for (const [value, mode] of cases) {
    try {
      usecase.execute(value, mode);
      throw new Error("nessuna eccezione sollevata");
    } catch (e) {
      const err = e as SpotError;
      assertEquals(err.message, err.code);
    }
  }
});
