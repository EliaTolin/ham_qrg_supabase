import { getSupabaseClient, getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { getAuthToken, verifySupabaseJWT } from "../_shared/auth.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { ProfileRepository } from "../_shared/repository/profile-repository.ts";
import { RepeaterRepository } from "../_shared/repository/repeater-repository.ts";
import { AccessRepository } from "../_shared/repository/access-repository.ts";
import { SpotRepository } from "../_shared/repository/spot-repository.ts";
import { FavoriteRepository } from "../_shared/repository/favorite-repository.ts";
import { NotificationRepository } from "../_shared/repository/notification-repository.ts";
import { ValidateCallsignUseCase } from "./usecase/validate-callsign-usecase.ts";
import { ValidateDurationUseCase } from "./usecase/validate-duration-usecase.ts";
import { ValidateRepeaterUseCase } from "./usecase/validate-repeater-usecase.ts";
import { ValidateAccessUseCase } from "./usecase/validate-access-usecase.ts";
import { NotifyFavoritesUseCase } from "./usecase/notify-favorites-usecase.ts";
import { CreateSpotController } from "./controller/create-spot-controller.ts";
import type { CreateSpotRequest } from "./types.ts";
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
    const body: CreateSpotRequest = await req.json();
    if (!body.repeater_id) {
      return jsonError(new Error("repeater_id is required"), 400);
    }

    // DI wiring — use authenticated client for reads, service client for writes
    const authClient = getSupabaseClient(token);
    const serviceClient = getSupabaseServiceClient();

    const profileRepo = new ProfileRepository(authClient);
    const repeaterRepo = new RepeaterRepository(authClient);
    const accessRepo = new AccessRepository(authClient);
    const spotRepo = new SpotRepository(serviceClient);
    const favoriteRepo = new FavoriteRepository(serviceClient);
    const notificationRepo = new NotificationRepository(serviceClient);

    const controller = new CreateSpotController(
      new ValidateCallsignUseCase(profileRepo),
      new ValidateDurationUseCase(),
      new ValidateRepeaterUseCase(repeaterRepo),
      new ValidateAccessUseCase(accessRepo),
      new NotifyFavoritesUseCase(repeaterRepo, favoriteRepo, notificationRepo),
      spotRepo,
    );

    const spot = await controller.execute(userId, body);

    return jsonSuccess({ data: spot }, 201);
  } catch (error) {
    if (error instanceof SpotError) {
      return jsonError(error, error.httpStatus);
    }
    console.error("create-spot failed:", error);
    return jsonError(error);
  }
});
