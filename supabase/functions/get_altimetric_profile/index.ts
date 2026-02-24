import { OpenMeteoClient } from "../_shared/api/open-meteo-client.ts";
import { getAuthToken, verifySupabaseJWT } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { ComputeElevationProfileUseCase } from "./usecase/compute-elevation-profile.ts";
import { ProfileController } from "./controller/profile-controller.ts";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT — only authenticated users can call this function
    const token = getAuthToken(req);
    await verifySupabaseJWT(token);

    const body = await req.json();

    const elevationClient = new OpenMeteoClient();
    const computeProfileUseCase = new ComputeElevationProfileUseCase(
      elevationClient,
    );
    const controller = new ProfileController(computeProfileUseCase);

    const result = await controller.handle(body);

    return jsonSuccess(result);
  } catch (error) {
    console.error("[get_altimetric_profile] Failed:", error);

    const status = error instanceof Error &&
        error.message.startsWith("Missing")
      ? 400
      : 500;

    return jsonError(error, status);
  }
});