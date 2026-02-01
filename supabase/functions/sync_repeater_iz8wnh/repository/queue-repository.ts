import type { SupabaseClient } from "supabase";
import type { GridMessage } from "../types.ts";

const QUEUE_NAME = "sync_repeater_iz8wnh_queue";

export class QueueRepository {
  constructor(private supabase: SupabaseClient) {}

  async sendBatch(messages: GridMessage[]): Promise<void> {
    const { error } = await this.supabase.rpc("queue_send_batch", {
      p_queue_name: QUEUE_NAME,
      p_msgs: messages,
    });

    if (error) {
      throw new Error(`Failed to send batch: ${error.message}`);
    }
  }

  async read(
    batchSize: number,
    visibilityTimeout: number,
  ): Promise<Array<{ msg_id: number; read_ct: number; message: GridMessage }>> {
    const { data, error } = await this.supabase.rpc("queue_read", {
      p_queue_name: QUEUE_NAME,
      p_vt: visibilityTimeout,
      p_qty: batchSize,
    });

    if (error) {
      throw new Error(`Failed to read from queue: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    return data.map(
      (row: { msg_id: number; read_ct: number; message: GridMessage }) => ({
        msg_id: row.msg_id,
        read_ct: row.read_ct,
        message: row.message,
      }),
    );
  }

  async delete(msgId: number): Promise<void> {
    const { error } = await this.supabase.rpc("queue_delete", {
      p_queue_name: QUEUE_NAME,
      p_msg_id: msgId,
    });

    if (error) {
      throw new Error(`Failed to delete message ${msgId}: ${error.message}`);
    }
  }
}
