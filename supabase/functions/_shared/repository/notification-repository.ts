import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Database } from "../database.types.ts";

export interface NotificationInsert {
  user_id: string;
  headings: Record<string, string>;
  contents: Record<string, string>;
  data: Record<string, string>;
}

export class NotificationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /** Bulk insert notifications. Returns the count of inserted rows. */
  async insertMany(rows: NotificationInsert[]): Promise<number> {
    if (rows.length === 0) return 0;

    const { error } = await this.supabase
      .from("user_notifications")
      .insert(rows);

    if (error) {
      console.error("[NotificationRepo] insertMany failed:", error);
      throw error;
    }

    return rows.length;
  }
}
