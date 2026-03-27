import type { Database } from "./database.types.ts";

type AccessMode = Database["public"]["Enums"]["access_mode"];

export const API_URL =
  "https://www.iz8wnh.it/rpts/privateAPI/HamQRG/HamQRG.php";

export const UPDATES_API_URL =
  "https://www.iz8wnh.it/rpts/privateAPI/HamQRG/lastUpdatesOutgoing.php";

export const TIPOLOGIA_MAP: Record<string, AccessMode | null> = {
  "FM": "ANALOG",
  "fm": "ANALOG",
  "DMR": "DMR",
  "C4FM": "C4FM",
  "DS": "DSTAR",
  "EL": "ECHOLINK",
  "SVX": "SVX",
  "SVXLink": "SVX",
  "SWXLink": "SVX",
  "ATV": "ATV",
  "Beacon": "BEACON",
  "LN": "ANALOG",
  "PK": "APRS",
  "NXDN": "NXDN",
  "AllStar": "ALLSTAR",
  "Winlink": "WINLINK",
};

export const RETE_MAP: Record<string, string> = {
  "BrandMeister": "BrandMeister",
  "EchoLink": "EchoLink",
  "Wires-X": "Wires-X",
  "Wires-x": "Wires-X",
  "ADN": "ADN",
  "ircDDB": "ircDDB",
  "IT-DMR": "IT-DMR",
  "DMR+": "DMR+",
  "DMR-Marc": "DMR-Marc",
  "AllStar": "AllStar",
  "YSF": "YSF",
};

export const RETE_SKIP = ["l", ""];
