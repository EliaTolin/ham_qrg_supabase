/**
 * European Maidenhead Grid Squares (4 characters)
 * Organized by region/country
 */

// =============================================================================
// ATLANTIC / WESTERN EUROPE
// =============================================================================

/** Iceland */
export const ICELAND_GRIDS = [
  "HP93", "HP94", "HP95",
  "IP04", "IP05", "IP06", "IP14", "IP15", "IP16", "IP17",
];

/** Faroe Islands */
export const FAROE_GRIDS = ["IP61", "IP62"];

/** Ireland */
export const IRELAND_GRIDS = [
  "IO51", "IO52", "IO53", "IO54",
  "IO61", "IO62", "IO63", "IO64",
];

/** United Kingdom */
export const UK_GRIDS = [
  // England
  "IO70", "IO80", "IO81", "IO82", "IO83", "IO90", "IO91", "IO92", "IO93", "IO94",
  "JO00", "JO01", "JO02", "JO03",
  // Scotland
  "IO74", "IO75", "IO76", "IO77", "IO78", "IO85", "IO86", "IO87", "IO88",
  "IO95", "IO96", "IO97", "IO98",
  // Wales
  "IO71", "IO72", "IO73", "IO81", "IO82",
  // Northern Ireland
  "IO64", "IO65", "IO74",
];

/** Portugal */
export const PORTUGAL_GRIDS = [
  "IM57", "IM58", "IM59",
  "IM67", "IM68", "IM69",
  "IN50", "IN51", "IN52", "IN60", "IN61",
];

/** Azores */
export const AZORES_GRIDS = ["HM56", "HM57", "HM58", "HM66", "HM67", "HM68", "HM76", "HM77", "HM78"];

/** Canary Islands */
export const CANARY_GRIDS = ["IL17", "IL18", "IL27", "IL28"];

/** Spain */
export const SPAIN_GRIDS = [
  // Mainland
  "IM66", "IM67", "IM68", "IM69",
  "IM76", "IM77", "IM78", "IM79",
  "IM86", "IM87", "IM88", "IM89",
  "IM96", "IM97", "IM98", "IM99",
  "IN50", "IN51", "IN52", "IN53",
  "IN60", "IN61", "IN62", "IN63",
  "IN70", "IN71", "IN72", "IN73",
  "IN80", "IN81", "IN82", "IN83",
  "IN90", "IN91", "IN92", "IN93",
  "JN00", "JN01", "JN02", "JN03",
  "JN10", "JN11", "JN12",
  // Balearic Islands
  "JM08", "JM09", "JM19", "JN00", "JN10",
];

// =============================================================================
// CENTRAL EUROPE
// =============================================================================

/** France */
export const FRANCE_GRIDS = [
  "IN76", "IN77", "IN78",
  "IN86", "IN87", "IN88",
  "IN93", "IN94", "IN95", "IN96", "IN97", "IN98",
  "JN02", "JN03", "JN04", "JN05", "JN06", "JN07", "JN08", "JN09",
  "JN12", "JN13", "JN14", "JN15", "JN16", "JN17", "JN18", "JN19",
  "JN22", "JN23", "JN24", "JN25", "JN26", "JN27", "JN28", "JN29",
  "JN33", "JN34", "JN35", "JN36", "JN37", "JN38", "JN39",
];

/** Belgium */
export const BELGIUM_GRIDS = ["JO10", "JO11", "JO20", "JO21"];

/** Netherlands */
export const NETHERLANDS_GRIDS = ["JO11", "JO21", "JO22", "JO31", "JO32", "JO33"];

/** Luxembourg */
export const LUXEMBOURG_GRIDS = ["JN29", "JN39"];

/** Germany */
export const GERMANY_GRIDS = [
  "JN37", "JN38", "JN39",
  "JN47", "JN48", "JN49",
  "JN57", "JN58", "JN59",
  "JN67", "JN68", "JN69",
  "JO20", "JO21", "JO22",
  "JO30", "JO31", "JO32", "JO33",
  "JO40", "JO41", "JO42", "JO43", "JO44",
  "JO50", "JO51", "JO52", "JO53", "JO54",
  "JO60", "JO61", "JO62", "JO63", "JO64",
  "JO70", "JO71", "JO72", "JO73",
];

/** Switzerland */
export const SWITZERLAND_GRIDS = ["JN36", "JN37", "JN46", "JN47"];

/** Austria */
export const AUSTRIA_GRIDS = ["JN47", "JN57", "JN67", "JN68", "JN77", "JN78", "JN87", "JN88"];

