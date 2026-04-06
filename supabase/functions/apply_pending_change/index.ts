import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { RepeaterRepository } from "../_shared/repository/repeater-repository.ts";
import { AccessRepository } from "../_shared/repository/access-repository.ts";
import { NetworkRepository } from "../_shared/repository/network-repository.ts";
import { MapApiRecordToRepeaterUseCase } from "../_shared/usecase/map-api-record-to-repeater.ts";
import { PersistRepeaterToDatabaseUseCase } from "../_shared/usecase/persist-repeater-to-database.ts";
import { ApplyChangeUseCase } from "../_shared/usecase/apply-change.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
    const changeIds = body.change_ids ?? (body.change_id ? [body.change_id] : []);

    if (changeIds.length === 0 || !action) {
      return jsonError(new Error("change_id(s) and action are required"), 400);
    }

    const supabase = getSupabaseServiceClient();

    // Bulk reject: single UPDATE
    if (action === "reject") {
      for (let i = 0; i < changeIds.length; i += 500) {
        const chunk = changeIds.slice(i, i + 500);
        await supabase
          .from(TABLE)
          .update({
            status: "rejected",
            reviewed_by: user_id ?? null,
            reviewed_at: new Date().toISOString(),
          } as never)
          .in("id", chunk)
          .eq("status", "pending");
      }
      return jsonSuccess({ applied: false, action: "rejected", count: changeIds.length });
    }

    // Approve: fetch + apply + mark
    const repeaterRepo = new RepeaterRepository(supabase);
    const accessRepo = new AccessRepository(supabase);
    const networkRepo = new NetworkRepository(supabase);
    const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
    const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
      repeaterRepo,
      accessRepo,
    );
    const applyUseCase = new ApplyChangeUseCase(
      repeaterRepo,
      accessRepo,
      mapApiRecordUseCase,
      persistRepeaterUseCase,
    );

    // Fetch all pending changes
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

    for (const change of allChanges) {
      try {
        const ok = await applyUseCase.execute(change);
        if (ok) {
          await supabase
            .from(TABLE)
            .update({
              status: "approved",
              reviewed_by: user_id ?? null,
              reviewed_at: now,
            } as never)
            .eq("id", change.id);
          applied++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`[Apply] ${change.id} failed:`, err);
        errors++;
      }
    }

    return jsonSuccess({
      applied: true,
      action: "approved",
      count: applied,
      errors,
    });
  } catch (error) {
    console.error("apply_pending_change failed:", error);
    return jsonError(error);
  }
});
