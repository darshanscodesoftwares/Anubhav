import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, useTexture } from '@react-three/drei';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  RoundCuboidCollider,
  type RapierRigidBody
} from '@react-three/rapier';
import { SAREES, type Saree, type Tag } from './data';
import { applyFabricDeform, makeBundleGeometry, makeFabricUniforms, springStep } from './fabric';
import { petalMaterial, usePetalGeometry } from './models';


export interface DrapeSceneProps {
  /** the browser dropped the WebGL context (GPU reset, too many contexts…) — the parent remounts the scene */
  onContextLost?: () => void;
  active: boolean;
  filter: Tag | null;
}

interface Entry {
  /** sarees feel heavy in the hand (lag, capped carry/throw speed); petals stay feathery */
  heavy?: boolean;
  key: string;
  rb: RapierRigidBody;
  gravity: number;
  /** stop any idle behaviour (e.g. hovering) so physics takes over */
  release?: () => void;
}

interface Bounds { cx: number; cz: number; hx: number; hz: number; s: number }

interface Ctx {
  startDrag: (e: Entry, ev: ThreeEvent<PointerEvent>) => void;
  dragging: React.RefObject<Entry | null>;
  bounds: Bounds;
  petals: React.RefObject<Map<string, RapierRigidBody>>;
  bundles: React.RefObject<Map<string, RapierRigidBody>>;
  /** cursor on the floating-height plane (world x,z) and its velocity; `on` is false when the pointer isn't over the scene */
  cursor: React.RefObject<{ x: number; z: number; vx: number; vz: number; on: boolean }>;
  /** puff of air from (x, z): nearby petals blow outward and up like feathers */
  gust: (x: number, z: number, radius: number, power: number) => void;
}
const SceneCtx = createContext<Ctx>(null!);

// Layout in normalised floor coords (-1..1), echoing the design board.
const LAYOUT = {
  saree: [
    { id: 'maroon', x: 0.1, z: -0.02, ry: 0.35 },
    { id: 'ivory', x: -0.28, z: -0.08, ry: -0.25 },
    { id: 'navy', x: 0.56, z: -0.16, ry: 0.2 },
    { id: 'black', x: -0.44, z: 0.66, ry: 0.18 },
    { id: 'yellow', x: 0.4, z: 0.46, ry: -0.12 }
  ] as const,
  // rose petals scattered through the gaps; the first 6 are used on small screens
  petal: [
    { x: -0.56, z: -0.58, k: 1.2 }, { x: 0.74, z: 0.12, k: 1.35 }, { x: -0.1, z: 0.42, k: 1.1 }, { x: 0.24, z: 0.34, k: 0.95 },
    { x: -0.7, z: 0.2, k: 1.25 }, { x: 0.62, z: 0.8, k: 1.05 }, { x: 0.32, z: -0.62, k: 0.9 }, { x: -0.2, z: 0.86, k: 1.3 },
    { x: 0.02, z: 0.62, k: 1.0 }, { x: -0.52, z: 0.3, k: 0.85 }
  ]
};

/* ------------------------------------------------------------------ soft contact shadows */

/**
 * Rounded-rect shadow sprite. The shape fills only the centre `frac` of the canvas, leaving > 3× the blur radius
 * as margin so the falloff reaches zero before the sprite edge (no visible square seams when shadows overlap).
 */
function makeShadowTex(size: number, frac: number, blur: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const inset = (size * (1 - frac)) / 2;
  g.filter = `blur(${blur}px)`;
  g.fillStyle = 'rgb(46,20,13)';
  g.beginPath();
  g.roundRect(inset, inset, size * frac, size * frac, size * frac * 0.22);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const CORE = { frac: 0.6, tex: makeShadowTex(256, 0.6, 7) };   // contact shadow: dense, tight
const SOFT = { frac: 0.4, tex: makeShadowTex(512, 0.4, 46) };  // penumbra: wide, soft
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/** Floor direction shadows fall in (x, z): away from the top-right key light. */
const SHADOW_DIR = new THREE.Vector2(-0.78, 0.62).normalize();

/**
 * Physically-motivated soft shadow under a body, shaped like its footprint and turning with it:
 *  - contact layer: thick and dark while touching the surface, gone within a few cm of lift
 *  - penumbra layer: grows larger, softer and fainter with height
 * Both slide down-left (away from the key light) as the object rises.
 */
function ShadowBlob({ body, w, d, strength = 1, y = -0.14 }: { body: React.RefObject<RapierRigidBody | null>; w: number; d: number; strength?: number; y?: number }) {
  const core = useRef<THREE.Mesh>(null);
  const soft = useRef<THREE.Mesh>(null);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ map: CORE.tex, transparent: true, depthWrite: false, toneMapped: false }), []);
  const softMat = useMemo(() => new THREE.MeshBasicMaterial({ map: SOFT.tex, transparent: true, depthWrite: false, toneMapped: false }), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const b = body.current;
    if (!b || !core.current || !soft.current) return;
    const p = b.translation();
    const r = b.rotation();
    e.setFromQuaternion(q.set(r.x, r.y, r.z, r.w), 'YXZ');
    const size = Math.max(w, d);
    // height of the underside above the floor (bodies rest with their centre ≈ half-thickness up)
    const gap = Math.max(0, p.y - size * 0.1);
    const touch = 1 - THREE.MathUtils.smoothstep(gap, 0.02, 0.25);
    const lift = THREE.MathUtils.clamp(gap / 3, 0, 1);

    const cOff = size * 0.05;
    core.current.position.set(p.x + SHADOW_DIR.x * cOff, y + 0.004, p.z + SHADOW_DIR.y * cOff);
    core.current.rotation.y = e.y;
    core.current.scale.set((w * 1.04) / CORE.frac, 1, (d * 1.06) / CORE.frac);
    coreMat.opacity = 0.62 * touch * strength;

    const sOff = size * 0.12 + gap * 0.42;
    soft.current.position.set(p.x + SHADOW_DIR.x * sOff, y + 0.003, p.z + SHADOW_DIR.y * sOff);
    soft.current.rotation.y = e.y;
    const spread = 1.12 + lift * 0.7;
    soft.current.scale.set((w * spread) / SOFT.frac, 1, (d * spread) / SOFT.frac);
    softMat.opacity = 0.42 * (1 - lift * 0.65) * strength;
  });
  return (
    <>
      <mesh ref={soft} geometry={shadowGeo} material={softMat} renderOrder={-2} />
      <mesh ref={core} geometry={shadowGeo} material={coreMat} renderOrder={-1} />
    </>
  );
}

