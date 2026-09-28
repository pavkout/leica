// Depth for the live camera (#37), off the main thread: Depth Anything V2
// (small, 8-bit, ~27 MB, downloaded once and cached by the browser, the same
// model the photo upload uses). Frames never leave the device.

/// <reference lib="webworker" />

type In = { type: "frame"; bitmap: ImageBitmap };
type Out =
  | { type: "status"; message: string; fraction: number | null }
  | { type: "depth"; data: Uint8Array; width: number; height: number; ms: number }
  | { type: "error"; message: string };

const post = (m: Out, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let estimator: Promise<any> | null = null;

function load() {
  estimator ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const loaded = new Map<string, [number, number]>();
    return pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === "progress" && p.file && p.total) {
          loaded.set(p.file, [p.loaded ?? 0, p.total]);
          let done = 0;
          let total = 0;
          for (const [l, t] of loaded.values()) {
            done += l;
            total += t;
          }
          post({ type: "status", message: `Downloading the depth model (${Math.round(total / 1e6)} MB, first time only)`, fraction: done / total });
        }
      },
    });
  })();
  return estimator;
}

self.onmessage = async (e: MessageEvent<In>) => {
  if (e.data.type !== "frame") return;
  const { bitmap } = e.data;
  try {
    const est = await load();
    const t0 = performance.now();
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { RawImage } = await import("@huggingface/transformers");
    const input = new RawImage(px.data, canvas.width, canvas.height, 4);
    const { depth } = await est(input);
    // One channel, 0 far … 255 near, at the input's size.
    const data = new Uint8Array(depth.data);
    post({ type: "depth", data, width: depth.width, height: depth.height, ms: performance.now() - t0 }, [data.buffer]);
  } catch (err) {
    estimator = null;
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