/** Liechtenstein */
export const LIECHTENSTEIN_GRIDS = ["JN47"];

// =============================================================================
// SOUTHERN EUROPE
// =============================================================================

/** Italy */
export const ITALY_GRIDS = [
  // North
  "JN34", "JN35", "JN36", "JN44", "JN45", "JN46",
  "JN54", "JN55", "JN56", "JN64", "JN65", "JN66",
  // Central
  "JN51", "JN52", "JN53", "JN61", "JN62", "JN63",
  "JN60", "JN70", "JN71", "JN72",
  // South
  "JM78", "JM79", "JM88", "JM89",
  "JM77", "JM87", "JM97",
  "JN70", "JN80", "JN81",
  // Sicily
  "JM66", "JM67", "JM68", "JM76", "JM77", "JM78",
  // Sardinia
  "JM48", "JM49", "JN40", "JN41",
];

/** San Marino */
export const SAN_MARINO_GRIDS = ["JN63"];

/** Vatican / Malta */
export const MALTA_GRIDS = ["JM75", "JM76"];

/** Slovenia */
export const SLOVENIA_GRIDS = ["JN65", "JN66", "JN75", "JN76"];

/** Croatia */
export const CROATIA_GRIDS = [
  "JN72", "JN73", "JN74", "JN75", "JN76",
  "JN82", "JN83", "JN84", "JN85", "JN86",
  "JN92", "JN93", "JN94", "JN95",
];

/** Bosnia */
export const BOSNIA_GRIDS = ["JN83", "JN84", "JN93", "JN94"];

/** Serbia */
export const SERBIA_GRIDS = ["JN84", "JN85", "JN94", "JN95", "KN03", "KN04", "KN05"];

/** Montenegro */
export const MONTENEGRO_GRIDS = ["JN92", "JN93", "KN02"];

/** Kosovo */
export const KOSOVO_GRIDS = ["KN02", "KN03", "KN12", "KN13"];

/** North Macedonia */
export const NORTH_MACEDONIA_GRIDS = ["KN01", "KN02", "KN11", "KN12"];

/** Albania */
export const ALBANIA_GRIDS = ["JN91", "JN92", "KN01", "KN02"];

/** Greece */
export const GREECE_GRIDS = [
  // Mainland
  "KM06", "KM07", "KM08", "KM09",
  "KM16", "KM17", "KM18", "KM19",
  "KM26", "KM27", "KM28", "KM29",
  "KN00", "KN01", "KN10", "KN11", "KN20", "KN21",
  // Islands
  "KM15", "KM16", "KM25", "KM26", "KM35", "KM36", "KM37",
  "KM45", "KM46", "KM47",
];

/** Cyprus */
export const CYPRUS_GRIDS = ["KM64", "KM65", "KM74", "KM75"];

/** Turkey (European part) */
export const TURKEY_EUROPE_GRIDS = ["KN20", "KN21", "KN30", "KN31", "KN40", "KN41"];

// =============================================================================
// NORTHERN EUROPE / SCANDINAVIA
// =============================================================================

/** Denmark */
export const DENMARK_GRIDS = [
  "JO44", "JO45", "JO46", "JO47",
  "JO54", "JO55", "JO56", "JO57",
  "JO64", "JO65", "JO66",
];

/** Norway */
export const NORWAY_GRIDS = [
  "JO28", "JO29", "JO37", "JO38", "JO39",
  "JO47", "JO48", "JO49", "JO57", "JO58", "JO59",
  "JP20", "JP30", "JP31", "JP32", "JP40", "JP41", "JP42",
  "JP50", "JP51", "JP52", "JP53",
  "JP60", "JP61", "JP62", "JP63", "JP64",
  "JP70", "JP71", "JP72", "JP73", "JP74",
  "JP80", "JP81", "JP82", "JP83", "JP84",
  "JP90", "JP91", "JP92", "JP93", "JP94", "JP95",
  "JQ60", "JQ70", "JQ80",
  "KP08", "KP09", "KP18", "KP19", "KP28", "KP29", "KP38", "KP39",
];

