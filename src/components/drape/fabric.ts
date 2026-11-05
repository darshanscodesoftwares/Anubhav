import * as THREE from 'three';

/**
 * Folded saree bundle. Built from a subdivided BoxGeometry (keeps the 6 face groups + per-face UVs) and rounded
 * per side: the FRONT (+z) gets a big, almost full-height round — the fold where the cloth turns over — while the
 * back and sides stay tighter. The top gets a soft pillow and faint wrinkles. Normals are analytic for smooth shading.
 */
export function makeBundleGeometry(w: number, h: number, d: number, r: number, bulge: number) {
  const g = new THREE.BoxGeometry(w, h, d, 48, 10, 36);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  const rFront = h * 0.48;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const front = p.z > 0;
    const rr = front ? rFront : r;
    // asymmetric inner box: the front fold eats more depth than the back
    c.set(
      THREE.MathUtils.clamp(p.x, -half.x + r, half.x - r),
      THREE.MathUtils.clamp(p.y, -half.y + rr, half.y - rr),
      THREE.MathUtils.clamp(p.z, -half.z + r, half.z - rFront)
    );
    n.subVectors(p, c);
    if (n.lengthSq() > 1e-8) {
      n.normalize();
      p.copy(c).addScaledVector(n, rr);
    } else {
      n.fromBufferAttribute(nor, i);
    }
    const t = (p.y + half.y) / (2 * half.y);
    const ux = p.x / half.x, uz = p.z / half.z;
    // pillow + faint cloth wrinkles on the upper layers
    p.y += bulge * t * (1 - ux * ux) * (1 - uz * uz);
    p.y += t * h * (0.025 * Math.sin(ux * 7.3 + uz * 2.1) * Math.sin(uz * 5.7 - ux * 1.3) + 0.012 * Math.sin(ux * 19 + uz * 11));
    // the fold sags a touch, like heavy silk
    if (front) p.y -= 0.04 * h * Math.max(0, uz) ** 2;
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  g.computeVertexNormals();
  // faces don't share vertices: average normals of coincident points so the fold shades as one surface
  const key = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const acc = new Map<string, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const v = acc.get(k) ?? acc.set(k, new THREE.Vector3()).get(k)!;
    v.x += nor.getX(i); v.y += nor.getY(i); v.z += nor.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i))!.clone().normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
  return g;
}

export interface FabricUniforms {
  uTime: { value: number };
  uLag: { value: THREE.Vector3 };
  uRipple: { value: number };
  uSlump: { value: number };
  uHold: { value: number };
  uGrab: { value: THREE.Vector2 };
  /** support under this bundle (another bundle): centre x,z + half extents hx,hz in this bundle's local frame */
  uSup: { value: THREE.Vector4 };
  /** cos, sin of the support's yaw relative to this bundle */
  uSupRot: { value: THREE.Vector2 };
  uSag: { value: number };
  uHalf: { value: THREE.Vector3 };
}

export function makeFabricUniforms(half: THREE.Vector3): FabricUniforms {
  return {
    uTime: { value: 0 },
    uLag: { value: new THREE.Vector3() },
    uRipple: { value: 0 },
    uSlump: { value: 0 },
    uHold: { value: 0 },
    uGrab: { value: new THREE.Vector2() },
    uSup: { value: new THREE.Vector4() },
    uSupRot: { value: new THREE.Vector2(1, 0) },
    uSag: { value: 0 },
    uHalf: { value: half }
  };
}

/**
 * Saree physics in the vertex shader (visual only — the collider stays rigid):
 *  - layer lag: upper layers trail behind sudden moves, like folded silk sliding over itself
 *  - flutter: free edges ripple with speed, a travelling wave along the fabric
 *  - slump: on landing the bundle sinks and spreads softly, then breathes back (no jelly bounce)
 *  - hold: while picked up, cloth droops away from where it was grabbed, like lifting folded cloth
 *  - drape: resting on another bundle, the overhanging parts sag around the one beneath
 */
