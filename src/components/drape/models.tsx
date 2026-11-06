import { useMemo } from 'react';
import * as THREE from 'three';

const LEN = 0.62;   // base → tip
const WID = 0.46;   // widest point
const CUP = 0.11;   // how deep the petal is cupped

/**
 * Lotus/rose petal: a parametric surface (u = base→tip, v = edge→edge) with a pointed tip, a cupped body
 * (concave side up), a lengthwise curl that lifts the tip and base, and slightly rippled edges.
 * Origin is the mesh centre; the cup's lowest point sits near y = −CUP/2 so it rests on the floor.
 */
export function usePetalGeometry() {
  return useMemo(() => {
    const NU = 28, NV = 18;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      // broad shoulders, narrow base, tapering to a point
      const w = WID * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.85) * (1 - 0.18 * u);
      const curl = 0.55 * (u - 0.42) ** 2 - 0.05;
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * 2 - 1;
        const edge = Math.abs(v);
        const x = v * w;
        const z = (u - 0.5) * LEN;
        // cup deepest at the middle, rising to the rim; shallower toward the tip and base
        const cup = CUP * edge ** 1.7 * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.04)) ** 0.7;
        const ripple = 0.012 * Math.sin(u * 17 + v * 3) * edge ** 3 + 0.008 * Math.sin(u * 31 - v * 5) * edge ** 4;
        const y = cup + curl * CUP * 1.6 + ripple - CUP * 0.5;
        pos.push(x, y, z);
        uv.push((v + 1) / 2, u);
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
}

/** Paints the petal: deep pink rim, base and tip fading to a pale, translucent-looking centre, with fine veins. */
function makePetalTexture() {
  const W = 256, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const deep = [214, 66, 112], mid = [240, 130, 160], pale = [253, 228, 233];
  const mix = (a: number[], b: number[], t: number) => a.map((x, k) => x + (b[k] - x) * t);
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    const u = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const v = (x / (W - 1)) * 2 - 1;
      const e = Math.abs(v);
      // veins run along the length and fan out from the base
      const vein = 0.5 + 0.5 * Math.sin((v * (2.2 + 3.2 * u)) * 3.1 + Math.sin(u * 3.1 + v * 1.7) * 0.9);
      const streak = vein * 0.05 * (1 - e * 0.5);
      // pale in the middle of the body; deeper toward the rim, the base and (strongly) the tip
      let f = 0.1 + 0.85 * ss(0.3, 1, e) + 0.55 * ss(0.78, 1, u) + 0.4 * (1 - ss(0, 0.2, u)) - 0.18 * (1 - e) * ss(0.2, 0.7, u) * (1 - ss(0.7, 1, u));
      f = Math.min(1, Math.max(0, f)) + streak;
      const col = f < 0.55 ? mix(pale, mid, f / 0.55) : mix(mid, deep, (f - 0.55) / 0.45);
      // a little greenish-yellow where the petal joins the flower (like a real rose petal's base)
      const yg = (1 - ss(0.04, 0.34, 1 - u)) * (1 - ss(0.05, 0.62, e));
      const c2 = yg > 0 ? mix(col, [242, 238, 172], Math.min(1, yg * 0.85)) : col;
      col[0] = c2[0]; col[1] = c2[1]; col[2] = c2[2];
      const k = (y * W + x) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Hair-fine veins (≈ 20 % visible): a fan of nerves from the base that fork toward the rim, so the petal reads as
  // thin living tissue rather than smooth clay. Deterministic pseudo-random so every load looks the same.
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const X = (v: number) => ((v + 1) / 2) * (W - 1), Y = (u: number) => u * (H - 1);
  const vein = (v0: number, u0: number, vEnd: number, uEnd: number, depth: number) => {
    const steps = 18, wob = (rnd() - 0.5) * 0.05;
    g.beginPath();
    let lastV = v0, lastU = u0;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const v = v0 + (vEnd - v0) * t ** 0.85 + Math.sin(t * 6 + wob * 40) * wob;
      const u = u0 + (uEnd - u0) * t;
      k ? g.lineTo(X(v), Y(u)) : g.moveTo(X(v), Y(u));
      lastV = v; lastU = u;
    }
    g.stroke();
    if (depth < 2) for (let b = 0; b < 2; b++) {
      const t = 0.45 + rnd() * 0.3;
      const bv = v0 + (vEnd - v0) * t ** 0.85, bu = u0 + (uEnd - u0) * t;
      vein(bv, bu, bv + (vEnd - v0) * (0.35 + rnd() * 0.25) * (b ? 1 : -0.4), Math.min(0.98, bu + (uEnd - u0) * (0.3 + rnd() * 0.2)), depth + 1);
    }
    return [lastV, lastU];
  };
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(165, 35, 78, 0.26)';
  g.lineWidth = 1.05;
  for (let n = 0; n < 15; n++) {
    const vEnd = -0.95 + (1.9 * n) / 14 + (rnd() - 0.5) * 0.08;
    vein(0, 0.02, vEnd, 0.9 + rnd() * 0.08, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const petalMap = makePetalTexture();

export const petalMaterial = new THREE.MeshPhysicalMaterial({
  map: petalMap,
  roughness: 0.55,
  sheen: 0.8,
  sheenRoughness: 0.5,
  sheenColor: new THREE.Color('#ffd3df'),
  clearcoat: 0.08,
  clearcoatRoughness: 0.6,
  envMapIntensity: 0.28,
  // Thin petals are translucent: light passes through, so every face keeps its own colour even when turned from the
  // light. A faint self-glow from the colour map reproduces that and stops shaded faces going grey.
  emissive: new THREE.Color('#ffffff'),
  emissiveMap: petalMap,
  emissiveIntensity: 0.42,
  side: THREE.DoubleSide
});
