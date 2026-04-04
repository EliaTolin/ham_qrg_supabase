import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { RepeaterRepository } from "../_shared/repository/repeater-repository.ts";
import { AccessRepository } from "../_shared/repository/access-repository.ts";
import { NetworkRepository } from "../_shared/repository/network-repository.ts";
import { MapApiRecordToRepeaterUseCase } from "../_shared/usecase/map-api-record-to-repeater.ts";
import { PersistRepeaterToDatabaseUseCase } from "../_shared/usecase/persist-repeater-to-database.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { HamQRGRecord } from "../_shared/types.ts";

const TABLE = "sync_pending_changes" as never;

interface ApplyRequest {
  change_id?: string;
  change_ids?: string[];
  action: "approve" | "reject";
  user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ApplyRequest = await req.json();
    const { action, user_id } = body;

    if (!action) {
      return jsonError(new Error("action is required"), 400);
    }

    // Bulk mode: process multiple changes
    if (body.change_ids && body.change_ids.length > 0) {
      return await handleBulk(body.change_ids, action, user_id);
    }

    const change_id = body.change_id;
    if (!change_id) {
      return jsonError(new Error("change_id or change_ids required"), 400);
    }

    const supabase = getSupabaseServiceClient();

    // 1) Fetch the pending change
    const { data: change, error: fetchErr } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", change_id)
      .single();

    if (fetchErr || !change) {
      return jsonError(new Error(fetchErr?.message ?? "Pending change not found"), 404);
    }

    // deno-lint-ignore no-explicit-any
    const pc = change as any;

    if (pc.status !== "pending") {
      return jsonError(new Error("Change already processed"), 400);
    }

