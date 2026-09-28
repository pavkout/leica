// The live camera's renderer (#37): each phone frame goes through the
// simulated shutter (frames accumulate for slow speeds), lens (depth of field
// from a depth map) and sensor or film (exposure error, tone, grain), in
// WebGL 2. Parameters are plain numbers so a control change lands in the next
// frame without React in the loop.

export interface LiveParams {
  /** Blend of each new frame into the accumulated exposure (1 = no accumulation). */
  alpha: number;
  /** Stops over (+) or under (−) the correct exposure for the scene. */
  exposureStops: number;
  noise: number;
  mono: boolean;
  /** Blur-disc diameter in px = |invZ·a − b| (invZ in 1/m); see liveMath.blurCoefficients. */
  blurA: number;
  blurB: number;
  /** Relative depth → inverse metres: invZ = d · invNear. */
  invNear: number;
  depthOn: boolean;
  /** Share of the phone's frame shown, per axis: cover-fit to the frame's shape, then the lens's crop. */
  crop: [number, number];
  seed: number;
}

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS_ACCUM = `#version 300 es
precision mediump float;
uniform sampler2D uPrev;
uniform sampler2D uFrame;
uniform float uAlpha;
uniform vec2 uCrop;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 uv = 0.5 + (vUv - 0.5) * uCrop;
  o = mix(texture(uPrev, vUv), texture(uFrame, uv), uAlpha);
}`;

const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D uAcc;
uniform sampler2D uDepth;
uniform vec2 uSize;
uniform float uA;
uniform float uB;
uniform float uInvNear;
uniform float uDepthOn;
uniform vec2 uCrop;
uniform float uExposure;
uniform float uNoise;
uniform float uMono;
uniform float uSeed;
in vec2 vUv;
out vec4 o;

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float blur = 0.0;
  if (uDepthOn > 0.5) {
    // Depth rows are stored top-down; the frame is flipped to GL's bottom-up.
    vec2 duv = 0.5 + (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * uCrop;
    float d = texture(uDepth, duv).r;
    blur = min(96.0, abs(d * uInvNear * uA - uB));
  }
  vec3 c;
  if (blur < 1.0) {
    c = lin(texture(uAcc, vUv).rgb);
  } else {
    // A 20-tap golden-angle disc from the mip level matching the disc size; bright taps weigh more (bokeh).
    float r = blur * 0.5;
    float lod = max(0.0, log2(r / 4.0));
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 20; i++) {
      float fi = float(i);
      float a = fi * 2.39996;
      vec2 off = vec2(cos(a), sin(a)) * r * sqrt((fi + 0.5) / 20.0) / uSize;
      vec3 s = lin(textureLod(uAcc, vUv + off, lod).rgb);
      float w = 1.0 + 4.0 * max(0.0, dot(s, vec3(0.2126, 0.7152, 0.0722)) - 0.6);
      sum += s * w;
      wsum += w;
    }
    c = sum / wsum;
  }
  c *= exp2(uExposure);
  // Soft shoulder: linear to 0.8, then highlights roll smoothly into white (overexposure still blows out).
  c = mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) / 0.2)), step(0.8, c));
  if (uMono > 0.5) c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
  float n = (hash(gl_FragCoord.xy * 0.73 + uSeed) - 0.5) * 2.0 * uNoise;
  c += n * (0.35 + 0.65 * sqrt(max(c, vec3(0.0))));
  o = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, fs: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  const loc = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (n: string) => (loc.has(n) ? loc.get(n)! : (loc.set(n, gl.getUniformLocation(p, n)), loc.get(n)!)) };
}

export class LiveRenderer {
  private gl: WebGL2RenderingContext;
  private accum;
  private final;
  private frameTex: WebGLTexture;
  private depthTex: WebGLTexture;
  private acc: { tex: WebGLTexture; fbo: WebGLFramebuffer }[] = [];
  private size = [0, 0];
  private cur = 0;
  private fresh = true;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL 2 is not available");
    this.gl = gl;
    this.accum = compile(gl, FS_ACCUM);
    this.final = compile(gl, FS_FINAL);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.frameTex = tex();
    this.depthTex = tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
  }

  /** Start the exposure afresh (e.g. after the scene changed completely). */
  reset() {
    this.fresh = true;
  }

  /** A depth map from the depth model: `w`×`h` bytes, rows top-down, 255 = nearest. */
  setDepth(data: Uint8Array, w: number, h: number) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  }

  private ensureTargets(w: number, h: number) {
    if (this.size[0] === w && this.size[1] === h) return;
    const gl = this.gl;
    for (const a of this.acc) {
      gl.deleteTexture(a.tex);
      gl.deleteFramebuffer(a.fbo);
    }
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    this.acc = [0, 1].map(() => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo };
    });
    this.size = [w, h];
    this.fresh = true;
  }

  /** Draw one frame of `video` through the simulated camera onto the canvas. */
  render(video: TexImageSource, p: LiveParams) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W < 2 || H < 2) return;
    this.ensureTargets(W, H);

    gl.bindTexture(gl.TEXTURE_2D, this.frameTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // 1. The shutter: blend the new frame into the running exposure.
    const next = 1 - this.cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc[next].fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.accum.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.acc[this.cur].tex);
    gl.uniform1i(this.accum.u("uPrev"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.frameTex);
    gl.uniform1i(this.accum.u("uFrame"), 1);
    gl.uniform1f(this.accum.u("uAlpha"), this.fresh ? 1 : p.alpha);
    gl.uniform2f(this.accum.u("uCrop"), p.crop[0], p.crop[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.cur = next;
    this.fresh = false;
    gl.bindTexture(gl.TEXTURE_2D, this.acc[this.cur].tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 2. Lens and sensor, onto the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.final.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.acc[this.cur].tex);
    gl.uniform1i(this.final.u("uAcc"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.uniform1i(this.final.u("uDepth"), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(this.final.u("uSize"), W, H);
    gl.uniform1f(this.final.u("uA"), p.blurA);
    gl.uniform1f(this.final.u("uB"), p.blurB);
    gl.uniform1f(this.final.u("uInvNear"), p.invNear);
    gl.uniform1f(this.final.u("uDepthOn"), p.depthOn ? 1 : 0);
    gl.uniform2f(this.final.u("uCrop"), p.crop[0], p.crop[1]);
    gl.uniform1f(this.final.u("uExposure"), p.exposureStops);
    gl.uniform1f(this.final.u("uNoise"), p.noise);
    gl.uniform1f(this.final.u("uMono"), p.mono ? 1 : 0);
    gl.uniform1f(this.final.u("uSeed"), p.seed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    const gl = this.gl;
    for (const a of this.acc) {
      gl.deleteTexture(a.tex);
      gl.deleteFramebuffer(a.fbo);
    }
    gl.deleteTexture(this.frameTex);
    gl.deleteTexture(this.depthTex);
    gl.deleteProgram(this.accum.p);
    gl.deleteProgram(this.final.p);
    // The context itself stays: the canvas may get a new renderer (React remounts effects in development),
    // and a lost context can't be reused. It goes with the canvas when the screen unmounts.
  }
}
