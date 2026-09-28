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
import type { FilmLook } from "./film";
import type { PhotoScene } from "./photoScene";
import { spriteArt, type SpriteId } from "./sprites";

/** What happens after the lens: exposure, film or sensor, and the photographer's hands. */
export interface DevelopParams {
  /** Stops over (+) or under (−) the correct exposure. */
  exposureStops: number;
  look: FilmLook;
  /** Grain or noise strength (0 = none). */
  grain: number;
  /** Lens vignetting at the frame corner, in stops. */
  vignetteStops: number;
  /** Camera-shake blur as a fraction of the frame width, and its direction. */
  shake: number;
  shakeAngle: number;
  /** Varies the grain pattern from frame to frame. */
  seed: number;
}

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
  /** Film/sensor processing; omitted for the optical viewfinder. */
  develop?: DevelopParams;
  /** Render this photograph (with its depth map) instead of the illustrated street. */
  photo?: PhotoScene;
}

/** Depth slices for photos, evenly spaced in inverse depth (which is evenly spaced in blur). */
const PHOTO_SLICES = 20;

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
// Photos: which pixels are visible at this depth (not hidden by nearer ones).
uniform sampler2D uSupport;
uniform int uUseSupport;
uniform float uShift;
out vec4 o;
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 d = uCatEye * (fc - uCanvas * 0.5) / (0.5 * length(uCanvas));
  vec4 sum = vec4(0.0);
  float n = 0.0;
  float support = 0.0;
  for (int i = 0; i < ${KERNEL_SIZE}; i++) {
    if (i >= uCount) break;
    vec2 k = uKernel[i];
    if (uCount > 1 && length(k - d) > 1.0) continue;
    vec2 p = fc + uMargin - k * uRadius - vec2(uShift, 0.0);
    vec2 uv = vec2(p.x / uTexSize.x, 1.0 - p.y / uTexSize.y);
    sum += textureLod(uTex, uv, uLod);
    if (uUseSupport == 1) support += textureLod(uSupport, uv, uLod).r;
    n += 1.0;
  }
  // Hidden samples are unknown, not transparent: average over the visible ones.
  float norm = uUseSupport == 1 ? support : n;
  o = norm > 0.001 ? sum / norm : vec4(0.0);
}`;

const FS_PHOTO = `#version 300 es
precision highp float;
uniform sampler2D uPhoto;
uniform sampler2D uDepth;
uniform vec2 uTarget;
uniform vec2 uCanvas;
uniform float uMargin;
uniform float uFovRatio;
uniform float uAspect;
uniform float uK;
uniform float uV0;
uniform float uPrev;   // inverse depth of the neighbouring slice centres
uniform float uCenter;
uniform float uNext;
uniform int uPlate;
uniform float uBoost;
layout(location = 0) out vec4 o;
layout(location = 1) out vec4 s;
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uTarget.y - gl_FragCoord.y) - uMargin;
  vec2 uv = 0.5 + (fc - uCanvas * 0.5) / uCanvas.x * uFovRatio * vec2(1.0, uAspect);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    // Outside the photo (a lens wider than it was taken with).
    o = uPlate == 1 ? vec4(0.03, 0.03, 0.03, 1.0) : vec4(0.0);
    s = vec4(1.0);
    return;
  }
  vec3 c = texture(uPhoto, uv).rgb;
  float inv = max(texture(uDepth, uv).r - uV0, 0.0) * uK;
  // Near-white points are light sources: give them the energy to become bokeh.
  float peak = max(c.r, max(c.g, c.b));
  c *= 1.0 + uBoost * smoothstep(0.8, 1.0, peak);
  float m;
  if (uPlate == 1) m = 1.0;
  else if (inv < uCenter) m = uPrev < 0.0 ? 1.0 : clamp((inv - uPrev) / (uCenter - uPrev), 0.0, 1.0);
  else m = uNext < 0.0 ? 1.0 : clamp((uNext - inv) / (uNext - uCenter), 0.0, 1.0);
  o = vec4(c * m, m);
  s = vec4(uPlate == 1 || uNext < 0.0 || inv <= uNext ? 1.0 : 0.0);
}`;

const FS_DEVELOP = `#version 300 es
precision highp float;
uniform sampler2D uImg;
uniform vec2 uTarget;
uniform float uExposure;
uniform int uCurve;          // 0 = digital clip, 1 = film curve
uniform float uMono;
uniform float uSoft;
uniform float uBias;
uniform float uSat;
uniform vec3 uBalance;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uBlackLift;
uniform float uGrain;
uniform float uGrainSize;
uniform float uGrainColor;
uniform float uHalation;
uniform float uHalLod;
uniform float uVignette;
uniform vec2 uShake;         // full blur length in pixels
uniform float uSeed;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Smooth value noise in [-1, 1].
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}

