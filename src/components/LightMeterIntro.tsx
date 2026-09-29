import { lensEngraving } from "../utils/format";

interface Props {
  /** The film or sensor speed, shown in the meter's ASA window. */
  iso: number;
  bodyName: string;
  lensName: string;
  /** Film name, or "ISO n" on a digital body. */
  filmLabel: string;
  available: boolean;
  onOpen: () => void;
}

/**
 * A clip-on meter in the manner of the classic rangefinder meters: a black
 * body with a rounded end, a calculator dial (shutter speeds round a disc of
 * apertures, the film speed in its window), the needle window with its zebra
 * scale, a rubber button and a knurled wheel. Drawn, no maker's marks.
 */
function MeterDial({ iso }: { iso: number }) {
  const C = { x: 150, y: 120 };
  const speeds = ["1000", "500", "250", "125", "60", "30", "15", "8", "4", "2", "1", "B", "2", "4", "8"];
  const apertures = ["16", "11", "8", "5.6", "4", "2.8", "2", "1.4"];
  const at = (deg: number, r: number) => [C.x + r * Math.cos((deg * Math.PI) / 180), C.y + r * Math.sin((deg * Math.PI) / 180)] as const;
  return (
    <svg viewBox="0 0 480 240" className="lm-dial" aria-hidden="true">
      <defs>
        <linearGradient id="lm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a29" />
          <stop offset="0.5" stopColor="#141414" />
          <stop offset="1" stopColor="#0b0b0b" />
        </linearGradient>
        <radialGradient id="lm-disc" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#1e1e1e" />
          <stop offset="1" stopColor="#0a0a0a" />
        </radialGradient>
        <radialGradient id="lm-hub" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f2f2f0" />
          <stop offset="1" stopColor="#8a8a86" />
        </radialGradient>
        <clipPath id="lm-window">
          <path d="M268 42 Q300 34 332 42 L322 198 Q300 204 278 198 Z" />
        </clipPath>
      </defs>

      {/* Body: a rounded end over the dial, square shoulders on the right. */}
      <path d="M120 16 H448 Q468 16 468 36 V204 Q468 224 448 224 H120 A104 104 0 0 1 120 16 Z" fill="url(#lm-body)" stroke="#3a3a38" />

      {/* Shutter speeds engraved on the body round the dial; the red dot marks 1/60. */}
      {speeds.map((t, i) => {
        const deg = -98 - i * 14.5;
        const [x, y] = at(deg, 90);
        return (
          <text key={i} x={x} y={y} className="lm-speed" textAnchor="middle" dominantBaseline="central" transform={`rotate(${deg} ${x} ${y})`}>
            {t}
          </text>
        );
      })}
      {(() => {
        const [x, y] = at(-98 - 4 * 14.5 + 7, 90);
        return <circle cx={x} cy={y} r={3} className="lm-reddot" />;
      })()}
      <path d={`M${at(-90, 104)[0] - 6} ${at(-90, 104)[1] - 8} l12 0 l-6 9 z`} className="lm-index" />

      {/* The calculator disc: apertures round its edge, red over white, the film speed in its window. */}
      <circle cx={C.x} cy={C.y} r={76} fill="url(#lm-disc)" stroke="#2f2f2d" />
      {[...apertures, ...apertures].map((n, i) => {
        const deg = -80 + i * 10.7;
        const [x, y] = at(deg, 60);
        return (
          <text key={i} x={x} y={y} className={i < 8 ? "lm-ap lm-ap-red" : "lm-ap"} textAnchor="middle" dominantBaseline="central" transform={`rotate(${deg} ${x} ${y})`}>
            {n}
          </text>
        );
      })}
      <text x={C.x - 22} y={C.y - 26} className="lm-asa">
        ◀ ASA ▶
      </text>
      <rect x={C.x - 30} y={C.y + 20} width={44} height={20} rx={2} className="lm-asa-window" />
      <text x={C.x - 8} y={C.y + 34} className="lm-asa-value" textAnchor="middle">
        {iso}
      </text>
      <text x={C.x - 40} y={C.y + 4} className="lm-din" transform={`rotate(-90 ${C.x - 40} ${C.y + 4})`}>
        DIN
      </text>
      <circle cx={C.x} cy={C.y} r={17} fill="url(#lm-hub)" stroke="#6a6a66" />
      <circle cx={C.x - 5} cy={C.y} r={2.6} fill="#2a2a28" />
      <circle cx={C.x + 5} cy={C.y} r={2.6} fill="#2a2a28" />

      {/* The needle window: a zebra scale behind glass, the needle swinging over it. */}
      <path d="M264 38 Q300 29 336 38 L326 202 Q300 209 274 202 Z" fill="#0a0a0a" stroke="#8a8a86" strokeWidth={2.5} />
      <g clipPath="url(#lm-window)">
        <rect x="260" y="30" width="80" height="180" fill="#ecebe6" />
        {Array.from({ length: 10 }, (_, i) => {
          const y = 20 + i * 26;
          return <path key={i} d={`M250 ${y} L350 ${y - 36} L350 ${y - 24} L250 ${y + 12} Z`} fill="#141414" />;
        })}
        <line x1="300" y1="228" x2="300" y2="40" className="lm-needle" />
        <path d="M268 42 Q300 34 332 42 L322 198 Q300 204 278 198 Z" className="lm-glass" />
      </g>
      <circle cx={300} cy={120} r={3} fill="#ecebe6" opacity={0.9} />

      {/* Right shoulder: the arrow, the rubber button, the red dot and the knurled wheel. */}
      <path d="M362 70 h38 M362 70 l9 -6 M362 70 l9 6" className="lm-arrow" />
      <rect x="408" y="44" width="46" height="66" rx="9" className="lm-button" />
      <circle cx="402" cy="146" r="4" className="lm-reddot" />
      <g transform="translate(424 176)">
        <circle r="26" className="lm-wheel" />
        {Array.from({ length: 36 }, (_, i) => (
          <line key={i} x1={0} y1={-26} x2={0} y2={-21} className="lm-knurl" transform={`rotate(${i * 10})`} />
        ))}
        <path d="M-5 -7 L7 0 L-5 7 Z" fill="#ecebe6" />
      </g>
      <circle cx="372" cy="176" r="4" fill="#ecebe6" />
    </svg>
  );
}

