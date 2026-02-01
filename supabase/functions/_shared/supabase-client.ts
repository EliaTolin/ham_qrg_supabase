import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "./database.types.ts";

export function createSupabaseClient(token: string) {
  return createClient<Database>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY")!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  );
}
