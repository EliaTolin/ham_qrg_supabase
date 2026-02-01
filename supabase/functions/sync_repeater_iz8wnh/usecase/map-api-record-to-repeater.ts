import { TIPOLOGIA_MAP } from "../constants.ts";
import { locatorToLatLon } from "../utils.ts";
import type { HamQRGRecord, MappedRecord } from "../types.ts";
import type { NetworkRepository } from "../repository/network-repository.ts";

export class MapApiRecordToRepeaterUseCase {
  constructor(private networkRepo: NetworkRepository) {}

  async execute(rec: HamQRGRecord): Promise<MappedRecord | null> {
    const freqHz = Math.round(parseFloat(rec.Frequenza) * 1_000_000);
    const coords = locatorToLatLon(rec.Locator);
    const locality = rec.Localita?.replace(/\n/g, " ").trim() || null;

    const repeater = {
      external_id: `${freqHz}_${rec.Locator}`,
      name: rec.Ripetitore || null,
      callsign: rec.Identificativo || null,
      frequency_hz: freqHz,
      shift_hz: Math.round(parseFloat(rec.Shift) * 1_000_000),
      shift_raw: rec.Shift,
      locality,
      locator: rec.Locator,
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
    };

    const mode = TIPOLOGIA_MAP[rec.Tipologia];
    if (!mode) {
      console.warn(`Unknown tipologia: ${rec.Tipologia} (record ${rec.ID})`);
      return { repeater, access: null };
    }

    const networkId = await this.networkRepo.resolveNetworkId(rec.Rete);

    const ctcssVal = parseFloat(rec.Tono);
    const ctcssHz = ctcssVal > 0 && ctcssVal <= 300 ? ctcssVal : null;

    let colorCode: number | null = null;
    if (mode === "DMR" && rec.ColorCode) {
      const cc = parseInt(rec.ColorCode);
      if (cc >= 0 && cc <= 15) colorCode = cc;
    }

    let talkgroup: number | null = null;
    if (rec.Stanza) {
      const parsed = parseInt(rec.Stanza);
      if (!isNaN(parsed)) talkgroup = parsed;
    }

    return {
      repeater,
      access: {
        external_id: rec.ID,
        mode,
        network_id: networkId,
        ctcss_hz: ctcssHz,
        color_code: colorCode,
        talkgroup,
      },
    };
  }
}
