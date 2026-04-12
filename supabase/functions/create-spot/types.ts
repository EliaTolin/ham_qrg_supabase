export interface CreateSpotRequest {
  repeater_id: string;
  duration_minutes?: number | null;
  access_id?: string | null;
  spotted_callsign?: string | null;
}

export class SpotError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SpotError";
  }
}
