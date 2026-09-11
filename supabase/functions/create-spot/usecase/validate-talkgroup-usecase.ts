import type { Database } from "../../_shared/database.types.ts";
import { SpotError } from "../types.ts";

type AccessMode = Database["public"]["Enums"]["access_mode"];

/** DMR talkgroup ids are 24-bit, like DMR ids. */
const MAX_TALKGROUP = 16777215;

/**
 * Validates the declared talkgroup:
 * - omitted/null is always fine (the field is optional);
 * - only allowed when the chosen access is DMR — the mode comes from the
 *   database, not from the client;
 * - must be an integer in 1..16777215.
 */
export class ValidateTalkgroupUseCase {
  execute(
    talkgroup: number | null | undefined,
    accessMode: AccessMode | null,
  ): number | null {
    if (talkgroup == null) return null;

    if (accessMode !== "DMR") {
      // Nessun messaggio custom: jsonError serializza `message`, e il client
      // mappa il CODICE sulla stringa tradotta. Un messaggio qui farebbe
      // cadere l'app sull'errore generico.
      throw new SpotError("TALKGROUP_NOT_ALLOWED", 422);
    }

    if (
      !Number.isInteger(talkgroup) ||
      talkgroup < 1 ||
      talkgroup > MAX_TALKGROUP
    ) {
      throw new SpotError("INVALID_TALKGROUP", 422);
    }

    return talkgroup;
  }
}
