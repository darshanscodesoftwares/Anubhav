import { useMemo } from 'react';
import * as THREE from 'three';

const LEN = 0.72;   // base → tip
const WID = 0.66;   // across (the photo's transparency cuts the real, rounded outline out of this patch)
const CUP = 0.12;   // how far the edges rise

/**
 * A real 3D rose petal: a finely subdivided patch (u = base→tip, v = edge→edge) bent like the photographed petal —
 * a narrow pinched base, a cupped body whose edges rise, a tip that curls back, a rippled rim and one side rolled
 * over (like the right-hand fold in the reference). The owner's face-on petal photo (public/drape/petal-face.webp,
 * transparent outside the petal) is the colour map; the alpha cuts the outline. Lit like everything else in the
 * scene, so it shades correctly from any direction. Origin = patch centre; the cup's lowest point rests near y = −0.06.
 */
export function usePetalGeometry() {
  return useMemo(() => {
    const NU = 40, NV = 30;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const body = Math.sin(Math.PI * Math.min(1, u * 0.97 + 0.02)) ** 0.6;        // 0 at the ends, 1 mid-petal
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * 2 - 1;
        const edge = Math.abs(v);
        // pinch the base so the petal narrows where it joined the flower
        const pinch = 0.55 + 0.45 * ss(0.0, 0.38, u);
        let x = v * WID * 0.5 * pinch;
        const z = (u - 0.5) * LEN;
        let y = CUP * edge ** 1.8 * (0.3 + 0.7 * body);                               // cupped across
        y += 0.2 * CUP * (u - 0.45) ** 2 * 4;                                          // gentle lengthwise bow
        y += 0.22 * ss(0.72, 1, u) ** 2;                                               // tip curls back up
        y += 0.012 * Math.sin(u * 15 + v * 3) * edge ** 3 + 0.01 * Math.sin(u * 27 - v * 5) * edge ** 4; // rippled rim
        // right-hand side rolled over and inward
        const roll = ss(0.35, 1.0, v) * (0.25 + 0.75 * body);
        y += 0.15 * roll * roll;
        x -= 0.12 * roll * roll * WID * 0.5;
        pos.push(x, y - 0.06, z);
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

const petalMap = new THREE.TextureLoader().load('/drape/petal-face.webp');
petalMap.colorSpace = THREE.SRGBColorSpace;
petalMap.anisotropy = 4;

export const petalMaterial = new THREE.MeshPhysicalMaterial({
  map: petalMap,
  alphaTest: 0.4,
  roughness: 0.6,
  sheen: 0.7,
  sheenRoughness: 0.5,
  sheenColor: new THREE.Color('#ffd3df'),
  envMapIntensity: 0.3,
  // thin petals are translucent: a faint self-glow keeps faces turned from the light from going grey
  emissive: new THREE.Color('#ffffff'),
  emissiveMap: petalMap,
  emissiveIntensity: 0.14,
  side: THREE.DoubleSide
});
