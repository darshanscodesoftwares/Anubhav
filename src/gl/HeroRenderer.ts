import type { FabricRegion, Pt, Slide, Sweep } from '../data/slides';

const VERT = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const frag = (clothSamples: number) => /* glsl */ `
precision highp float;
#define CLOTH_SAMPLES ${clothSamples}
uniform vec2 uRes;
uniform float uTime;
uniform float uSway;
uniform float uShowMask;
uniform vec2 uShift;

uniform sampler2D uTexA; uniform sampler2D uMaskA; uniform float uAspA; uniform float uCropA; uniform vec2 uFocA; uniform float uScaleA;
uniform sampler2D uTexB; uniform sampler2D uMaskB; uniform float uAspB; uniform float uCropB; uniform vec2 uFocB; uniform float uScaleB;
uniform float uSwayB;

// Saree sweep: a length of scene B's saree swings across the lens along B's flow direction.
uniform float uSweep;       // 0 → 1 across the transition
uniform vec2 uDir;          // unit travel direction, screen space (x in aspect units, y down)
uniform vec2 uSwatch;       // fabric-only patch centre in B (image UV)
uniform vec2 uHalf;         // patch half-size
uniform float uSwatchScale;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec2 coverUV(vec2 uv, float imgAsp, float cropX) {
  float va = uRes.x / uRes.y;
  vec2 s = va > imgAsp ? vec2(1.0, imgAsp / va) : vec2(va / imgAsp, 1.0);
  vec2 c = (uv - 0.5) * s + 0.5;
  c.x += (1.0 - s.x) * (cropX - 0.5);
  return c;
}

// Mask: R = amplitude (0 at the pin, rising toward the free edge), G = phase, B = flow angle.
vec3 fabric(sampler2D tex, sampler2D mask, float asp, vec2 uv, float ampMul) {
  vec4 m = texture2D(mask, uv);
  float amp = m.r * uSway * ampMul;
  if (amp < 0.003) return texture2D(tex, uv).rgb;
  float t = uTime;
  float ph = m.g * 6.2831;
  float a = m.b * 6.2831;
  vec2 dir = vec2(cos(a), sin(a));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 p = uv * vec2(asp, 1.0);
  float s = dot(p, dir);
  float n = dot(p, nrm);
  float gust = 0.7 + 0.3 * sin(t * 0.31 + ph);
  float w1 = sin(s * 7.0 - t * 1.5 + ph + sin(n * 3.0 + t * 0.45) * 0.8);
  float w2 = sin(s * 15.0 - t * 2.3 + n * 4.0 + ph * 1.7);
  vec2 d = (nrm * (w1 * 0.75 + w2 * 0.25) + dir * w2 * 0.2) * amp * gust * 0.011;
  d.x /= asp;
  vec3 c = texture2D(tex, clamp(uv + d, 0.001, 0.999)).rgb;
  float fold = cos(s * 7.0 - t * 1.5 + ph) * 0.65 + w2 * 0.35;
  c *= 1.0 + fold * amp * gust * 0.085;
  return c;
}

vec3 scene(sampler2D tex, sampler2D mask, float asp, float crop, vec2 foc, float scale, vec2 uv, float ampMul) {
  vec2 base = foc + (coverUV(uv, asp, crop) - foc) / scale + uShift / scale;
  return fabric(tex, mask, asp, clamp(base, 0.0, 1.0), ampMul);
}

// Mirror-tile inside the swatch box so the cloth only ever shows saree fabric.
vec2 swatchUV(vec2 o) {
  vec2 q = o / (2.0 * uHalf) + 0.5;
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  return uSwatch + (q - 0.5) * 2.0 * uHalf;
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  float va = uRes.x / uRes.y;
  float jitter = hash(gl_FragCoord.xy + fract(uTime));
  vec3 col;

  if (uSweep <= 0.0) {
    col = scene(uTexA, uMaskA, uAspA, uCropA, uFocA, uScaleA, uv, 1.0);
  } else if (uSweep >= 1.0) {
    col = scene(uTexB, uMaskB, uAspB, uCropB, uFocB, uScaleB, uv, uSwayB);
  } else {
    vec3 a = scene(uTexA, uMaskA, uAspA, uCropA, uFocA, uScaleA, uv, 1.0);
    vec3 b = scene(uTexB, uMaskB, uAspB, uCropB, uFocB, uScaleB, uv, uSwayB);
    float s = uSweep;
    vec2 dir = uDir;
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 p = (uv - 0.5) * vec2(va, 1.0);
    float E = 0.5 * (abs(dir.x) * va + abs(dir.y));
    float dn = dot(p, dir) / E;              // -1…1 across the screen along travel
    float ac = dot(p, nrm);                  // across the cloth

    // Billowing leading (pallu) edge and softer trailing edge.
    float W = 1.75;
    float lead = mix(-1.35, 1.35 + W, s) + 0.11 * sin(ac * 4.0 + s * 7.0 + uTime * 0.8) + 0.05 * sin(ac * 10.0 - s * 12.0);
    float trail = lead - W + 0.2 * sin(ac * 3.0 - s * 6.0 + 1.3) + 0.07 * sin(ac * 8.0 + s * 9.0);

    if (dn > lead) {
      float shadow = smoothstep(lead + 0.4, lead, dn);
      col = a * (1.0 - 0.32 * shadow);
    } else if (dn < trail) {
      col = b;
    } else {
      float ct = (dn - trail) / (lead - trail);  // 0 trailing → 1 leading edge
      vec3 beneath = mix(b, a, smoothstep(0.3, 0.8, ct));
      float along = (dn - lead) * E;             // travels with the cloth
      float fold = sin(ac * 13.0 + along * 2.5 + uTime * 1.3) * 0.6 + sin(ac * 29.0 - along * 4.0) * 0.4;
      vec2 off = dir * along + nrm * (ac + fold * 0.012);
      vec3 cloth = vec3(0.0);
      for (int i = 0; i < CLOTH_SAMPLES; i++) {
        float k = (float(i) + jitter) / float(CLOTH_SAMPLES) - 0.5;
        vec2 o = (off + dir * k * 0.022) * uSwatchScale;
        o.x /= uAspB;
        cloth += texture2D(uTexB, swatchUV(o)).rgb;
      }
      cloth /= float(CLOTH_SAMPLES);
      cloth *= 0.82 + 0.28 * fold;
      float sheen = pow(max(0.0, sin(ac * 5.0 + along * 2.0 - s * 10.0)), 10.0);
      cloth += vec3(1.0, 0.93, 0.8) * sheen * 0.4;
      // Zari border on the pallu edge: gold that takes its light from the weave underneath, with glints.
      float border = smoothstep(0.895, 0.925, ct) * (1.0 - smoothstep(0.962, 0.982, ct));
      float lum = dot(cloth, vec3(0.3, 0.59, 0.11));
      float glint = pow(hash(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 10.0)), 140.0) * 1.6;
      vec3 zari = vec3(0.93, 0.75, 0.42) * (0.55 + 0.75 * lum) + glint;
      cloth = mix(cloth, zari, border * 0.8);
      float alpha = mix(0.55, 0.95, smoothstep(0.05, 0.55, ct)) * smoothstep(0.0, 0.07, ct) * (1.0 - smoothstep(0.985, 1.0, ct));
      col = mix(beneath, cloth, alpha);
    }
  }

  col += (hash(gl_FragCoord.xy * 0.37 + uTime) - 0.5) * 0.018;
  if (uShowMask > 0.5) {
    float m = uSweep > 0.5
      ? texture2D(uMaskB, uFocB + (coverUV(uv, uAspB, uCropB) - uFocB) / uScaleB).r
      : texture2D(uMaskA, uFocA + (coverUV(uv, uAspA, uCropA) - uFocA) / uScaleA).r;
    col = mix(col, vec3(0.0, 0.9, 0.5), m * 0.6);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const UNIFORMS = ['uRes', 'uTime', 'uSway', 'uShowMask', 'uShift', 'uSwayB',
  'uTexA', 'uMaskA', 'uAspA', 'uCropA', 'uFocA', 'uScaleA',
  'uTexB', 'uMaskB', 'uAspB', 'uCropB', 'uFocB', 'uScaleB',
  'uSweep', 'uDir', 'uSwatch', 'uHalf', 'uSwatchScale'] as const;

type UniformName = (typeof UNIFORMS)[number];

interface Shot { tex: WebGLTexture; mask: WebGLTexture; aspect: number; focus: Pt; mobileX: number; sweep: Sweep }

export interface RendererOptions {
  reduceMotion: boolean;
  lowPower: boolean;
  showMask?: boolean;
}

export const REST_SCALE = 1.03;
const MASK_SIZE = 128;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Horizontal crop anchor (0 = keep left edge, 1 = keep right edge) when the screen is narrower than the image.
 * Desktop keeps the left/copy side like the design; portrait screens centre on the slide's mobileX.
 */
function cropX(viewAspect: number, imgAspect: number, mobileX: number) {
  if (viewAspect >= imgAspect) return 0.5;
  if (viewAspect >= 1.2) return 0;
  const visible = viewAspect / imgAspect;
  return clamp01(0.5 + (mobileX - 0.5) / (1 - visible));
}

/** Sweep progress inside one scene segment: short hold, then the cloth travels across. */
export const sweepProgress = (f: number) => clamp01((f - 0.06) / 0.88);

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

// R ramps radially from the pin; G = per-region phase; B = flow angle (pin → region centroid).
// Painted large, then downsampled so LINEAR filtering gives soft edges.
function buildMask(regions: FabricRegion[], aspect: number) {
  const S = MASK_SIZE * 4;
  const big = document.createElement('canvas');
  big.width = big.height = S;
  const ctx = big.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  regions.forEach((r, idx) => {
    const cx = r.pts.reduce((s, p) => s + p[0], 0) / r.pts.length;
    const cy = r.pts.reduce((s, p) => s + p[1], 0) / r.pts.length;
    let ang = Math.atan2(cy - r.pin[1], (cx - r.pin[0]) * aspect);
    if (ang < 0) ang += Math.PI * 2;
    const far = Math.max(...r.pts.map(([x, y]) => Math.hypot((x - r.pin[0]) * aspect, y - r.pin[1])));
    const g = Math.round(((idx * 0.37 + 0.11) % 1) * 255);
    const b = Math.round((ang / (Math.PI * 2)) * 255);
    // Draw in aspect-corrected space so the radial ramp is circular in the actual image.
    ctx.save();
    ctx.scale(1 / aspect, 1);
    const px = r.pin[0] * S * aspect, py = r.pin[1] * S;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, far * S);
    grad.addColorStop(0, `rgb(${Math.round(r.amp * 255 * 0.05)},${g},${b})`);
    grad.addColorStop(0.35, `rgb(${Math.round(r.amp * 255 * 0.55)},${g},${b})`);
    grad.addColorStop(1, `rgb(${Math.round(r.amp * 255)},${g},${b})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    r.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * S * aspect, y * S) : ctx.moveTo(x * S * aspect, y * S)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  const small = document.createElement('canvas');
  small.width = small.height = MASK_SIZE;
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(big, 0, 0, MASK_SIZE, MASK_SIZE);
  return small;
}

