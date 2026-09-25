// WebGL2 renderer for the bokeh preview.
//
// Each scene layer sits at one distance, so it needs a single blur size. For
// every layer, far to near:
//   1. paint it into an off-screen texture (with a margin around the frame),
//   2. build mipmaps,
//   3. composite it onto the canvas through an aperture-shaped gather blur,
//      sampling a mip level matched to the blur so big blurs stay smooth,
//   4. draw its point lights as explicit bokeh shapes.
// Nearer layers then cover farther ones, and a blurred foreground edge
// reveals the real background behind it.

import { blurDiscMm } from "../physics/optics";
import { kernelSamples, type ApertureShape } from "./aperture";
import { CAMERA_HEIGHT_M, LAMP_POSTS, buildScene, type Layer, type Light } from "./scene";
import { spriteArt, type SpriteId } from "./sprites";

export interface RenderParams {
  focalMm: number;
  fNumber: number;
  focusMm: number;
  subjectMm: number;
  backgroundMm: number;
  frameWidthMm: number;
  horizontalAngleDeg: number;
  shape: ApertureShape;
  /** Render everything sharp, as seen through an optical viewfinder. */
  sharp?: boolean;
  /**
   * Render from a viewpoint this far to the side (metres), turned so objects
   * at the focus distance line up: the rangefinder's second image.
   */
  baselineM?: number;
}

const KERNEL_SIZE = 64;
/** Extra border painted around the frame so blur near the edges has content to sample. */
const MARGIN_FRACTION = 0.1;
const FOG_COLOR = [0.3, 0.19, 0.2] as const;

const VS = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;   // x0, y0, x1, y1 in target pixels, y down
uniform vec2 uTarget; // target size in pixels
out vec2 vUv;
void main() {
  vec2 p = mix(uRect.xy, uRect.zw, aPos);
  vUv = aPos;
  gl_Position = vec4(p.x / uTarget.x * 2.0 - 1.0, 1.0 - p.y / uTarget.y * 2.0, 0.0, 1.0);
}`;

const FS_SKY = `#version 300 es
precision highp float;
uniform vec2 uTarget;
uniform float uHorizon;
uniform float uFpx;
out vec4 o;
void main() {
  float y = uTarget.y - gl_FragCoord.y;
  float elev = degrees(atan((uHorizon - y) / uFpx));
  vec3 c = mix(vec3(0.85, 0.47, 0.28), vec3(0.62, 0.3, 0.3), smoothstep(0.0, 3.0, elev));
  c = mix(c, vec3(0.2, 0.15, 0.3), smoothstep(3.0, 12.0, elev));
  c = mix(c, vec3(0.045, 0.06, 0.14), smoothstep(12.0, 40.0, elev));
  o = vec4(c, 1.0);
}`;

const FS_SPRITE = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uFog;
uniform vec3 uFogColor;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  o = vec4(mix(c.rgb, uFogColor * c.a, uFog), c.a);
}`;

const FS_GROUND = `#version 300 es
precision highp float;
uniform vec2 uTarget;
uniform vec2 uCenter;   // optical centre in target pixels, y down
uniform float uFpx;
uniform float uCamH;
uniform float uBaselinePx;
uniform float uInvFocus;
uniform vec2 uLamps[8];
uniform int uLampCount;
uniform vec3 uFogColor;
out vec4 o;

float gridLine(vec2 g) {
  vec2 fw = fwidth(g) + 1e-5;
  vec2 d = abs(fract(g) - 0.5);
  vec2 line = 1.0 - smoothstep(0.5 - fw * 1.5, 0.5 - fw * 0.5, d);
  float fade = clamp(1.0 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
  return (1.0 - line.x * line.y) * fade;
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uTarget.y - gl_FragCoord.y);
  float dy = fc.y - uCenter.y;
  if (dy <= 0.0) discard;
  float Z = uFpx * uCamH / dy;
  float X = (fc.x - uCenter.x - uBaselinePx * (1.0 / Z - uInvFocus)) * Z / uFpx;
  float ax = abs(X);

  vec3 col;
  if (ax < 3.2) {
    col = vec3(0.075, 0.075, 0.09);
    float fw = fwidth(X) + 1e-4;
    float dash = step(fract(Z / 6.0), 0.5);
    float lane = (1.0 - smoothstep(0.07 - fw, 0.07 + fw, ax)) * dash;
    col = mix(col, vec3(0.5, 0.48, 0.45), lane * 0.6 * clamp(1.0 - fw * 4.0, 0.0, 1.0));
  } else if (ax < 3.45) {
    col = vec3(0.22, 0.21, 0.23);
  } else {
    col = mix(vec3(0.15, 0.14, 0.16), vec3(0.09, 0.085, 0.1), gridLine(vec2(X, Z) / 0.6));
  }

  float pool = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uLampCount) break;
    vec2 d = vec2(X, Z) - uLamps[i];
    pool += exp(-dot(d, d) / 9.0);
  }
  col += vec3(1.0, 0.68, 0.38) * 0.32 * pool;

  float fog = 1.0 - exp(-Z / 260.0);
  o = vec4(mix(col, uFogColor, fog * 0.9), 1.0);
}`;

