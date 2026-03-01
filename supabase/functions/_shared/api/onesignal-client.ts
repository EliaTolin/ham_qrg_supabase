export interface OneSignalNotificationPayload {
  app_id: string;
  headings: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, string>;
  url?: string;
  target_channel?: string;
  include_aliases?: { external_id: string[] };
  included_segments?: string[];
}

export interface OneSignalResponse {
  id: string;
}

export class OneSignalClient {
  private appId: string;
  private apiKey: string;

  constructor(appId: string, apiKey: string) {
    this.appId = appId;
    this.apiKey = apiKey;
  }

  async sendNotification(
    payload: Omit<OneSignalNotificationPayload, "app_id">,
  ): Promise<OneSignalResponse> {
    console.log("[OneSignal] Sending notification...");

    const response = await fetch(
      "https://api.onesignal.com/notifications?c=push",
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: this.appId,
          ...payload,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OneSignal API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    const data = await response.json();
    console.log(`[OneSignal] Response body: ${JSON.stringify(data)}`);
    return { id: data.id };
  }
}
