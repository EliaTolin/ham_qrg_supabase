import type { SupabaseClient } from "supabase";
import type { Database } from "../../_shared/database.types.ts";
import { RETE_MAP, RETE_SKIP } from "../constants.ts";

export class NetworkRepository {
  private cache = new Map<string, string | null>();
  private _unknownRete = new Set<string>();
  private _missingNetworks = new Set<string>();

  constructor(private supabase: SupabaseClient<Database>) {}

  get unknownRete(): string[] {
    return [...this._unknownRete];
  }

  get missingNetworks(): string[] {
    return [...this._missingNetworks];
  }

  async resolveNetworkId(rete: string | null): Promise<string | null> {
    if (!rete || RETE_SKIP.includes(rete)) return null;

    const networkName = RETE_MAP[rete];
    if (!networkName) {
      this._unknownRete.add(rete);
      return null;
    }

    if (this.cache.has(networkName)) {
      return this.cache.get(networkName)!;
    }

    const { data } = await this.supabase
      .from("networks")
      .select("id")
      .ilike("name", networkName)
      .single();

    const id = data?.id ?? null;
    this.cache.set(networkName, id);

    if (!id) {
      this._missingNetworks.add(networkName);
    }

    return id;
  }
}