const FEATURES = [
  { title: "Meter a spot", text: "Tap anything in the picture to read just that part of the scene." },
  { title: "Place the tones", text: "Choose a highlight or a shadow and expose to keep its detail." },
  { title: "Read the settings", text: "Every equivalent aperture and speed, plus the zone-focus distance." },
];

/**
 * The Light meter's entrance: what it's for, drawn as a meter's dial, the kit
 * it meters for, and one way in.
 */
export default function LightMeterIntro({ iso, bodyName, lensName, filmLabel, available, onOpen }: Props) {
  return (
    <section className="panel stage-live" aria-label="Light meter">
      <div className="lm-hero">
        <MeterDial iso={iso} />
        <div className="lm-copy">
          <p className="lm-lede">A handheld meter for the camera in your hands.</p>
          <p className="lm-kit">
            <span>{bodyName}</span>
            <span>{lensEngraving(lensName)}</span>
            <span>{filmLabel}</span>
          </p>
          {available ? (
            <button type="button" className="btn btn-red live-open" onClick={onOpen}>
              Open the light meter
            </button>
          ) : (
            <p className="muted">The light meter isn&apos;t available in this build.</p>
          )}
          <p className="muted small">It uses your phone&apos;s camera only while it&apos;s open. Nothing leaves your device.</p>
        </div>
      </div>

      <ol className="lm-features">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <h3>{f.title}</h3>
            <p className="muted">{f.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
