export interface CloseSpotRequest {
  spot_id: string;
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
