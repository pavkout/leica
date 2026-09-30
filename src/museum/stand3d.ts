// The museum's display stand (#39) as a real 3D model, rendered once and reused.
//
// A matte black block; on it a thinner black frame, set in by the same margin
// on every side; in the frame, a panel of pebbled red leather; on the front,
// the owner's mark when its artwork exists. Lit by a warm spotlight from
// above, seen from a centred camera, so it's symmetric by construction.
//
// It's rendered once per visit to an image (one WebGL context, then released),
// because the museum shows many stands at once and a display may run for
// hours: a live 3D canvas per piece would be heavy on an iPad or TV. Without
// WebGL this returns null and the drawn SVG stand is used instead.

export interface StandImage {
  src: string;
  /** Width / height of the image. */
  aspect: number;
  /** Where a piece should stand: height from the image's top, as a fraction of the image's width. */
  seat: number;
}

/** Stand proportions, in metres-ish scene units. */
const W = 1.6;
const D = 1.0;
const H = 0.3;
/** The step between block and frame: the same on every side. */
const GAP = 0.03;
const TIER_H = 0.035;
/** The black rim around the leather. */
const RIM = 0.035;

/** Pixel bounds of a set of projected points, padded, clamped to the canvas. */
export function cropBox(points: [number, number][], pad: number, width: number, height: number) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const x1 = Math.min(width, Math.ceil(Math.max(...xs) + pad));
  const y1 = Math.min(height, Math.ceil(Math.max(...ys) + pad));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A pebbled-leather bump map: overlapping soft grains on a mid grey. */
function leatherBump(size = 512): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 2 + rnd() * 5;
    const v = Math.round(110 + rnd() * 110);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.9)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** The soft shadow the stand throws on the gallery floor. */
