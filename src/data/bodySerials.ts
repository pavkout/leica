// Leica camera body serial numbers, 1954–1965, and the M5.
//
// Provenance
// - 700,001–1,110,500: the Leitz serial-number list "Ausgabe März 1965"
//   (issue of March 1965), as scanned and published by Heinz Richter
//   (read 2026-09-29):
//     https://gmpphoto.blogspot.com/2023/01/leica-camera-serial-numbers-and.html
//   Transcribed from a poor photocopy. Where a row's first digits are
//   illegible, the start is taken as the previous row's end + 1 (the list is
//   otherwise contiguous); where a printed number is an obvious slip (e.g.
//   1 199 800 between 1 098 301 and 1 099 801) the contiguous value is used.
//   Rows the copy cuts off are left out, so those numbers read as unknown.
//   Cross-checked against independent facts: the M3 starts at 700,001 and
//   single-stroke M3s start at 919,251 (Wikipedia, Leica M3); the M2 starts at
//   926,001.
// - The M5 block and its third-lug change: Wikipedia, Leica M5.
//
// Variants, as the list abbreviates them: ELC = made by Ernst Leitz Canada;
// schw. l. / lack. = black lacquered (black paint); Vorl. / VW = with
// self-timer (Vorlaufwerk); oliv. = olive; luftw. gr. = Air Force grey;
// Postkam. = special camera for the German Post Office.

export interface BodyBlock {
  from: number;
  to: number;
  /** The model as the list names it. */
  model: string;
  variant?: string;
  /** Year as printed; "1957/58" style spans kept. */
  year: string;
  /** Catalogue body id when the simulator knows the model. */
  bodyId?: string;
}

export const BODY_SERIAL_SOURCES = [
  { label: "Leitz serial-number list, March 1965 issue (scan by Heinz Richter)", url: "https://gmpphoto.blogspot.com/2023/01/leica-camera-serial-numbers-and.html" },
  { label: "Wikipedia: Leica M3 (single-stroke from 919,251)", url: "https://en.wikipedia.org/wiki/Leica_M3" },
  { label: "Wikipedia: Leica M5", url: "https://en.wikipedia.org/wiki/Leica_M5" },
  { label: "Wikipedia: Leica M2", url: "https://en.wikipedia.org/wiki/Leica_M2" },
  { label: "Wikipedia: Leica M1", url: "https://en.wikipedia.org/wiki/Leica_M1" },
];

const V = {
  elc: "made by Ernst Leitz Canada",
  black: "black paint",
  timer: "with self-timer",
  olive: "olive",
  grey: "Air Force grey",
};

type Row = [number, number, string, string, string?];

