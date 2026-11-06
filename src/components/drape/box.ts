import * as THREE from 'three';

/**
 * Traditional carved wooden chest (sandook) for the Pick a Drape "delivery box": polished rosewood with a carved front
 * panel (beaded frame, corner leaves, central rosette) and brass fittings. Everything is procedural — canvas textures,
 * no image downloads.
 */

/** Box dimensions in scene units (multiplied by the scene scale `s`). */
export const BOX = { w: 1.55, d: 1.1, h: 0.74, lid: 0.1, dome: 0.21, foot: 0.05 };

// deterministic noise so the grain is identical on every load
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Rosewood/teak grain: long flowing streaks along x, pores and a warm polished tone. */
function paintGrain(g: CanvasRenderingContext2D, W: number, H: number, seed: number) {
  const img = g.createImageData(W, H), d = img.data;
  const dark = [62, 30, 14], mid = [104, 56, 28], light = [146, 88, 46];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const warp = vnoise(nx * 3 + seed, ny * 6) * 2.2 + vnoise(nx * 9, ny * 18 + seed) * 0.5;
      const ring = 0.5 + 0.5 * Math.sin((ny * 14 + warp * 2.4) * Math.PI);
      const fine = vnoise(nx * 220, ny * 34 + seed) * 0.5 + vnoise(nx * 40, ny * 160) * 0.5;
      const t = Math.min(1, Math.max(0, 0.32 + ring ** 2 * 0.32 + fine * 0.42 - 0.12));
      const c = t < 0.5 ? dark.map((v, k) => v + (mid[k] - v) * (t / 0.5)) : mid.map((v, k) => v + (light[k] - v) * ((t - 0.5) / 0.5));
      const pore = hash(x * 0.7 + seed, y * 1.3) > 0.985 ? 0.82 : 1;
      const k = (y * W + x) * 4;
      d[k] = c[0] * pore; d[k + 1] = c[1] * pore; d[k + 2] = c[2] * pore; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/** A carved stroke: a dark groove with a thin highlight on its upper-left lip, so it reads as cut into the wood. */
function carve(g: CanvasRenderingContext2D, path: () => void, width: number) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.translate(-1, -1);
  g.strokeStyle = 'rgba(214,160,104,0.55)';
  g.lineWidth = width * 0.7;
  path(); g.stroke();
  g.translate(2, 2);
  g.strokeStyle = 'rgba(28,12,4,0.82)';
  g.lineWidth = width;
  path(); g.stroke();
  g.restore();
}

function framePanel(g: CanvasRenderingContext2D, W: number, H: number, inset: number) {
  // outer bevelled frame + a beaded inner border
  carve(g, () => { g.beginPath(); g.rect(inset, inset, W - inset * 2, H - inset * 2); }, 5);
  carve(g, () => { g.beginPath(); g.rect(inset + 18, inset + 18, W - inset * 2 - 36, H - inset * 2 - 36); }, 3);
  const step = 16;
  for (let x = inset + 30; x < W - inset - 24; x += step) {
    carve(g, () => { g.beginPath(); g.arc(x, inset + 9, 2.6, 0, Math.PI * 2); }, 1.6);
    carve(g, () => { g.beginPath(); g.arc(x, H - inset - 9, 2.6, 0, Math.PI * 2); }, 1.6);
  }
}

function leaf(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number) {
  carve(g, () => {
    g.beginPath();
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    const nx = -Math.sin(ang) * len * 0.32, ny = Math.cos(ang) * len * 0.32;
    g.moveTo(x, y);
    g.quadraticCurveTo((x + ex) / 2 + nx, (y + ey) / 2 + ny, ex, ey);
    g.quadraticCurveTo((x + ex) / 2 - nx, (y + ey) / 2 - ny, x, y);
    g.moveTo(x, y); g.lineTo(ex, ey);
  }, 2.4);
}

function rosette(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    carve(g, () => {
      g.beginPath();
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      g.ellipse((cx + px) / 2, (cy + py) / 2, r * 0.52, r * 0.2, a, 0, Math.PI * 2);
    }, 2.8);
  }
  carve(g, () => { g.beginPath(); g.arc(cx, cy, r * 0.22, 0, Math.PI * 2); }, 3);
  carve(g, () => { g.beginPath(); g.arc(cx, cy, r * 1.18, 0, Math.PI * 2); }, 2.2);
  // scrolling vines either side
  for (const side of [-1, 1]) {
    carve(g, () => {
      g.beginPath();
      g.moveTo(cx + side * r * 1.3, cy);
      g.bezierCurveTo(cx + side * r * 2.4, cy - r * 0.9, cx + side * r * 3.4, cy + r * 0.9, cx + side * r * 4.6, cy - r * 0.1);
    }, 2.6);
    for (let k = 0; k < 4; k++) {
      const t = 0.25 + k * 0.2;
      leaf(g, cx + side * r * (1.3 + t * 3.3), cy + Math.sin(t * 7) * r * 0.45, side > 0 ? -0.9 + k * 0.7 : Math.PI + 0.9 - k * 0.7, r * 0.55);
    }
  }
}

function canvasTex(W: number, H: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let cache: ReturnType<typeof build> | null = null;
function build() {
  const grain = canvasTex(512, 512, g => paintGrain(g, 512, 512, 3.1));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  const front = canvasTex(1024, 512, g => {
    paintGrain(g, 1024, 512, 7.7);
    framePanel(g, 1024, 512, 26);
    rosette(g, 512, 256, 58);
    for (const [x, y, a] of [[90, 90, 0.6], [934, 90, Math.PI - 0.6], [90, 422, -0.6], [934, 422, Math.PI + 0.6]] as const) {
      leaf(g, x, y, a, 46); leaf(g, x, y, a + 0.7 * Math.sign(Math.cos(a)), 34);
    }
  });
  const side = canvasTex(704, 496, g => {
    paintGrain(g, 704, 496, 1.9);
    framePanel(g, 704, 496, 24);
    rosette(g, 352, 248, 34);
  });
  const lidTex = canvasTex(1024, 512, g => {
    paintGrain(g, 1024, 512, 5.3);
    carve(g, () => { g.beginPath(); g.rect(30, 30, 964, 452); }, 4);
    for (let x = 60; x < 980; x += 60) leaf(g, x, 256, (x / 60) % 2 ? -0.5 : 0.5 + Math.PI, 26);
  });
  const wood = (map: THREE.Texture) =>
    new THREE.MeshPhysicalMaterial({ map, bumpMap: map, bumpScale: 2.2, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c39a4c', metalness: 1, roughness: 0.32, envMapIntensity: 1.1 });
  const interior = new THREE.MeshStandardMaterial({ color: '#2a140a', roughness: 0.9, side: THREE.BackSide });
  const velvet = new THREE.MeshStandardMaterial({ color: '#6b1424', roughness: 0.95 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  return {
    // BoxGeometry face order: +x, −x, +y (open top → hidden), −y, +z (front), −z (back)
    body: [wood(side), wood(side), hidden, wood(grain), wood(front), wood(front)],
    lid: wood(lidTex),
    plain: wood(grain),
    brass,
    interior,
    velvet
  };
}

/** Shared materials for the chest (built once, on first use). */
export function boxMaterials() {
  return (cache ??= build());
}

/** Domed lid: a half-cylinder along x, flattened, closed at both ends. */
export function domeGeometry(w: number, d: number, dome: number) {
  const g = new THREE.CylinderGeometry(d / 2, d / 2, w, 40, 1, false, 0, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.scale(1, dome / (d / 2), 1);
  return g;
}
