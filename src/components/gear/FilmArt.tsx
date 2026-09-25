import { useId } from "react";
import type { FilmLook } from "../../preview/film";

// A generic 35 mm film canister in the stock's colours (not its packaging).

export default function FilmArt({ film, className }: { film: FilmLook; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const g = (n: string) => `${n}-${uid}`;
  const [label, band] = film.colors;
  return (
    <svg className={className} viewBox="0 0 150 100" role="img" aria-label={`${film.name} film canister`}>
      <defs>
        <linearGradient id={g("can")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={g("cap")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1a1a1a" />
          <stop offset="0.3" stopColor="#6b6b6b" />
          <stop offset="1" stopColor="#0b0b0b" />
        </linearGradient>
        <radialGradient id={g("shadow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="75" cy="90" rx="34" ry="4" fill={`url(#${g("shadow")})`} />
      {/* Film leader sticking out */}
      <path d="M96,40 h26 a3,3 0 0 1 3,3 v24 h-29 Z" fill="#3a2a1a" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={100 + i * 5} y={42} width={2.4} height={3} rx={0.6} fill="#1a120b" />
      ))}
      <rect x="54" y="12" width="44" height="6" rx="2" fill={`url(#${g("cap")})`} />
      <rect x="70" y="6" width="12" height="7" rx="2" fill={`url(#${g("cap")})`} />
      <rect x="52" y="18" width="48" height="66" rx="3" fill={label} />
      <rect x="52" y="44" width="48" height="16" fill={band} />
      <text x="76" y="55" fontSize="7" fontWeight="700" textAnchor="middle" fill={film.colors[0] === "#1f2a44" ? "#fff" : label} fontFamily="Outfit, Helvetica, sans-serif">
        {film.iso}
      </text>
      <text x="76" y="32" fontSize="5.4" fontWeight="700" textAnchor="middle" fill={band} fontFamily="Outfit, Helvetica, sans-serif">
        {film.mono ? "B&W" : film.kind === "slide" ? "SLIDE" : "COLOR"}
      </text>
      <text x="76" y="74" fontSize="4.6" textAnchor="middle" fill={band} fontFamily="Outfit, Helvetica, sans-serif" letterSpacing="0.5">
        35 mm · 36
      </text>
      <rect x="52" y="18" width="48" height="66" rx="3" fill={`url(#${g("can")})`} />
      <rect x="54" y="84" width="44" height="5" rx="2" fill={`url(#${g("cap")})`} />
    </svg>
  );
}
