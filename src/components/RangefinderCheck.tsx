import { useState } from "react";
import { analyseFocus, toGray, type FocusResult } from "../physics/focusCheck";

interface Props {
  /** Open the calibration simulator, to see what the result means for pictures. */
  onLearnMore: () => void;
}

const ANALYSIS_WIDTH = 900;

/** The printed target: fine line pairs down an A4 page, a bold focus mark in the middle, a centimetre scale either side. */
function Target() {
  const lines = [];
  for (let y = 20; y <= 277; y += 1.2) lines.push(<line key={y} x1={70} x2={140} y1={y} y2={y} stroke="#000" strokeWidth={0.45} />);
  const ticks = [];
  for (let cm = -10; cm <= 10; cm++) {
    const y = 148.5 + cm * 10;
    ticks.push(
      <g key={cm}>
        <line x1={44} x2={cm % 5 === 0 ? 62 : 56} y1={y} y2={y} stroke="#000" strokeWidth={0.4} />
        <line x1={148} x2={cm % 5 === 0 ? 166 : 160} y1={y} y2={y} stroke="#000" strokeWidth={0.4} />
        {cm % 2 === 0 && cm !== 0 && (
          <text x={36} y={y + 1.5} fontSize={4.2} textAnchor="end" fontFamily="Archivo, Helvetica, sans-serif">
            {cm > 0 ? `−${cm}` : `+${-cm}`}
          </text>
        )}
      </g>,
    );
  }
  return (
    <svg viewBox="0 0 210 297" className="rfc-target" role="img" aria-label="Printable focus target">
      <rect width="210" height="297" fill="#fff" />
      <text x="105" y="12" fontSize="5" textAnchor="middle" fontFamily="Archivo, Helvetica, sans-serif">
        FAR SIDE: away from the camera
      </text>
      {lines}
      {ticks}
      <rect x="62" y="145.5" width="86" height="6" fill="#000" />
      <text x="170" y="150.3" fontSize="4.6" fontFamily="Archivo, Helvetica, sans-serif">
        ◀ FOCUS HERE
      </text>
      <text x="105" y="290" fontSize="5" textAnchor="middle" fontFamily="Archivo, Helvetica, sans-serif">
        NEAR SIDE: towards the camera · scale in cm
      </text>
    </svg>
  );
}

/** The set-up, from the side: camera looking down at 45° onto the target on a table, 1 m away. */
function Setup() {
  return (
    <svg viewBox="0 0 240 150" className="rfc-setup" role="img" aria-label="The camera 1 metre from the target, looking down at 45 degrees">
      <line x1="10" y1="122" x2="230" y2="122" className="rfc-table" />
      <rect x="150" y="117" width="62" height="4" className="rfc-sheet" />
      <rect x="178" y="117" width="6" height="4" className="rfc-bar" />
      <g transform="translate(66 42) rotate(45)">
        <rect x="-22" y="-12" width="44" height="24" rx="3" className="rfc-cam" />
        <rect x="18" y="-7" width="16" height="14" rx="1.5" className="rfc-lens" />
      </g>
      <line x1="84" y1="60" x2="181" y2="118" className="rfc-axis" />
      <path d="M130 122 A34 34 0 0 0 125 101" className="rfc-arc" />
      <text x="138" y="108" className="rfc-dim">45°</text>
      <text x="112" y="80" className="rfc-dim" transform="rotate(31 112 80)">1 m</text>
    </svg>
  );
}

/**
 * Check a real rangefinder at home. Print the target, photograph it at 45°
 * wide open, focused on the mark with the rangefinder, and upload the photo:
 * the sharpest band shows whether the camera front- or back-focuses.
 */
