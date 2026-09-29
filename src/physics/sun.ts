// Where the sun is, and when the light changes. The sun's altitude from the
// NOAA solar-position equations (accurate to a minute or so for dates this
// century), then the day's phases found by stepping through it a minute at a
// time. The phase limits are the photographic conventions:
//   sunrise/sunset   the sun's upper edge on the horizon (−0.833°)
//   golden hour      sun between −4° and +6°
//   blue hour        sun between −6° and −4°

const RAD = Math.PI / 180;

/** Sun altitude above the horizon, degrees, at an instant, for a place. */
export function sunAltitude(date: Date, latDeg: number, lonDeg: number): number {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD)) /
    RAD;
  const minutesUtc = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolar = (((minutesUtc + eqTime + 4 * lonDeg) % 1440) + 1440) % 1440;
  const hourAngle = trueSolar / 4 < 0 ? trueSolar / 4 + 180 : trueSolar / 4 - 180;
  const lat = latDeg * RAD;
  const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) / RAD;
}

export type Phase = "night" | "blue" | "golden" | "day";

export function phaseAt(altitudeDeg: number): Phase {
  if (altitudeDeg < -6) return "night";
  if (altitudeDeg < -4) return "blue";
  if (altitudeDeg < 6) return "golden";
  return "day";
}

export interface Span {
  phase: Phase;
  start: Date;
  end: Date;
}

export interface SunDay {
  /** The day as consecutive phases, covering 24 hours from `from`. */
  spans: Span[];
  sunrise: Date | null;
  sunset: Date | null;
}

/**
 * The phases of the 24 hours from `from` (e.g. local midnight), for a place.
 * A minute's resolution; polar days and nights come out as one long phase and
 * no sunrise or sunset.
 */
export function sunDay(from: Date, latDeg: number, lonDeg: number): SunDay {
  const step = 60_000;
  const spans: Span[] = [];
  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  let prevAlt = sunAltitude(from, latDeg, lonDeg);
  let current: Span = { phase: phaseAt(prevAlt), start: from, end: from };
  for (let i = 1; i <= 1440; i++) {
    const t = new Date(from.getTime() + i * step);
    const alt = sunAltitude(t, latDeg, lonDeg);
    if (prevAlt < -0.833 && alt >= -0.833 && !sunrise) sunrise = t;
    if (prevAlt >= -0.833 && alt < -0.833 && !sunset) sunset = t;
    const phase = phaseAt(alt);
    if (phase !== current.phase) {
      current.end = t;
      spans.push(current);
      current = { phase, start: t, end: t };
    }
    prevAlt = alt;
  }
  current.end = new Date(from.getTime() + 1440 * step);
  spans.push(current);
  return { spans, sunrise, sunset };
}
