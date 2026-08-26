/// Minimal RevenueCat REST v1 client used by the webhook to fetch the
/// authoritative entitlement state for a customer (more reliable than
/// inferring it from the webhook event type alone).

export interface ProEntitlementInfo {
  isPro: boolean;
  productId: string | null;
  expiresAt: string | null; // ISO 8601, or null for lifetime entitlements
  store: string | null;
  willRenew: boolean;
}

export class RevenueCatClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /// Fetches the current state of [entitlementId] for [appUserId].
  async getProEntitlement(
    appUserId: string,
    entitlementId: string,
  ): Promise<ProEntitlementInfo> {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${
        encodeURIComponent(appUserId)
      }`,
      {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `RevenueCat API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    const data = await response.json();
    const subscriber = data.subscriber ?? {};
    const entitlement = subscriber.entitlements?.[entitlementId];

    if (!entitlement) {
      return {
        isPro: false,
        productId: null,
        expiresAt: null,
        store: null,
        willRenew: false,
      };
    }

    const expiresAt: string | null = entitlement.expires_date ?? null;
    const isActive = expiresAt === null ||
      new Date(expiresAt).getTime() > Date.now();

    const productId: string | null = entitlement.product_identifier ?? null;
    const subscription = productId
      ? subscriber.subscriptions?.[productId]
      : null;
    const store: string | null = subscription?.store ?? null;
    const willRenew = isActive &&
      !!subscription &&
      !subscription.unsubscribe_detected_at &&
      !subscription.billing_issues_detected_at;

    return { isPro: isActive, productId, expiresAt, store, willRenew };
  }
}