    // 2) If reject, just mark it
    if (action === "reject") {
      await supabase
        .from(TABLE)
        .update({
          status: "rejected",
          reviewed_by: user_id ?? null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", change_id);

      return jsonSuccess({ applied: false, action: "rejected" });
    }

    // 3) Approve: apply the change
    const repeaterRepo = new RepeaterRepository(supabase);
    const accessRepo = new AccessRepository(supabase);
    const networkRepo = new NetworkRepository(supabase);
    const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
    const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
      repeaterRepo,
      accessRepo,
    );

    const remoteData = pc.remote_data as Record<string, string>;
    const changeType = pc.change_type as string;

    let applyResult: { success?: boolean; error?: string } = { success: true };

    switch (changeType) {
      case "new": {
        const apiRecord: HamQRGRecord = {
          ID: pc.external_id,
          Ripetitore: remoteData.Ripetitore ?? "",
          Frequenza: remoteData.Frequenza ?? "0",
          Shift: remoteData.Shift ?? "0",
          Tono: remoteData.Tono ?? "0",
          ColorCode: remoteData.ColorCode ?? null,
          Stanza: remoteData.Stanza ?? null,
          Rete: remoteData.Rete ?? null,
          Lat: remoteData.Lat ?? "0",
          Long: remoteData.Long ?? "0",
          Localita: remoteData.Localita ?? "",
          Locator: remoteData.Locator ?? "",
          Identificativo: remoteData.Identificativo ?? null,
          Tipologia: remoteData.Tipologia ?? "",
          Ultima_Modifica: remoteData.Ultima_Modifica ?? "",
          QRB: remoteData.QRB ?? "0",
        };

        const mapped = await mapApiRecordUseCase.execute(apiRecord);
        if (!mapped) {
          applyResult = { error: "Mapping failed for record" };
          break;
        }

        const freqHz = Math.round(parseFloat(remoteData.Frequenza) * 1_000_000);

        // Check if repeater with same freq+locator already exists
        const existing = await repeaterRepo.findByFreqLocator(
          freqHz,
          remoteData.Locator ?? "",
        );

        if (existing) {
          // Repeater exists — just add the access
          console.log(
            `[Apply] "new" but repeater already exists (${existing.id}), adding access only`,
          );
          if (mapped.access) {
            await accessRepo.upsert({
              ...mapped.access,
              repeater_id: existing.id,
            });
          }
          break;
        }

        // Truly new repeater
        mapped.repeater.external_id = `${freqHz}_${remoteData.Locator}`;
        const syncResult = await persistRepeaterUseCase.execute(mapped);
        if (!syncResult.repeaterOk) {
          applyResult = { error: "Repeater insert failed" };
        }
        break;
      }

      case "update": {
        if (!pc.repeater_id) {
          applyResult = { error: "repeater_id missing for update" };
          break;
        }

        const diff = pc.diff as Record<string, { local: unknown; remote: unknown }>;
        const repeaterUpdates: Record<string, unknown> = {};
        const accessUpdates: Record<string, unknown> = {};

        for (const [field, values] of Object.entries(diff)) {
          if (field === "scope") continue;
          if (field.startsWith("access.")) {
            accessUpdates[field.replace("access.", "")] = values.remote;
          } else if (field.startsWith("access_")) {
            // New access mode — handled below
          } else {
            repeaterUpdates[field] = values.remote;
          }
        }

        if (Object.keys(repeaterUpdates).length > 0) {
          const ok = await repeaterRepo.updateFields(pc.repeater_id, repeaterUpdates);
          if (!ok) {
            applyResult = { error: "Repeater update failed" };
            break;
          }
        }

        if (Object.keys(accessUpdates).length > 0) {
          await accessRepo.updateByExternalId(pc.external_id, accessUpdates);
        }

        // Handle new access mode (access_DMR, access_ANALOG, etc.)
        for (const [field, values] of Object.entries(diff)) {
          if (!field.startsWith("access_")) continue;
          const accessData = values.remote as Record<string, unknown>;
          if (accessData) {
            await accessRepo.insertAccess({
              repeater_id: pc.repeater_id,
              external_id: pc.external_id,
              mode: accessData.mode,
              ctcss_tx_hz: accessData.ctcss_tx_hz ?? null,
              color_code: accessData.color_code ?? null,
              node_id: accessData.node_id ?? null,
              network_id: accessData.network_id ?? null,
              source: "iz8wnh",
              last_seen_at: new Date().toISOString(),
            });
          }
        }

        break;
      }

      case "deactivate": {
        if (!pc.repeater_id) {
          applyResult = { error: "repeater_id missing for deactivate" };
          break;
        }

        const scope = (pc.diff as Record<string, { remote: unknown }>).scope?.remote as string | undefined;

        if (scope === "access") {
          await accessRepo.deleteByExternalId(pc.external_id);

          const remaining = await accessRepo.findByRepeaterId(pc.repeater_id);
          if (remaining.length === 0) {
            await repeaterRepo.setActive(pc.repeater_id, false);
          }
        } else {
          await repeaterRepo.setActive(pc.repeater_id, false);
        }
        break;
      }

      case "reactivate": {
        if (!pc.repeater_id) {
          applyResult = { error: "repeater_id missing for reactivate" };
          break;
        }
        await repeaterRepo.setActive(pc.repeater_id, true);
        break;
      }

      default:
        applyResult = { error: `Unknown change type: ${changeType}` };
    }

    if (applyResult.error) {
      return jsonError(new Error(applyResult.error), 500);
    }

    // 4) Mark as approved
    await supabase
      .from(TABLE)
      .update({
        status: "approved",
        reviewed_by: user_id ?? null,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", change_id);

    return jsonSuccess({ applied: true, action: "approved", change_type: changeType });
  } catch (error) {
    console.error("apply_pending_change failed:", error);
    return jsonError(error);
  }
});

const BATCH_SIZE = 10;

async function handleBulk(
  changeIds: string[],
  action: "approve" | "reject",
  userId?: string,
): Promise<Response> {
  const supabase = getSupabaseServiceClient();

  // Bulk reject: single UPDATE, no per-row processing needed
  if (action === "reject") {
    // Process in chunks of 500 to avoid PostgREST limits
    let rejected = 0;
    for (let i = 0; i < changeIds.length; i += 500) {
      const chunk = changeIds.slice(i, i + 500);
      const { error } = await supabase
        .from(TABLE)
        .update({
          status: "rejected",
          reviewed_by: userId ?? null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .in("id", chunk)
        .eq("status", "pending");

      if (error) {
        console.error(`[BulkReject] chunk failed:`, error);
      } else {
        rejected += chunk.length;
      }
    }
    return jsonSuccess({ applied: false, action: "rejected", count: rejected });
  }

  // Bulk approve: fetch changes, process in parallel batches
  const repeaterRepo = new RepeaterRepository(supabase);
  const accessRepo = new AccessRepository(supabase);
  const networkRepo = new NetworkRepository(supabase);
  const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
  const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
    repeaterRepo,
    accessRepo,
  );

  // Fetch all pending changes (paginated to avoid PostgREST limit)
  // deno-lint-ignore no-explicit-any
  const allChanges: any[] = [];
  for (let i = 0; i < changeIds.length; i += 500) {
    const chunk = changeIds.slice(i, i + 500);
    const { data } = await supabase
      .from(TABLE)
      .select("*")
      .in("id", chunk)
      .eq("status", "pending");

    if (data) allChanges.push(...data);
  }

  let applied = 0;
  let errors = 0;
  const now = new Date().toISOString();

  // Process in parallel batches of BATCH_SIZE
  for (let i = 0; i < allChanges.length; i += BATCH_SIZE) {
    const batch = allChanges.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (change: { id: string; [key: string]: unknown }) => {
        const ok = await applySingleChange(
          supabase,
          change,
          repeaterRepo,
          accessRepo,
          mapApiRecordUseCase,
          persistRepeaterUseCase,
        );

        if (ok) {
          await supabase
            .from(TABLE)
            .update({
              status: "approved",
              reviewed_by: userId ?? null,
              reviewed_at: now,
            } as never)
            .eq("id", change.id);
        }

        return ok;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        applied++;
      } else {
        errors++;
      }
    }

    console.log(
      `[BulkApply] batch ${Math.floor(i / BATCH_SIZE) + 1}: ${applied} applied, ${errors} errors`,
    );
  }

  return jsonSuccess({ applied: true, action: "approved", count: applied, errors });
}

// deno-lint-ignore no-explicit-any
async function applySingleChange(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  pc: any,
  repeaterRepo: RepeaterRepository,
  accessRepo: AccessRepository,
  mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
  persistRepeaterUseCase: PersistRepeaterToDatabaseUseCase,
): Promise<boolean> {
  const remoteData = pc.remote_data as Record<string, string>;
  const changeType = pc.change_type as string;

  switch (changeType) {
    case "new": {
      const apiRecord: HamQRGRecord = {
        ID: pc.external_id,
        Ripetitore: remoteData.Ripetitore ?? "",
        Frequenza: remoteData.Frequenza ?? "0",
        Shift: remoteData.Shift ?? "0",
        Tono: remoteData.Tono ?? "0",
        ColorCode: remoteData.ColorCode ?? null,
        Stanza: remoteData.Stanza ?? null,
        Rete: remoteData.Rete ?? null,
        Lat: remoteData.Lat ?? "0",
        Long: remoteData.Long ?? "0",
        Localita: remoteData.Localita ?? "",
        Locator: remoteData.Locator ?? "",
        Identificativo: remoteData.Identificativo ?? null,
        Tipologia: remoteData.Tipologia ?? "",
        Ultima_Modifica: remoteData.Ultima_Modifica ?? "",
        QRB: remoteData.QRB ?? "0",
      };

      const mapped = await mapApiRecordUseCase.execute(apiRecord);
      if (!mapped) return false;

      const freqHz = Math.round(parseFloat(remoteData.Frequenza) * 1_000_000);

      // Check if a repeater with same freq+locator already exists
      const existing = await repeaterRepo.findByFreqLocator(
        freqHz,
        remoteData.Locator ?? "",
      );

      if (existing) {
        // Repeater exists — just add the access if we have one
        console.log(
          `[Apply] "new" but repeater already exists (${existing.id}), adding access only`,
        );
        if (mapped.access) {
          await accessRepo.upsert({
            ...mapped.access,
            repeater_id: existing.id,
          });
        }
        return true;
      }

      // Truly new repeater
      mapped.repeater.external_id = `${freqHz}_${remoteData.Locator}`;
      const result = await persistRepeaterUseCase.execute(mapped);
      return result.repeaterOk;
    }

    case "update": {
      if (!pc.repeater_id) return false;

      const diff = pc.diff as Record<string, { local: unknown; remote: unknown }>;
      const repeaterUpdates: Record<string, unknown> = {};
      const accessUpdates: Record<string, unknown> = {};

      for (const [field, values] of Object.entries(diff)) {
        if (field === "scope") continue;
        if (field.startsWith("access.")) {
          accessUpdates[field.replace("access.", "")] = values.remote;
        } else if (!field.startsWith("access_")) {
          repeaterUpdates[field] = values.remote;
        }
      }

      if (Object.keys(repeaterUpdates).length > 0) {
        const ok = await repeaterRepo.updateFields(pc.repeater_id, repeaterUpdates);
        if (!ok) return false;
      }

      if (Object.keys(accessUpdates).length > 0) {
        await accessRepo.updateByExternalId(pc.external_id, accessUpdates);
      }

      for (const [field, values] of Object.entries(diff)) {
        if (!field.startsWith("access_")) continue;
        const accessData = values.remote as Record<string, unknown>;
        if (accessData) {
          await accessRepo.insertAccess({
            repeater_id: pc.repeater_id,
            external_id: pc.external_id,
            mode: accessData.mode,
            ctcss_tx_hz: accessData.ctcss_tx_hz ?? null,
            color_code: accessData.color_code ?? null,
            node_id: accessData.node_id ?? null,
            network_id: accessData.network_id ?? null,
            source: "iz8wnh",
            last_seen_at: new Date().toISOString(),
          });
        }
      }

      return true;
    }

    case "deactivate": {
      if (!pc.repeater_id) return false;

      const scope = (pc.diff as Record<string, { remote: unknown }>).scope?.remote as string | undefined;

      if (scope === "access") {
        await accessRepo.deleteByExternalId(pc.external_id);
        const remaining = await accessRepo.findByRepeaterId(pc.repeater_id);
        if (remaining.length === 0) {
          await repeaterRepo.setActive(pc.repeater_id, false);
        }
      } else {
        await repeaterRepo.setActive(pc.repeater_id, false);
      }
      return true;
    }

    case "reactivate": {
      if (!pc.repeater_id) return false;
      await repeaterRepo.setActive(pc.repeater_id, true);
      return true;
    }

    default:
      return false;
  }
}