/* ------------------------------------------------------------------ camera + walls */

function Rig({ children }: { children: (b: Bounds) => React.ReactNode }) {
  const { camera, size } = useThree();
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useEffect(() => {
    const aspect = size.width / size.height;
    const cam = camera as THREE.PerspectiveCamera;
    // pull back on narrow screens so the play area stays usable
    const k = aspect < 1 ? 1.45 : aspect < 1.4 ? 1.2 : 1;
    cam.fov = 30;
    // lower, more frontal angle like the design board (≈40°), so the folds and borders face the viewer
    cam.position.set(0, 8.6 * k, 10.6 * k);
    cam.lookAt(0, 0, 1.0 * k);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // project screen corners onto the floor to find the visible play area
    const ray = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = (x: number, y: number) => {
      ray.setFromCamera(new THREE.Vector2(x, y), cam);
      return ray.ray.intersectPlane(floor, new THREE.Vector3())!;
    };
    const far = [hit(-1, 0.86), hit(1, 0.86)];
    const near = [hit(-1, -1), hit(1, -1)];
    const hx = Math.min(Math.abs(far[0].x), Math.abs(far[1].x)) * 0.94;
    const z0 = far[0].z, z1 = near[0].z;
    setBounds({ cx: 0, cz: (z0 + z1) / 2, hx, hz: ((z1 - z0) / 2) * 0.86, s: THREE.MathUtils.clamp(hx / 4.6, 0.62, 1) });
  }, [camera, size.width, size.height]);

  if (!bounds) return null;
  const { cx, cz, hx, hz } = bounds;
  const T = 0.5;
  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={0.9} restitution={0.05}>
        <CuboidCollider args={[40, 0.5, 40]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[T, 6, hz + 2]} position={[cx - hx - T, 6, cz]} />
        <CuboidCollider args={[T, 6, hz + 2]} position={[cx + hx + T, 6, cz]} />
        <CuboidCollider args={[hx + 2, 6, T]} position={[cx, 6, cz - hz - T]} />
        <CuboidCollider args={[hx + 2, 6, T]} position={[cx, 6, cz + hz + T]} />
        <CuboidCollider args={[hx + 2, T, hz + 2]} position={[cx, 7.5, cz]} />
      </RigidBody>
      {children(bounds)}
    </>
  );
}

/* ------------------------------------------------------------------ drag + throw */

const LIFT = 1.15;
/** World gravity (m/s²). Everything obeys it; floaters are held up by a levitation spring, not by switching it off. */
const GRAVITY = 14;
/** Petals are feather-light: barely any gravity + high air drag → a gust darts them away, then they drift down slowly. */
const PETAL_GRAVITY = 0.16;

