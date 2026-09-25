import { useId } from "react";
import type { Lens } from "../../data/gear";

// Product-style side view of a lens, drawn from its approximate size and
// finish: mount on the left, front element (seen in slight perspective) on the right.

const FINISH = {
  black: { dark: "#0b0b0c", mid: "#2a2a2d", light: "#5d5d62", edge: "#000", text: "#e9e9e9", rib: "#1a1a1c" },
  silver: { dark: "#6f7074", mid: "#c9cacd", light: "#f7f7f8", edge: "#4a4a4d", text: "#1a1a1a", rib: "#9fa0a3" },
};

export default function LensArt({ lens, className }: { lens: Lens; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const { lengthMm, diameterMm, finish, hood, tab } = lens.look;
  const c = FINISH[finish];

  // Layout in millimetres, framed around this lens at 3:2 (with a floor so
  // pancake lenses don't fill the card).
  const d = diameterMm;
  const W = Math.max(lengthMm + 42, (d * 1.1 + 24) * 1.5, 96);
  const H = W / 1.5;
  const cy = H / 2 - 2;
  const x0 = (W - lengthMm - 16) / 2 + 4;
  const mountLen = 5;
  const mountD = Math.min(d, 50) * 0.92;
  const faceRx = d * 0.16;

  // Sections from the mount forward: fixed DoF ring, focus ring, aperture ring, front barrel.
  const body = lengthMm - mountLen;
  const scaleLen = body * 0.1;
  const focusLen = body * 0.36;
  const apLen = body * 0.14;
  const xs = x0 + mountLen;
  const xf = xs + scaleLen;
  const xa = xf + focusLen;
  const xb = xa + apLen;
  const xEnd = x0 + lengthMm;
  const hoodD = hood === "clip" ? d * 1.08 : hood === "builtin" ? d * 1.02 : d;

  const g = (name: string) => `${name}-${uid}`;
  const shaded = `url(#${g("cyl")})`;

  const ribs: number[] = [];
  for (let x = xf + 1.2; x < xa - 0.8; x += 1.6) ribs.push(x);
  const apRibs: number[] = [];
  for (let x = xa + 1; x < xb - 1; x += 2.4) apRibs.push(x);

  const focal = lens.focalMm;
  const aperture = lens.maxAperture < 1 ? lens.maxAperture.toFixed(2) : String(lens.maxAperture);

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Illustration of the ${lens.name}`}>
      <defs>
        <linearGradient id={g("cyl")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.dark} />
          <stop offset="0.18" stopColor={c.light} />
          <stop offset="0.32" stopColor={c.mid} />
          <stop offset="0.75" stopColor={c.dark} />
          <stop offset="1" stopColor={c.edge} />
        </linearGradient>
        <linearGradient id={g("chrome")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b5c60" />
          <stop offset="0.2" stopColor="#fafafa" />
          <stop offset="0.45" stopColor="#a9aaad" />
          <stop offset="0.8" stopColor="#505155" />
          <stop offset="1" stopColor="#2b2b2e" />
        </linearGradient>
        <radialGradient id={g("glass")} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#6c5bd6" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#1d2a4f" />
          <stop offset="0.7" stopColor="#0a0c14" />
          <stop offset="0.9" stopColor="#2f6b4f" stopOpacity="0.8" />
          <stop offset="1" stopColor="#07080b" />
        </radialGradient>
        <radialGradient id={g("shadow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx={x0 + lengthMm / 2} cy={cy + hoodD / 2 + 6} rx={lengthMm / 2 + 10} ry={4} fill={`url(#${g("shadow")})`} />

      {/* Bayonet mount, with the red lens-change index */}
      <rect x={x0} y={cy - mountD / 2} width={mountLen} height={mountD} fill={`url(#${g("chrome")})`} rx={0.6} />
      <circle cx={x0 + mountLen - 1.6} cy={cy - mountD / 2 + 3} r={0.9} fill="#cf2e25" />

      {/* Fixed ring with the depth-of-field scale */}
      <rect x={xs} y={cy - d / 2} width={scaleLen} height={d} fill={shaded} />
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <line key={i} x1={xs + scaleLen / 2 + i * 1.1} x2={xs + scaleLen / 2 + i * 1.1} y1={cy - d / 2 + 2} y2={cy - d / 2 + (i === 0 ? 5 : 3.4)} stroke={i === 0 ? "#cf2e25" : c.text} strokeWidth={0.35} />
      ))}

      {/* Focus ring: fine ribs, distance scale, optional finger tab */}
      <rect x={xf} y={cy - d / 2} width={focusLen} height={d} fill={shaded} />
      {ribs.map((x) => (
        <line key={x} x1={x} x2={x} y1={cy - d / 2 + d * 0.3} y2={cy + d / 2 - 1} stroke={c.rib} strokeWidth={0.55} opacity={0.8} />
      ))}
      <text x={xf + focusLen / 2} y={cy - d / 2 + d * 0.2} fontSize={2.6} fill={c.text} textAnchor="middle" fontFamily="Outfit, Helvetica, sans-serif" letterSpacing="0.6">
        0.7  1  1.5  2  3  5  ∞
      </text>
      {tab && (
        <path d={`M${xf + focusLen * 0.35},${cy + d / 2} q${focusLen * 0.15},9 ${focusLen * 0.3},0 Z`} fill={shaded} stroke={c.edge} strokeWidth={0.3} />
      )}

      {/* Aperture ring */}
      <rect x={xa} y={cy - d / 2 - 0.4} width={apLen} height={d + 0.8} fill={shaded} />
      {apRibs.map((x) => (
        <rect key={x} x={x} y={cy - d / 2 - 0.4} width={1.1} height={d + 0.8} fill={c.rib} opacity={0.55} />
      ))}
      <text x={xa + apLen / 2} y={cy - d / 2 + 3.8} fontSize={2.8} fill={c.text} textAnchor="middle" fontFamily="Outfit, Helvetica, sans-serif">
        {aperture}
      </text>

      {/* Front barrel with engraving */}
      <rect x={xb} y={cy - d / 2} width={xEnd - xb} height={d} fill={shaded} />
      <text x={(xb + xEnd) / 2} y={cy - d / 2 + 4.2} fontSize={2.4} fill={c.text} textAnchor="middle" fontFamily="Outfit, Helvetica, sans-serif" letterSpacing="0.3">
        {`1:${aperture}/${focal}`}
      </text>

      {/* Hood */}
      {hood === "clip" && (
        <path d={`M${xEnd - 8},${cy - d / 2} L${xEnd + 2},${cy - hoodD / 2} L${xEnd + 2},${cy + hoodD / 2} L${xEnd - 8},${cy + d / 2} Z`} fill={shaded} />
      )}
      {hood === "screw" && (
        <>
          <rect x={xEnd - 1} y={cy - d / 2} width={9} height={d} fill={shaded} />
          <rect x={xEnd + 1.5} y={cy - d / 2 + d * 0.18} width={4} height={d * 0.16} rx={1} fill="#050505" />
          <rect x={xEnd + 1.5} y={cy + d / 2 - d * 0.34} width={4} height={d * 0.16} rx={1} fill="#050505" />
        </>
      )}
      {hood === "builtin" && <rect x={xEnd - 6} y={cy - hoodD / 2} width={6} height={hoodD} fill={shaded} />}

      {/* Front element in perspective */}
      {(() => {
        const fx = hood === "screw" ? xEnd + 8 : hood === "clip" ? xEnd + 2 : xEnd;
        const ry = (hood === "screw" ? d : hoodD) / 2;
        return (
          <g>
            <ellipse cx={fx} cy={cy} rx={faceRx} ry={ry} fill={c.edge} />
            <ellipse cx={fx} cy={cy} rx={faceRx * 0.86} ry={ry * 0.86} fill="#050506" />
            <ellipse cx={fx - faceRx * 0.1} cy={cy} rx={faceRx * 0.6} ry={ry * 0.62} fill={`url(#${g("glass")})`} />
            <ellipse cx={fx - faceRx * 0.3} cy={cy - ry * 0.25} rx={faceRx * 0.12} ry={ry * 0.14} fill="#fff" opacity={0.35} />
          </g>
        );
      })()}
    </svg>
  );
}
