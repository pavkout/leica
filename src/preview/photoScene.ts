// Real photographs with a depth map. Depth Anything V2 gives relative inverse
// depth v ∈ [0, 1] (1 = nearest). We turn it into metres with one known
// distance: 1/z = k · (v − v0), with v0 the farthest value (the sky → ∞).

export interface PhotoSceneInfo {
  id: string;
  name: string;
  /** Scene brightness, EV at ISO 100. */
  ev100: number;
  /** Horizontal field of view the photo was taken with. */
  fovDeg: number;
  /** A point in the photo (0–1) and how far away it was. */
  anchor: { u: number; v: number; distanceM: number };
  image: string;
  depth: string;
  credit: string;
  sourceUrl?: string;
}

const COMMONS_CREDIT = "Photo: Fons Heijnsbroek, CC0, via Wikimedia Commons";

export const SAMPLE_SCENES: PhotoSceneInfo[] = [
  {
    id: "amsterdam-night",
    name: "Amsterdam, Christmas lights",
    ev100: 4,
    fovDeg: 62,
    anchor: { u: 0.25, v: 0.62, distanceM: 12 },
    image: "scenes/night.jpg",
    depth: "scenes/night-depth.png",
    credit: COMMONS_CREDIT,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2024_-_Photo_of_the_street_Koningsstraat_and_square_Nieuwmarkt_with_Christmas_lights_by_night_in_Amsterdam_city_in_winter_-_free_image_of_street_photography_in_The_Netherlands_by_Fons_Heijnsbroek.jpg",
  },
  {
    id: "utrecht-rain",
    name: "Utrecht, a rainy afternoon",
    ev100: 10,
    fovDeg: 62,
    anchor: { u: 0.77, v: 0.74, distanceM: 3.5 },
    image: "scenes/rain.jpg",
    depth: "scenes/rain-depth.png",
    credit: COMMONS_CREDIT,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:024-02_-_free_download_photo_of_people_shopping_and_walking_with_umbrellas_in_the_shopping_street_Steenweg_in_Utrecht_city_on_a_rainy_day_with_lighting_shop_shop_windows._Street_photography_in_high_resolution_photos_by_Fons_Heijnsbroek.tif",
  },
  {
    id: "amsterdam-sun",
    name: "Amsterdam, spring sunshine",
    ev100: 14,
    fovDeg: 62,
    anchor: { u: 0.24, v: 0.62, distanceM: 2.2 },
    image: "scenes/sun.jpg",
    depth: "scenes/sun-depth.png",
    credit: COMMONS_CREDIT,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2023_Amsterdam_poto_-_Woman_are_walking_the_pedestrian_crossing_over_the_city_road_Stadhouderskade_in_early_Spring_sunlight;_free_download_photo_in_high_resolutions_by_Fons_Heijnbroek_,_street_photography_in_The_Netherlands,_CCO.jpg",
  },
];

/** A loaded photo scene, ready for the renderer. */
export interface PhotoScene {
  key: string;
  image: TexImageSource;
  depth: TexImageSource;
  aspect: number;
  fovDeg: number;
  /** Inverse depth (1/m) = k · (v − v0). */
  k: number;
  v0: number;
  /** Low-resolution depth values for statistics and tap-to-focus. */
  sample: { data: Float32Array; width: number; height: number };
}

const SAMPLE_WIDTH = 160;

function sampleDepth(source: CanvasImageSource, width: number, height: number) {
  const w = SAMPLE_WIDTH;
  const h = Math.max(1, Math.round((height / width) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4] / 255;
  return { data, width: w, height: h };
}

export function depthAt(sample: PhotoScene["sample"], u: number, v: number) {
  const x = Math.min(sample.width - 1, Math.max(0, Math.round(u * (sample.width - 1))));
  const y = Math.min(sample.height - 1, Math.max(0, Math.round(v * (sample.height - 1))));
  return sample.data[y * sample.width + x];
}

/** Farthest depth value in the photo, treated as infinity. */
function farthest(sample: PhotoScene["sample"]) {
  const sorted = Float32Array.from(sample.data).sort();
  return sorted[Math.floor(sorted.length * 0.005)];
}

/** Calibrates so the anchor point sits at its known distance. */
export function calibrate(sample: PhotoScene["sample"], anchor: { u: number; v: number; distanceM: number }) {
  const v0 = farthest(sample);
  const va = Math.max(depthAt(sample, anchor.u, anchor.v) - v0, 0.02);
  return { v0, k: 1 / (anchor.distanceM * va) };
}

/** Distance in metres at a point of the photo (u, v in 0–1). */
export function distanceAt(scene: PhotoScene, u: number, v: number) {
  const inv = (depthAt(scene.sample, u, v) - scene.v0) * scene.k;
  return inv <= 1e-4 ? Infinity : 1 / inv;
}

/** Nearest distance anywhere in the photo. */
export function nearestDistance(scene: PhotoScene) {
  let max = 0;
  for (const v of scene.sample.data) max = Math.max(max, v);
  return 1 / Math.max((max - scene.v0) * scene.k, 1e-4);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${url}`));
    img.src = url;
  });
}

export async function loadSampleScene(info: PhotoSceneInfo): Promise<PhotoScene> {
  const [image, depth] = await Promise.all([loadImage(info.image), loadImage(info.depth)]);
  const sample = sampleDepth(depth, depth.naturalWidth, depth.naturalHeight);
  return {
    key: info.id,
    image,
    depth,
    aspect: image.naturalWidth / image.naturalHeight,
    fovDeg: info.fovDeg,
    sample,
    ...calibrate(sample, info.anchor),
  };
}

/** Builds a scene from a photo and a depth canvas (e.g. from in-browser estimation). */
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function sceneFromCanvases(key: string, image: AnyCanvas, depth: AnyCanvas, fovDeg: number, anchor: { u: number; v: number; distanceM: number }): PhotoScene {
  const sample = sampleDepth(depth, depth.width, depth.height);
  return { key, image, depth, aspect: image.width / image.height, fovDeg, sample, ...calibrate(sample, anchor) };
}

/** Maps a point in the rendered frame (0–1) to the photo, given the lens's field of view. */
export function frameToPhoto(scene: PhotoScene, frameAspect: number, lensFovDeg: number, x: number, y: number) {
  const ratio = Math.tan((lensFovDeg * Math.PI) / 360) / Math.tan((scene.fovDeg * Math.PI) / 360);
  return {
    u: 0.5 + (x - 0.5) * ratio,
    v: 0.5 + ((y - 0.5) / frameAspect) * ratio * scene.aspect,
  };
}
