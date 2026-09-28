import { useId } from "react";
import type { Body, Lens } from "../../data/gear";

// Product-style front view of a camera body, optionally with a lens mounted
// (seen head-on as concentric rings). Each family has its own silhouette.
// There's deliberately no maker's logo on the front plate.

interface Props {
  body: Body;
  lens?: Lens;
  className?: string;
}

const W = 180;
const H = 120;

export default function BodyArt({ body, lens, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const g = (n: string) => `${n}-${uid}`;
  const silver = body.finish === "silver";
  const plate = silver ? `url(#${g("chrome")})` : `url(#${g("paint")})`;

  // Common geometry: a 140 × 80 mm body centred in the frame.
  const bw = body.family === "CL" ? 131 : body.family === "Q" ? 130 : body.family === "S" ? 160 : body.family === "SL" ? 146 : 138;
  const bh = body.family === "CL" ? 78 : body.family === "Q" ? 80 : body.family === "S" ? 120 : body.family === "SL" ? 104 : 77;
  const scale = Math.min((W - 12) / bw, (H - 18) / bh);
  const bx = (W - bw * scale) / 2;
  const by = (H - bh * scale) / 2 + 2;
  const s = (mm: number) => mm * scale;

  const lensD = lens ? Math.min(lens.look.diameterMm, body.family === "M film" || body.family === "M digital" ? 75 : 90) : 44;
  const mountX = bx + s(body.family === "SL" || body.family === "S" ? bw * 0.52 : bw * 0.47);
  const mountY = by + s(bh * (body.family === "SL" || body.family === "S" ? 0.58 : 0.55));

  const isM = body.family === "M film" || body.family === "M digital";
  const film = body.medium === "film";

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Illustration of the ${body.name}`}>
      <defs>
        <linearGradient id={g("chrome")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="0.35" stopColor="#c7c8cb" />
          <stop offset="0.7" stopColor="#9c9da1" />
          <stop offset="1" stopColor="#6e6f73" />
        </linearGradient>
        <linearGradient id={g("paint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a4e" />
          <stop offset="0.25" stopColor="#222225" />
          <stop offset="1" stopColor="#0c0c0d" />
        </linearGradient>
        <pattern id={g("leather")} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
          <rect width="1.6" height="1.6" fill="#151516" />
          <circle cx="0.5" cy="0.5" r="0.45" fill="#232325" />
          <circle cx="1.3" cy="1.2" r="0.35" fill="#0b0b0c" />
        </pattern>
        <linearGradient id={g("leatherShade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={g("glass")} cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#7b68e0" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#1c2750" />
          <stop offset="0.65" stopColor="#07080d" />
          <stop offset="0.88" stopColor="#2a6a4d" stopOpacity="0.85" />
          <stop offset="1" stopColor="#050507" />
        </radialGradient>
        <radialGradient id={g("window")} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#5e6a86" />
          <stop offset="0.6" stopColor="#1b2130" />
          <stop offset="1" stopColor="#0a0c12" />
        </radialGradient>
        <radialGradient id={g("shadow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("ring")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lens?.look.finish === "silver" ? "#f4f4f5" : "#4a4a4e"} />
          <stop offset="1" stopColor={lens?.look.finish === "silver" ? "#77787c" : "#0b0b0c"} />
        </linearGradient>
      </defs>

      <ellipse cx={W / 2} cy={by + s(bh) + 5} rx={s(bw) * 0.55} ry={4} fill={`url(#${g("shadow")})`} />

      {body.family === "SL" || body.family === "S" ? (
        <>
          {/* Viewfinder hump over the mount, grip on the right-hand side */}
          <path
            d={`M${mountX - s(24)},${by + s(18)} L${mountX - s(16)},${by} L${mountX + s(16)},${by} L${mountX + s(24)},${by + s(18)} Z`}
            fill={plate}
          />
          <rect x={bx} y={by + s(16)} width={s(bw)} height={s(bh - 16)} rx={s(10)} fill={plate} />
          <rect x={bx + s(2)} y={by + s(34)} width={s(bw - 4)} height={s(bh - 40)} rx={s(8)} fill={`url(#${g("leather")})`} />
          <rect x={bx} y={by + s(24)} width={s(30)} height={s(bh - 26)} rx={s(12)} fill={`url(#${g("leather")})`} />
          <rect x={bx} y={by + s(24)} width={s(30)} height={s(bh - 26)} rx={s(12)} fill={`url(#${g("leatherShade")})`} />
          <circle cx={bx + s(16)} cy={by + s(12)} r={s(4)} fill={`url(#${g("chrome")})`} />
        </>
      ) : (
        <>
          <rect x={bx} y={by} width={s(bw)} height={s(bh)} rx={s(isM ? 14 : 8)} fill={plate} />
          {/* Leatherette below the top plate */}
          <rect x={bx + s(1)} y={by + s(bh * 0.36)} width={s(bw - 2)} height={s(bh * 0.6)} rx={s(isM ? 12 : 6)} fill={`url(#${g("leather")})`} />
          <rect x={bx + s(1)} y={by + s(bh * 0.36)} width={s(bw - 2)} height={s(bh * 0.6)} rx={s(isM ? 12 : 6)} fill={`url(#${g("leatherShade")})`} />
          <line x1={bx + s(6)} x2={bx + s(bw - 6)} y1={by + s(bh * 0.36)} y2={by + s(bh * 0.36)} stroke="#000" strokeOpacity={0.5} strokeWidth={0.5} />
        </>
      )}

      {isM && (
        <>
          {/* Rangefinder window (left), frame-illumination window (film, M9, M240), viewfinder window (right) */}
          <rect x={bx + s(14)} y={by + s(8)} width={s(13)} height={s(11)} rx={s(1.5)} fill={`url(#${g("window")})`} stroke="#000" strokeWidth={0.4} />
          {(film || body.id === "m9" || body.id === "m240") && (
            <rect x={bx + s(52)} y={by + s(9)} width={s(18)} height={s(9)} rx={s(1)} fill={silver ? "#e8e6df" : "#d9d6cc"} stroke="#000" strokeWidth={0.4} />
          )}
          <rect x={bx + s(bw - 44)} y={by + s(7)} width={s(28)} height={s(15)} rx={s(2)} fill={`url(#${g("window")})`} stroke="#000" strokeWidth={0.4} />
          <rect x={bx + s(bw - 43)} y={by + s(8)} width={s(10)} height={s(3)} rx={s(1)} fill="#fff" opacity={0.18} />
          {/* Top controls: shutter release and speed dial on the left, rewind or ISO dial on the right */}
          <rect x={bx + s(12)} y={by - s(4)} width={s(22)} height={s(4.5)} rx={s(1)} fill={`url(#${g("chrome")})`} />
          <rect x={bx + s(40)} y={by - s(3)} width={s(5)} height={s(3.5)} rx={s(1)} fill={`url(#${g("chrome")})`} />
          {film && <rect x={bx + s(34)} y={by - s(2)} width={s(16)} height={s(2.2)} rx={s(1)} fill="#0e0e0f" />}
          <rect x={bx + s(bw - 34)} y={by - s(film ? 6 : 3.5)} width={s(18)} height={s(film ? 6.5 : 4)} rx={s(1.5)} fill={film ? `url(#${g("chrome")})` : plate} />
          <text x={bx + s(bw - 10)} y={by + s(25)} fontSize={s(4.5)} textAnchor="end" fill={silver ? "#2a2a2a" : "#bdbdbd"} fontFamily="Archivo, Helvetica, sans-serif" fontWeight={600}>
            {body.name.replace(/\s*\(.*\)/, "")}
          </text>
        </>
      )}

      {body.family === "Q" && (
        <>
          <rect x={bx + s(bw - 36)} y={by - s(3)} width={s(14)} height={s(3.5)} rx={s(1)} fill={plate} />
          <rect x={bx + s(10)} y={by - s(3)} width={s(12)} height={s(3.5)} rx={s(1)} fill={plate} />
        </>
      )}

      {body.family === "CL" && (
        <rect x={bx + s(bw - 30)} y={by + s(6)} width={s(20)} height={s(12)} rx={s(2)} fill="#050506" />
      )}

      {/* Lens, head-on */}
      <circle cx={mountX} cy={mountY} r={s(lensD / 2 + 2)} fill="#000" opacity={0.5} />
      <circle cx={mountX} cy={mountY} r={s(lensD / 2)} fill={`url(#${g("ring")})`} />
      <circle cx={mountX} cy={mountY} r={s(lensD / 2 - 2.5)} fill="#08080a" />
      <circle cx={mountX} cy={mountY} r={s(lensD / 2 - 4)} fill="none" stroke="#2a2a2d" strokeWidth={0.5} />
      <circle cx={mountX} cy={mountY} r={s(lensD * 0.34)} fill={`url(#${g("glass")})`} />
      <ellipse cx={mountX - s(lensD * 0.12)} cy={mountY - s(lensD * 0.13)} rx={s(lensD * 0.07)} ry={s(lensD * 0.045)} fill="#fff" opacity={0.4} transform={`rotate(-30 ${mountX - s(lensD * 0.12)} ${mountY - s(lensD * 0.13)})`} />
      {isM && <circle cx={mountX + s(lensD / 2 - 1.2)} cy={mountY - s(3)} r={s(0.9)} fill="#cf2e25" />}
    </svg>
  );
}