float grain(vec2 p) {
  return vnoise(p) * 0.7 + vnoise(p * 2.3 + 17.0) * 0.3;
}

vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;

  // Camera shake: the image smeared along a line.
  vec3 c = vec3(0.0);
  const int TAPS = 12;
  for (int i = 0; i < TAPS; i++) {
    float t = float(i) / float(TAPS - 1) - 0.5;
    c += texture(uImg, uv + uShake * t / uTarget).rgb;
  }
  vec3 lin = toLinear(c / float(TAPS));

  // Lens vignetting, strongest in the corners.
  vec2 d = (uv - 0.5) * vec2(uTarget.x / uTarget.y, 1.0);
  float r2 = dot(d, d) / dot(vec2(0.5 * uTarget.x / uTarget.y, 0.5), vec2(0.5 * uTarget.x / uTarget.y, 0.5));
  lin *= exp2(-uVignette * pow(r2, 1.15));

  // Halation: light scattered back from the film base glows red around highlights.
  if (uHalation > 0.0) {
    // A tight glow hugging each light plus a wider, fainter bloom.
    float tight = dot(toLinear(textureLod(uImg, uv, uHalLod - 2.0).rgb), vec3(0.3, 0.5, 0.2));
    float wide = dot(toLinear(textureLod(uImg, uv, uHalLod).rgb), vec3(0.3, 0.5, 0.2));
    float h = max(tight - 0.3, 0.0) * 1.4 + max(wide - 0.15, 0.0) * 1.2;
    lin += uHalation * vec3(1.0, 0.18, 0.05) * h;
  }

  lin *= uBalance * exp2(uExposure);
  float Y = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  lin = mix(vec3(Y), lin, uSat);
  if (uMono > 0.5) lin = vec3(dot(lin, vec3(0.3, 0.59, 0.11)));

  vec3 y;
  if (uCurve == 0) {
    // Digital: linear until the sensor clips.
    y = pow(clamp(lin, 0.0, 1.0), vec3(1.0 / 2.2));
  } else {
    vec3 stops = log2(max(lin, 1e-5) / 0.18);
    y = 0.5 + 0.5 * tanh((stops + uBias) / uSoft);
  }
  y += uShadowTint * (1.0 - y) * (1.0 - y) + uHighlightTint * y * y;
  y = uBlackLift + y * (1.0 - uBlackLift);

  // Grain strongest in the midtones (film) or noise strongest in shadows (digital).
  if (uGrain > 0.0) {
    vec2 gp = gl_FragCoord.xy / uGrainSize;
    float lum = dot(y, vec3(0.3, 0.59, 0.11));
    float weight = uCurve == 0 ? (1.15 - lum) : 4.0 * lum * (1.0 - lum) + 0.15;
    float g = grain(gp);
    vec3 gc = vec3(grain(gp + 31.7), grain(gp + 63.1), grain(gp + 94.3));
    vec3 n = mix(vec3(g), gc, uGrainColor * (1.0 - uMono));
    y += uGrain * 0.09 * weight * n;
  }

  o = vec4(clamp(y, 0.0, 1.0), 1.0);
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
type ProgramName = "sky" | "sprite" | "ground" | "blur" | "light" | "develop" | "photo";
type Rect = [number, number, number, number];