/** [from, to, model, year, variant] as the list prints them. */
const ROWS: Row[] = [
  [700001, 710000, "M3", "1954"],
  [710001, 713000, "IIf", "1954"],
  [713001, 730000, "IIIf", "1954"],
  [730001, 750000, "M3", "1954/55"],
  [750001, 759700, "M3", "1955"],
  [759701, 760000, "M3", "1955", V.elc],
  [760001, 762000, "If", "1955"],
  [762001, 765000, "IIf", "1955"],
  [765001, 773000, "IIIf", "1955"],
  [773001, 774000, "IIIf", "1955", V.elc],
  [774001, 775000, "IIIf", "1955"],
  [775001, 778000, "M3", "1955"],
  [778001, 780100, "M3", "1955", V.elc],
  [780101, 787000, "M3", "1955"],
  [787001, 789000, "IIf", "1955"],
  [789001, 790000, "If", "1955"],
  [790001, 793000, "IIIf", "1955/56"],
  [793001, 799999, "IIf", "1956"],
  [800000, 805000, "M3", "1955"],
  [805001, 805100, "M3", "1955", V.elc],
  [805101, 807500, "M3", "1955"],
  [807501, 808500, "If", "1956"],
  [808501, 810000, "IIf", "1956"],
  [810001, 815000, "IIIf", "1956"],
  [815001, 816000, "If", "1955"],
  [816001, 816900, "M3", "1956"],
  [816901, 817000, "M3", "1956", V.elc],
  [817001, 820500, "M3", "1956"],
  [820501, 822000, "IIf", "1956"],
  [822001, 823000, "If and IIIf", "1956", V.black],
  [823001, 823500, "IIIf", "1956"],
  [823501, 823867, "IIIf", "1956", V.elc],
  [823868, 825000, "IIIf", "1956"],
  [825001, 829750, "IIIg", "1957"],
  [829751, 829850, "IIIf", "1957", V.elc],
  [829851, 830000, "M3", "1957", V.elc],
  [830001, 837500, "M3", "1957"],
  [837501, 837620, "M3", "1957", V.elc],
  [837621, 837720, "IIIf", "1957", V.elc],
  [837721, 839620, "M3", "1957"],
  [839621, 839700, "M3", "1957", V.elc],
  [839701, 840500, "M3", "1957"],
  [840501, 840820, "M3", "1956", V.elc],
  [840821, 844700, "M3", "1956"],
  [844701, 845000, "M3", "1956", V.elc],
  [845001, 845380, "IIIg", "1956", V.elc],
  [845381, 850900, "IIIg", "1956"],
  [850901, 851000, "If", "1957"],
  [851001, 858000, "M3", "1957"],
  [858001, 861600, "IIIg", "1957"],
  [861601, 862000, "IIIg", "1957", V.elc],
  [862001, 866620, "M3", "1957"],
  [866621, 867000, "M3", "1957", V.elc],
  [867001, 871200, "IIIg", "1957"],
  [871201, 872000, "IIIg", "1957", V.elc],
  [872001, 882000, "IIIg", "1957"],
  [882001, 886700, "M3", "1957"],
  [886701, 887000, "M3", "1957", V.elc],
  [887001, 888000, "Ig", "1957"],
  [888001, 893000, "IIIg", "1957"],
  [893001, 894000, "M3", "1957"],
  [894001, 894570, "M3", "1957", V.elc],
  [894571, 903000, "M3", "1957"],
  [903001, 903300, "M3", "1957", V.elc],
  [903301, 907000, "IIIg", "1957"],
  [907001, 910000, "Ig", "1957"],
  [910001, 910500, "M3", "1957/58"],
  [910501, 910600, "M3", "1957/58", V.olive],
  [910601, 916000, "M3", "1957"],
  [916001, 924400, "M3", "1958"],
  [924401, 924500, "M3", "1958", V.elc],
  [924501, 926000, "Ig", "1958"],
  [926001, 926200, "M2", "1957"],
  [926201, 926700, "Ig", "1958"],
  [926701, 928922, "M3", "1959"],
  [928923, 929000, "Post Office camera", "1958"],
  [929001, 933000, "M2", "1958"],
  [933001, 934000, "IIIg", "1958"],
  [934001, 934200, "IIIg", "1958", V.elc],
  [934201, 935000, "IIIg", "1958"],
  [935001, 937620, "M2", "1958"],
  [937621, 937650, "M2", "1958", V.elc],
  [937651, 942900, "M2", "1958"],
  [942901, 943000, "M2", "1958", V.elc],
  [943001, 944000, "IIIg", "1958"],
  [944001, 946300, "M2", "1958"],
  [946301, 946400, "M2", "1958", V.elc],
  [946401, 946900, "M2", "1958"],
  [946901, 947000, "M2", "1958", V.elc],
  [947001, 948000, "M2", "1958"],
  [948001, 948500, "IIIg", "1958"],
  [948501, 948600, "M2", "1958", V.elc],
  [948601, 949100, "M2", "1958", V.black],
  [949101, 949400, "M2", "1958", V.timer],
  [949401, 950000, "M2", "1959"],
  [950001, 950300, "M1", "1959"],
  [950301, 951900, "M3", "1959"],
  [951901, 952000, "M3", "1959", V.elc],
  [952001, 952015, "M2", "1959"],
  [952016, 952500, "M1", "1959"],
  [952501, 954800, "M3", "1959"],
  [954801, 955000, "M3", "1959", V.elc],
  [955001, 956500, "IIIg", "1959"],
  [956501, 957000, "M1", "1959"],
  [957001, 959400, "M3", "1959"],
  [959401, 959500, "M3", "1959", V.black],
  [959501, 960200, "M2", "1959", V.timer],
  [960501, 961500, "M2", "1959"],
  [961501, 961700, "M3", "1959", V.elc],
  [961701, 966500, "M3", "1959"],
  [966501, 967500, "M1", "1959"],
  [967501, 968350, "M2", "1959"],
  [968351, 968500, "M3", "1959", V.elc],
  [968501, 970000, "IIIg", "1959"],
  [970001, 971500, "M2", "1959"],
  [971501, 972000, "IIIg", "1959"],
  [972001, 974700, "M3", "1959"],
  [974701, 975000, "M3", "1959", V.elc],
  [975001, 975800, "M2", "1959"],
  [975801, 976100, "M2", "1960", V.timer],
  [976101, 976500, "M2", "1959"],
  [976501, 979500, "M3", "1959"],
  [979501, 980450, "M1", "1959"],
  [980451, 980500, "M1", "1960", V.olive],
  [980501, 982000, "IIIg", "1959"],
  [982001, 982150, "M2", "1960", V.timer],
  [982151, 982900, "M2", "1959"],
  [982901, 983500, "M2", "1959", V.timer],
  [983501, 984000, "M2", "1959"],
  [984001, 984200, "M3", "1959", V.elc],
  [984201, 987000, "M3", "1959"],
  [987001, 987200, "M3", "1960", V.elc],
  [987201, 987300, "M2", "1960", V.elc],
  [987301, 987600, "Ig", "1960"],
  [987601, 987900, "IIIg", "1960"],
  [987901, 988025, "IIIg", "1960", V.black],
  [988026, 988350, "IIIg", "1960"],
  [988351, 988650, "M2", "1960"],
  [988651, 989650, "M2", "1960", V.timer],
  [989651, 989800, "M2", "1960"],
  [989801, 990500, "M2", "1960", V.timer],
  [990501, 990750, "M2", "1960", V.black],
  [990751, 993500, "M3", "1960"],
  [993501, 993750, "M3", "1960", V.black],
  [993751, 995000, "M2", "1960"],
  [995001, 995100, "M2", "1960", V.elc],
  [995101, 995400, "M2", "1960", V.timer],
  [995401, 996000, "M2", "1960"],
  [996001, 998000, "M3", "1960"],
  [998001, 998300, "M3", "1960", V.elc],
  [998301, 1003700, "M3", "1960"],
  [1003701, 1004000, "M3", "1960", V.elc],
  [1004001, 1005350, "M2", "1960", V.timer],
  [1005351, 1005450, "M2", "1960", V.elc],
  [1005451, 1005750, "M2", "1960"],
  [1005751, 1005770, "M2", "1960", V.grey],
  [1005771, 1007000, "M2", "1960"],
  [1007001, 1011000, "M3", "1960"],
  [1011001, 1014000, "M2", "1960"],
  [1014001, 1014300, "M3", "1960", V.elc],
  [1014301, 1017000, "M3", "1960"],
  [1017001, 1017500, "M1", "1961"],
  [1017501, 1017900, "M2", "1961"],
  [1017901, 1018000, "M2", "1961", V.elc],
  [1018001, 1020100, "M2", "1961"],
  [1020101, 1020200, "M2", "1961", V.elc],
  [1020201, 1022000, "M2", "1961"],
  [1022001, 1022700, "M3", "1961"],
  [1022701, 1023000, "M3", "1961", V.elc],
  [1023001, 1027800, "M3", "1961"],
  [1027801, 1028000, "M3", "1961", V.elc],
  [1028001, 1028600, "M1", "1961"],
  [1028601, 1031800, "M2", "1961"],
  [1031801, 1032000, "M2", "1961", V.black],
  [1032001, 1035400, "M3", "1961"],
  [1035401, 1035925, "M1", "1961"],
  [1035926, 1036000, "M1", "1961", V.olive],
  [1036001, 1036050, "M2", "1961", V.elc],
  [1036051, 1036350, "M3", "1961", V.elc],
  [1036351, 1037950, "M2", "1961"],
  [1037951, 1038000, "M2", "1962", V.elc],
  [1038001, 1038800, "M3", "1961"],
  [1038801, 1039000, "M3", "1961", V.black],
  [1039001, 1040000, "M3", "1961"],
  [1040001, 1040066, "M1", "1962"],
  [1040067, 1040068, "M3", "1962"],
  [1040072, 1040094, "M1", "1961"],
  [1040095, 1040096, "M3", "1962"],
  [1040097, 1040600, "M1", "1961"],
  [1040601, 1043000, "M3", "1961"],
  [1043001, 1043800, "M2", "1962"],
  [1043801, 1044000, "M2", "1962", V.black],
  [1044001, 1046000, "M3", "1962", V.black],
  [1046001, 1046500, "M1", "1962"],
  [1046501, 1047800, "M3", "1962"],
  [1047801, 1048000, "M3", "1962", V.elc],
  [1048001, 1050000, "M2", "1962"],
  [1050001, 1050500, "M1", "1962"],
  [1050501, 1053100, "M2", "1962"],
  [1053101, 1053250, "M2", "1962", V.black],
  [1053251, 1054900, "M2", "1962"],
  [1054901, 1055000, "M2", "1962", V.elc],
  [1055001, 1059849, "M3", "1962"],
  [1059850, 1059999, "M3", "1962", V.black],
  [1060000, 1060000, "M3", "1962"],
  [1060001, 1060500, "M1", "1962"],
  [1060501, 1061700, "M2", "1962"],
  [1061701, 1061800, "M2", "1962", V.elc],
  [1061801, 1063000, "M2", "1962"],
  [1063001, 1065000, "M3", "1962"],
  [1065001, 1065200, "M3", "1962", V.elc],
  [1065201, 1067500, "M3", "1962"],
  [1067501, 1067870, "M1", "1963"],
  [1067871, 1068000, "Post Office camera", "1963"],
  [1068001, 1070000, "M2", "1963"],
  [1070001, 1074000, "M3", "1963"],
  [1074001, 1074500, "M1", "1963"],
  [1074501, 1077000, "M2", "1963"],
  [1077001, 1080000, "M3", "1963"],
  [1080001, 1085000, "Leicaflex", "1964/65"],
  [1085001, 1085500, "M1", "1963"],
  [1085501, 1088000, "M2", "1963"],
  [1088001, 1091000, "M3", "1963"],
  [1091001, 1091300, "M1", "1964"],
  [1091301, 1093500, "M2", "1964"],
  [1093801, 1097700, "M3", "1964"],
  [1097701, 1097850, "M3", "1964", V.black],
  [1097851, 1098000, "M3", "1964", V.elc],
  [1098001, 1098100, "M1", "1964"],
  [1098101, 1098185, "M1", "1964", V.olive],
  [1098186, 1098300, "M1", "1964"],
  [1098301, 1099800, "M2", "1964"],
  [1099801, 1099900, "M2", "1964", V.elc],
  [1099901, 1100000, "M2", "1964"],
  [1100001, 1102000, "M3", "1964"],
  [1102001, 1102500, "M1", "1964"],
  [1102501, 1102800, "MD", "1964"],
  [1102801, 1103000, "M1", "1964"],
  [1103001, 1104900, "M2", "1964"],
  [1104901, 1105000, "M2", "1965", V.elc],
  [1105001, 1106900, "M3", "1965"],
  [1106901, 1107000, "M3", "1965", V.elc],
  [1107001, 1109000, "M2", "1965"],
  [1109001, 1110500, "M3", "1965"],
];