function useDragController(bounds: Bounds) {
  const { camera, gl } = useThree();
  const dragging = useRef<Entry | null>(null);
  const ndc = useRef(new THREE.Vector2());
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  const setNdc = (x: number, y: number) => {
    const r = gl.domElement.getBoundingClientRect();
    ndc.current.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };

  const startDrag = (e: Entry, ev: ThreeEvent<PointerEvent>) => {
    ev.stopPropagation();
    dragging.current = e;
    setNdc(ev.nativeEvent.clientX, ev.nativeEvent.clientY);
    e.rb.setGravityScale(0, true);
    document.body.style.cursor = 'grabbing';
    const move = (m: PointerEvent) => setNdc(m.clientX, m.clientY);
    const end = () => {
      const d = dragging.current;
      dragging.current = null;
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!d) return;
      d.rb.setGravityScale(d.gravity, true);
      const v = d.rb.linvel();
      const len = Math.hypot(v.x, v.y, v.z);
      // a heavy saree keeps only part of the hand's speed, capped, and can't be flung upward much
      const keep = d.heavy ? 0.55 : 1, cap = d.heavy ? 5.5 : 13;
      const k = Math.min(keep, cap / Math.max(len * keep, 1e-3) * keep);
      d.rb.setLinvel({ x: v.x * k, y: Math.min(v.y * k, d.heavy ? 1.5 : 8), z: v.z * k }, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  useFrame(() => {
    const d = dragging.current;
    if (!d) return;
    ray.setFromCamera(ndc.current, camera);
    if (!ray.ray.intersectPlane(plane, target)) return;
    target.x = THREE.MathUtils.clamp(target.x, bounds.cx - bounds.hx + 0.6, bounds.cx + bounds.hx - 0.6);
    target.z = THREE.MathUtils.clamp(target.z, bounds.cz - bounds.hz + 0.5, bounds.cz + bounds.hz - 0.5);
    const p = d.rb.translation();
    // heavy things lag the hand and have a top carry speed
    const gain = d.heavy ? 5.5 : 13, top = d.heavy ? 6.5 : 18;
    let vx = (target.x - p.x) * gain, vy = (target.y - p.y) * gain, vz = (target.z - p.z) * gain;
    const sp = Math.hypot(vx, vy, vz);
    if (sp > top) { vx *= top / sp; vy *= top / sp; vz *= top / sp; }
    d.rb.setLinvel({ x: vx, y: vy, z: vz }, true);
    // keep it roughly level while carried, swinging a little with the motion like held cloth
    const r = d.rb.rotation();
    q.set(r.x, r.y, r.z, r.w);
    up.set(0, 1, 0).applyQuaternion(q);
    const av = d.rb.angvel();
    d.rb.setAngvel({ x: -up.z * 6 + vz * 0.05 + av.x * 0.2, y: av.y * 0.85, z: up.x * 6 - vx * 0.05 + av.z * 0.2 }, true);
  });

  return { startDrag, dragging };
}

/* ------------------------------------------------------------------ saree bundle */

/** Top row floats mid-toss (like the design board); the bottom two rest on the surface. */
const FLOATING: Saree['id'][] = ['ivory', 'maroon', 'navy'];

/** half of the pillow/wrinkle height above the base box (see makeBundleGeometry) */
const BULGE_PAD = 0.06;

const bundleGeometries = new Map<string, THREE.BufferGeometry>();
function bundleGeometry(bh: number, shape: Saree['shape']) {
  const key = `${bh}|${JSON.stringify(shape ?? null)}`;
  let g = bundleGeometries.get(key);
  if (!g) {
    g = makeBundleGeometry(BUNDLE.w, bh, BUNDLE.d, BUNDLE.r, BUNDLE.bulge, shape);
    bundleGeometries.set(key, g);
  }
  return g;
}

const BUNDLE = { w: 2.2, h: 0.5, d: 1.5, r: 0.17, bulge: 0.09 };

function Bundle({ saree, at, index, dim, hop, float = false }: { saree: Saree; at: { x: number; z: number; ry: number }; index: number; dim: boolean; hop: number; float?: boolean }) {
  const ctx = useContext(SceneCtx);
  const rb = useRef<RapierRigidBody>(null);
  const s = ctx.bounds.s;
  const bh = saree.shape?.h ?? BUNDLE.h; // thickness (flat sarees are lower)
  const half = useMemo(() => new THREE.Vector3(BUNDLE.w / 2, bh / 2, BUNDLE.d / 2), [bh]);
  const geometry = useMemo(() => bundleGeometry(bh, saree.shape), [bh, saree.shape]);
  const U = useMemo(() => makeFabricUniforms(half), [half]);
  // colour (tinted ground) and roughness/metalness (zari) are pre-baked by scripts/bake-drape-maps.mjs
  const [topCol, topRm, edgeCol, edgeRm] = useTexture([
    `/drape/top-${saree.id}-col.webp`,
    `/drape/top-${saree.id}-rm.webp`,
    `/drape/edge-${saree.id}-col.webp`,
    `/drape/edge-${saree.id}-rm.webp`
  ]);
  const maps = useMemo(() => {
    topRm.colorSpace = THREE.NoColorSpace;
    edgeRm.colorSpace = THREE.NoColorSpace;
    return { top: { colour: topCol, rm: topRm }, edge: { colour: edgeCol, rm: edgeRm } };
  }, [topCol, topRm, edgeCol, edgeRm]);

  // Faces that share a UV transform share one texture + one material, so each saree uploads only a few textures to the GPU.
  const materials = useMemo(() => {
    const texCache = new Map<string, THREE.Texture>();
    const prep = (src: THREE.Texture, srgb: boolean, rx: number, ox: number, ry: number, oy: number) => {
      const key = `${src.uuid}|${rx}|${ox}|${ry}|${oy}`;
      let c = texCache.get(key);
      if (!c) {
        c = src.clone();
        if (srgb) c.colorSpace = THREE.SRGBColorSpace;
        c.anisotropy = 8;
        c.wrapS = c.wrapT = THREE.RepeatWrapping;
        c.repeat.set(rx, ry);
        c.offset.set(ox, oy);
        c.needsUpdate = true;
        texCache.set(key, c);
      }
      return c;
    };
    const matCache = new Map<string, THREE.MeshPhysicalMaterial>();
    // each face: colour map + matching zari map with the same UV transform
    const face = (src: 'top' | 'edge', rx = 1, ox = 0, ry = 1, oy = 0) => {
      const key = `${src}|${rx}|${ox}|${ry}|${oy}`;
      const cached = matCache.get(key);
      if (cached) return cached;
      const { colour, rm } = maps[src];
      const zm = prep(rm, false, rx, ox, ry, oy);
      const weave = saree.weave;
      const m = new THREE.MeshPhysicalMaterial({
        map: prep(colour, true, rx, ox, ry, oy),
        roughnessMap: zm,
        metalnessMap: zm,
        roughness: 1,
        metalness: 1,
        envMapIntensity: 0.8,
        // silk: a long, soft highlight that runs along the weave and slides with the view/light angle
        anisotropy: weave === 'silk' ? 0.55 : weave === 'organza' ? 0.3 : 0,
        anisotropyRotation: 0,
        // velvet: pile catches light at grazing angles; silk/organza get only a faint sheen
        sheen: weave === 'velvet' ? 0.45 : weave === 'organza' ? 0.2 : 0.12,
        sheenRoughness: weave === 'velvet' ? 0.6 : 0.35,
        sheenColor: new THREE.Color(saree.sheen),
        transparent: true
      });
      applyFabricDeform(m, U);
      matCache.set(key, m);
      return m;
    };
    // BoxGeometry groups: +x, −x, +y, −y, +z(front fold), −z(back).
    // The top's zari border (bottom 20% of the texture) continues mirrored down over the front fold.
    // Bottom and back faces are hidden from the camera, so they reuse the plain edge texture.
    return [
      face('edge', -1, 1),
      face('edge'),
      face('top'),
      face('edge'),
      face('top', 1, 0, -0.2, 0.2),
      face('edge')
    ];
  }, [maps, saree, U]);

  const init = useMemo(
    () => ({
      p: new THREE.Vector3(ctx.bounds.cx + at.x * ctx.bounds.hx, 2.6 + index * 0.75, ctx.bounds.cz + at.z * ctx.bounds.hz),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, at.ry, 0))
    }),
    [ctx.bounds, at, index]
  );

  // The top-row drapes float mid-toss (like the design board) until someone grabs them.
  const hovering = useRef(float);
  // where it levitates: the top-row sarees return to their start; a double-clicked one stays where it was lifted
  const hoverAt = useRef({ x: init.p.x, z: init.p.z });
  const entry = useRef<Entry | null>(null);
  useEffect(() => {
    if (!rb.current) return;
    const body = rb.current;
    entry.current = {
      key: saree.id,
      rb: body,
      gravity: 1,
      heavy: true,
      release: () => {
        if (!hovering.current) return;
        hovering.current = false;
      }
    };
    const id = saree.id, bundles = ctx.bundles.current;
    bundles.set(id, body);
    return () => { bundles.delete(id); };
  }, [saree.id, ctx]);

  // filter: matching drapes hop, others fade back
  useEffect(() => {
    if (hop && rb.current && !dim) {
      const m = rb.current.mass();
      rb.current.applyImpulse({ x: 0, y: 3.4 * m, z: 0 }, true);
      rb.current.applyTorqueImpulse({ x: 0, y: 0.05 * m, z: 0.02 * m }, true);
    }
  }, [hop]); // eslint-disable-line react-hooks/exhaustive-deps

  // fabric dynamics
  const tiltRef = useRef<THREE.Group>(null);
  // where the bundle was grabbed, in its own frame (-1..1 across width x and depth z)
  const grab = useRef(new THREE.Vector2());
  const tilt = useRef({ x: 0, vx: 0, z: 0, vz: 0 });
  const st = useRef({ prev: new THREE.Vector3(), lag: new THREE.Vector3(), lagV: new THREE.Vector3(), ripple: 0, slump: 0, slumpV: 0, prevVy: 0, hold: 0, holdV: 0, gusted: false, drape: 0, drapeV: 0 });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), a: new THREE.Vector3(), q: new THREE.Quaternion(), qd: new THREE.Quaternion(), e: new THREE.Euler() }), []);
  useFrame((state, dtRaw) => {
    const body = rb.current;
    if (!body) return;
    const dt = Math.min(dtRaw, 1 / 30);
    if (hovering.current) {
      const t = state.clock.elapsedTime;
      // Levitation under real gravity: a soft spring force balances the bundle's weight and holds it near its
      // hover point, so it sags in, bobs with inertia and reacts to bumps instead of being positioned directly.
      const p = body.translation();
      const v = body.linvel();
      const m = body.mass();
      const ty = (0.62 + 0.14 * (index % 3)) * s + 0.08 * Math.sin(t * 0.9 + index * 1.7);
      const ky = 16, cy = 6.2, kh = 5, ch = 4.2;
      body.applyImpulse({
        x: m * (kh * (hoverAt.current.x - p.x) - ch * v.x) * dt,
        y: m * (GRAVITY + ky * (ty - p.y) - cy * v.y) * dt,
        z: m * (kh * (hoverAt.current.z - p.z) - ch * v.z) * dt
      }, true);
      // Cursor push field: a floating saree is nudged away from the pointer (and a touch along its movement).
      // Soft quadratic falloff, small accelerations — a gentle shove the levitation spring then eases back.
      const cur = ctx.cursor.current;
      if (cur.on && !ctx.dragging.current) {
        const dx = p.x - cur.x, dz = p.z - cur.z;
        const dist = Math.hypot(dx, dz);
        const R = 2.3 * s;
        if (dist < R) {
          const f = (1 - dist / R) ** 2;
          const nx = dist > 1e-3 ? dx / dist : 0, nz = dist > 1e-3 ? dz / dist : 0;
          const accel = 7.5 * f;
          body.applyImpulse({
            x: m * (nx * accel + THREE.MathUtils.clamp(cur.vx, -8, 8) * 0.5 * f) * dt,
            y: 0,
            z: m * (nz * accel + THREE.MathUtils.clamp(cur.vz, -8, 8) * 0.5 * f) * dt
          }, true);
        }
      }
      const r = body.rotation();
      const yaw = tmp.e.setFromQuaternion(tmp.q.set(r.x, r.y, r.z, r.w), 'YXZ').y;
      body.setAngvel({ x: 0, y: (at.ry + 0.22 * Math.sin(t * 0.45 + index) - yaw) * 2, z: 0 }, true);
    }
    const S = st.current;
    const k = 62, c = 9.5;
    const lv = body.linvel();
    tmp.v.set(lv.x, lv.y, lv.z);
    tmp.a.subVectors(tmp.v, S.prev).divideScalar(Math.max(dt, 1e-3));
    S.prev.copy(tmp.v);
    const r = body.rotation();
    tmp.q.set(r.x, r.y, r.z, r.w).invert();
    tmp.a.applyQuaternion(tmp.q);
    // upper layers trail opposite the acceleration
    // constant breeze: slow gusts sway the upper layers a little, even when the bundle is at rest
    const wt = state.clock.elapsedTime + index * 2.1;
    const gust = 0.6 + 0.4 * Math.sin(wt * 0.37);
    const lagTarget = tmp.a.multiplyScalar(-0.0026).clampLength(0, 0.22);
    lagTarget.x += Math.sin(wt * 0.8) * 0.035 * gust;
    lagTarget.z += Math.cos(wt * 0.63 + 1.3) * 0.03 * gust;
    for (const ax of ['x', 'y', 'z'] as const) {
      const [x, v] = springStep(S.lag[ax], S.lagV[ax], lagTarget[ax], k, c, dt);
      S.lag[ax] = x;
      S.lagV[ax] = v;
    }
    // flutter with speed; a landing adds a burst
    const speed = tmp.v.length();
    const impact = S.prevVy < -2 && lv.y - S.prevVy > 1.5 ? Math.min(1, (lv.y - S.prevVy) / 9) : 0;
    // a falling cloth pushes air out from underneath just before it touches down → nearby petals blow away
    const bp = body.translation();
    if (!hovering.current && !S.gusted && lv.y < -1.6 && bp.y < 0.75 * s && ctx.dragging.current?.rb !== body) {
      S.gusted = true;
      ctx.gust(bp.x, bp.z, 3.4 * s, 0.4 + Math.min(1, -lv.y / 7));
    }
    if (lv.y > -0.3 && bp.y < 0.4 * s) S.gusted = false;
    S.prevVy = lv.y;
    // always-on flutter along the edges (all sarees, not just flying ones), swelling and easing with the gusts
    const breeze = 0.42 + 0.16 * Math.sin(wt * 0.5) + 0.08 * Math.sin(wt * 1.3);
    const rippleTarget = Math.max(breeze, Math.min(1, speed / 7) + impact * 0.9);
    S.ripple += (rippleTarget - S.ripple) * (rippleTarget > S.ripple ? 0.25 : 0.035);
    // soft slump on impact, then breathe back (well damped, no bounce)
    if (impact) S.slumpV += impact * 3.4;
    const [sx, sv] = springStep(S.slump, S.slumpV, 0, 38, 11, dt);
    S.slump = THREE.MathUtils.clamp(sx, -0.15, 0.6);
    S.slumpV = sv;
    // Physics keeps every bundle flat (rotation locked to yaw, so it can never flip). The lean you see is visual:
    // floaters hold a mid-toss tilt; others lean into their motion and spring back flat.
    if (tiltRef.current) {
      const T = tilt.current;
      const yaw = tmp.e.setFromQuaternion(tmp.q.set(r.x, r.y, r.z, r.w), 'YXZ').y;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const lvx = lv.x * cy - lv.z * sy, lvz = lv.x * sy + lv.z * cy; // velocity in the bundle's frame
      const t = state.clock.elapsedTime;
      // edge pickups: the grabbed side lifts a little toward the hand (x-rot lifts −z… so negate z)
      const gx = grab.current.x * S.hold, gz = grab.current.y * S.hold;
      const tx = hovering.current ? 0.32 + 0.06 * Math.sin(t * 0.9 + index) : THREE.MathUtils.clamp(lvz * 0.045 - gz * 0.16, -0.38, 0.38);
      const tz = hovering.current ? -0.14 + 0.05 * Math.sin(t * 0.7 + index) : THREE.MathUtils.clamp(-lvx * 0.045 + gx * 0.22, -0.38, 0.38);
      [T.x, T.vx] = springStep(T.x, T.vx, tx, 45, 8, dt);
      [T.z, T.vz] = springStep(T.z, T.vz, tz, 45, 8, dt);
      tiltRef.current.rotation.set(T.x, 0, T.z);
    }
    U.uLag.value.copy(S.lag);
    U.uRipple.value = S.ripple;
    U.uSlump.value = S.slump;
    // picked up → ends droop with a small settle; released → relax flat
    const held = ctx.dragging.current?.key === saree.id;
    [S.hold, S.holdV] = springStep(S.hold, S.holdV, held ? 1 : 0, 70, 9, dt);
    U.uHold.value = S.hold;

    // Resting on another bundle? Find the one underneath and let the overhang sag around its edge.
    let support: { sx: number; sz: number; dyaw: number; px: number; pz: number } | null = null;
    if (!hovering.current && !held && lv.y > -1.5) {
      const ap = body.translation();
      const ay = tmp.e.setFromQuaternion(tmp.q.set(r.x, r.y, r.z, r.w), 'YXZ').y;
      const ca = Math.cos(ay), sa = Math.sin(ay);
      ctx.bundles.current.forEach((ob, id) => {
        if (id === saree.id || support) return;
        const bp = ob.translation();
        const dy = ap.y - bp.y;
        if (dy < 0.3 * s || dy > 0.95 * s) return; // not directly above it
        const wx = bp.x - ap.x, wz = bp.z - ap.z;
        const br = ob.rotation();
        const by = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(br.x, br.y, br.z, br.w), 'YXZ').y;
        // footprints must overlap (in its frame); my centre may hang past its edge
        const cb = Math.cos(by), sb = Math.sin(by);
        const mx = -wx * cb - wz * sb, mz = wx * sb - wz * cb;
        if (Math.abs(mx) > half.x * 1.9 * s || Math.abs(mz) > half.z * 1.9 * s) return;
        // centre of mass past the lower bundle's edge → it can't balance there and slides off (physics stays yaw-locked,
        // so this is a push away from the ledge instead of a tip-over)
        const ox = Math.sign(mx) * Math.max(0, Math.abs(mx) - half.x * s * 1.05);
        const oz = Math.sign(mz) * Math.max(0, Math.abs(mz) - half.z * s * 1.05);
        support = { sx: (wx * ca - wz * sa) / s, sz: (wx * sa + wz * ca) / s, dyaw: by - ay, px: ox * cb - oz * sb, pz: ox * sb + oz * cb };
      });
    }
    const sup = support as { sx: number; sz: number; dyaw: number; px: number; pz: number } | null;
    if (sup) {
      U.uSup.value.set(sup.sx, sup.sz, half.x, half.z);
      U.uSupRot.value.set(Math.cos(sup.dyaw), Math.sin(sup.dyaw));
      const over = Math.hypot(sup.px, sup.pz);
      if (over > 0.02) {
        const k = Math.min(1, over / (0.1 * s)) * 24 * body.mass() * dt / over;
        body.applyImpulse({ x: sup.px * k, y: 0, z: sup.pz * k }, true);
      }
    }
    [S.drape, S.drapeV] = springStep(S.drape, S.drapeV, sup ? 1 : 0, 46, 9, dt);
    U.uSag.value = Math.max(0, S.drape);
    U.uTime.value = state.clock.elapsedTime;
    const targetOpacity = dim ? 0.22 : 1;
    for (const m of materials) m.opacity += (targetOpacity - m.opacity) * 0.12;
  });

  return (
    <>
    <ShadowBlob body={rb} w={BUNDLE.w * s} d={BUNDLE.d * s} strength={dim ? 0.22 : 1} />
    <RigidBody
      ref={rb}
      colliders={false}
      position={init.p}
      quaternion={init.q}
      enabledRotations={[false, true, false]}
      linearDamping={0.95}
      angularDamping={2.2}
      ccd
    >
      {/* Collider covers the visible shape: the pillowed top + wrinkles rise ~BUNDLE.bulge above the base box, so it is
          taller and shifted up by half of that — otherwise petals settle inside the cloth. */}
      <RoundCuboidCollider
        position={[0, BULGE_PAD * s, 0]}
        args={[(BUNDLE.w / 2 - BUNDLE.r) * s, (bh / 2 + BULGE_PAD - BUNDLE.r) * s, (BUNDLE.d / 2 - BUNDLE.r) * s, BUNDLE.r * s]}
        density={1.1}
        friction={1.25}
        restitution={0.04}
      />
      <group ref={tiltRef}>
      <mesh
        geometry={geometry}
        material={materials}
        scale={s}
        onPointerDown={e => {
          if (!entry.current || !rb.current) return;
          const p = rb.current.translation(), r = rb.current.rotation();
          const yaw = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w), 'YXZ').y;
          const dx = e.point.x - p.x, dz = e.point.z - p.z;
          const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
          grab.current.set(THREE.MathUtils.clamp(lx / (half.x * s), -1, 1), THREE.MathUtils.clamp(lz / (half.z * s), -1, 1));
          U.uGrab.value.copy(grab.current);
          entry.current.release?.();
          ctx.gust(p.x, p.z, 2.4 * s, 0.35);
          ctx.startDrag(entry.current, e);
        }}
        onDoubleClick={() => {
          // double-click: let it float where it is
          const b = rb.current;
          if (!b) return;
          const p = b.translation();
          hoverAt.current = { x: p.x, z: p.z };
          hovering.current = true;
        }}
        onPointerOver={() => !ctx.dragging.current && (document.body.style.cursor = 'grab')}
        onPointerOut={() => !ctx.dragging.current && (document.body.style.cursor = '')}
      />
      </group>
    </RigidBody>
    </>
  );
}

