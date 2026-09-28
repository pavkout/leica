// Development times for the app's black-and-white films, transcribed from the
// film makers' own datasheets (read 2026-09-27). Each table reproduces the
// source's rows; "not recommended" and blank cells are left out rather than
// estimated. Times are minutes for small/spiral tanks with the datasheet's
// intermittent agitation. Push levels are stops from the app's box speed for
// the film, rounded from the datasheet's EI.

export interface DatasheetTime {
  filmId: string;
  developer: string;
  dilution: string;
  temperatureC: number;
  /** Meter setting (EI) the datasheet gives this time for. */
  ei: number;
  /** Stops from the film's box speed in the app (push +, pull −). */
  developStops: number;
  minutes: number;
  source: string;
  url: string;
  agitation: string;
  note?: string;
}

type Row = [developer: string, dilution: string, ei: number, times: (number | null)[]];

const KODAK_TRIX = {
  source: "Kodak Alaris, KODAK PROFESSIONAL TRI-X 320 and 400 Films, technical data F-4017 (February 2016)",
  url: "https://business.kodakmoments.com/sites/default/files/files/products/f4017_TriX.pdf",
  agitation: "Small tank, agitation at 30-second intervals",
  temps: [18, 20, 21, 22, 24],
  box: 400,
};

// TRI-X 400 / 400TX, small tank: EI 400 (p. 3) and EI 1600 / 3200 push (p. 5).
const TRIX_ROWS: Row[] = [
  ["Kodak T-MAX", "stock", 400, [6.75, 6, 5.75, 5.5, 4.75]],
  ["Kodak T-MAX RS", "stock", 400, [4.75, 4.5, 4.25, 4, 3.5]],
  ["Kodak HC-110", "dilution B", 400, [4.5, 3.75, 3.5, 3, 2.5]],
  ["Kodak D-76", "stock", 400, [8, 6.75, 6.25, 5.5, 4.75]],
  ["Kodak D-76", "1:1", 400, [10.75, 9.75, 9, 8.5, 7.75]],
  ["Kodak XTOL", "stock", 400, [8, 7, 6.25, 5.75, 4.75]],
  ["Kodak XTOL", "1:1", 400, [10, 9, 8.5, 8, 7.25]],
  ["Kodak T-MAX", "stock", 1600, [9.5, 8.75, 8.25, 7.75, 7]],
  ["Kodak T-MAX RS", "stock", 1600, [8.5, 7.75, 7.25, 6.75, 6]],
  ["Kodak HC-110", "dilution B", 1600, [7, 6, 5.5, 5, 4.25]],
  ["Kodak D-76", "stock", 1600, [11.25, 9.5, 8.75, 7.75, 6.5]],
  ["Kodak D-76", "1:1", 1600, [14.75, 13.25, 12.5, 11.75, 10.75]],
  ["Kodak XTOL", "stock", 1600, [11.25, 9.75, 8.75, 8, 6.75]],
  ["Kodak XTOL", "1:1", 1600, [14.5, 13.25, 12.25, 11.5, 10.5]],
  ["Kodak T-MAX", "stock", 3200, [null, null, null, null, 8.25]],
  ["Kodak T-MAX RS", "stock", 3200, [null, 9.5, 9, 8.25, 7.5]],
  ["Kodak D-76", "stock", 3200, [12.75, 11, 9.75, 9, 7.5]],
  ["Kodak D-76", "1:1", 3200, [17.5, 16, 15, 14.25, 12.75]],
  ["Kodak XTOL", "stock", 3200, [null, 11.5, 10.5, 9.5, 8]],
  ["Kodak XTOL", "1:1", 3200, [null, 15.5, 14.5, 13.75, 12.25]],
];

const ILFORD_HP5 = {
  source: "HARMAN technology (ILFORD), HP5 PLUS technical information (November 2018)",
  url: "https://www.ilfordphoto.com/amfile/file/download/file/1903/product/691/",
  agitation: "Spiral tank, intermittent agitation (four inversions each minute)",
  temps: [20],
  box: 400,
};

