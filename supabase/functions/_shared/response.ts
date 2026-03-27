import { corsHeaders } from "./cors.ts";

export function jsonSuccess(
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status,
    },
  );
}

export function jsonError(
  error: unknown,
  status = 500,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status,
    },
  );
}
