import { useMemo } from 'react';
import * as THREE from 'three';

const LEN = 0.62;   // base → tip
const WID = 0.51;   // patch width (the photo's alpha cuts the real outline; 524×640 → 0.82 of LEN)
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
      const w = WID * 0.5; // full-width patch; the photo's transparency shapes the petal
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

/** The owner's petal photo (rotated so the yellow base is at u = 0, transparent outside the petal). */
const petalMap = new THREE.TextureLoader().load('/drape/petal-dewy.webp');
petalMap.colorSpace = THREE.SRGBColorSpace;
petalMap.anisotropy = 4;

export const petalMaterial = new THREE.MeshPhysicalMaterial({
  map: petalMap,
  alphaTest: 0.5,
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
  emissiveIntensity: 0.16,
  side: THREE.DoubleSide
});
