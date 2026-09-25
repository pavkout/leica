// Scene artwork, painted once with Canvas 2D and uploaded as textures.
// The look is a dusk street: dark shapes, warm windows, a red scarf.

export type SpriteId = "person" | "tree" | "lamp" | "facade" | "skyline" | "branch" | "car";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function paintPerson() {
  // 0.56 m × 1.76 m, seen from behind, looking down the street.
  const { c, ctx } = canvas(224, 704);
  const s = 400; // px per metre
  const at = (x: number, y: number) => [x * s, (1.76 - y) * s] as const;

  // Legs and shoes
  ctx.fillStyle = "#1a1b20";
  ctx.fillRect(...at(0.17, 0.86), 0.1 * s, 0.84 * s);
  ctx.fillRect(...at(0.3, 0.86), 0.1 * s, 0.84 * s);
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(...at(0.16, 0.05), 0.12 * s, 0.05 * s);
  ctx.fillRect(...at(0.3, 0.05), 0.12 * s, 0.05 * s);

  // Coat, lit from the warm street on the right
  const coat = ctx.createLinearGradient(0, 0, c.width, 0);
  coat.addColorStop(0, "#1c1d22");
  coat.addColorStop(0.7, "#30313a");
  coat.addColorStop(1, "#3d3634");
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(...at(0.1, 1.4));
  ctx.quadraticCurveTo(...at(0.28, 1.47), ...at(0.46, 1.4));
  ctx.quadraticCurveTo(...at(0.53, 1.3), ...at(0.52, 1.05));
  ctx.lineTo(...at(0.5, 0.7));
  ctx.lineTo(...at(0.06, 0.7));
  ctx.lineTo(...at(0.04, 1.05));
  ctx.quadraticCurveTo(...at(0.03, 1.3), ...at(0.1, 1.4));
  ctx.closePath();
  ctx.fill();
  // Back seam and belt
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(...at(0.275, 1.38), 0.01 * s, 0.68 * s);
  ctx.fillRect(...at(0.06, 1.0), 0.44 * s, 0.035 * s);
  // Arms, hands in pockets
  ctx.fillStyle = "#26272d";
  for (const [x, tilt] of [[0.06, 0.06], [0.5, -0.06]] as const) {
    ctx.beginPath();
    ctx.ellipse(...at(x, 1.12), 0.05 * s, 0.27 * s, tilt, 0, Math.PI * 2);
    ctx.fill();
  }

  // Neck and ears, then hair
  ctx.fillStyle = "#b07b60";
  ctx.fillRect(...at(0.245, 1.53), 0.07 * s, 0.08 * s);
  ctx.beginPath();
  ctx.ellipse(...at(0.195, 1.62), 0.014 * s, 0.028 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(...at(0.365, 1.62), 0.014 * s, 0.028 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const hair = ctx.createRadialGradient(...at(0.33, 1.7), 4, ...at(0.28, 1.63), 0.13 * s);
  hair.addColorStop(0, "#4a3326");
  hair.addColorStop(1, "#1a120e");
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(...at(0.28, 1.64), 0.085 * s, 0.11 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Red scarf around the collar, one end hanging down the back
  ctx.fillStyle = "#cf2e25";
  ctx.beginPath();
  ctx.ellipse(...at(0.28, 1.47), 0.13 * s, 0.05 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(...at(0.33, 1.46));
  ctx.rotate(0.06);
  ctx.fillRect(0, 0, 0.075 * s, 0.34 * s);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0.3 * s, 0.075 * s, 0.04 * s);
  ctx.restore();
  return c;
}

function paintTree() {
  // 4 m × 6 m
  const { c, ctx } = canvas(400, 600);
  const rand = mulberry32(7);
  ctx.fillStyle = "#1e1612";
  ctx.fillRect(186, 330, 28, 270);
  for (let i = 0; i < 26; i++) {
    const x = 200 + (rand() - 0.5) * 300;
    const y = 200 + (rand() - 0.5) * 260;
    const r = 50 + rand() * 60;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, i % 3 ? "#2c3b2a" : "#3a4a2f");
    g.addColorStop(1, "#18221a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function paintLamp() {
  // 0.8 m × 4.4 m, arm reaching toward the street on the right
  const { c, ctx } = canvas(80, 440);
  ctx.fillStyle = "#101012";
  ctx.fillRect(12, 20, 7, 420);
  ctx.fillRect(8, 400, 15, 40);
  ctx.fillRect(12, 18, 50, 5);
  ctx.fillStyle = "#1c1c1f";
  ctx.beginPath();
  ctx.moveTo(48, 22);
  ctx.lineTo(74, 22);
  ctx.lineTo(68, 34);
  ctx.lineTo(54, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe2b0";
  ctx.fillRect(55, 33, 12, 3);
  return c;
}

function paintFacade() {
  // 36 m × 13 m, with a lit café window in the middle of the ground floor
  const { c, ctx } = canvas(1728, 624);
  const s = 48; // px per metre
  const rand = mulberry32(42);
  const stone = ctx.createLinearGradient(0, 0, 0, c.height);
  stone.addColorStop(0, "#2a2528");
  stone.addColorStop(1, "#3a3031");
  ctx.fillStyle = stone;
  ctx.fillRect(0, 0, c.width, c.height);

  // Vertical bays between buildings
  for (let x = 0; x < 36; x += 6 + rand() * 3) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.03)";
    ctx.fillRect(x * s, 0, (3 + rand() * 4) * s, c.height);
  }

  // Upper-floor windows
  for (let floor = 0; floor < 3; floor++) {
    const y = (13 - 4.4 - floor * 3.1) * s;
    for (let x = 0.8; x < 35; x += 2.2) {
      if (Math.abs(x - 18) < 1.5 && floor === 0) continue;
      const lit = rand() < 0.38;
      const w = 1.1 * s;
      const h = 1.7 * s;
      if (lit) {
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, "#f6c27a");
        g.addColorStop(1, "#b76a2e");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = rand() < 0.5 ? "#15161c" : "#1d2029";
      }
      ctx.fillRect(x * s, y, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x * s + w / 2 - 1, y, 2, h);
    }
  }

  // Ground floor: dark shopfronts with a warm café in the centre
  ctx.fillStyle = "#141416";
  ctx.fillRect(0, (13 - 3.2) * s, c.width, 3.2 * s);
  for (const [x0, x1] of [[2, 8], [24, 31]] as const) {
    ctx.fillStyle = "#1f2530";
    ctx.fillRect(x0 * s, (13 - 2.8) * s, (x1 - x0) * s, 2.2 * s);
  }
  const cafe = ctx.createRadialGradient(18 * s, (13 - 1.4) * s, 10, 18 * s, (13 - 1.4) * s, 4.5 * s);
  cafe.addColorStop(0, "#c77a3a");
  cafe.addColorStop(0.6, "#7a3f1c");
  cafe.addColorStop(1, "#3a1d10");
  ctx.fillStyle = cafe;
  ctx.fillRect(14 * s, (13 - 2.9) * s, 8 * s, 2.6 * s);
  // Awning
  ctx.fillStyle = "#8f0d15";
  ctx.fillRect(13.6 * s, (13 - 3.3) * s, 8.8 * s, 0.35 * s);
  // Window mullions
  ctx.fillStyle = "rgba(10,10,10,0.8)";
  for (let x = 14; x <= 22; x += 2) ctx.fillRect(x * s - 2, (13 - 2.9) * s, 4, 2.6 * s);
  return c;
}

function paintSkyline() {
  // 5000 m × 140 m of distant city
  const { c, ctx } = canvas(4096, 128);
  const rand = mulberry32(3);
  ctx.fillStyle = "#12141f";
  let x = 0;
  while (x < c.width) {
    const w = 20 + rand() * 90;
    const h = 20 + rand() * 90 * (rand() < 0.12 ? 1.4 : 1);
    ctx.fillRect(x, c.height - Math.min(h, c.height), w, h);
    for (let i = 0; i < w * h * 0.004; i++) {
      ctx.fillStyle = rand() < 0.7 ? "#d9a45d" : "#9fb3d6";
      ctx.fillRect(x + rand() * w, c.height - rand() * h * 0.95, 1.5, 1.5);
    }
    ctx.fillStyle = "#12141f";
    x += w - 2;
  }
  return c;
}

function paintBranch() {
  // 0.7 m × 0.8 m of leaves hanging into the top-left corner
  const { c, ctx } = canvas(420, 480);
  const rand = mulberry32(11);
  ctx.strokeStyle = "#1a140f";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.quadraticCurveTo(200, 60, 380, 300);
  ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const t = rand();
    const x = t * 360 + (rand() - 0.5) * 60;
    const y = 30 + t * t * 270 + (rand() - 0.2) * 90;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = rand() < 0.3 ? "#3f5634" : rand() < 0.5 ? "#2a3a25" : "#1e2a1b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

function paintCar() {
  // Rear view, 1.8 m × 1.4 m
  const { c, ctx } = canvas(360, 280);
  ctx.fillStyle = "#17181d";
  ctx.beginPath();
  ctx.moveTo(10, 250);
  ctx.lineTo(10, 140);
  ctx.quadraticCurveTo(20, 110, 70, 100);
  ctx.lineTo(95, 30);
  ctx.quadraticCurveTo(180, 15, 265, 30);
  ctx.lineTo(290, 100);
  ctx.quadraticCurveTo(340, 110, 350, 140);
  ctx.lineTo(350, 250);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(105, 42, 150, 55);
  ctx.fillStyle = "#4a0a0c";
  ctx.fillRect(18, 128, 60, 22);
  ctx.fillRect(282, 128, 60, 22);
  ctx.fillStyle = "#050505";
  ctx.fillRect(28, 245, 50, 35);
  ctx.fillRect(282, 245, 50, 35);
  return c;
}

let cache: Record<SpriteId, HTMLCanvasElement> | null = null;

export function spriteArt(): Record<SpriteId, HTMLCanvasElement> {
  cache ??= {
    person: paintPerson(),
    tree: paintTree(),
    lamp: paintLamp(),
    facade: paintFacade(),
    skyline: paintSkyline(),
    branch: paintBranch(),
    car: paintCar(),
  };
  return cache;
}