/* ------------------------------------------------------------------ petals */

/** Light rose petal: floats down slowly (low gravity, high drag), can be picked up and tossed like the drapes. */
const petalUp = new THREE.Vector3(), petalTorque = new THREE.Vector3(), petalWorldUp = new THREE.Vector3(0, 1, 0), petalQ = new THREE.Quaternion();

function Petal({ i, at }: { i: number; at: { x: number; z: number; k: number } }) {
  const ctx = useContext(SceneCtx);
  const geo = usePetalGeometry();
  const rb = useRef<RapierRigidBody>(null);
  const s = ctx.bounds.s * at.k;
  const init = useMemo(
    () => ({
      p: new THREE.Vector3(ctx.bounds.cx + at.x * ctx.bounds.hx, 2.6 + i * 0.45, ctx.bounds.cz + at.z * ctx.bounds.hz),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler((i % 3) * 0.3, i * 1.7, (i % 2) * 0.4))
    }),
    [ctx.bounds, at, i]
  );
  const entry = useRef<Entry | null>(null);
  useEffect(() => {
    if (!rb.current) return;
    entry.current = { key: `petal-${i}`, rb: rb.current, gravity: PETAL_GRAVITY };
    const key = `petal-${i}`, body = rb.current, petals = ctx.petals.current;
    petals.set(key, body);
    return () => { petals.delete(key); };
  }, [i]);
  // airborne flutter: a slow side-to-side sway and tumble, like a petal drifting through air
  useFrame(state => {
    const b = rb.current;
    if (!b) return;
    const y = b.translation().y;
    const m = b.mass(), dt = 1 / 60;
    // settling: near a surface the petal is pressed back toward lying flat (it never balances on its edge);
    // in open air only a whisper of levelling so it still tumbles as it drifts
    const r = b.rotation();
    petalUp.set(0, 1, 0).applyQuaternion(petalQ.set(r.x, r.y, r.z, r.w));
    petalTorque.crossVectors(petalUp, petalWorldUp);
    const near = y < 0.5 * s ? 1 : 0.07;
    const av = b.angvel();
    b.applyTorqueImpulse(
      { x: (petalTorque.x * 2.6 * near - av.x * 0.06) * m * dt, y: 0, z: (petalTorque.z * 2.6 * near - av.z * 0.06) * m * dt },
      true
    );
    if (y < 0.12) return;
    const t = state.clock.elapsedTime + i * 1.3;
    b.applyImpulse({ x: Math.sin(t * 1.7) * 0.9 * m * dt, y: 0, z: Math.cos(t * 1.3) * 0.7 * m * dt }, true);
    b.applyTorqueImpulse({ x: Math.sin(t * 2.1) * 0.004 * m * dt, y: 0, z: Math.cos(t * 1.9) * 0.004 * m * dt }, true);
  });
  return (
    <>
      {/* y: sprites sit below the cupped petal so the shadow never cuts through its body */}
      <ShadowBlob body={rb} w={0.42 * s} d={0.42 * s} strength={0.45} y={-0.14} />
      <RigidBody ref={rb} colliders={false} position={init.p} quaternion={init.q} gravityScale={PETAL_GRAVITY} linearDamping={3.2} angularDamping={1.1} ccd>
        <CuboidCollider args={[0.22 * s * 1.25, 0.07 * s, 0.3 * s * 1.25]} density={0.15} friction={0.6} restitution={0} />
        <mesh
          geometry={geo}
          material={petalMaterial}
          scale={1.25 * s}
          onPointerDown={e => entry.current && ctx.startDrag(entry.current, e)}
          onPointerOver={() => !ctx.dragging.current && (document.body.style.cursor = 'grab')}
          onPointerOut={() => !ctx.dragging.current && (document.body.style.cursor = '')}
        />
      </RigidBody>
    </>
  );
}

