import { apertureStops, type Lens } from "../data/gear";

/** The lens's click-stops as a radio row; writes through the app's aperture setter so every panel shares one f-number. */
export default function ApertureStops({ lens, fNumber, onAperture, label }: { lens: Lens; fNumber: number; onAperture: (n: number) => void; label: string }) {
  return (
    <div className="field">
      <span>Aperture</span>
      <div className="dial" role="radiogroup" aria-label={label}>
        {apertureStops(lens).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={n === fNumber} className={n === fNumber ? "dial-step dial-on" : "dial-step"} onClick={() => onAperture(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
