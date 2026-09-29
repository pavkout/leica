// Photos are prepared on the device before they go anywhere: scaled so the
// long edge is at most 2576 px (the most detail the models use) and redrawn
// through a canvas, which drops EXIF, so no GPS location leaves the phone.

export const MAX_EDGE = 2576;
/** Anthropic's per-image limit is 5 MB of base64 data; stay under it. */
const MAX_BASE64 = 4.5 * 1024 * 1024;

export interface PreparedImage {
  base64: string;
  mediaType: "image/jpeg";
  /** A data URL for showing the photo back to the user. */
  dataUrl: string;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image this browser can read."));
    };
    img.src = url;
  });
}

export function scaledSize(w: number, h: number, maxEdge = MAX_EDGE): { w: number; h: number } {
  const s = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export async function prepareImage(file: Blob, maxEdge = MAX_EDGE): Promise<PreparedImage> {
  const img = await loadImage(file);
  const { w, h } = scaledSize(img.naturalWidth, img.naturalHeight, maxEdge);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(img, 0, 0, w, h);
  for (const q of [0.88, 0.8, 0.7, 0.6]) {
    const dataUrl = c.toDataURL("image/jpeg", q);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (base64.length <= MAX_BASE64) return { base64, mediaType: "image/jpeg", dataUrl };
  }
  if (maxEdge > 1200) return prepareImage(file, Math.round(maxEdge * 0.75));
  throw new Error("That photo is too large to send, even scaled down.");
}
