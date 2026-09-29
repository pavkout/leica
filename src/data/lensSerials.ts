// Leitz / Leica lens serial numbers by year of manufacture, 1933–2011.
// Lenses only: camera bodies were numbered in their own series.
//
// Provenance (read 2026-09-29; the two agree on every row they share,
// including the published overlap between 1992 and 1993):
// - Leica Rumors, after Leica Camera Blog Russia (1933–1999, 2004–2008)
//   https://leicarumors.com/2011/01/17/how-to-determine-the-production-year-of-a-leica-lens-based-on-the-serial-number.aspx/
// - Camera-wiki, citing Puts and Pont, "Les Chiffres Clés" (2000–2011)
//   https://camera-wiki.org/wiki/Leitz_lens_serial_numbers
// The ranges are kept exactly as published, gaps and overlaps included.

export interface SerialRange {
  from: number;
  to: number;
  year: number;
}

export const LENS_SERIAL_SOURCES = [
  {
    label: "Leica Rumors, after Leica Camera Blog Russia",
    url: "https://leicarumors.com/2011/01/17/how-to-determine-the-production-year-of-a-leica-lens-based-on-the-serial-number.aspx/",
  },
  { label: "Camera-wiki: Leitz lens serial numbers (after Puts; Pont, Les Chiffres Clés)", url: "https://camera-wiki.org/wiki/Leitz_lens_serial_numbers" },
];

const RAW: [number, number, number][] = [
  [156001, 195000, 1933], [195001, 236000, 1934], [236001, 284600, 1935], [284601, 345000, 1936], [345001, 416500, 1937],
  [416501, 490000, 1938], [490001, 538500, 1939], [538501, 565000, 1940], [565001, 582294, 1941], [582295, 593000, 1942],
  [593001, 594880, 1943], [594881, 595000, 1944], [595001, 601000, 1945], [601001, 633000, 1946], [633001, 647000, 1947],
  [647001, 682000, 1948], [682001, 756000, 1949], [756001, 840000, 1950], [840001, 950000, 1951], [950001, 1051000, 1952],
  [1051000, 1124000, 1953], [1124001, 1236000, 1954], [1236001, 1333000, 1955], [1333001, 1459000, 1956], [1459001, 1548000, 1957],
  [1548001, 1645300, 1958], [1645301, 1717000, 1959], [1717001, 1827000, 1960], [1827001, 1913000, 1961], [1913001, 1967100, 1962],
  [1967101, 2015700, 1963], [2015701, 2077500, 1964], [2077501, 2156300, 1965], [2156301, 2236500, 1966], [2236501, 2254400, 1967],
  [2254401, 2312750, 1968], [2312751, 2384700, 1969], [2384701, 2468500, 1970], [2468501, 2503100, 1971], [2503101, 2556500, 1972],
  [2556501, 2663400, 1973], [2663401, 2731900, 1974], [2731901, 2761100, 1975], [2761101, 2809400, 1976], [2809401, 2880600, 1977],
  [2880601, 2967250, 1978], [2967251, 3013650, 1979], [3013651, 3087000, 1980], [3087001, 3160500, 1981], [3160501, 3249100, 1982],
  [3249101, 3294900, 1983], [3294901, 3346200, 1984], [3346201, 3383200, 1985], [3383201, 3422890, 1986], [3422891, 3455870, 1987],
  [3455871, 3478900, 1988], [3478901, 3503150, 1989], [3503151, 3540467, 1990], [3540468, 3583830, 1991], [3585831, 3610680, 1992],
  [3610381, 3644475, 1993], [3644476, 3677030, 1994], [3677031, 3730290, 1995], [3730291, 3770920, 1996], [3770930, 3818624, 1997],
  [3818625, 3857849, 1998], [3857850, 3882996, 1999], [3882997, 3912247, 2000], [3912248, 3941497, 2001], [3941498, 3970748, 2002],
  [3970748, 3999999, 2003], [4000000, 4010600, 2004], [4010601, 4025900, 2005], [4025901, 4034900, 2006], [4034901, 4057000, 2007],
  [4057001, 4080000, 2008], [4080001, 4100000, 2009], [4100001, 4115000, 2010], [4115001, 4130000, 2011],
];

export const LENS_SERIALS: SerialRange[] = RAW.map(([from, to, year]) => ({ from, to, year }));

export type SerialAnswer =
  | { kind: "years"; ranges: SerialRange[] }
  | { kind: "gap"; before: SerialRange; after: SerialRange }
  | { kind: "before" }
  | { kind: "after"; last: SerialRange }
  | { kind: "invalid" };

/** Reads what a person types: digits with spaces, dots or commas, an optional "No." in front. */
export function parseSerial(text: string): number | null {
  const digits = text.replace(/^\s*(no\.?|nr\.?|#)\s*/i, "").replace(/[\s.,’']/g, "");
  return /^\d{4,8}$/.test(digits) ? Number(digits) : null;
}

/** The year(s) a lens serial falls in; several when published ranges overlap. */
export function lensYear(serial: number, table: SerialRange[] = LENS_SERIALS): SerialAnswer {
  if (!Number.isFinite(serial) || serial <= 0) return { kind: "invalid" };
  const hits = table.filter((r) => serial >= r.from && serial <= r.to);
  if (hits.length) return { kind: "years", ranges: hits };
  if (serial < table[0].from) return { kind: "before" };
  const last = table[table.length - 1];
  if (serial > last.to) return { kind: "after", last };
  const before = [...table].reverse().find((r) => r.to < serial)!;
  const after = table.find((r) => r.from > serial)!;
  return { kind: "gap", before, after };
}