export function applyFabricDeform(material: THREE.Material, U: FabricUniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; uniform vec3 uLag; uniform float uRipple; uniform float uSlump; uniform float uHold; uniform vec2 uGrab; uniform vec4 uSup; uniform vec2 uSupRot; uniform float uSag; uniform vec3 uHalf;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 q = transformed / uHalf;                          // -1..1 in the bundle
        float hgt = clamp(q.y * 0.5 + 0.5, 0.0, 1.0);          // 0 bottom layer → 1 top layer
        float edge = smoothstep(0.55, 1.0, max(abs(q.x), abs(q.z)));
        transformed += uLag * hgt * (0.55 + 0.45 * edge);
        float wave = sin(q.x * 3.2 + q.z * 2.1 - uTime * 7.0) * 0.6 + sin(q.x * 6.3 - q.z * 4.7 + uTime * 9.5) * 0.4;
        transformed.y += uRipple * wave * (0.25 + 0.75 * edge) * hgt * uHalf.y * 0.55;
        transformed.xz += uRipple * edge * hgt * normalize(q.xz + 1e-4) * wave * 0.035;
        transformed.y -= uSlump * hgt * uHalf.y * 0.55;
        transformed.xz *= 1.0 + uSlump * hgt * 0.07;
        // held: cloth droops away from the grab point (centre grab → both ends; edge grab → far side hangs most)
        vec2 dg = (q.xz - uGrab) / (1.0 + abs(uGrab));
        float droop = dg.x * dg.x;
        transformed.y -= uHold * (droop * uHalf.y * 0.85 + dg.y * dg.y * uHalf.y * 0.14);
        transformed.x *= 1.0 - uHold * droop * 0.022;
        // resting on another bundle: whatever hangs past the lower bundle's edge sags and pulls in around it
        vec2 pl = transformed.xz - uSup.xy;
        vec2 pb = vec2(uSupRot.x * pl.x + uSupRot.y * pl.y, -uSupRot.y * pl.x + uSupRot.x * pl.y);
        float over = length(max(abs(pb) - uSup.zw, 0.0));
        // hinge at the support's edge: bends from the edge outward, deeper the further it overhangs
        float sag = uSag * pow(clamp(over / 0.95, 0.0, 1.0), 1.1);
        transformed.y -= sag * uHalf.y * 2.3;
        transformed.xz -= normalize(pl + 1e-4) * sag * 0.12;`
      );
  };
  material.customProgramCacheKey = () => 'saree-fabric';
}

/** Critically-damped-ish spring step used for the fabric's lag and slump. */
export function springStep(x: number, v: number, target: number, k: number, c: number, dt: number) {
  const a = k * (target - x) - c * v;
  v += a * dt;
  x += v * dt;
  return [x, v] as const;
}

/**
 * Prepares a fabric texture for physically based silk + zari:
 *  - colour: the silk ground is multiplied by `tint` (to land on true jewel tones) but gold zari keeps its own colour
 *  - rm: roughness/metalness map (G = roughness, B = metalness, as three.js expects). Gold zari thread pixels
 *    (warm hue, saturated, bright) become metallic and smoother so they glint; the silk ground stays dielectric.
 */
export function makeFabricMaps(image: CanvasImageSource & { width: number; height: number }, tint: string, baseRoughness: number, strength: number) {
  const scale = Math.min(1, 1024 / image.width);
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const colour = document.createElement('canvas');
  colour.width = w;
  colour.height = h;
  const cctx = colour.getContext('2d', { willReadFrequently: true })!;
  cctx.drawImage(image, 0, 0, w, h);
  const img = cctx.getImageData(0, 0, w, h);
  const rmImg = new ImageData(w, h);
  const d = img.data, o = rmImg.data;
  // tint in plain sRGB 0–1 (not three's linear working space) since we multiply sRGB pixels directly
  const hex = parseInt(tint.slice(1), 16);
  const t = { r: (hex >> 16 & 255) / 255, g: (hex >> 8 & 255) / 255, b: (hex & 255) / 255 };
  const ss = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    let hue = 0;
    if (max !== min) {
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const goldness = ss(18, 30, hue) * (1 - ss(52, 64, hue)) * ss(0.28, 0.5, sat) * ss(0.38, 0.62, max);
    const gold = goldness * strength;
    // tint the silk ground only
    const keep = Math.max(goldness, 0);
    d[i] = Math.round(255 * r * (t.r + (1 - t.r) * keep));
    d[i + 1] = Math.round(255 * g * (t.g + (1 - t.g) * keep));
    d[i + 2] = Math.round(255 * b * (t.b + (1 - t.b) * keep));
    o[i] = 255;
    o[i + 1] = Math.round((baseRoughness + (0.32 - baseRoughness) * gold) * 255);
    o[i + 2] = Math.round(gold * 0.9 * 255);
    o[i + 3] = 255;
  }
  cctx.putImageData(img, 0, 0);
  const rm = document.createElement('canvas');
  rm.width = w;
  rm.height = h;
  rm.getContext('2d')!.putImageData(rmImg, 0, 0);
  return { colour, rm };
}