const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uCanvas;
uniform float uMargin;
uniform float uRadius;
uniform float uLod;
uniform vec2 uKernel[${KERNEL_SIZE}];
uniform int uCount;
uniform float uCatEye;
out vec4 o;
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 d = uCatEye * (fc - uCanvas * 0.5) / (0.5 * length(uCanvas));
  vec4 sum = vec4(0.0);
  float n = 0.0;
  for (int i = 0; i < ${KERNEL_SIZE}; i++) {
    if (i >= uCount) break;
    vec2 k = uKernel[i];
    if (uCount > 1 && length(k - d) > 1.0) continue;
    vec2 p = fc + uMargin - k * uRadius;
    sum += textureLod(uTex, vec2(p.x / uTexSize.x, 1.0 - p.y / uTexSize.y), uLod);
    n += 1.0;
  }
  o = n > 0.0 ? sum / n : vec4(0.0);
}`;

const FS_LIGHT = `#version 300 es
precision highp float;
uniform vec2 uCanvas;
uniform vec2 uCenter;
uniform float uR;
uniform vec3 uColor;
uniform float uBlades;
uniform float uRound;
uniform float uRot;
uniform float uCatEye;
out vec4 o;

float apertureRadius(float th) {
  float sector = 6.2831853 / uBlades;
  float l = mod(th - uRot, sector) - sector * 0.5;
  float poly = cos(sector * 0.5) / cos(l);
  return mix(poly, 1.0, uRound);
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 u = (fc - uCenter) / uR;
  float r = length(u);
  float edge = apertureRadius(atan(u.y, u.x));
  vec2 d = uCatEye * (uCenter - uCanvas * 0.5) / (0.5 * length(uCanvas));
  float inside = min(edge - r, 1.0 - length(u - d)) * uR;
  float cov = clamp(inside + 0.5, 0.0, 1.0);
  float rim = 1.0 + 0.22 * smoothstep(0.55, 1.0, r / edge);
  o = vec4(uColor * cov * rim, 0.0);
}`;

function compile(gl: WebGL2RenderingContext, fs: string) {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VS],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
    }
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    u(name: string) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name)!;
    },
  };
}

type Program = ReturnType<typeof compile>;
type ProgramName = "sky" | "sprite" | "ground" | "blur" | "light";
type Rect = [number, number, number, number];

export class BokehRenderer {
  private gl: WebGL2RenderingContext;
  private programs: Record<ProgramName, Program>;
  private sprites = new Map<SpriteId, WebGLTexture>();
  private layerTex: WebGLTexture | null = null;
  private layerFbo: WebGLFramebuffer | null = null;
  private layerSize = [0, 0];

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;

    this.programs = {
      sky: compile(gl, FS_SKY),
      sprite: compile(gl, FS_SPRITE),
      ground: compile(gl, FS_GROUND),
      blur: compile(gl, FS_BLUR),
      light: compile(gl, FS_LIGHT),
    };

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    for (const [id, art] of Object.entries(spriteArt()) as [SpriteId, HTMLCanvasElement][]) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.sprites.set(id, tex);
    }
  }

  private ensureLayerTarget(width: number, height: number) {
    if (this.layerSize[0] === width && this.layerSize[1] === height) return;
    const gl = this.gl;
    if (this.layerTex) gl.deleteTexture(this.layerTex);
    if (this.layerFbo) gl.deleteFramebuffer(this.layerFbo);
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    this.layerTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.layerTex);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.layerFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.layerTex, 0);
    this.layerSize = [width, height];
  }

  render(params: RenderParams) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const margin = Math.round(W * MARGIN_FRACTION);
    const FW = W + 2 * margin;
    const FH = H + 2 * margin;
    this.ensureLayerTarget(FW, FH);

    const fpx = W / 2 / Math.tan(((params.horizontalAngleDeg / 2) * Math.PI) / 180);
    const cx = W / 2;
    const cy = H / 2;
    const camH = CAMERA_HEIGHT_M;
    // Rangefinder second image: sideways parallax, cancelled at the focus distance.
    const baselinePx = fpx * (params.baselineM ?? 0);
    const invFocusM = Number.isFinite(params.focusMm) ? 1000 / params.focusMm : 0;
    const shift = (z: number) => baselinePx * (1 / z - invFocusM);
    const project = (x: number, y: number, z: number) =>
      [cx + (fpx * x) / z + shift(z), cy - (fpx * (y - camH)) / z] as const;
    const blurRadius = (zM: number) =>
      params.sharp
        ? 0
        : ((blurDiscMm(params.focalMm, params.fNumber, params.focusMm, zM * 1000) / params.frameWidthMm) * W) / 2;
    const fog = (zM: number) => (1 - Math.exp(-zM / 260)) * 0.9;

    const { shape } = params;
    const kernel = new Float32Array(kernelSamples(KERNEL_SIZE, shape).flat());
    const powerScale = 900 * (W / 1000) ** 2;

    const layers = buildScene(params.subjectMm / 1000, params.backgroundMm / 1000);

    // Sky, straight onto the canvas: a smooth gradient needs no blur.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    this.use("sky", [0, 0, W, H], [W, H]);
    gl.uniform1f(this.programs.sky.u("uHorizon"), cy);
    gl.uniform1f(this.programs.sky.u("uFpx"), fpx);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    for (const layer of layers) {
      const r = blurRadius(layer.z);
      const bounds = this.layerBounds(layer, project, fpx, cy, W, H, r);
      if (!bounds) continue;

      // 1. Paint the layer into the margin-padded texture.
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);
      gl.viewport(0, 0, FW, FH);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.paintLayer(layer, project, fpx, cx, cy, margin, FW, FH, H, r, fog(layer.z), baselinePx, invFocusM);

      // 2. Mipmaps for the blur.
      gl.bindTexture(gl.TEXTURE_2D, this.layerTex);
      gl.generateMipmap(gl.TEXTURE_2D);

      // 3. Blur-composite onto the canvas.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const [bx0, by0, bx1, by1] = bounds;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(bx0, H - by1, bx1 - bx0, by1 - by0);
      const blur = this.use("blur", [0, 0, W, H], [W, H]);
      const count = r < 0.6 ? 1 : KERNEL_SIZE;
      const spacing = r * Math.sqrt(Math.PI / KERNEL_SIZE);
      gl.uniform1i(blur.u("uTex"), 0);
      gl.uniform2f(blur.u("uTexSize"), FW, FH);
      gl.uniform2f(blur.u("uCanvas"), W, H);
      gl.uniform1f(blur.u("uMargin"), margin);
      gl.uniform1f(blur.u("uRadius"), count === 1 ? 0 : r);
      gl.uniform1f(blur.u("uLod"), count === 1 ? 0 : Math.max(0, Math.log2(spacing)));
      gl.uniform2fv(blur.u("uKernel"), kernel);
      gl.uniform1i(blur.u("uCount"), count);
      gl.uniform1f(blur.u("uCatEye"), shape.catEye);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.SCISSOR_TEST);

      // 4. Point lights as bokeh, added on top of their own layer.
      if (layer.lights.length) {
        gl.blendFunc(gl.ONE, gl.ONE);
        this.drawLights(layer.lights, project, blurRadius, fog, shape, powerScale, W, H);
      }
    }
  }

  /** Canvas-space box the blurred layer can touch, or null when off-screen. */
  private layerBounds(
    layer: Layer,
    project: (x: number, y: number, z: number) => readonly [number, number],
    fpx: number,
    cy: number,
    W: number,
    H: number,
    r: number
  ): Rect | null {
    let x0: number, y0: number, x1: number, y1: number;
    if (layer.kind === "ground") {
      x0 = 0;
      x1 = W;
      y0 = Number.isFinite(layer.zFar) ? cy + (fpx * CAMERA_HEIGHT_M) / layer.zFar : cy;
      y1 = cy + (fpx * CAMERA_HEIGHT_M) / layer.zNear;
      y0 -= r + 2; // the painted band reaches this far toward the horizon, see paintLayer
    } else {
      const [ax, ay] = project(layer.x0, layer.y1, layer.z);
      const [bx, by] = project(layer.x1, layer.y0, layer.z);
      x0 = Math.min(ax, bx);
      x1 = Math.max(ax, bx);
      y0 = ay;
      y1 = by;
    }
    let pad = r + 2;
    for (const l of layer.lights) {
      const [lx, ly] = project(l.x, l.y, l.z);
      x0 = Math.min(x0, lx);
      x1 = Math.max(x1, lx);
      y0 = Math.min(y0, ly);
      y1 = Math.max(y1, ly);
      pad = Math.max(pad, r + 4);
    }
    const rect: Rect = [
      Math.max(0, Math.floor(x0 - pad)),
      Math.max(0, Math.floor(y0 - pad)),
      Math.min(W, Math.ceil(x1 + pad)),
      Math.min(H, Math.ceil(y1 + pad)),
    ];
    return rect[2] > rect[0] && rect[3] > rect[1] ? rect : null;
  }

  private paintLayer(
    layer: Layer,
    project: (x: number, y: number, z: number) => readonly [number, number],
    fpx: number,
    cx: number,
    cy: number,
    margin: number,
    FW: number,
    FH: number,
    H: number,
    r: number,
    fogAmount: number,
    baselinePx: number,
    invFocusM: number
  ) {
    const gl = this.gl;
    if (layer.kind === "ground") {
      // Paint past the slice's far edge by the blur radius, so the blurred
      // edge overlaps the next slice instead of leaving a see-through seam.
      const yFar = Number.isFinite(layer.zFar) ? cy + (fpx * CAMERA_HEIGHT_M) / layer.zFar : cy;
      const yTop = Math.max(cy, yFar - r - 2);
      const yBottom = Math.min(H + margin, cy + (fpx * CAMERA_HEIGHT_M) / layer.zNear);
      if (yBottom <= yTop) return;
      const g = this.use("ground", [0, yTop + margin, FW, yBottom + margin], [FW, FH]);
      gl.uniform2f(g.u("uCenter"), cx + margin, cy + margin);
      gl.uniform1f(g.u("uFpx"), fpx);
      gl.uniform1f(g.u("uCamH"), CAMERA_HEIGHT_M);
      gl.uniform1f(g.u("uBaselinePx"), baselinePx);
      gl.uniform1f(g.u("uInvFocus"), invFocusM);
      gl.uniform3f(g.u("uFogColor"), ...FOG_COLOR);
      const lamps = LAMP_POSTS.slice(0, 8).flatMap((p) => [p.x * 0.8, p.z]);
      gl.uniform2fv(g.u("uLamps"), new Float32Array(lamps));
      gl.uniform1i(g.u("uLampCount"), Math.min(8, LAMP_POSTS.length));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    const [ax, ay] = project(layer.x0, layer.y1, layer.z);
    const [bx, by] = project(layer.x1, layer.y0, layer.z);
    const s = this.use("sprite", [ax + margin, ay + margin, bx + margin, by + margin], [FW, FH]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sprites.get(layer.sprite)!);
    gl.uniform1i(s.u("uTex"), 0);
    gl.uniform1f(s.u("uFog"), fogAmount);
    gl.uniform3f(s.u("uFogColor"), ...FOG_COLOR);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawLights(
    lights: Light[],
    project: (x: number, y: number, z: number) => readonly [number, number],
    blurRadius: (z: number) => number,
    fog: (z: number) => number,
    shape: ApertureShape,
    powerScale: number,
    W: number,
    H: number
  ) {
    const gl = this.gl;
    const p = this.programs.light;
    gl.useProgram(p.program);
    gl.uniform2f(p.u("uTarget"), W, H);
    gl.uniform2f(p.u("uCanvas"), W, H);
    gl.uniform1f(p.u("uBlades"), shape.blades);
    gl.uniform1f(p.u("uRound"), shape.roundness);
    gl.uniform1f(p.u("uRot"), shape.rotation);
    gl.uniform1f(p.u("uCatEye"), shape.catEye);
    for (const light of lights) {
      const [x, y] = project(light.x, light.y, light.z);
      const R = Math.max(blurRadius(light.z), 1.1);
      if (x < -R || x > W + R || y < -R || y > H + R) continue;
      const intensity = (1 - Math.exp((-light.power * powerScale) / (Math.PI * R * R))) * (1 - fog(light.z) * 0.6);
      const [cr, cg, cb] = light.color;
      gl.uniform4f(p.u("uRect"), x - R - 2, y - R - 2, x + R + 2, y + R + 2);
      gl.uniform2f(p.u("uCenter"), x, y);
      gl.uniform1f(p.u("uR"), R);
      gl.uniform3f(p.u("uColor"), cr * intensity, cg * intensity, cb * intensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  private use(name: ProgramName, rect: Rect, target: [number, number]) {
    const gl = this.gl;
    const p = this.programs[name];
    gl.useProgram(p.program);
    gl.uniform4f(p.u("uRect"), ...rect);
    gl.uniform2f(p.u("uTarget"), ...target);
    return p;
  }
}