/**
 * Pre-uploads every texture to the GPU and compiles the shaders in small idle slices, while the scene is still hidden,
 * so the first visible frame never stalls. (three only does this lazily, on the first render that draws a material.)
 */
function Warm({ ready }: { ready: boolean }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const textures = new Set<THREE.Texture>();
    scene.traverse(o => {
      const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        const mm = m as THREE.MeshPhysicalMaterial;
        [mm.map, mm.roughnessMap, mm.metalnessMap, mm.emissiveMap].forEach(t => t && textures.add(t));
      }
    });
    const queue = [...textures];
    const slice = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 400 }) : globalThis.setTimeout(cb, 30));
    const step = () => {
      if (cancelled) return;
      const t = queue.shift();
      if (t) {
        gl.initTexture(t);
        slice(step);
      } else {
        // shader programs compile on the GPU driver's own threads when the extension exists
        (gl as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> })
          .compileAsync?.(scene, camera)
          .catch(() => {});
      }
    };
    slice(step);
    return () => { cancelled = true; };
  }, [ready, gl, scene, camera]);
  return null;
}

/* ------------------------------------------------------------------ scene */

function World({ bounds, filter }: DrapeSceneProps & { bounds: Bounds }) {
  const { startDrag, dragging } = useDragController(bounds);

  const petals = useRef(new Map<string, RapierRigidBody>());
  const bundles = useRef(new Map<string, RapierRigidBody>());

  // Cursor push field: track where the pointer is on the plane the floating sarees hover in.
  const cursor = useRef({ x: 0, z: 0, vx: 0, vz: 0, on: false });
  const { gl: glr, camera: cam, pointer } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hoverPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8 * bounds.s), [bounds.s]);
  const hit = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const el = glr.domElement;
    const enter = () => { cursor.current.on = true; };
    const leave = () => { cursor.current.on = false; };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); };
  }, [glr]);
  useFrame((_, dt) => {
    const c = cursor.current;
    if (!c.on) { c.vx = c.vz = 0; return; }
    ray.setFromCamera(pointer, cam);
    if (!ray.ray.intersectPlane(hoverPlane, hit)) return;
    const d = Math.max(dt, 1e-3);
    // smoothed velocity so a single jumpy frame doesn't fling anything
    c.vx += ((hit.x - c.x) / d - c.vx) * 0.25;
    c.vz += ((hit.z - c.z) / d - c.vz) * 0.25;
    c.x = hit.x;
    c.z = hit.z;
  });
  const gust = useCallback((x: number, z: number, radius: number, power: number) => {
    petals.current.forEach(b => {
      const p = b.translation();
      const dx = p.x - x, dz = p.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > radius) return;
      const f = Math.pow(1 - dist / radius, 1.4) * power;
      const nx = dist > 1e-3 ? dx / dist : Math.random() - 0.5, nz = dist > 1e-3 ? dz / dist : Math.random() - 0.5;
      const m = b.mass();
      // mostly outward along the surface with a light lift: a skim-and-drift, like feathers
      b.applyImpulse({ x: nx * f * 10 * m, y: f * (2 + Math.random() * 1.2) * m, z: nz * f * 10 * m }, true);
      b.applyTorqueImpulse({ x: (Math.random() - 0.5) * f * 0.02 * m, y: (Math.random() - 0.5) * f * 0.03 * m, z: (Math.random() - 0.5) * f * 0.02 * m }, true);
    });
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({
      petals,
      bundles,
      cursor,
      gust,
      startDrag,
      dragging,
      bounds
    }),
    [bounds, startDrag, dragging, gust]
  );

  // Bring the sarees in one per frame: each one's texture upload is then its own short frame, not a single long stall.
  const [mounted, setMounted] = useState(0);
  useEffect(() => {
    if (mounted >= LAYOUT.saree.length) return;
    const id = requestAnimationFrame(() => setMounted(m => m + 1));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  const [hop, setHop] = useState(0);
  useEffect(() => { if (filter) setHop(h => h + 1); }, [filter]);


  const s = bounds.s;
  return (
    <SceneCtx.Provider value={ctx}>
      <Warm ready={mounted >= LAYOUT.saree.length} />
      {LAYOUT.saree.map((l, i) => {
        if (i >= mounted) return null;
        const saree = SAREES.find(x => x.id === l.id)!;
        return <Bundle key={l.id} saree={saree} at={l} index={i} dim={!!filter && !saree.tags.includes(filter)} hop={hop} float={FLOATING.includes(l.id)} />;
      })}
      {LAYOUT.petal.map((at, i) => (s > 0.7 || i < 6 ? <Petal key={i} i={i} at={at} /> : null))}
    </SceneCtx.Provider>
  );
}

export default function DrapeScene(props: DrapeSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={props.active ? 'always' : 'never'}
      camera={{ fov: 30, near: 0.5, far: 60, position: [0, 8.6, 10.6] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
      style={{ touchAction: 'pan-y' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', e => {
          e.preventDefault();
          props.onContextLost?.();
        });
      }}
    >
      <ambientLight intensity={0.4} />
      {/* key from the top-right of the section; soft warm fill from lower-left */}
      <directionalLight position={[7, 9, -4]} intensity={1.9} color="#fff4ea" />
      <directionalLight position={[-6, 4, 6]} intensity={0.35} color="#ffd9c2" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#e9d3c6']} />
        <Lightformer intensity={2.4} position={[5, 6, -4]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} color="#fff6ec" />
        <Lightformer intensity={0.6} position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} color="#ffe2c4" />
        <Lightformer intensity={1.4} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} color="#ffd0d6" />
      </Environment>
      <Suspense fallback={null}>
        <Physics gravity={[0, -GRAVITY, 0]} paused={!props.active}>
          <Rig>{bounds => <World {...props} bounds={bounds} />}</Rig>
        </Physics>
      </Suspense>
    </Canvas>
  );
}
