// Pure mappings behind the camera controls (feature #37).

/** Focus ring position: 0 at the closest distance, 1 at infinity, linear in 1/distance (like a real throw). */
export function focusToRing(mm: number, minMm: number): number {
  if (!Number.isFinite(mm)) return 1;
  return Math.min(1, Math.max(0, 1 - minMm / mm));
}

export function ringToFocus(t: number, minMm: number): number {
  if (t >= 0.995) return Infinity;
  return minMm / (1 - Math.max(0, t));
}

/** Exposure compensation in thirds of a stop, −3 … +3. */
export const EV_STEPS = Array.from({ length: 19 }, (_, i) => Math.round(((i - 9) / 3) * 1000) / 1000);

/** "+1⅓", "−⅔", "±0". */
export function evLabel(ev: number): string {
  if (Math.abs(ev) < 1e-6) return "±0";
  const sign = ev > 0 ? "+" : "−";
  const a = Math.abs(ev);
  const whole = Math.floor(a + 1e-6);
  const third = Math.round((a - whole) * 3);
  const frac = third === 1 ? "⅓" : third === 2 ? "⅔" : "";
  return `${sign}${whole || !frac ? whole : ""}${frac}`;
}
