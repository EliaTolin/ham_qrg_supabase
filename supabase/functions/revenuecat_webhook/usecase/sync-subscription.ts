import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { RevenueCatClient } from "../../_shared/api/revenuecat-client.ts";

/// Subset of the RevenueCat webhook event payload we rely on.
export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  store?: string;
  environment?: string;
}

export interface SyncResult {
  userId: string | null;
  isPro: boolean;
  skipped?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// Resolves the customer of a RevenueCat webhook event to a Supabase user id,
/// fetches the authoritative entitlement from RevenueCat, and upserts it into
/// `public.subscriptions`.
export class SyncSubscriptionUseCase {
  constructor(
    private supabase: SupabaseClient,
    private revenueCat: RevenueCatClient,
    private entitlementId: string,
  ) {}

  async execute(event: RevenueCatEvent): Promise<SyncResult> {
    const userId = this.resolveUserId(event);
    if (!userId) {
      // Purchase made by a still-anonymous RevenueCat customer (no Supabase
      // alias yet). The client SDK gates correctly; the row will be written
      // on the next event once the customer is logged in / aliased.
      return {
        userId: null,
        isPro: false,
        skipped: "no Supabase user id in event aliases",
      };
    }

    const lookupId = event.app_user_id ?? userId;
    const info = await this.revenueCat.getProEntitlement(
      lookupId,
      this.entitlementId,
    );

    const { error } = await this.supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          is_pro: info.isPro,
          entitlement: this.entitlementId,
          product_id: info.productId,
          store: info.store ?? event.store ?? null,
          environment: event.environment ?? null,
          expires_at: info.expiresAt,
          will_renew: info.willRenew,
          rc_original_app_user_id: event.original_app_user_id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      throw new Error(`Failed to upsert subscription: ${error.message}`);
    }

    return { userId, isPro: info.isPro };
  }

  private resolveUserId(event: RevenueCatEvent): string | null {
    const candidates = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases ?? []),
    ];
    return candidates.find((c) => !!c && UUID_RE.test(c)) ?? null;
  }
}
