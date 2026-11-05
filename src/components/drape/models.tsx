import { useMemo } from 'react';
import * as THREE from 'three';

/** Curled rose petal. */
export function usePetalGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.22);
    s.bezierCurveTo(0.2, -0.16, 0.24, 0.12, 0.05, 0.24);
    s.bezierCurveTo(0.0, 0.26, -0.05, 0.26, -0.08, 0.23);
    s.bezierCurveTo(-0.26, 0.08, -0.18, -0.17, 0, -0.22);
    const g = new THREE.ShapeGeometry(s, 24);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const base = new THREE.Color('#d6506b'), tip = new THREE.Color('#ffd9e1'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, 0.55 * x * x + 0.3 * Math.max(0, y) ** 2 - 0.08 * Math.max(0, -y));
      c.copy(base).lerp(tip, THREE.MathUtils.smoothstep(y, -0.22, 0.2));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, []);
}

export const petalMaterial = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  vertexColors: true,
  roughness: 0.42,
  sheen: 1,
  sheenColor: new THREE.Color('#ffd6df'),
  clearcoat: 0.35,
  side: THREE.DoubleSide
});
