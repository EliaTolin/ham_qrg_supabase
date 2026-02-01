import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const getSupabaseClient = (token?: string): SupabaseClient => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    token
      ? { global: { headers: { Authorization: "Bearer " + token } } }
      : undefined,
  );
};

export const getSupabaseServiceClient = (): SupabaseClient => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
};
