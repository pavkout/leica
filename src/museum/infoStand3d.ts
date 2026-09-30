// The museum's info stand (#39): the label that stands beside a piece.
//
// A clear acrylic block, polished edges catching the light, with a solid black
// band at the bottom carrying the owner's mark; inside the acrylic, a sheet of
// off-white paper. Rendered once to an image (one WebGL context, then
// released). The words on the paper are live text laid over the render at
// the paper's projected position, so they stay sharp, readable by assistive
// technology, and right for every piece.

import { cropBox, floorShadow, loadImage } from "./stand3d";

export interface InfoStandImage {
  src: string;
  /** Width / height of the image. */
  aspect: number;
  /** The paper's corners [top-left, top-right, bottom-right, bottom-left], as fractions of the image. */
  paper: [[number, number], [number, number], [number, number], [number, number]];
  /** The paper's width / height, for laying the text out before it's mapped on. */
  paperRatio: number;
}

/** Block proportions: portrait, like the real one. */
const W = 0.9;
const H = 1.28;
const D = 0.26;
/** The black band at the bottom. */
const BAND = 0.4;
/** The paper's margin inside the clear part: a hairline of glass, so the label reads as white. */
const MARGIN = 0.014;
/** Seen from a little to the left and above, so the block shows its depth. */
const YAW = (-14 * Math.PI) / 180;
const PITCH = (13 * Math.PI) / 180;
/** The paper sits in a slot just behind the front face. */
const PAPER_Z = D / 2 - 0.03;

