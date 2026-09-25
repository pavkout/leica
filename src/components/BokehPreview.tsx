import { useEffect, useRef, useState } from "react";
import type { ApertureShape } from "../preview/aperture";
import { BokehRenderer, type RenderParams } from "../preview/renderer";
import { formatFNumber } from "../utils/format";
import { useDrag } from "../utils/useDrag";
import { useElementWidth } from "../utils/useElementWidth";

export interface PreviewSide {
  label: string;
  params: Omit<RenderParams, "shape"> & { shape: ApertureShape };
}

interface Props {
  a: PreviewSide;
  b: PreviewSide | null;
  /** Width ÷ height of the frame. */
  aspect: number;
}

/** Rendering cap: detail beyond this isn't visible and costs fill rate on phones. */
const MAX_PIXEL_WIDTH = 1600;

export default function BokehPreview({ a, b, aspect }: Props) {
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
    <div ref={wrapRef} className="preview" style={{ aspectRatio: String(aspect) }}>
      <PreviewCanvas side={a} pixelWidth={pixelWidth} pixelHeight={pixelHeight} />
      {/* Kept mounted so toggling compare never creates extra WebGL contexts. */}
      <div className="preview-b" hidden={!b} style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
        <PreviewCanvas side={b} pixelWidth={pixelWidth} pixelHeight={pixelHeight} />
      </div>

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
}

function PreviewCanvas({
  side,
  pixelWidth,
  pixelHeight,
}: {
  side: PreviewSide | null;
  pixelWidth: number;
  pixelHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BokehRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rendererRef.current || !canvasRef.current) return;
    try {
      rendererRef.current = new BokehRenderer(canvasRef.current);
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
