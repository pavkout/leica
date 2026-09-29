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

/**
 * Check a real rangefinder at home. Print the target, photograph it at 45°
 * wide open, focused on the mark with the rangefinder, and upload the photo:
 * the sharpest band shows whether the camera front- or back-focuses.
 */
export default function RangefinderCheck({ onLearnMore }: Props) {
  const [photo, setPhoto] = useState<{ url: string; gray: Float32Array; w: number; h: number } | null>(null);
  const [result, setResult] = useState<FocusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    on: "On target: the sharpest band is at the mark you focused on.",
    front: "Front focus: the sharpest band is nearer than the mark.",
    back: "Back focus: the sharpest band is farther than the mark.",
  }[result.verdict];

  return (
    <section className="panel stage-rfcheck" aria-label="Rangefinder check">
      <ol className="rfc-steps">
        <li>
          <h3>Print the target</h3>
          <p className="muted">On A4 at 100% scale. Lay it flat on a table in good light.</p>
          <button type="button" className="btn btn-small" onClick={() => window.print()}>
            Print the target
          </button>
        </li>
        <li>
          <h3>Photograph it</h3>
          <p className="muted">
            Stand about 1 m away, looking down at roughly 45°. Open the lens fully, focus on the black bar with the rangefinder only (no
            live view), and take the picture. Use a tripod or brace yourself, and a fast enough speed.
          </p>
        </li>
        <li>
          <h3>Upload it</h3>
          <label className="btn btn-red rfc-upload">
            {photo ? "Choose another photo" : "Choose the photo"}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
          {error && <p className="warn-text small">{error}</p>}
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