/** Sweden */
export const SWEDEN_GRIDS = [
  "JO57", "JO58", "JO59",
  "JO65", "JO66", "JO67", "JO68", "JO69",
  "JO75", "JO76", "JO77", "JO78", "JO79",
  "JO85", "JO86", "JO87", "JO88", "JO89",
  "JO95", "JO96", "JO97", "JO98", "JO99",
  "JP60", "JP61", "JP70", "JP71", "JP72", "JP73",
  "JP80", "JP81", "JP82", "JP83", "JP84",
  "JP90", "JP91", "JP92", "JP93", "JP94", "JP95",
  "KP03", "KP04", "KP05", "KP06", "KP07",
  "KP13", "KP14", "KP15", "KP16", "KP17",
];

/** Finland */
export const FINLAND_GRIDS = [
  "KO16", "KO17", "KO18", "KO19",
  "KO26", "KO27", "KO28", "KO29",
  "KO35", "KO36", "KO37", "KO38", "KO39",
  "KO45", "KO46", "KO47", "KO48", "KO49",
  "KO55", "KO56", "KO57", "KO58", "KO59",
  "KP00", "KP01", "KP02", "KP03", "KP04", "KP05",
  "KP10", "KP11", "KP12", "KP13", "KP14", "KP15",
  "KP20", "KP21", "KP22", "KP23", "KP24", "KP25",
  "KP30", "KP31", "KP32", "KP33", "KP34", "KP35",
  "KP40", "KP41", "KP42", "KP43", "KP44", "KP45",
];

// =============================================================================
// EASTERN EUROPE
// =============================================================================

/** Poland */
export const POLAND_GRIDS = [
  "JO70", "JO71", "JO72", "JO73", "JO74",
  "JO80", "JO81", "JO82", "JO83", "JO84",
  "JO90", "JO91", "JO92", "JO93", "JO94",
  "KO00", "KO01", "KO02", "KO03", "KO04",
  "KO10", "KO11", "KO12", "KO13", "KO14",
];

/** Czech Republic */
export const CZECH_GRIDS = ["JN69", "JN79", "JN89", "JO60", "JO70", "JO80"];

/** Slovakia */
export const SLOVAKIA_GRIDS = ["JN87", "JN88", "JN98", "JN99", "KN08", "KN09"];

/** Hungary */
export const HUNGARY_GRIDS = ["JN86", "JN87", "JN96", "JN97", "KN06", "KN07"];

/** Romania */
export const ROMANIA_GRIDS = [
  "KN04", "KN05", "KN06",
  "KN14", "KN15", "KN16", "KN17",
  "KN24", "KN25", "KN26", "KN27",
  "KN33", "KN34", "KN35", "KN36", "KN37",
  "KN44", "KN45", "KN46",
];

/** Bulgaria */
export const BULGARIA_GRIDS = [
  "KN12", "KN13", "KN22", "KN23",
  "KN31", "KN32", "KN33", "KN41", "KN42", "KN43",
];

/** Moldova */
export const MOLDOVA_GRIDS = ["KN36", "KN37", "KN46", "KN47"];

/** Ukraine */
export const UKRAINE_GRIDS = [
  "KN17", "KN18", "KN19",
  "KN27", "KN28", "KN29",
  "KN37", "KN38", "KN39",
  "KN47", "KN48", "KN49",
  "KN57", "KN58", "KN59",
  "KN67", "KN68", "KN69",
  "KN77", "KN78", "KN79",
  "KN87", "KN88", "KN89",
  "KN97", "KN98", "KN99",
  "KO00", "KO10", "KO20", "KO30", "KO40", "KO50",
  "LN08", "LN09", "LN18", "LN19",
];

/** Belarus */
export const BELARUS_GRIDS = [
  "KO02", "KO03", "KO04", "KO05",
  "KO12", "KO13", "KO14", "KO15",
  "KO22", "KO23", "KO24", "KO25",
  "KO31", "KO32", "KO33", "KO34", "KO35",
  "KO42", "KO43", "KO44", "KO45",
];

/** Lithuania */
export const LITHUANIA_GRIDS = ["KO04", "KO05", "KO14", "KO15", "KO24", "KO25"];

/** Latvia */
export const LATVIA_GRIDS = ["KO06", "KO07", "KO16", "KO17", "KO26", "KO27", "KO36", "KO37"];

/** Estonia */
export const ESTONIA_GRIDS = ["KO18", "KO19", "KO28", "KO29", "KO38", "KO39"];

// =============================================================================
// RUSSIA (European part)
// =============================================================================