export class HeroRenderer {
  private gl: WebGLRenderingContext;
  private u = {} as Record<UniformName, WebGLUniformLocation | null>;
  private shots: Shot[] = [];
  private opts: RendererOptions;
  private canvas: HTMLCanvasElement;

  static create(canvas: HTMLCanvasElement, opts: RendererOptions) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    return gl ? new HeroRenderer(canvas, gl, opts) : null;
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, opts: RendererOptions) {
    this.canvas = canvas;
    this.gl = gl;
    this.opts = opts;
    const prog = gl.createProgram()!;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      return s;
    };
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag(opts.lowPower ? 3 : 6)));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    UNIFORMS.forEach(n => { this.u[n] = gl.getUniformLocation(prog, n); });
  }

  private texture(source: TexImageSource) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  async load(slides: Slide[]) {
    const imgs = await Promise.all(slides.map(s => loadImage(s.image)));
    this.shots = imgs.map((img, i) => {
      const aspect = img.naturalWidth / img.naturalHeight;
      return { tex: this.texture(img), mask: this.texture(buildMask(slides[i].fabric, aspect)), aspect, focus: slides[i].focus, mobileX: slides[i].mobileX, sweep: slides[i].sweep };
    });
  }

  private bind(slot: 'A' | 'B', s: Shot, unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.activeTexture(gl.TEXTURE0 + unit + 1);
    gl.bindTexture(gl.TEXTURE_2D, s.mask);
    gl.uniform1i(this.u[`uTex${slot}`], unit);
    gl.uniform1i(this.u[`uMask${slot}`], unit + 1);
    gl.uniform1f(this.u[`uAsp${slot}`], s.aspect);
    gl.uniform2f(this.u[`uFoc${slot}`], s.focus[0], s.focus[1]);
    gl.uniform1f(this.u[`uCrop${slot}`], cropX(this.canvas.clientWidth / this.canvas.clientHeight, s.aspect, s.mobileX));
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.lowPower ? 1.25 : 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  /** progress: 0 … N-1 (fractional = mid-transition). pointer: -1…1. */
  render(progress: number, time: number, pointer: { x: number; y: number }) {
    if (!this.shots.length) return;
    const gl = this.gl;
    const N = this.shots.length;
    const motion = this.opts.reduceMotion ? 0 : 1;
    this.resize();

    const i = Math.min(Math.floor(progress), N - 2);
    const f = progress - i;
    // Reduced motion: no sweeping cloth, just a cut halfway.
    const s = motion ? sweepProgress(f) : f < 0.5 ? 0 : 1;

    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, motion ? time : 0);
    gl.uniform1f(this.u.uSway, motion);
    gl.uniform1f(this.u.uShowMask, this.opts.showMask ? 1 : 0);
    gl.uniform2f(this.u.uShift, pointer.x * 0.004 * motion, pointer.y * 0.003 * motion);

    const a = this.shots[i];
    const b = this.shots[i + 1];
    this.bind('A', a, 0);
    this.bind('B', b, 2);

    // A: gentle camera push as the cloth approaches. B: settles from a slight zoom while its
    // saree flutters harder, as if it just landed in the pose, then calms.
    const settle = 1 - s;
    gl.uniform1f(this.u.uScaleA, REST_SCALE * (1 + 0.07 * s * motion));
    gl.uniform1f(this.u.uScaleB, REST_SCALE * (1 + 0.09 * settle * settle * motion));
    gl.uniform1f(this.u.uSwayB, 1 + 1.4 * settle * motion);

    const [dx, dy] = b.sweep.dir;
    const len = Math.hypot(dx, dy) || 1;
    gl.uniform1f(this.u.uSweep, s);
    gl.uniform2f(this.u.uDir, dx / len, dy / len);
    gl.uniform2f(this.u.uSwatch, b.sweep.swatch[0], b.sweep.swatch[1]);
    gl.uniform2f(this.u.uHalf, b.sweep.half[0], b.sweep.half[1]);
    gl.uniform1f(this.u.uSwatchScale, b.sweep.scale);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Converts a click on the canvas (0–1 CSS coords) into image UVs of the resting shot (for ?edit tracing). */
  pickUV(index: number, u: number, v: number): Pt {
    const s = this.shots[index];
    const va = this.canvas.clientWidth / this.canvas.clientHeight;
    const sc = va > s.aspect ? [1, s.aspect / va] : [va / s.aspect, 1];
    const cu = (u - 0.5) * sc[0] + 0.5 + (1 - sc[0]) * (cropX(va, s.aspect, s.mobileX) - 0.5);
    const cv = (v - 0.5) * sc[1] + 0.5;
    return [+(s.focus[0] + (cu - s.focus[0]) / REST_SCALE).toFixed(3), +(s.focus[1] + (cv - s.focus[1]) / REST_SCALE).toFixed(3)];
  }

  dispose() {
    // Free GPU memory but keep the context: React StrictMode remounts reuse the same canvas.
    this.shots.forEach(s => {
      this.gl.deleteTexture(s.tex);
      this.gl.deleteTexture(s.mask);
    });
    this.shots = [];
  }
}