export class BokehRenderer {
  private gl: WebGL2RenderingContext;
  private programs: Record<ProgramName, Program>;
  private sprites = new Map<SpriteId, WebGLTexture>();
  private layerTex: WebGLTexture | null = null;
  private layerFbo: WebGLFramebuffer | null = null;
  private layerSize = [0, 0];
  private layerCache = new Map<string, { tex: WebGLTexture; support: WebGLTexture; fbo: WebGLFramebuffer }>();
  private imageCache = new Map<string, { tex: WebGLTexture; fbo: WebGLFramebuffer }>();
  private supportTex: WebGLTexture | null = null;
  private photoKey: string | null = null;
  private photoTex: WebGLTexture | null = null;
  private depthTex: WebGLTexture | null = null;
  private imageTex: WebGLTexture | null = null;
  private imageFbo: WebGLFramebuffer | null = null;
  private imageSize = [0, 0];
  /** Half-float image buffer, so highlights can exceed white before the film curve. */
  private hdr: boolean;

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
      develop: compile(gl, FS_DEVELOP),
      photo: compile(gl, FS_PHOTO),
    };
    this.hdr = gl.getExtension("EXT_color_buffer_float") !== null;

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
    // Two sizes stay allocated (full and interactive quality), so switching while a ring turns costs nothing.
    const key = `${width}x${height}`;
    const hit = this.layerCache.get(key);
    if (hit) {
      [this.layerTex, this.supportTex, this.layerFbo] = [hit.tex, hit.support, hit.fbo];
      this.layerSize = [width, height];
      return;
    }
    if (this.layerCache.size >= 2) {
      const [oldKey, old] = this.layerCache.entries().next().value as [string, { tex: WebGLTexture; support: WebGLTexture; fbo: WebGLFramebuffer }];
      gl.deleteTexture(old.tex);
      gl.deleteTexture(old.support);
      gl.deleteFramebuffer(old.fbo);
      this.layerCache.delete(oldKey);
    }
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    const make = (format: number) => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, levels, format, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    // Half float lets photo highlights exceed white, so they bloom into bokeh.
    this.layerTex = make(this.hdr ? gl.RGBA16F : gl.RGBA8);
    this.supportTex = make(gl.RGBA8);
    this.layerFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.layerTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.supportTex, 0);
    this.layerSize = [width, height];
    this.layerCache.set(key, { tex: this.layerTex!, support: this.supportTex!, fbo: this.layerFbo! });
  }

  /** Clears the layer target: transparent colour, full support. */
  private clearLayer() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [1, 1, 1, 1]);
  }

  /** Blurs the painted layer through the aperture and composites it onto the image. */
  private compositeLayer(
    bounds: Rect,
    r: number,
    opts: { W: number; H: number; FW: number; FH: number; margin: number; kernel: Float32Array; catEye: number; shift?: number; useSupport?: boolean }
  ) {
    const gl = this.gl;
    const { W, H, FW, FH, margin } = opts;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.supportTex);
    if (opts.useSupport) gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.layerTex);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.imageFbo);
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
    gl.uniform1i(blur.u("uSupport"), 1);
    gl.uniform1i(blur.u("uUseSupport"), opts.useSupport ? 1 : 0);
    gl.uniform1f(blur.u("uShift"), opts.shift ?? 0);
    gl.uniform2f(blur.u("uTexSize"), FW, FH);
    gl.uniform2f(blur.u("uCanvas"), W, H);
    gl.uniform1f(blur.u("uMargin"), margin);
    gl.uniform1f(blur.u("uRadius"), count === 1 ? 0 : r);
    gl.uniform1f(blur.u("uLod"), count === 1 ? 0 : Math.max(0, Math.log2(spacing)));
    gl.uniform2fv(blur.u("uKernel"), opts.kernel);
    gl.uniform1i(blur.u("uCount"), count);
    gl.uniform1f(blur.u("uCatEye"), opts.catEye);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  }

  private uploadPhoto(photo: PhotoScene) {
    if (this.photoKey === photo.key) return;
    const gl = this.gl;
    for (const t of [this.photoTex, this.depthTex]) if (t) gl.deleteTexture(t);
    const upload = (source: TexImageSource, mip: boolean) => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    this.photoTex = upload(photo.image, true);
    this.depthTex = upload(photo.depth, false);
    this.photoKey = photo.key;
  }

  /**
   * A photograph sliced by depth: each slice (evenly spaced in inverse depth)
   * is blurred by the physically correct amount for its distance, far to near.
   */
  private renderPhoto(
    params: RenderParams,
    photo: PhotoScene,
    ctx: { W: number; H: number; FW: number; FH: number; margin: number; fpx: number; kernel: Float32Array; baselinePx: number; invFocusM: number }
  ) {
    const gl = this.gl;
    const { W, H, FW, FH, margin, kernel } = ctx;
    this.uploadPhoto(photo);

    const blurAtInv = (inv: number) =>
      params.sharp
        ? 0
        : ((blurDiscMm(params.focalMm, params.fNumber, params.focusMm, inv > 1e-6 ? 1000 / inv : Infinity) / params.frameWidthMm) * W) / 2;
    const fovRatio = Math.tan((params.horizontalAngleDeg * Math.PI) / 360) / Math.tan((photo.fovDeg * Math.PI) / 360);

    // Slice centres from infinity (0) to the nearest point in the photo.
    let maxV = 0;
    for (const v of photo.sample.data) maxV = Math.max(maxV, v);
    const invMax = Math.max((maxV - photo.v0) * photo.k, 1e-3);
    const centers = Array.from({ length: PHOTO_SLICES }, (_, i) => (invMax * i) / (PHOTO_SLICES - 1));

    // Which slices have any pixels, and where (in photo coordinates).
    const present = new Array(PHOTO_SLICES).fill(false);
    const step = invMax / (PHOTO_SLICES - 1);
    for (const v of photo.sample.data) {
      const inv = Math.max(v - photo.v0, 0) * photo.k;
      const i = inv / step;
      present[Math.floor(i)] = true;
      present[Math.min(PHOTO_SLICES - 1, Math.ceil(i))] = true;
    }

    const paint = (plate: boolean, i: number) => {
      this.clearLayer();
      gl.viewport(0, 0, FW, FH);
      const p = this.use("photo", [0, 0, FW, FH], [FW, FH]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
      gl.uniform1i(p.u("uPhoto"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
      gl.uniform1i(p.u("uDepth"), 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(p.u("uCanvas"), W, H);
      gl.uniform1f(p.u("uMargin"), margin);
      gl.uniform1f(p.u("uFovRatio"), fovRatio);
      gl.uniform1f(p.u("uAspect"), photo.aspect);
      gl.uniform1f(p.u("uK"), photo.k);
      gl.uniform1f(p.u("uV0"), photo.v0);
      gl.uniform1f(p.u("uPrev"), i > 0 ? centers[i - 1] : -1);
      gl.uniform1f(p.u("uCenter"), centers[i]);
      gl.uniform1f(p.u("uNext"), i < PHOTO_SLICES - 1 ? centers[i + 1] : -1);
      gl.uniform1i(p.u("uPlate"), plate ? 1 : 0);
      gl.uniform1f(p.u("uBoost"), this.hdr && !params.sharp ? 1.6 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const full: Rect = [0, 0, W, H];
    const common = { W, H, FW, FH, margin, kernel, catEye: params.shape.catEye };
    const shiftAt = (inv: number) => ctx.baselinePx * (inv - ctx.invFocusM);

    // A softly blurred plate behind everything fills in what nearer objects hid.
    const plateR = Math.max(...centers.filter((_, i) => present[i]).map(blurAtInv), 0);
    paint(true, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.imageFbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.compositeLayer(full, Math.min(plateR, W / 12), { ...common, shift: shiftAt(0) });

    for (let i = 0; i < PHOTO_SLICES; i++) {
      if (!present[i]) continue;
      paint(false, i);
      this.compositeLayer(full, blurAtInv(centers[i]), { ...common, shift: shiftAt(centers[i]), useSupport: true });
    }
  }

  private ensureImageTarget(width: number, height: number) {
    if (this.imageSize[0] === width && this.imageSize[1] === height) return;
    const gl = this.gl;
    const key = `${width}x${height}`;
    const hit = this.imageCache.get(key);
    if (hit) {
      [this.imageTex, this.imageFbo] = [hit.tex, hit.fbo];
      this.imageSize = [width, height];
      return;
    }
    if (this.imageCache.size >= 2) {
      const [oldKey, old] = this.imageCache.entries().next().value as [string, { tex: WebGLTexture; fbo: WebGLFramebuffer }];
      gl.deleteTexture(old.tex);
      gl.deleteFramebuffer(old.fbo);
      this.imageCache.delete(oldKey);
    }
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    this.imageTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.texStorage2D(gl.TEXTURE_2D, levels, this.hdr ? gl.RGBA16F : gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.imageFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.imageFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.imageTex, 0);
    this.imageSize = [width, height];
    this.imageCache.set(key, { tex: this.imageTex!, fbo: this.imageFbo! });
  }

  /**
   * Allocates the render targets for a canvas of this size without drawing, so the first frame at that
   * size (e.g. interactive quality when a ring is grabbed) doesn't pay for allocation.
   */
  prepare(width: number, height: number) {
    const [lw, lh] = this.layerSize;
    const [iw, ih] = this.imageSize;
    const margin = Math.round(width * MARGIN_FRACTION);
    this.ensureLayerTarget(width + 2 * margin, height + 2 * margin);
    this.ensureImageTarget(width, height);
    if (lw && lh) this.ensureLayerTarget(lw, lh);
    if (iw && ih) this.ensureImageTarget(iw, ih);
  }

  /**
   * `scale` below 1 renders the optics at a lower internal resolution and upscales in the final pass, so a
   * control being turned lands in the next frame without resizing the canvas (which is slow on big screens).
   */
  render(params: RenderParams, scale = 1) {
    const gl = this.gl;
    const CW = this.canvas.width;
    const CH = this.canvas.height;
    const W = Math.max(2, Math.round(CW * scale));
    const H = Math.max(2, Math.round(CH * scale));
    const margin = Math.round(W * MARGIN_FRACTION);
    const FW = W + 2 * margin;
    const FH = H + 2 * margin;
    this.ensureLayerTarget(FW, FH);
    this.ensureImageTarget(W, H);

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

    if (params.photo) {
      this.renderPhoto(params, params.photo, { W, H, FW, FH, margin, fpx, kernel, baselinePx, invFocusM });
      this.develop(params.develop, W, H, CW, CH);
      return;
    }

    const layers = buildScene(params.subjectMm / 1000, params.backgroundMm / 1000);

    // Sky, straight onto the image: a smooth gradient needs no blur.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.imageFbo);
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

      // 1. Paint the layer into the margin-padded texture (colour only).
      this.clearLayer();
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.viewport(0, 0, FW, FH);
      this.paintLayer(layer, project, fpx, cx, cy, margin, FW, FH, H, r, fog(layer.z), baselinePx, invFocusM);

      // 2–3. Mipmaps, then blur-composite onto the image.
      this.compositeLayer(bounds, r, { W, H, FW, FH, margin, kernel, catEye: shape.catEye });

      // 4. Point lights as bokeh, added on top of their own layer.
      if (layer.lights.length) {
        gl.blendFunc(gl.ONE, gl.ONE);
        this.drawLights(layer.lights, project, blurRadius, fog, shape, powerScale, W, H);
      }
    }

    this.develop(params.develop, W, H, CW, CH);
  }

  /** Film or sensor: turns the optical image into the final photo on the canvas. */
  /** Final pass onto the canvas (`CW`×`CH`) from the image (`W`×`H`, smaller at interactive quality). */
  private develop(dev: DevelopParams | undefined, W: number, H: number, CW = W, CH = H) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, CW, CH);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    const p = this.use("develop", [0, 0, CW, CH], [CW, CH]);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(p.u("uImg"), 0);

    const look = dev?.look;
    const film = look !== undefined && look.kind !== "digital";
    gl.uniform1f(p.u("uExposure"), dev?.exposureStops ?? 0);
    gl.uniform1i(p.u("uCurve"), film ? 1 : 0);
    gl.uniform1f(p.u("uMono"), look?.mono ? 1 : 0);
    gl.uniform1f(p.u("uSoft"), look?.softness || 1);
    gl.uniform1f(p.u("uBias"), look?.bias ?? 0);
    gl.uniform1f(p.u("uSat"), look?.saturation ?? 1);
    gl.uniform3fv(p.u("uBalance"), look?.balance ?? [1, 1, 1]);
    gl.uniform3fv(p.u("uShadowTint"), look?.shadowTint ?? [0, 0, 0]);
    gl.uniform3fv(p.u("uHighlightTint"), look?.highlightTint ?? [0, 0, 0]);
    gl.uniform1f(p.u("uBlackLift"), look?.blackLift ?? 0);
    gl.uniform1f(p.u("uGrain"), dev?.grain ?? 0);
    // Grain clumps grow with film speed; sensor noise is per pixel.
    // Grain and shake are in canvas pixels (the shader works in output pixels); halation samples the image's mips.
    const grainSize = film ? Math.max(0.9, (CW / 1100) * 1.5 * ((look?.iso ?? 400) / 400) ** 0.3) : Math.max(0.7, CW / 1600);
    gl.uniform1f(p.u("uGrainSize"), grainSize);
    gl.uniform1f(p.u("uGrainColor"), film ? 0.35 : 0.5);
    gl.uniform1f(p.u("uHalation"), look?.halation ?? 0);
    gl.uniform1f(p.u("uHalLod"), Math.max(1, Math.log2(W / 110)));
    gl.uniform1f(p.u("uVignette"), dev?.vignetteStops ?? 0);
    const shakePx = (dev?.shake ?? 0) * CW;
    gl.uniform2f(p.u("uShake"), shakePx * Math.cos(dev?.shakeAngle ?? 0), shakePx * Math.sin(dev?.shakeAngle ?? 0));
    gl.uniform1f(p.u("uSeed"), ((dev?.seed ?? 0) % 1000) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
      // Energy spreads over the disc; in HDR a small disc may exceed white.
      const density = (light.power * powerScale) / (Math.PI * R * R);
      const intensity = (this.hdr ? Math.min(density * 0.6, 12) : 1 - Math.exp(-density)) * (1 - fog(light.z) * 0.6);
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
