// The Passport's shareable card (#41): a 1080 × 1350 image, drawn on the
// device, for a message, a listing or a collectors' forum. Black plate, one
// red index mark, the serial engraved; the app's name, never Leica's logo.

export interface CardText {
  label: string;
  name: string;
  serial?: string;
  lines: string[];
  fingerprintLabel: string;
  fingerprint: string;
  footer: string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Wraps text to a width; returns the lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  // CJK text has no spaces: break between characters instead.
  const words = /\s/.test(text) ? text.split(/\s+/) : [...text];
  const joiner = /\s/.test(text) ? " " : "";
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + joiner + w : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawPassportCard(text: CardText, photo?: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const sans = '"Inter", "Helvetica Neue", Arial, "Hiragino Sans", "PingFang SC", "Noto Sans CJK", sans-serif';

  ctx.fillStyle = "#121211";
  ctx.fillRect(0, 0, W, H);
  // The plate.
  const pad = 64;
  ctx.fillStyle = "#1a1a19";
  ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2);
  ctx.strokeStyle = "#3b3b37";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  let y = pad + 70;
  ctx.fillStyle = "#cf2e25";
  ctx.fillRect(pad, y - 34, 6, 44);
  ctx.fillStyle = "#9a968e";
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(text.label.toUpperCase(), pad + 36, y);

  // The photo, if the owner has one.
  y += 40;
  const img = photo ? await loadImage(photo) : null;
  if (img) {
    const boxW = W - pad * 2 - 72;
    const boxH = 470;
    const s = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) / 2, y + (boxH - h) / 2, w, h);
    y += boxH + 40;
  } else y += 60;

  ctx.fillStyle = "#ece9e2";
  ctx.font = `600 64px ${sans}`;
  for (const line of wrap(ctx, text.name, W - pad * 2 - 72).slice(0, 2)) {
    ctx.fillText(line, pad + 36, y + 50);
    y += 74;
  }
  if (text.serial) {
    ctx.fillStyle = "#dedbd4";
    ctx.font = `500 58px "Archivo", ${sans}`;
    ctx.fillText(`No. ${text.serial}`, pad + 36, y + 56);
    y += 90;
  }
  y += 16;
  ctx.fillStyle = "#c9c6bf";
  ctx.font = `400 34px ${sans}`;
  for (const l of text.lines) {
    for (const line of wrap(ctx, l, W - pad * 2 - 72)) {
      if (y > H - pad - 230) break;
      ctx.fillText(line, pad + 36, y + 30);
      y += 48;
    }
  }

  // The fingerprint, at the foot of the plate.
  const fy = H - pad - 170;
  ctx.strokeStyle = "#2c2c29";
  ctx.beginPath();
  ctx.moveTo(pad + 36, fy);
  ctx.lineTo(W - pad - 36, fy);
  ctx.stroke();
  ctx.fillStyle = "#9a968e";
  ctx.font = `600 26px ${sans}`;
  ctx.fillText(text.fingerprintLabel.toUpperCase(), pad + 36, fy + 50);
  ctx.fillStyle = "#ece9e2";
  ctx.font = `500 48px "Archivo", ui-monospace, Menlo, monospace`;
  ctx.fillText(text.fingerprint, pad + 36, fy + 110);
  ctx.fillStyle = "#6f6c66";
  ctx.font = `400 22px ${sans}`;
  ctx.fillText(text.footer, pad + 36, H - pad - 22);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}

/** The system share sheet with the image where it can take files, else a download. */
export async function shareOrDownload(blob: Blob, name: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      // The owner closed the share sheet: leave it there. Anything else falls through to a download.
      if ((e as Error)?.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, name);
  return "downloaded";
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
