import { SupabaseClient } from "@supabase/supabase-js";
import { RETE_MAP, RETE_SKIP } from "../constants.ts";

export class NetworkRepository {
  private supabase: SupabaseClient;
  private cache = new Map<string, string | null>();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async resolveNetworkId(rete: string | null): Promise<string | null> {
    if (!rete || RETE_SKIP.includes(rete)) return null;

    const networkName = RETE_MAP[rete];
    if (!networkName) return null;

    if (this.cache.has(networkName)) {
      return this.cache.get(networkName)!;
    }

    const { data } = await this.supabase
      .from("networks")
      .select("id")
      .eq("name", networkName)
      .single();

    const id = data?.id ?? null;
    this.cache.set(networkName, id);
    return id;
  }
}
