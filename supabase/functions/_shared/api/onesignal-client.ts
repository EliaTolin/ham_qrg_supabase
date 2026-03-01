export interface OneSignalNotificationPayload {
  app_id: string;
  headings: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, string>;
  url?: string;
  include_external_user_ids?: string[];
  included_segments?: string[];
}

export interface OneSignalResponse {
  id: string;
  recipients: number;
}

export class OneSignalClient {
  private appId: string;
  private restApiKey: string;

  constructor(appId: string, restApiKey: string) {
    this.appId = appId;
    this.restApiKey = restApiKey;
  }

  async sendNotification(
    payload: Omit<OneSignalNotificationPayload, "app_id">,
  ): Promise<OneSignalResponse> {
    console.log("[OneSignal] Sending notification...");

    const response = await fetch(
      "https://api.onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${this.restApiKey}`,
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
    console.log(
      `[OneSignal] Notification sent: id=${data.id}, recipients=${data.recipients}`,
    );
    return { id: data.id, recipients: data.recipients };
  }
}