export default function RangefinderCheck({ onLearnMore }: Props) {
  const [photo, setPhoto] = useState<{ url: string; gray: Float32Array; w: number; h: number } | null>(null);
  const [result, setResult] = useState<FocusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function load(file: File) {
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = Math.min(ANALYSIS_WIDTH, img.naturalWidth);
      const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return setError("This browser can't read the photo.");
      ctx.drawImage(img, 0, 0, w, h);
      const gray = toGray(ctx.getImageData(0, 0, w, h).data, w, h);
      setPhoto({ url, gray, w, h });
      setResult(analyseFocus(gray, w, h, 0.5));
    };
    img.onerror = () => setError("That file isn't a photo this browser can open.");
    img.src = url;
  }

  function tapMark(e: React.MouseEvent<HTMLDivElement>) {
    if (!photo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height));
    setResult(analyseFocus(photo.gray, photo.w, photo.h, m));
  }

  const words = result && {
    on: "The sharpest band is at the mark you focused on.",
    front: "The sharpest band is nearer than the mark.",
    back: "The sharpest band is farther than the mark.",
  }[result.verdict];

  return (
    <section className="panel stage-rfcheck" aria-label="Rangefinder check">
      <ol className="rfc-steps">
        <li className="rfc-step">
          <div className="rfc-visual rfc-visual-paper">
            <Target />
          </div>
          <div className="rfc-step-body">
            <h3>Print the target</h3>
            <p className="muted">A4, at 100% scale. Lay it flat on a table in good light.</p>
            <button type="button" className="btn btn-small" onClick={() => window.print()}>
              Print the target
            </button>
          </div>
        </li>
        <li className="rfc-step">
          <div className="rfc-visual">
            <Setup />
          </div>
          <div className="rfc-step-body">
            <h3>Photograph it</h3>
            <dl className="rfc-specs">
              <div>
                <dt>Distance</dt>
                <dd>1 m</dd>
              </div>
              <div>
                <dt>Angle</dt>
                <dd>45°</dd>
              </div>
              <div>
                <dt>Aperture</dt>
                <dd>Wide open</dd>
              </div>
            </dl>
            <p className="muted">Focus on the black bar with the rangefinder only, not live view. Brace yourself or use a tripod.</p>
          </div>
        </li>
        <li className="rfc-step">
          <label
            className={`rfc-drop${dragging ? " rfc-drop-over" : ""}${photo ? " rfc-drop-done" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) load(f);
            }}
          >
            {photo ? <img src={photo.url} alt="" /> : (
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
            <span className="rfc-drop-title">{photo ? "Choose another photo" : "Drop the photo here"}</span>
            {!photo && <span className="muted small">or tap to choose it</span>}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
          <div className="rfc-step-body">
            <h3>Upload it</h3>
            <p className="muted">It&apos;s analysed in this browser; nothing is uploaded anywhere.</p>
            {error && <p className="warn-text small">{error}</p>}
          </div>
        </li>
      </ol>

      {photo && result && (
        <div className="rfc-result">
          <div className="rfc-photo" onClick={tapMark} role="img" aria-label={`Your photo. ${words}`}>
            <img src={photo.url} alt="" />
            {/* The sharpness profile down the frame, drawn up the right edge. */}
            <svg className="rfc-profile" viewBox={`0 0 100 ${result.profile.length}`} preserveAspectRatio="none" aria-hidden="true">
              <polyline points={result.profile.map((v, i) => `${100 - v * 90},${i}`).join(" ")} />
            </svg>
            <span className="rfc-line rfc-mark" style={{ top: `${result.mark * 100}%` }}>
              <b>Focused here</b>
            </span>
            <span className="rfc-line rfc-peak" style={{ top: `${result.peak * 100}%` }}>
              <b>Sharpest</b>
            </span>
          </div>
          <div className="rfc-verdict">
            <p className={`rfc-word rfc-word-${result.verdict}`}>{result.verdict === "on" ? "On target" : result.verdict === "front" ? "Front focus" : "Back focus"}</p>
            <p>{words}</p>
            {result.confidence < 1.6 && <p className="warn-text small">The photo has no clear sharp band: try again wide open, closer, with more light on the target.</p>}
            <p className="muted small">
              Tap the black bar in your photo if the “Focused here” line isn&apos;t on it. One photo can mislead: repeat it three times. If the result
              is the same every time, have the rangefinder adjusted by Leica or a specialist.
            </p>
            <button type="button" className="btn btn-small" onClick={onLearnMore}>
              What a misaligned rangefinder does to pictures
            </button>
          </div>
        </div>
      )}

      <div className="rfc-print" aria-hidden="true">
        <Target />
      </div>
      <p className="hint">
        The analysis measures local contrast row by row in your photo; it happens in this browser and nothing is uploaded. It shows a tendency,
        not a service measurement.
      </p>
    </section>
  );
}