async function render(logoSrc: string | null, outWidth: number): Promise<InfoStandImage | null> {
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
  const RW = Math.round(outWidth * 2.2);
  const RH = Math.round(RW * 1.1);
  renderer.setPixelRatio(1);
  renderer.setSize(RW, RH, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const owned: { dispose: () => void }[] = [];
  const own = <X extends { dispose: () => void }>(x: X) => (owned.push(x), x);

  const scene = new T.Scene();
  const pmrem = own(new T.PMREMGenerator(renderer));
  scene.environment = own(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  scene.environmentIntensity = 0.35;

  // ── Black band, with the mark on its front ──
  const bandGeo = own(new T.BoxGeometry(W, BAND, D));
  const band = new T.Mesh(bandGeo, own(new T.MeshStandardMaterial({ color: new T.Color("#1b1b1c"), roughness: 0.55, metalness: 0 })));
  band.position.y = BAND / 2;
  scene.add(band);

  const logoImg = logoSrc ? await loadImage(logoSrc) : null;
  if (logoImg) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    c.getContext("2d")!.drawImage(logoImg, 0, 0, 512, 512);
    const tex = own(new T.CanvasTexture(c));
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const size = 0.13;
    const logo = new T.Mesh(
      own(new T.PlaneGeometry(size, size)),
      own(new T.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.02, roughness: 0.5, metalness: 0 }))
    );
    logo.position.set(-W / 2 + 0.09 + size / 2, BAND * 0.48, D / 2 + 0.0015);
    scene.add(logo);
  }

  // ── The paper, held inside the acrylic ──
  const clearH = H - BAND;
  const PW = W - 2 * MARGIN;
  const PH = clearH - 2 * MARGIN;
  const paper = new T.Mesh(own(new T.PlaneGeometry(PW, PH)), own(new T.MeshStandardMaterial({ color: new T.Color("#efece5"), roughness: 0.92, metalness: 0 })));
  paper.position.set(0, BAND + clearH / 2, PAPER_Z);
  scene.add(paper);

  // ── Clear acrylic: a faint tint, glossy, reflecting the room; polished edges ──
  const acrylicGeo = own(new T.BoxGeometry(W, clearH, D));
  const acrylic = new T.Mesh(
    acrylicGeo,
    own(
      new T.MeshPhysicalMaterial({
        color: new T.Color("#dfe9e6"),
        transparent: true,
        opacity: 0.16,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.6,
        depthWrite: false,
      })
    )
  );
  acrylic.position.y = BAND + clearH / 2;
  acrylic.renderOrder = 2;
  scene.add(acrylic);
  const edges = new T.LineSegments(own(new T.EdgesGeometry(acrylicGeo)), own(new T.LineBasicMaterial({ color: new T.Color("#d8e6e2"), transparent: true, opacity: 0.55 })));
  edges.position.copy(acrylic.position);
  scene.add(edges);
  const bandEdges = new T.LineSegments(own(new T.EdgesGeometry(bandGeo)), own(new T.LineBasicMaterial({ color: new T.Color("#4a4a4b"), transparent: true, opacity: 0.5 })));
  bandEdges.position.copy(band.position);
  scene.add(bandEdges);

  // ── Floor shadow ──
  const shadow = new T.Mesh(
    own(new T.PlaneGeometry(W * 1.5, D * 5)),
    own(new T.MeshBasicMaterial({ map: own(new T.CanvasTexture(floorShadow())), transparent: true, depthWrite: false }))
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0005;
  scene.add(shadow);

  // ── Light: the gallery's warm spot from above and to the right, so the front and side read differently ──
  const spot = new T.SpotLight("#fff0dc", 18, 0, 0.7, 0.9, 2);
  spot.position.set(0.9, 3.2, 1.8);
  spot.target.position.set(0, H * 0.6, 0);
  scene.add(spot, spot.target);
  scene.add(new T.HemisphereLight("#d9d3c8", "#0b0b0b", 0.4));
  const fill = new T.DirectionalLight("#ffffff", 0.65);
  fill.position.set(1.2, 1, 3);
  scene.add(fill);

  // ── Camera: a three-quarter view from the left, a little above ──
  const camera = new T.PerspectiveCamera(16, RW / RH, 0.1, 50);
  const dist = 5.4;
  camera.position.set(Math.sin(YAW) * Math.cos(PITCH) * dist, H * 0.5 + Math.sin(PITCH) * dist, Math.cos(YAW) * Math.cos(PITCH) * dist);
  camera.lookAt(0, H * 0.5, 0);
  camera.updateMatrixWorld();

  renderer.render(scene, camera);

  const toPx = (x: number, y: number, z: number): [number, number] => {
    const v = new T.Vector3(x, y, z).project(camera);
    return [((v.x + 1) / 2) * RW, ((1 - v.y) / 2) * RH];
  };
  const corners: [number, number][] = [];
  for (const x of [-W / 2, W / 2]) for (const y of [0, H]) for (const z of [-D / 2, D / 2]) corners.push(toPx(x, y, z));
  const box = cropBox(corners, RW * 0.02, RW, RH);
  box.h = Math.min(RH - box.y, box.h + Math.round(RW * 0.02));

  // The paper's corners, projected.
  const top = BAND + clearH / 2 + PH / 2;
  const bottom = BAND + clearH / 2 - PH / 2;
  const quad = [toPx(-PW / 2, top, PAPER_Z), toPx(PW / 2, top, PAPER_Z), toPx(PW / 2, bottom, PAPER_Z), toPx(-PW / 2, bottom, PAPER_Z)];

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
  const fx = (x: number) => ((x - box.x) * scale) / out.width;
  const fy = (y: number) => ((y - box.y) * scale) / out.height;
  return {
    src: URL.createObjectURL(blob),
    aspect: out.width / out.height,
    paper: quad.map(([x, y]) => [fx(x), fy(y)]) as InfoStandImage["paper"],
    paperRatio: PW / PH,
  };
}

const cache = new Map<string, Promise<InfoStandImage | null>>();

/** The info stand as an image, rendered once per logo; null when WebGL isn't available. */
export function infoStandImage(logoSrc: string | null, outWidth = 700): Promise<InfoStandImage | null> {
  const key = `${logoSrc ?? ""}@${outWidth}`;
  let p = cache.get(key);
  if (!p) {
    p = render(logoSrc, outWidth).catch(() => null);
    cache.set(key, p);
  }
  return p;
}
