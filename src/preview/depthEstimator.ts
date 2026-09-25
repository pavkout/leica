// In-browser depth estimation for uploaded photos with Depth Anything V2
// (small, 8-bit quantised, about 27 MB, downloaded once and cached by the
// browser). The photo never leaves the device.

type Progress = (message: string, fraction: number | null) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let estimator: Promise<any> | null = null;

async function getEstimator(onProgress: Progress) {
  estimator ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const loaded = new Map<string, [number, number]>();
    return pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p) => {
        if (p.status === "progress" && p.file && p.total) {
          loaded.set(p.file, [p.loaded ?? 0, p.total]);
          let done = 0;
          let total = 0;
          for (const [l, t] of loaded.values()) {
            done += l;
            total += t;
          }
          onProgress(`Downloading the depth model (${Math.round(total / 1e6)} MB, first time only)…`, done / total);
        }
      },
    });
  })();
  try {
    return await estimator;
  } catch (e) {
    estimator = null;
    throw e;
  }
}

/** Resizes the photo, estimates depth, and returns both as canvases. */
export async function estimateDepth(file: File, onProgress: Progress) {
  onProgress("Reading the photo…", null);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const photo = document.createElement("canvas");
  photo.width = Math.round(bitmap.width * scale);
  photo.height = Math.round(bitmap.height * scale);
  photo.getContext("2d")!.drawImage(bitmap, 0, 0, photo.width, photo.height);
  bitmap.close();

  const depthAnything = await getEstimator(onProgress);
  onProgress("Estimating depth…", null);
  const { RawImage } = await import("@huggingface/transformers");
  const input = RawImage.fromCanvas(photo);
  const { depth } = await depthAnything(input);
  const depthCanvas: HTMLCanvasElement | OffscreenCanvas = depth.toCanvas();
  return { photo, depth: depthCanvas };
}