// HP5 PLUS 35mm and roll film, 20 °C (p. 3). EI 200 appears only for ILFOSOL 3.
const HP5_ROWS: Row[] = [
  ...grid("ILFOTEC DD-X", "1+4", [400, 800, 1600, 3200], [9, 10, 13, 20]),
  ...grid("ILFOSOL 3", "1+9", [200, 400, 800], [5, 6.5, 13.5]),
  ...grid("ILFOSOL 3", "1+14", [200, 400, 800], [7, 11, 19.5]),
  ...grid("ILFOTEC HC", "1+15", [400, 800, 1600, 3200], [3.5, 5, 7.5, 11]),
  ...grid("ILFOTEC HC", "1+31", [400, 800, 1600], [6.5, 9.5, 14]),
  ...grid("ILFOTEC LC29", "1+9", [400, 800, 1600, 3200], [3.5, 5, 7.5, 11]),
  ...grid("ILFOTEC LC29", "1+19", [400, 800, 1600], [6.5, 9.5, 14]),
  ...grid("ILFOTEC LC29", "1+29", [400], [9]),
  ...grid("ID-11", "stock", [400, 800, 1600], [7.5, 10.5, 14]),
  ...grid("ID-11", "1+1", [400, 800], [13, 16.5]),
  ...grid("ID-11", "1+3", [400], [20]),
  ...grid("MICROPHEN", "stock", [400, 800, 1600, 3200], [6.5, 8, 11, 16]),
  ...grid("MICROPHEN", "1+1", [400, 800], [12, 15]),
  ...grid("MICROPHEN", "1+3", [400], [23]),
  ...grid("Acufine", "stock", [400, 800, 1600], [4.5, 6.5, 9.5]),
  ...grid("Agfa Rodinal", "1+25", [400, 800], [6, 8]),
  ...grid("Agfa Rodinal", "1+50", [400], [11]),
  ...grid("Kodak D-76", "stock", [400, 800, 1600], [7.5, 9.5, 12.5]),
  ...grid("Kodak D-76", "1+1", [400, 800], [11, 13]),
  ...grid("Kodak D-76", "1+3", [400], [22]),
  ...grid("Kodak HC-110", "dilution A", [400, 800, 1600, 3200], [2.5, 3.75, 5.5, 9.5]),
  ...grid("Kodak HC-110", "dilution B", [400, 800, 1600], [5, 7.5, 11]),
  ...grid("Kodak T-Max", "1+4", [400, 800, 1600, 3200], [6.5, 8, 9.5, 11.5]),
  ...grid("Tetenal Ultrafin SF", "stock", [400, 800], [7.5, 10]),
  ...grid("Tetenal Ultrafin SF", "1+1", [400], [16]),
  ...grid("Tetenal Ultrafin Plus", "1+4", [400, 800, 1600], [7, 10, 13]),
  ...grid("Kodak Xtol", "stock", [400, 800, 1600, 3200], [8, 11, 14, 19]),
  ...grid("Kodak Xtol", "1+1", [400, 800], [12, 17]),
];

const ILFORD_DELTA3200 = {
  source: "HARMAN technology (ILFORD), DELTA 3200 PROFESSIONAL technical information (June 2025)",
  url: "https://www.ilfordphoto.com/amfile/file/download/file/1913/product/682/",
  agitation: "Spiral tank, intermittent agitation (four inversions each minute)",
  temps: [20, 24],
  box: 3200,
};

const D3200_EIS = [400, 800, 1600, 3200, 6400, 12500];
// DELTA 3200 35mm and roll film at 20 °C (p. 3) and 24 °C (p. 4), EI 400 … 12500.
const D3200_20: [string, string, (number | null)[]][] = [
  ["ILFOTEC DD-X", "1+4", [6, 7, 8, 9.5, 12.5, 17]],
  ["ILFOSOL 3", "1+9", [6, 7.5, 10, 11, 18, null]],
  ["ILFOSOL 3", "1+14", [11, 13, 15.5, 17, 23, null]],
  ["ILFOTEC HC", "1+15", [null, null, 5, 8, 13, null]],
  ["ILFOTEC HC", "1+31", [6, 7.5, 9, 14.5, null, null]],
  ["ILFOTEC LC29", "1+9", [null, null, 5, 8, 13, null]],
  ["ILFOTEC LC29", "1+19", [6, 7.5, 9, 14.5, null, null]],
  ["ID-11", "stock", [7, 8, 9.5, 10.5, 13, 17]],
  ["MICROPHEN", "stock", [6, 7, 8, 9, 12, 16.5]],
  ["PERCEPTOL", "stock", [11, 13, 15, 18, null, null]],
];
const D3200_24: [string, string, (number | null)[]][] = [
  ["ILFOTEC DD-X", "1+4", [null, 5, 6, 7, 9, 12]],
  ["ILFOSOL 3", "1+9", [5.5, 7, 8, 9, 15.5, null]],
  ["ILFOSOL 3", "1+14", [7, 8, 10, 11, 19, null]],
  ["ILFOTEC HC", "1+15", [null, null, null, 5.5, 8.5, null]],
  ["ILFOTEC HC", "1+31", [5, 6, 7, 10.5, null, null]],
  ["ILFOTEC LC29", "1+9", [null, null, null, 5.5, 8.5, null]],
  ["ILFOTEC LC29", "1+19", [5, 6, 7, 10.5, null, null]],
  ["ID-11", "stock", [6, 7, 8, 9, 11, 13.5]],
  ["MICROPHEN", "stock", [null, 5, 6, 7, 9.5, 13.5]],
  ["PERCEPTOL", "stock", [9.5, 10.5, 12, 15.5, null, null]],
];

