import type { OneSignalClient } from "../../_shared/api/onesignal-client.ts";
import type { NotificationRequest, NotificationResult } from "../types.ts";

export class SendPushNotificationUseCase {
  constructor(private oneSignalClient: OneSignalClient) {}

  async execute(request: NotificationRequest): Promise<NotificationResult> {
    console.log(
      `[SendPushNotification] Sending: "${request.headings.en ?? Object.values(request.headings)[0]}" to ${
        request.include_external_user_ids?.length ?? 0
      } users / ${request.included_segments?.join(", ") ?? "no segments"}`,
    );

    const result = await this.oneSignalClient.sendNotification({
      headings: request.headings,
      contents: request.contents,
      ...(request.include_external_user_ids && {
        include_aliases: { external_id: request.include_external_user_ids },
        target_channel: "push",
      }),
      ...(request.included_segments && {
        included_segments: request.included_segments,
      }),
      ...(request.data && { data: request.data }),
      ...(request.url && { url: request.url }),
    });

    console.log(`[SendPushNotification] Done: id=${result.id}`);

    return result;
  }
}
