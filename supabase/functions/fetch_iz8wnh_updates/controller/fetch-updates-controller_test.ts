import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type {
  HamQRGUpdateRecord,
  PendingChangeInsert,
} from "../../_shared/types.ts";
import { FetchUpdatesController } from "./fetch-updates-controller.ts";

type ReviewCheck = (
  change: PendingChangeInsert,
  carriesDataDiff: boolean,
) => boolean;

/**
 * needsHumanReview e' privato: lo si raggiunge dal prototype invece di
 * allargarne la visibilita' solo per il test.
 */
function needsHumanReview(
  change: PendingChangeInsert,
  carriesDataDiff: boolean,
): boolean {
  const proto = FetchUpdatesController.prototype as unknown as {
    needsHumanReview: ReviewCheck;
  };
  return proto.needsHumanReview(change, carriesDataDiff);
}

function makeChange(
  overrides: Partial<PendingChangeInsert> = {},
): PendingChangeInsert {
  return {
    repeater_id: "rep-1",
    external_id: "56511",
    change_type: "update",
    remote_data: {} as HamQRGUpdateRecord,
    diff: { locality: { local: "Cuneo, Torre Civica", remote: "Cuneo" } },
    remote_updated_at: "2026-09-30T00:00:00Z",
    local_updated_at: "2026-09-29T12:02:51Z",
    suggested_winner: "remote",
    ...overrides,
  };
}

Deno.test("update con winner='local' → trattenuto per review", () => {
  assertEquals(
    needsHumanReview(makeChange({ suggested_winner: "local" }), false),
    true,
  );
});

Deno.test("update con winner='remote' → auto-applicabile", () => {
  assertEquals(
    needsHumanReview(makeChange({ suggested_winner: "remote" }), false),
    false,
  );
});

Deno.test("merge attivazione + dati → trattenuto, qualunque sia il winner", () => {
  // Era il buco di skipTimestampCheck: un deactivate che arrivava insieme a un
  // diff sui dati autorizzava la sovrascrittura di lat/lon/locality.
  const change = makeChange({
    change_type: "deactivate",
    suggested_winner: "remote",
  });
  assertEquals(needsHumanReview(change, true), true);
});

Deno.test("deactivate puro → auto-applicabile, la fonte e' autorevole sullo stato", () => {
  const change = makeChange({
    change_type: "deactivate",
    suggested_winner: "remote",
  });
  assertEquals(needsHumanReview(change, false), false);
});

Deno.test("new → auto-applicabile, non c'e' nulla di locale da perdere", () => {
  const change = makeChange({
    change_type: "new",
    repeater_id: null,
    diff: {},
    suggested_winner: "remote",
  });
  assertEquals(needsHumanReview(change, false), false);
});

Deno.test("reactivate → auto-applicabile", () => {
  const change = makeChange({
    change_type: "reactivate",
    suggested_winner: "remote",
  });
  assertEquals(needsHumanReview(change, false), false);
});

Deno.test("winner='unknown' su update → auto-applicabile, nessun conflitto rilevabile", () => {
  const change = makeChange({
    suggested_winner: "unknown",
    remote_updated_at: null,
  });
  assertEquals(needsHumanReview(change, false), false);
});
