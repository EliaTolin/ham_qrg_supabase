import type { RepeaterRepository } from "../repository/repeater-repository.ts";
import type { AccessRepository } from "../repository/access-repository.ts";
import type { MapApiRecordToRepeaterUseCase } from "./map-api-record-to-repeater.ts";
import type { PersistRepeaterToDatabaseUseCase } from "./persist-repeater-to-database.ts";
import type { HamQRGRecord } from "../types.ts";

// deno-lint-ignore no-explicit-any
type PendingChange = Record<string, any>;

export class ApplyChangeUseCase {
  constructor(
    private repeaterRepo: RepeaterRepository,
    private accessRepo: AccessRepository,
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
    private persistRepeaterUseCase: PersistRepeaterToDatabaseUseCase,
  ) {}

  async execute(pc: PendingChange): Promise<boolean> {
    const remoteData = pc.remote_data as Record<string, string>;
    const changeType = pc.change_type as string;

    switch (changeType) {
      case "new":
        return this.applyNew(pc, remoteData);
      case "update":
        return this.applyUpdate(pc);
      case "deactivate":
        return this.applyDeactivate(pc);
      case "reactivate":
        return this.applyReactivate(pc);
      default:
        return false;
    }
  }

  private async applyNew(
    pc: PendingChange,
    remoteData: Record<string, string>,
  ): Promise<boolean> {
    const apiRecord: HamQRGRecord = {
      ID: pc.external_id,
      Ripetitore: remoteData.Ripetitore ?? "",
      Frequenza: remoteData.Frequenza ?? "0",
      Shift: remoteData.Shift ?? "0",
      Tono: remoteData.Tono ?? "0",
      ColorCode: remoteData.ColorCode ?? null,
      Stanza: remoteData.Stanza ?? null,
      Rete: remoteData.Rete ?? null,
      Lat: remoteData.Lat ?? "0",
      Long: remoteData.Long ?? "0",
      Localita: remoteData.Localita ?? "",
      Locator: remoteData.Locator ?? "",
      Identificativo: remoteData.Identificativo ?? null,
      Tipologia: remoteData.Tipologia ?? "",
      Ultima_Modifica: remoteData.Ultima_Modifica ?? "",
      QRB: remoteData.QRB ?? "0",
    };

    const mapped = await this.mapApiRecordUseCase.execute(apiRecord);
    if (!mapped) return false;

    const freqHz = Math.round(
      parseFloat(remoteData.Frequenza) * 1_000_000,
    );

    const existing = await this.repeaterRepo.findByFreqLocator(
      freqHz,
      remoteData.Locator ?? "",
    );

    if (existing) {
      if (mapped.access) {
        await this.accessRepo.upsert({
          ...mapped.access,
          repeater_id: existing.id,
        });
      }
      return true;
    }

    mapped.repeater.external_id = `${freqHz}_${remoteData.Locator}`;
    const result = await this.persistRepeaterUseCase.execute(mapped);
    return result.repeaterOk;
  }

  private async applyUpdate(pc: PendingChange): Promise<boolean> {
    if (!pc.repeater_id) return false;

    const diff = pc.diff as Record<
      string,
      { local: unknown; remote: unknown }
    >;
    const repeaterUpdates: Record<string, unknown> = {};
    const accessUpdates: Record<string, unknown> = {};

    for (const [field, values] of Object.entries(diff)) {
      if (field === "scope") continue;
      if (field.startsWith("access.")) {
        accessUpdates[field.replace("access.", "")] = values.remote;
      } else if (!field.startsWith("access_")) {
        repeaterUpdates[field] = values.remote;
      }
    }

    if (Object.keys(repeaterUpdates).length > 0) {
      const ok = await this.repeaterRepo.updateFields(
        pc.repeater_id,
        repeaterUpdates,
      );
      if (!ok) return false;
    }

    if (Object.keys(accessUpdates).length > 0) {
      await this.accessRepo.updateByExternalId(
        pc.external_id,
        accessUpdates,
      );
    }

    for (const [field, values] of Object.entries(diff)) {
      if (!field.startsWith("access_")) continue;
      const accessData = values.remote as Record<string, unknown>;
      if (accessData) {
        await this.accessRepo.insertAccess({
          repeater_id: pc.repeater_id,
          external_id: pc.external_id,
          mode: accessData.mode,
          ctcss_tx_hz: accessData.ctcss_tx_hz ?? null,
          color_code: accessData.color_code ?? null,
          node_id: accessData.node_id ?? null,
          network_id: accessData.network_id ?? null,
          source: "iz8wnh",
          last_seen_at: new Date().toISOString(),
        });
      }
    }

    return true;
  }

  private async applyDeactivate(pc: PendingChange): Promise<boolean> {
    if (!pc.repeater_id) return false;

    const scope = (
      pc.diff as Record<string, { remote: unknown }>
    ).scope?.remote as string | undefined;

    if (scope === "access") {
      await this.accessRepo.deleteByExternalId(pc.external_id);
      const remaining = await this.accessRepo.findByRepeaterId(
        pc.repeater_id,
      );
      if (remaining.length === 0) {
        await this.repeaterRepo.setActive(pc.repeater_id, false);
      }
    } else {
      await this.repeaterRepo.setActive(pc.repeater_id, false);
    }
    return true;
  }

  private async applyReactivate(pc: PendingChange): Promise<boolean> {
    if (!pc.repeater_id) return false;

    const diff = pc.diff as Record<
      string,
      { local: unknown; remote: unknown }
    >;
    const updates: Record<string, unknown> = { is_active: true };

    for (const [field, values] of Object.entries(diff)) {
      if (
        field === "scope" ||
        field === "is_active" ||
        field === "AutoON" ||
        field === "ManualON"
      )
        continue;
      if (field.startsWith("access")) continue;
      updates[field] = values.remote;
    }

    await this.repeaterRepo.updateFields(pc.repeater_id, updates);

    for (const [field, values] of Object.entries(diff)) {
      if (field.startsWith("access.")) {
        await this.accessRepo.updateByExternalId(pc.external_id, {
          [field.replace("access.", "")]: values.remote,
        });
      } else if (field.startsWith("access_")) {
        const accessData = values.remote as Record<string, unknown>;
        if (accessData) {
          await this.accessRepo.insertAccess({
            repeater_id: pc.repeater_id,
            external_id: pc.external_id,
            mode: accessData.mode,
            ctcss_tx_hz: accessData.ctcss_tx_hz ?? null,
            color_code: accessData.color_code ?? null,
            node_id: accessData.node_id ?? null,
            network_id: accessData.network_id ?? null,
            source: "iz8wnh",
            last_seen_at: new Date().toISOString(),
          });
        }
      }
    }

    return true;
  }
}