function grid(developer: string, dilution: string, eis: number[], times: number[]): Row[] {
  return eis.map((ei, i) => [developer, dilution, ei, [times[i]]]);
}

const stopsFrom = (box: number, ei: number) => Math.round(Math.log2(ei / box));

function expand(filmId: string, meta: { source: string; url: string; agitation: string; temps: number[]; box: number }, rows: Row[], note?: string): DatasheetTime[] {
  return rows.flatMap(([developer, dilution, ei, times]) =>
    times.flatMap((minutes, i) =>
      minutes === null
        ? []
        : [{ filmId, developer, dilution, temperatureC: meta.temps[i], ei, developStops: stopsFrom(meta.box, ei), minutes, source: meta.source, url: meta.url, agitation: meta.agitation, ...(note ? { note } : {}) }],
    ),
  );
}

const KODAK_SHORT = "Kodak: development times shorter than 5 minutes may produce unsatisfactory uniformity.";

export const DATASHEET_TIMES: DatasheetTime[] = [
  ...expand("trix400", KODAK_TRIX, TRIX_ROWS).map((t) => (t.minutes < 5 ? { ...t, note: KODAK_SHORT } : t)),
  // Kodak (p. 4): "You can underexpose by one stop and use normal processing times."
  ...expand(
    "trix400",
    KODAK_TRIX,
    TRIX_ROWS.filter((r) => r[2] === 400).map(([d, dil, , times]) => [d, dil, 800, times] as Row),
    "Kodak: at one stop under (EI 800) use normal processing times.",
  ),
  ...expand("hp5", ILFORD_HP5, HP5_ROWS),
  ...expand("delta3200", { ...ILFORD_DELTA3200, temps: [20] }, D3200_20.flatMap(([d, dil, times]) => D3200_EIS.map((ei, i) => [d, dil, ei, [times[i]]] as Row))),
  ...expand("delta3200", { ...ILFORD_DELTA3200, temps: [24] }, D3200_24.flatMap(([d, dil, times]) => D3200_EIS.map((ei, i) => [d, dil, ei, [times[i]]] as Row))),
];

/** A datasheet time for this exact film, developer, dilution, temperature and push, or null — never an estimate. */
export function datasheetTime(filmId: string, developer: string, dilution: string, temperatureC: number, developStops: number, table: DatasheetTime[] = DATASHEET_TIMES): DatasheetTime | null {
  return table.find((t) => t.filmId === filmId && t.developer === developer && t.dilution === dilution && t.temperatureC === temperatureC && t.developStops === developStops) ?? null;
}

/** The choices the datasheets offer for a film (developers, their dilutions, temperatures). */
export function datasheetOptions(filmId: string) {
  const rows = DATASHEET_TIMES.filter((t) => t.filmId === filmId);
  const developers = [...new Set(rows.map((t) => t.developer))];
  const dilutions = (dev: string) => [...new Set(rows.filter((t) => t.developer === dev).map((t) => t.dilution))];
  const temps = (dev: string, dil: string) => [...new Set(rows.filter((t) => t.developer === dev && t.dilution === dil).map((t) => t.temperatureC))].sort((a, b) => a - b);
  return { developers, dilutions, temps };
}
