import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type MutableRefObject } from "react";
import type { ApertureShape } from "../preview/aperture";
import { BokehRenderer, type RenderParams } from "../preview/renderer";
import { formatFNumber } from "../utils/format";
import { useDrag } from "../utils/useDrag";
import { useElementWidth } from "../utils/useElementWidth";

export interface PreviewSide {
  label: string;
  params: RenderParams & { shape: ApertureShape };
}

interface Props {
  a: PreviewSide;
  b: PreviewSide | null;
  /** Width ÷ height of the frame. */
  aspect: number;
  /** Covers the photo with this message (the focus challenge hides the result). */
  veil?: string;
  /** Tap to focus: position in the frame, 0–1. */
  onTap?: (x: number, y: number) => void;
}

/** Rendering cap: detail beyond this isn't visible and costs fill rate on phones. */
const MAX_PIXEL_WIDTH = 1600;

export interface PreviewHandle {
  /** Renders side A with these params and returns the frame as a JPEG data URL. */
  capture(params: RenderParams): string | null;
}

interface CanvasHandle {
  renderer: BokehRenderer;
  canvas: HTMLCanvasElement;
}

const BokehPreview = forwardRef<PreviewHandle, Props>(function BokehPreview({ a, b, aspect, veil, onTap }, ref) {
  const [reticle, setReticle] = useState<{ x: number; y: number; key: number } | null>(null);
  const handleA = useRef<CanvasHandle | null>(null);
  useImperativeHandle(ref, () => ({
    capture(params) {
      const h = handleA.current;
      if (!h) return null;
      // Read back in the same task as the draw: the buffer isn't preserved after compositing.
      h.renderer.render(params);
      return h.canvas.toDataURL("image/jpeg", 0.92);
    },
  }));

  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.min(Math.round(width * dpr), MAX_PIXEL_WIDTH);
  const pixelHeight = Math.round(pixelWidth / aspect);

  const [split, setSplit] = useState(0.5);
  const drag = useDrag({
    onMove: (_dx, x) => setSplit(Math.min(Math.max(x / width, 0.04), 0.96)),
    onTap: (x) => setSplit(Math.min(Math.max(x / width, 0.04), 0.96)),
  });

  function onSplitKey(e: React.KeyboardEvent) {
    const delta = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0;
    if (delta) {
      e.preventDefault();
      setSplit((s) => Math.min(Math.max(s + delta, 0.04), 0.96));
    }
  }

  return (
    <div
      ref={wrapRef}
      className={onTap && !b ? "preview preview-tappable" : "preview"}
      style={{ aspectRatio: String(aspect) }}
      onClick={(e) => {
        if (!onTap || b) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        setReticle({ x, y, key: Date.now() });
        onTap(x, y);
      }}
    >
      {reticle && !b && (
        <span key={reticle.key} className="reticle" style={{ left: `${reticle.x * 100}%`, top: `${reticle.y * 100}%` }} aria-hidden="true" />
      )}
      <PreviewCanvas side={a} pixelWidth={pixelWidth} pixelHeight={pixelHeight} handleRef={handleA} />
      {/* Kept mounted so toggling compare never creates extra WebGL contexts. */}
      <div className="preview-b" hidden={!b} style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
        <PreviewCanvas side={b} pixelWidth={pixelWidth} pixelHeight={pixelHeight} />
      </div>

      {veil && <div className="preview-veil">{veil}</div>}
      <span className="preview-tag preview-tag-a">
        {b && <b>A</b>} {formatFNumber(a.params.fNumber)} · {a.label}
      </span>
      {b && (
        <>
          <span className="preview-tag preview-tag-b">
            <b>B</b> {formatFNumber(b.params.fNumber)} · {b.label}
          </span>
          <div className="preview-split-hit" {...drag}>
            <div
              className="preview-split"
              style={{ left: `${split * 100}%` }}
              role="slider"
              tabIndex={0}
              aria-label="Comparison divider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(split * 100)}
              onKeyDown={onSplitKey}
            >
              <span className="preview-split-knob" aria-hidden="true">‹ ›</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default BokehPreview;

function PreviewCanvas({
  side,
  pixelWidth,
  pixelHeight,
  handleRef,
}: {
  side: PreviewSide | null;
  pixelWidth: number;
  pixelHeight: number;
  handleRef?: MutableRefObject<CanvasHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BokehRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rendererRef.current || !canvasRef.current) return;
    try {
      rendererRef.current = new BokehRenderer(canvasRef.current);
      if (handleRef) handleRef.current = { renderer: rendererRef.current, canvas: canvasRef.current };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Coalesce bursts of changes (dragging a ring) into one render per frame.
  const paramsKey = side ? JSON.stringify(side.params) : "";
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!side || !canvas || !renderer || pixelWidth < 2) return;
    const frame = requestAnimationFrame(() => {
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      renderer.render(side.params);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, pixelWidth, pixelHeight]);

  if (error) {
    return <div className="preview-error">The photo preview needs WebGL 2, which this browser doesn't provide.</div>;
  }
  return <canvas ref={canvasRef} className="preview-canvas" role="img" aria-label={side ? `Simulated photo: ${side.label}` : undefined} />;
}