export function floorShadow(size = 256): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.85)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.45)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function render(logoSrc: string | null, outWidth: number): Promise<StandImage | null> {
  if (typeof document === "undefined") return null;
  const T = await import("three");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  const canvas = document.createElement("canvas");
  let renderer: InstanceType<typeof T.WebGLRenderer>;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  const RW = Math.round(outWidth * 1.35);
  const RH = Math.round(RW * 0.75);
  renderer.setPixelRatio(1);
  renderer.setSize(RW, RH, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const owned: { dispose: () => void }[] = [];
  const own = <X extends { dispose: () => void }>(x: X) => (owned.push(x), x);

  const scene = new T.Scene();
  const pmrem = own(new T.PMREMGenerator(renderer));
  const env = own(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  scene.environment = env;
  scene.environmentIntensity = 0.12;

  // ── Materials ──
  const black = own(new T.MeshStandardMaterial({ color: new T.Color("#1d1d1e"), roughness: 0.72, metalness: 0 }));
  const frameBlack = own(new T.MeshStandardMaterial({ color: new T.Color("#1d1d1e"), roughness: 0.66, metalness: 0 }));
  const bump = own(new T.CanvasTexture(leatherBump()));
  bump.colorSpace = T.NoColorSpace;
  bump.wrapS = bump.wrapT = T.RepeatWrapping;
  bump.repeat.set(5, 3.5);
  const leather = own(new T.MeshStandardMaterial({ color: new T.Color("#b8261f"), roughness: 0.88, metalness: 0, bumpMap: bump, bumpScale: 9 }));

  // ── Geometry: block, frame tier (same gap all round), leather ──
  const baseGeo = own(new T.BoxGeometry(W, H, D));
  const base = new T.Mesh(baseGeo, black);
  base.position.y = H / 2;
  scene.add(base);

  const tierGeo = own(new T.BoxGeometry(W - 2 * GAP, TIER_H, D - 2 * GAP));
  const tier = new T.Mesh(tierGeo, frameBlack);
  tier.position.y = H + TIER_H / 2;
  scene.add(tier);

  // Sharp edges catch a little light: a faint line along each, as on real matte black.
  const edgeMat = own(new T.LineBasicMaterial({ color: new T.Color("#4a4a4b"), transparent: true, opacity: 0.55 }));
  for (const [geo, mesh] of [
    [baseGeo, base],
    [tierGeo, tier],
  ] as const) {
    const edges = new T.LineSegments(own(new T.EdgesGeometry(geo)), edgeMat);
    edges.position.copy(mesh.position);
    scene.add(edges);
  }

  const LW = W - 2 * GAP - 2 * RIM;
  const LD = D - 2 * GAP - 2 * RIM;
  const leatherGeo = own(new T.BoxGeometry(LW, 0.008, LD));
  const panel = new T.Mesh(leatherGeo, leather);
  panel.position.y = H + TIER_H + 0.002;
  scene.add(panel);

  // ── The mark on the front, low on the left ──
  const logoImg = logoSrc ? await loadImage(logoSrc) : null;
  if (logoImg) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    c.getContext("2d")!.drawImage(logoImg, 0, 0, 512, 512);
    const tex = own(new T.CanvasTexture(c));
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = own(new T.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.02, roughness: 0.55, metalness: 0 }));
    const size = 0.105;
    const logo = new T.Mesh(own(new T.PlaneGeometry(size, size)), mat);
    logo.position.set(-W / 2 + 0.07 + size / 2, H * 0.48, D / 2 + 0.0015);
    scene.add(logo);
  }

  // ── Floor shadow ──
  const shadowTex = own(new T.CanvasTexture(floorShadow()));
  const shadow = new T.Mesh(
    own(new T.PlaneGeometry(W * 1.35, D * 1.5)),
    own(new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0005;
  scene.add(shadow);

  // ── Light: a warm spot from above, a little from the front; a soft fill ──
  const spot = new T.SpotLight("#fff0dc", 17, 0, 0.62, 0.85, 2);
  spot.position.set(0, 2.6, 1.15);
  spot.target.position.set(0, H, 0);
  scene.add(spot, spot.target);
  scene.add(new T.HemisphereLight("#d9d3c8", "#0b0b0b", 0.35));
  const fill = new T.DirectionalLight("#ffffff", 0.9);
  fill.position.set(0, 0.6, 3);
  scene.add(fill);

  // ── Camera: centred, a little above, so the stand is symmetric ──
  const camera = new T.PerspectiveCamera(18, RW / RH, 0.1, 50);
  camera.position.set(0, 1.55, 4.5);
  camera.lookAt(0, H * 0.75, 0);
  camera.updateMatrixWorld();

  renderer.render(scene, camera);

  // Crop tight to the stand (and its floor shadow), from projected corners.
  const toPx = (x: number, y: number, z: number): [number, number] => {
    const v = new T.Vector3(x, y, z).project(camera);
    return [((v.x + 1) / 2) * RW, ((1 - v.y) / 2) * RH];
  };
  const corners: [number, number][] = [];
  for (const x of [-W / 2, W / 2]) for (const y of [0, H + TIER_H]) for (const z of [-D / 2, D / 2]) corners.push(toPx(x, y, z));
  const box = cropBox(corners, RW * 0.012, RW, RH);
  box.h = Math.min(RH - box.y, box.h + Math.round(RW * 0.02)); // room for the floor shadow

  // The piece stands on the leather, a little behind its front edge.
  const [, seatPx] = toPx(0, H + TIER_H, D / 2 - GAP - RIM - LD * 0.28);

  const out = document.createElement("canvas");
  const scale = outWidth / box.w;
  out.width = outWidth;
  out.height = Math.round(box.h * scale);
  out.getContext("2d")!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);

  owned.forEach((o) => o.dispose());
  renderer.dispose();
  renderer.forceContextLoss();

  const blob: Blob | null = await new Promise((r) => out.toBlob(r, "image/png"));
  if (!blob) return null;
  return { src: URL.createObjectURL(blob), aspect: out.width / out.height, seat: ((seatPx - box.y) * scale) / out.width };
}

const cache = new Map<string, Promise<StandImage | null>>();

/** The 3D stand as an image, rendered once per logo; null when WebGL isn't available. */
export function standImage(logoSrc: string | null, outWidth = 1400): Promise<StandImage | null> {
  const key = `${logoSrc ?? ""}@${outWidth}`;
  let p = cache.get(key);
  if (!p) {
    p = render(logoSrc, outWidth).catch(() => null);
    cache.set(key, p);
  }
  return p;
}
