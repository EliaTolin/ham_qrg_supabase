import type { SendPushNotificationUseCase } from "../usecase/send-push-notification.ts";
import type { NotificationRequest, NotificationResult } from "../types.ts";

export class NotificationController {
  constructor(
    private sendPushNotificationUseCase: SendPushNotificationUseCase,
  ) {}

  async handle(body: NotificationRequest): Promise<NotificationResult> {
    this.validate(body);

    console.log(
      `[Notification] Request: headings=${JSON.stringify(body.headings)}, targeting=${
        body.include_external_user_ids
          ? `${body.include_external_user_ids.length} users`
          : body.included_segments?.join(", ") ?? "none"
      }`,
    );

    const result = await this.sendPushNotificationUseCase.execute(body);

    console.log(
      `[Notification] Done: id=${result.id}, recipients=${result.recipients}`,
    );

    return result;
  }

  private validate(body: NotificationRequest): void {
    if (!body.headings || Object.keys(body.headings).length === 0) {
      throw new Error("Missing required field: headings");
    }

    if (!body.contents || Object.keys(body.contents).length === 0) {
      throw new Error("Missing required field: contents");
    }

    const hasUsers = body.include_external_user_ids &&
      body.include_external_user_ids.length > 0;
    const hasSegments = body.included_segments &&
      body.included_segments.length > 0;

    if (!hasUsers && !hasSegments) {
      throw new Error(
        "Missing targeting: provide include_external_user_ids or included_segments",
      );
    }
  }
}