/** Catalogue ids for models the simulator has. */
const CATALOGUE: Record<string, string> = { M3: "m3" };

export const BODY_SERIALS: BodyBlock[] = [
  ...ROWS.map(([from, to, model, year, variant]) => ({ from, to, model, year, variant, bodyId: CATALOGUE[model] })),
  // Wikipedia, Leica M5: 1,287,001–1,384,000, 1971–1975; a third strap lug from 1,355,001 (chrome) / 1,357,001 (black chrome).
  { from: 1287001, to: 1384000, model: "M5", year: "1971–1975" },
];

/** Single-stroke film advance on the M3 from this number (Wikipedia, Leica M3). */
export const M3_SINGLE_STROKE_FROM = 919251;

export const BODY_LIST_RANGE = { from: 700001, to: 1110500 };

export function bodyBlock(serial: number, blocks: BodyBlock[] = BODY_SERIALS): BodyBlock | null {
  return blocks.find((b) => serial >= b.from && serial <= b.to) ?? null;
}

/** Extra facts for a body by its serial, beyond the list's row. */
export function bodyNotes(serial: number, b: BodyBlock): string[] {
  const notes: string[] = [];
  if (b.model === "M3") notes.push(serial >= M3_SINGLE_STROKE_FROM ? "Single-stroke film advance (from 919,251)." : "Double-stroke film advance (before 919,251).");
  if (b.model === "M5") {
    if (serial >= 1357001) notes.push("Late M5, with the third strap lug added in 1973.");
    else if (serial >= 1355001) notes.push("Third strap lug if it's chrome (from 1,355,001); black chrome bodies got it from 1,357,001.");
    else notes.push("Early M5, with two strap lugs.");
  }
  return notes;
}

/** What each model in the list is, in a line. */
export const MODEL_NOTES: Record<string, string> = {
  M3: "The first M, launched 1954: bayonet mount and a 0.91× rangefinder with 50, 90 and 135 mm frames.",
  M2: "Launched 1957: a simpler, less expensive M with a 0.72× finder and 35, 50 and 90 mm frames.",
  M1: "Launched 1959: an M2 without the rangefinder, for scientific and technical work.",
  MD: "Launched 1964: an M body with no viewfinder at all, for use on microscopes and reproduction stands.",
  M5: "Launched 1971: the first M with through-the-lens metering, larger than any M before it.",
  IIIf: "A screw-mount (Barnack) Leica with a separate rangefinder window and flash synchronisation.",
  IIIg: "The last screw-mount Leica, with a larger finder and bright frame lines.",
  IIf: "A screw-mount Leica without the slow speeds of the IIIf.",
  If: "A screw-mount Leica without a rangefinder.",
  Ig: "A screw-mount Leica without a rangefinder, the last of its line.",
  Leicaflex: "Leica's first single-lens reflex camera.",
  "Post Office camera": "A special camera built for the German Post Office.",
  "If and IIIf": "Screw-mount Leicas, this batch in black paint.",
};
