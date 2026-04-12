import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { getAuthToken, verifySupabaseJWT } from "../_shared/auth.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SpotRepository } from "../_shared/repository/spot-repository.ts";
import { LoadSpotUseCase } from "./usecase/load-spot-usecase.ts";
import { CloseSpotUseCase } from "./usecase/close-spot-usecase.ts";
import { CloseSpotController } from "./controller/close-spot-controller.ts";
import type { CloseSpotRequest } from "./types.ts";
import { SpotError } from "./types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: verify JWT and extract user ID
    const token = getAuthToken(req);
    const { payload } = await verifySupabaseJWT(token);
    const userId = payload.sub;
    if (!userId) {
      return jsonError(new Error("AUTH_REQUIRED"), 401);
    }

    // Parse request body
    const body: CloseSpotRequest = await req.json();
    if (!body.spot_id) {
      return jsonError(new Error("spot_id is required"), 400);
    }

    // DI wiring — service client to bypass RLS (like SECURITY DEFINER)
    const serviceClient = getSupabaseServiceClient();
    const spotRepo = new SpotRepository(serviceClient);

    const controller = new CloseSpotController(
      new LoadSpotUseCase(spotRepo),
      new CloseSpotUseCase(spotRepo),
    );

    const spot = await controller.execute(userId, body.spot_id);

    return jsonSuccess({ data: spot });
  } catch (error) {
    if (error instanceof SpotError) {
      return jsonError(error, error.httpStatus);
    }
    console.error("close-spot failed:", error);
    return jsonError(error);
  }
});
