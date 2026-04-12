import type { Database } from "../../_shared/database.types.ts";
import { RepeaterRepository } from "../../_shared/repository/repeater-repository.ts";
import { FavoriteRepository } from "../../_shared/repository/favorite-repository.ts";
import { NotificationRepository } from "../../_shared/repository/notification-repository.ts";

type RepeaterSpot = Database["public"]["Tables"]["repeater_spots"]["Row"];

/**
 * Sends push notifications to users who have the repeater in their
 * favorites, respecting both opt-in flags and excluding the spot author.
 *
 * Inserts rows into user_notifications via NotificationRepository —
 * the existing trigger trg_user_notification_push handles actual
 * push delivery via pg_net.
 */
export class NotifyFavoritesUseCase {
  constructor(
    private repeaterRepo: RepeaterRepository,
    private favoriteRepo: FavoriteRepository,
    private notificationRepo: NotificationRepository,
  ) {}

  async execute(spot: RepeaterSpot): Promise<number> {
    // 1. Get repeater label
    const repeater = await this.repeaterRepo.findById(spot.repeater_id);
    const label = repeater?.callsign ?? repeater?.name ?? "Repeater";

    // 2. Find eligible recipients
    const recipients = await this.favoriteRepo
      .findEligibleForClusterNotification(spot.repeater_id, spot.user_id);

    if (recipients.length === 0) return 0;

    // 3. Build notification rows
    const rows = recipients.map((r) => ({
      user_id: r.user_id,
      headings: {
        en: `New spot on ${label}`,
        it: `Nuovo spot su ${label}`,
      },
      contents: {
        en:
          `${spot.callsign_snapshot} is listening for ${spot.duration_minutes} min`,
        it:
          `${spot.callsign_snapshot} è in ascolto per ${spot.duration_minutes} min`,
      },
      data: {
        type: "new_cluster_spot",
        spot_id: spot.id,
        repeater_id: spot.repeater_id,
        spotter_user_id: spot.user_id,
      },
    }));

    // 4. Persist via repository
    return await this.notificationRepo.insertMany(rows);
  }
}