/** European Russia (west of Urals) */
export const RUSSIA_EUROPE_GRIDS = [
  // Northwest
  "KO49", "KO59", "KO69", "KO79", "KO89", "KO99",
  "KP00", "KP10", "KP20", "KP30", "KP40", "KP50", "KP60",
  "KP01", "KP11", "KP21", "KP31", "KP41", "KP51",
  // Central
  "KO55", "KO56", "KO57", "KO58",
  "KO65", "KO66", "KO67", "KO68",
  "KO75", "KO76", "KO77", "KO78",
  "KO85", "KO86", "KO87", "KO88",
  "KO95", "KO96", "KO97", "KO98",
  // Southwest
  "LN07", "LN08", "LN09",
  "LN17", "LN18", "LN19", "LN27", "LN28", "LN29",
  // East (towards Urals)
  "LO05", "LO06", "LO07", "LO08", "LO09",
  "LO15", "LO16", "LO17", "LO18", "LO19",
  "LO25", "LO26", "LO27", "LO28", "LO29",
  "MO05", "MO06", "MO07", "MO08", "MO09",
];

// =============================================================================
// AGGREGATE EXPORTS
// =============================================================================

/** All European grid squares */
export const EUROPE_GRIDS = [
  ...ICELAND_GRIDS,
  ...FAROE_GRIDS,
  ...IRELAND_GRIDS,
  ...UK_GRIDS,
  ...PORTUGAL_GRIDS,
  ...AZORES_GRIDS,
  ...CANARY_GRIDS,
  ...SPAIN_GRIDS,
  ...FRANCE_GRIDS,
  ...BELGIUM_GRIDS,
  ...NETHERLANDS_GRIDS,
  ...LUXEMBOURG_GRIDS,
  ...GERMANY_GRIDS,
  ...SWITZERLAND_GRIDS,
  ...AUSTRIA_GRIDS,
  ...LIECHTENSTEIN_GRIDS,
  ...ITALY_GRIDS,
  ...SAN_MARINO_GRIDS,
  ...MALTA_GRIDS,
  ...SLOVENIA_GRIDS,
  ...CROATIA_GRIDS,
  ...BOSNIA_GRIDS,
  ...SERBIA_GRIDS,
  ...MONTENEGRO_GRIDS,
  ...KOSOVO_GRIDS,
  ...NORTH_MACEDONIA_GRIDS,
  ...ALBANIA_GRIDS,
  ...GREECE_GRIDS,
  ...CYPRUS_GRIDS,
  ...TURKEY_EUROPE_GRIDS,
  ...DENMARK_GRIDS,
  ...NORWAY_GRIDS,
  ...SWEDEN_GRIDS,
  ...FINLAND_GRIDS,
  ...POLAND_GRIDS,
  ...CZECH_GRIDS,
  ...SLOVAKIA_GRIDS,
  ...HUNGARY_GRIDS,
  ...ROMANIA_GRIDS,
  ...BULGARIA_GRIDS,
  ...MOLDOVA_GRIDS,
  ...UKRAINE_GRIDS,
  ...BELARUS_GRIDS,
  ...LITHUANIA_GRIDS,
  ...LATVIA_GRIDS,
  ...ESTONIA_GRIDS,
  ...RUSSIA_EUROPE_GRIDS,
];

/** Deduplicated and sorted */
export const EUROPE_GRIDS_UNIQUE = [...new Set(EUROPE_GRIDS)].sort();

/** EU member states only */
export const EU_GRIDS = [
  ...IRELAND_GRIDS,
  ...PORTUGAL_GRIDS,
  ...AZORES_GRIDS,
  ...SPAIN_GRIDS,
  ...FRANCE_GRIDS,
  ...BELGIUM_GRIDS,
  ...NETHERLANDS_GRIDS,
  ...LUXEMBOURG_GRIDS,
  ...GERMANY_GRIDS,
  ...AUSTRIA_GRIDS,
  ...ITALY_GRIDS,
  ...MALTA_GRIDS,
  ...SLOVENIA_GRIDS,
  ...CROATIA_GRIDS,
  ...GREECE_GRIDS,
  ...CYPRUS_GRIDS,
  ...DENMARK_GRIDS,
  ...SWEDEN_GRIDS,
  ...FINLAND_GRIDS,
  ...POLAND_GRIDS,
  ...CZECH_GRIDS,
  ...SLOVAKIA_GRIDS,
  ...HUNGARY_GRIDS,
  ...ROMANIA_GRIDS,
  ...BULGARIA_GRIDS,
  ...LITHUANIA_GRIDS,
  ...LATVIA_GRIDS,
  ...ESTONIA_GRIDS,
];

/** EU deduplicated and sorted */
export const EU_GRIDS_UNIQUE = [...new Set(EU_GRIDS)].sort();