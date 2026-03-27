import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { RepeaterRepository } from "../_shared/repository/repeater-repository.ts";
import { AccessRepository } from "../_shared/repository/access-repository.ts";
import { NetworkRepository } from "../_shared/repository/network-repository.ts";
import { MapApiRecordToRepeaterUseCase } from "../_shared/usecase/map-api-record-to-repeater.ts";
import { PersistRepeaterToDatabaseUseCase } from "../_shared/usecase/persist-repeater-to-database.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { HamQRGRecord } from "../_shared/types.ts";

interface ApplyRequest {
  change_id: string;
  action: "approve" | "reject";
  user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ApplyRequest = await req.json();
    const { change_id, action, user_id } = body;

    if (!change_id || !action) {
      return jsonError(new Error("change_id and action are required"), 400);
    }

    const supabase = getSupabaseServiceClient();

    // 1) Fetch the pending change
    const { data: change, error: fetchErr } = await supabase
      .from("sync_pending_changes")
      .select("*")
      .eq("id", change_id)
      .single();

    if (fetchErr || !change) {
      return jsonError(new Error(fetchErr?.message ?? "Pending change not found"), 404);
    }

    if (change.status !== "pending") {
      return jsonError(new Error("Change already processed"), 400);
    }

    // 2) If reject, just mark it
    if (action === "reject") {
      await supabase
        .from("sync_pending_changes")
        .update({
          status: "rejected",
          reviewed_by: user_id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", change_id);

      return jsonSuccess({ applied: false, action: "rejected" });
    }

    // 3) Approve: apply the change using shared use cases
    const repeaterRepo = new RepeaterRepository(supabase);
    const accessRepo = new AccessRepository(supabase);
    const networkRepo = new NetworkRepository(supabase);
    const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
    const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
      repeaterRepo,
      accessRepo,
    );

    const remoteData = change.remote_data as Record<string, string>;
    const changeType = change.change_type as string;

    let result: { success?: boolean; error?: string } = { success: true };

    switch (changeType) {
      case "new": {
        // Map the remote record using the same logic as the sync
        const apiRecord: HamQRGRecord = {
          ID: change.external_id,
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
          result = { error: "Mapping failed for record" };
          break;
        }

        const syncResult = await persistRepeaterUseCase.execute(mapped);
        if (!syncResult.repeaterOk) {
          result = { error: "Repeater insert failed" };
        }
        break;
      }

      case "update": {
        if (!change.repeater_id) {
          result = { error: "repeater_id missing for update" };
          break;
        }

        // Apply only changed repeater fields from diff
        const diff = change.diff as Record<string, { local: unknown; remote: unknown }>;
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

        // Apply repeater field changes
        if (Object.keys(repeaterUpdates).length > 0) {
          const { error } = await supabase
            .from("repeaters")
            .update(repeaterUpdates)
            .eq("id", change.repeater_id);
          if (error) {
            result = { error: error.message };
            break;
          }
        }

        // Apply access field changes (update existing access by external_id)
        if (Object.keys(accessUpdates).length > 0) {
          const { error } = await supabase
            .from("repeater_access")
            .update(accessUpdates)
            .eq("external_id", change.external_id);
          if (error) {
            console.warn(`[Apply] Access update failed: ${error.message}`);
          }
        }

        // Handle new access mode (access_DMR, access_ANALOG, etc.)
        for (const [field, values] of Object.entries(diff)) {
          if (!field.startsWith("access_")) continue;
          const accessData = values.remote as Record<string, unknown>;
          if (accessData) {
            await supabase.from("repeater_access").insert({
              repeater_id: change.repeater_id,
              external_id: change.external_id,
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
        if (!change.repeater_id) {
          result = { error: "repeater_id missing for deactivate" };
          break;
        }

        const scope = (change.diff as Record<string, { remote: unknown }>).scope?.remote as string | undefined;

        if (scope === "access") {
          // Delete the specific access
          await supabase
            .from("repeater_access")
            .delete()
            .eq("external_id", change.external_id);

          // Check remaining accesses
          const { count } = await supabase
            .from("repeater_access")
            .select("id", { count: "exact", head: true })
            .eq("repeater_id", change.repeater_id);

          if (count === 0) {
            await supabase
              .from("repeaters")
              .update({ is_active: false })
              .eq("id", change.repeater_id);
          }
        } else {
          await supabase
            .from("repeaters")
            .update({ is_active: false })
            .eq("id", change.repeater_id);
        }
        break;
      }

      case "reactivate": {
        if (!change.repeater_id) {
          result = { error: "repeater_id missing for reactivate" };
          break;
        }
        await supabase
          .from("repeaters")
          .update({ is_active: true })
          .eq("id", change.repeater_id);
        break;
      }

      default:
        result = { error: `Unknown change type: ${changeType}` };
    }

    if (result.error) {
      return jsonError(new Error(result.error), 500);
    }

    // 4) Mark as approved
    await supabase
      .from("sync_pending_changes")
      .update({
        status: "approved",
        reviewed_by: user_id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", change_id);

    return jsonSuccess({ applied: true, action: "approved", change_type: changeType });
  } catch (error) {
    console.error("apply_pending_change failed:", error);
    return jsonError(error);
  }
});
