/** Richiesta profilo altimetrico */
export interface ProfileRequest {
  repeater_lat: number;
  repeater_lon: number;
  user_lat: number;
  user_lon: number;
  num_points?: number;
}

/** Singolo punto del profilo altimetrico */
export interface ProfilePoint {
  lat: number;
  lon: number;
  elevation_m: number;
  distance_km: number;
}

/** Risposta profilo altimetrico */
export interface ProfileResult {
  points: ProfilePoint[];
  total_distance_km: number;
  num_points: number;
}