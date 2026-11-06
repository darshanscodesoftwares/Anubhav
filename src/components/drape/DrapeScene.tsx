import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, useTexture } from '@react-three/drei';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  RoundCuboidCollider,
  type RapierCollider,
  type RapierRigidBody
} from '@react-three/rapier';
import { SAREES, type Saree, type Tag } from './data';
import { applyFabricDeform, makeBundleGeometry, makeFabricUniforms, springStep } from './fabric';
import { petalMaterial, usePetalGeometry } from './models';
import { BOX, boxMaterials, domeGeometry } from './box';


export interface DrapeSceneProps {
  /** the browser dropped the WebGL context (GPU reset, too many contexts…) — the parent remounts the scene */
  onContextLost?: () => void;
  active: boolean;
  filter: Tag | null;
  /** DOM overlay (two arc groups) the scene drives while a saree is held — 2D 'tension arcs' */
  arcs?: React.RefObject<HTMLDivElement | null>;
  /** a saree was released over the wooden box and has been pulled inside → show it (the popup) */
  onBoxOpen?: (id: Saree['id']) => void;
  /** the scene puts `spit()` here: call it when the popup closes to send the saree back out, floating */
  boxApi?: React.RefObject<{ spit?: () => void }>;
}

/** Shared state of the fixed wooden box (world units). */
interface BoxState {
  x: number; z: number; top: number; deep: number; reach: number;
  /** release a carried saree within this distance and the box takes it (the lid opens from `reach`) */
  take: number;
  /** where the saree is being sucked in (it stays where it was let go) */
  px: number; py: number; pz: number;
  /** the dragged saree is close enough → the lid opens */
  near: boolean;
  occupant: Saree['id'] | null;
  phase: 'idle' | 'pull' | 'inside' | 'spit';
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
  box: React.RefObject<BoxState>;
  onBoxOpen: (id: Saree['id']) => void;
}
const SceneCtx = createContext<Ctx>(null!);

// Layout in normalised floor coords (-1..1), echoing the design board.
const LAYOUT = {
  saree: [
    { id: 'maroon', x: 0.1, z: 0.11, ry: 0.35 },
    { id: 'ivory', x: -0.29, z: -0.04, ry: -0.25 },
    { id: 'navy', x: 0.55, z: -0.3, ry: 0.2 },
    { id: 'black', x: -0.04, z: 0.72, ry: 0.18 },
    { id: 'yellow', x: 0.3, z: 0.42, ry: -0.12 }
  ] as const,
  // rose petals fitted to the owner's screenshot (they fall from above onto these spots); the first 6 are used on small screens
  petal: [
    { x: -0.66, z: -0.3, k: 1.2 }, { x: 0.92, z: -0.42, k: 1.35 }, { x: -0.54, z: 0.4, k: 0.62 }, { x: -0.02, z: 0.58, k: 0.95 },
    { x: 0.3, z: -0.42, k: 1.25 }, { x: 0.15, z: 0.92, k: 0.58 }, { x: -0.76, z: 0.31, k: 0.9 }, { x: -0.14, z: 0.3, k: 1.3 },
    { x: 0.09, z: 0.61, k: 0.66 }, { x: 0.81, z: 0.85, k: 0.85 }, { x: 0.36, z: 0.95, k: 1.15 }
  ],
  /** the carved wooden delivery box, fixed on the right-hand side */
  box: { x: -0.4, z: 0.9, ry: 2.3 }
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
/** Petal-shaped sprite: a rounded teardrop (broad shoulders, pointed tip at +z) so a petal's shadow matches its outline. */
function makePetalShadowTex(size: number, frac: number, blur: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const a = size * frac, x0 = (size - a) / 2, y0 = x0;      // shape box; +z (tip) is toward the bottom of the canvas
  const X = (u: number) => x0 + u * a, Y = (v: number) => y0 + v * a;
  g.filter = `blur(${blur}px)`;
  g.fillStyle = 'rgb(46,20,13)';
  g.beginPath();
  g.moveTo(X(0.5), Y(0.02));                                   // narrow base
  g.bezierCurveTo(X(0.92), Y(0.1), X(1.04), Y(0.62), X(0.62), Y(0.94));
  g.quadraticCurveTo(X(0.52), Y(1.02), X(0.46), Y(0.95));      // slightly pointed tip
  g.bezierCurveTo(X(-0.04), Y(0.66), X(0.0), Y(0.12), X(0.5), Y(0.02));
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const CORE = { frac: 0.6, tex: makeShadowTex(256, 0.6, 11) };   // contact shadow: dense, tight
const SOFT = { frac: 0.4, tex: makeShadowTex(512, 0.4, 50) };  // penumbra: wide, soft
const PCORE = { frac: 0.6, tex: makePetalShadowTex(256, 0.6, 9) };
const PSOFT = { frac: 0.4, tex: makePetalShadowTex(512, 0.4, 42) };
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/** Floor direction shadows fall in (x, z): away from the top-right key light. */
const SHADOW_DIR = new THREE.Vector2(-0.9, 0.42).normalize();

/**
 * Physically-motivated soft shadow under a body, shaped like its footprint and turning with it:
 *  - contact layer: thick and dark while touching the surface, gone within a few cm of lift
 *  - penumbra layer: grows larger, softer and fainter with height
 * Both slide down-left (away from the key light) as the object rises.
 */
function ShadowBlob({ body, w, d, strength = 1, y = -0.03, petal = false }: { body: React.RefObject<RapierRigidBody | null>; w: number; d: number; strength?: number; y?: number; petal?: boolean }) {
  const CORE_ = petal ? PCORE : CORE, SOFT_ = petal ? PSOFT : SOFT;
  const core = useRef<THREE.Mesh>(null);
  const soft = useRef<THREE.Mesh>(null);
  const seam = useRef<THREE.Mesh>(null);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ map: CORE_.tex, transparent: true, depthWrite: false, toneMapped: false }), []);
  const seamMat = useMemo(() => new THREE.MeshBasicMaterial({ map: CORE_.tex, transparent: true, depthWrite: false, toneMapped: false }), []);
  const softMat = useMemo(() => new THREE.MeshBasicMaterial({ map: SOFT_.tex, transparent: true, depthWrite: false, toneMapped: false }), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const b = body.current;
    if (!b || !core.current || !soft.current || !seam.current) return;
    const p = b.translation();
    const r = b.rotation();
    e.setFromQuaternion(q.set(r.x, r.y, r.z, r.w), 'YXZ');
    const size = Math.max(w, d);
    // height of the underside above the floor (bodies rest with their centre ≈ half-thickness up)
    const gap = Math.max(0, p.y - size * 0.1);
    const touch = 1 - THREE.MathUtils.smoothstep(gap, 0.02, 0.25);
    const lift = THREE.MathUtils.clamp(gap / 3, 0, 1);

    const cOff = size * 0.15;
    core.current.position.set(p.x + SHADOW_DIR.x * cOff, y + 0.004, p.z + SHADOW_DIR.y * cOff);
    core.current.rotation.y = e.y;
    core.current.scale.set((w * 1.12) / CORE_.frac, 1, (d * 1.1) / CORE_.frac);
    coreMat.opacity = 0.5 * touch * strength;
    // contact seam: a tight, dark, un-offset footprint right under the body — the thin line where it meets the floor
    seam.current.position.set(p.x, y + 0.005, p.z);
    seam.current.rotation.y = e.y;
    seam.current.scale.set((w * 0.98) / CORE_.frac, 1, (d * 0.98) / CORE_.frac);
    seamMat.opacity = 0.4 * touch * touch * strength;

    const sOff = size * 0.36 + gap * 0.5;
    soft.current.position.set(p.x + SHADOW_DIR.x * sOff, y + 0.003, p.z + SHADOW_DIR.y * sOff);
    soft.current.rotation.y = e.y;
    const spread = 1.3 + lift * 0.7;
    soft.current.scale.set((w * spread) / SOFT_.frac, 1, (d * spread) / SOFT_.frac);
    softMat.opacity = 0.4 * (1 - lift * 0.65) * strength;
  });
  return (
    <>
      <mesh ref={soft} geometry={shadowGeo} material={softMat} renderOrder={-2} />
      <mesh ref={core} geometry={shadowGeo} material={coreMat} renderOrder={-1} />
      <mesh ref={seam} geometry={shadowGeo} material={seamMat} renderOrder={0} />
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
/** embroidery relief strength per saree (0 = flat) */
const BUMP: Record<Saree['id'], number> = { maroon: 3.8, ivory: 1.7, navy: 5, black: 4.4, yellow: 2.8 };
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
  const [topCol, topRm, edgeCol, edgeRm, topH] = useTexture([
    `/drape/top-${saree.id}-col.webp`,
    `/drape/top-${saree.id}-rm.webp`,
    `/drape/edge-${saree.id}-col.webp`,
    `/drape/edge-${saree.id}-rm.webp`,
    `/drape/top-${saree.id}-h.webp`
  ]);
  const maps = useMemo(() => {
    topRm.colorSpace = THREE.NoColorSpace;
    edgeRm.colorSpace = THREE.NoColorSpace;
    topH.colorSpace = THREE.NoColorSpace;
    return { top: { colour: topCol, rm: topRm, h: topH }, edge: { colour: edgeCol, rm: edgeRm, h: edgeCol } };
  }, [topCol, topRm, edgeCol, edgeRm, topH]);

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
      const { colour, rm, h } = maps[src];
      const zm = prep(rm, false, rx, ox, ry, oy);
      const weave = saree.weave;
      const m = new THREE.MeshPhysicalMaterial({
        map: prep(colour, true, rx, ox, ry, oy),
        // relief: the embroidery is brighter than the ground, so the colour map's red channel doubles as a height map —
        // flowers and zari catch light like raised thread (same texture object, no extra upload)
        bumpMap: src === 'top' ? prep(h, false, rx, ox, ry, oy) : prep(colour, true, rx, ox, ry, oy),
        bumpScale: BUMP[saree.id],
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
  // the wooden box: released over it → pulled in (kinematic), hidden while inside, spat back out floating
  const [inBox, setInBox] = useState(false);
  const scaleRef = useRef<THREE.Group>(null);
  const absorb = useRef({ mode: 'none' as 'none' | 'pull' | 'inside' | 'spit', t: 0, from: new THREE.Vector3(), yaw0: 0 });
  const wasHeld = useRef(false);
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
    {
      const B = ctx.box.current, A = absorb.current;
      const heldNow = ctx.dragging.current?.key === saree.id;
      // let go over the open box → it takes the saree
      if (wasHeld.current && !heldNow && A.mode === 'none' && !B.occupant) {
        const p = body.translation();
        if (Math.hypot(p.x - B.x, p.z - B.z) < B.take) {
          const r = body.rotation();
          A.mode = 'pull'; A.t = 0; A.from.set(p.x, p.y, p.z);
          B.px = p.x; B.py = p.y; B.pz = p.z;
          A.yaw0 = tmp.e.setFromQuaternion(tmp.q.set(r.x, r.y, r.z, r.w), 'YXZ').y;
          B.occupant = saree.id; B.phase = 'pull';
          hovering.current = false;
          body.setBodyType(2, true); // kinematic (position-based) while the box draws it in
        }
      }
      wasHeld.current = heldNow;
      if (A.mode !== 'none') {
        const sc = scaleRef.current;
        if (A.mode === 'pull') {
          // Sucked in right where it was let go: nothing drags it toward the box. It lifts a touch, strains against the pull
          // (stretching tall each time it's yanked and slumping back), then gives way and is drawn down into a point.
          A.t = Math.min(1, A.t + dt / 2.1);
          const t = A.t;
          const strain = Math.sin(t * Math.PI * 7.5) * Math.min(1, t * 5) * (1 - t) ** 0.8;
          const prog = THREE.MathUtils.clamp(t ** 1.7 + 0.055 * strain, 0, 1);
          const fall = THREE.MathUtils.clamp((prog - 0.6) / 0.4, 0, 1);
          const lift = Math.sin(Math.min(1, prog / 0.6) * Math.PI * 0.5) * 0.22 * s;       // anticipation
          const gy = A.from.y + lift - 0.4 * s * fall * fall;
          const shake = Math.sin(t * 90) * 0.03 * s * Math.abs(strain) * (1 - fall);
          body.setNextKinematicTranslation(tmp.v.set(A.from.x + shake, gy, A.from.z));
          body.setNextKinematicRotation(tmp.q.setFromEuler(tmp.e.set(0, A.yaw0, 0)));
          B.py = gy - 0.15 * s;
          if (sc) {
            const tension = (0.35 + 0.65 * Math.max(0, strain)) * (1 - fall * 0.4) * Math.min(1, t * 4);
            const k = 1 - 0.9 * fall ** 1.2;
            const sx = k * (1 - 0.14 * tension), sz = k * (1 - 0.14 * tension);
            const sy = k * (1 + 0.5 * tension + 1.2 * fall ** 2);
            sc.scale.set(Math.max(0.04, sx), Math.max(0.04, sy), Math.max(0.04, sz));
            sc.rotation.set(0, 0, 0);
          }
          if (A.t >= 1) {
            A.mode = 'inside';
            body.setEnabled(false);
            B.phase = 'inside';
            setInBox(true);
            globalThis.setTimeout(() => ctx.onBoxOpen(saree.id), 260);
          }
        } else if (A.mode === 'inside') {
          if (B.phase === 'spit' && B.occupant === saree.id) {
            A.mode = 'spit'; A.t = 0;
            body.setEnabled(true);
            body.setNextKinematicTranslation(tmp.v.set(B.x, B.deep, B.z));
            setInBox(false);
          }
        } else if (A.mode === 'spit') {
          // springs up out of the box in an arc toward the open floor, unfolding back to size
          A.t = Math.min(1, A.t + dt / 1.05);
          const e = 1 - (1 - A.t) ** 3;
          const ox = ctx.bounds.cx - B.x, oz = ctx.bounds.cz - B.z, ol = Math.hypot(ox, oz) || 1;
          const tx = B.x + (ox / ol) * 3.4 * s, tz = B.z + (oz / ol) * 3.4 * s, ty = 0.85 * s;
          tmp.v.set(B.x + (tx - B.x) * e, B.deep + (ty - B.deep) * e + Math.sin(Math.PI * Math.min(1, A.t * 1.1)) * 1.1 * s, B.z + (tz - B.z) * e);
          body.setNextKinematicTranslation(tmp.v);
          if (sc) { sc.scale.setScalar(0.06 + 0.94 * e); sc.rotation.set(0, 0, 0); }
          body.setNextKinematicRotation(tmp.q.setFromEuler(tmp.e.set(0, A.yaw0, 0)));
          if (A.t >= 1) {
            A.mode = 'none';
            sc?.scale.setScalar(1);
            body.setRotation(tmp.q.setFromEuler(tmp.e.set(0, A.yaw0, 0)), true);
            body.setBodyType(0, true); // dynamic again
            body.setLinvel({ x: (ox / ol) * 0.6 * s, y: 0, z: (oz / ol) * 0.6 * s }, true);
            hoverAt.current = { x: tx, z: tz };
            hovering.current = true; // floats where it landed
            B.occupant = null; B.phase = 'idle';
          }
        }
        return;
      }
    }
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
    // Majestic descent: cloth catches the air, so a falling bundle never exceeds a gentle terminal speed and eases to
    // a near-stop in the last few centimetres (no thud) — applies to the opening drop-in and to released/tossed sarees.
    if (!hovering.current && ctx.dragging.current?.key !== saree.id && lv.y < -0.3) {
      const rest = half.y * s;
      const aboveFloor = Math.max(0, body.translation().y - rest);
      const vt = THREE.MathUtils.lerp(0.6, 2.4, THREE.MathUtils.smoothstep(aboveFloor, 0.04, 0.9));
      if (lv.y < -vt) body.applyImpulse({ x: 0, y: body.mass() * (-vt - lv.y) * 40 * dt, z: 0 }, true);
    }
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
      // held: a faint tremble + slow sway that grow with how hard the hand moves it (the 2D arcs echo this)
      const shake = S.hold * Math.min(1, Math.hypot(lv.x, lv.z) / 5);
      const vib = 0; // (the 2D arcs now pulse instead of trembling)
      tiltRef.current.rotation.set(
        T.x + Math.sin(t * 61 + index) * vib + Math.sin(t * 5.1) * 0.012 * shake,
        Math.sin(t * 4.3 + index) * 0.02 * shake,
        T.z + Math.cos(t * 53 + index) * vib + Math.cos(t * 4.7) * 0.014 * shake
      );
    }
    U.uLag.value.copy(S.lag);
    U.uRipple.value = S.ripple;
    // Petals ride the moving cloth: the shader's ripple is visual only, so mirror its wave here — petals on top are lifted
    // as it rises, slide down its slopes and get shed off the fluttering edge (the rigid collider alone would let them sink in).
    if (ctx.dragging.current?.key !== saree.id && ctx.petals.current.size) {
      const wf = (qx: number, qz: number, tt: number) => Math.sin(qx * 3.2 + qz * 2.1 - tt * 7) * 0.6 + Math.sin(qx * 6.3 - qz * 4.7 + tt * 9.5) * 0.4;
      const bp = body.translation();
      const ang = tmp.e.setFromQuaternion(tmp.q.set(r.x, r.y, r.z, r.w), 'YXZ').y;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const tNow = state.clock.elapsedTime;
      const topY = bp.y + (half.y + BULGE_PAD) * s;
      ctx.petals.current.forEach(pb => {
        const pt = pb.translation();
        const dx = pt.x - bp.x, dz = pt.z - bp.z;
        const qx = ((dx * cs - dz * sn) / s) / half.x, qz = ((dx * sn + dz * cs) / s) / half.z;
        const h = pt.y - topY;
        if (Math.abs(qx) > 1.2 || Math.abs(qz) > 1.2 || h < -0.12 * s || h > 0.3 * s) return;
        const edge = THREE.MathUtils.smoothstep(Math.max(Math.abs(qx), Math.abs(qz)), 0.55, 1.0);
        const amp = S.ripple * (0.25 + 0.75 * edge) * half.y * 0.55 * s;
        const w0 = wf(qx, qz, tNow);
        const vel = (amp * (w0 - wf(qx, qz, tNow - 0.03))) / 0.03;       // how fast the cloth under it moves up
        const gx = (wf(qx + 0.05, qz, tNow) - w0) / 0.05 / half.x * amp / s; // surface slope (local)
        const gz = (wf(qx, qz + 0.05, tNow) - w0) / 0.05 / half.z * amp / s;
        const ql = Math.hypot(qx, qz) || 1;
        const ox = -gx * 70 + (qx / ql) * edge * S.ripple * 16;
        const oz = -gz * 70 + (qz / ql) * edge * S.ripple * 16;
        const m = pb.mass();
        pb.applyImpulse({
          x: m * (ox * cs + oz * sn) * dt,
          y: m * Math.max(0, vel) * 40 * dt,
          z: m * (-ox * sn + oz * cs) * dt
        }, true);
      });
    }
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
        const ox = Math.sign(mx) * Math.max(0, Math.abs(mx) - half.x * s * 1.55);
        const oz = Math.sign(mz) * Math.max(0, Math.abs(mz) - half.z * s * 1.55);
        support = { sx: (wx * ca - wz * sa) / s, sz: (wx * sa + wz * ca) / s, dyaw: by - ay, px: ox * cb - oz * sb, pz: ox * sb + oz * cb };
      });
    }
    const sup = support as { sx: number; sz: number; dyaw: number; px: number; pz: number } | null;
    if (sup) {
      U.uSup.value.set(sup.sx, sup.sz, half.x, half.z);
      U.uSupRot.value.set(Math.cos(sup.dyaw), Math.sin(sup.dyaw));
      const over = Math.hypot(sup.px, sup.pz);
      if (over > 0.02) {
        const k = Math.min(1, over / (0.2 * s)) * 20 * body.mass() * dt / over;
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
    <ShadowBlob body={rb} w={BUNDLE.w * s} d={BUNDLE.d * s} strength={inBox ? 0 : dim ? 0.22 : 1} />
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
      <group ref={scaleRef} visible={!inBox}>
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
      </group>
    </RigidBody>
    </>
  );
}

/* ------------------------------------------------------------------ wooden delivery box */

/**
 * A carved rosewood chest fixed on the floor. Carry a saree over it and the lid swings open; let go and the box draws
 * the saree inside (see Bundle), the lid closes and the section shows the saree on its model. Closing that popup makes
 * the lid open again and the box spits the saree back out, floating.
 */
/** An open brass band around the box at height y (four thin bars, so nothing covers the opening). */
function BandRing({ geo, material, y, w = BOX.w, d = BOX.d }: { geo: { bandX: THREE.BufferGeometry; bandZ: THREE.BufferGeometry }; material: THREE.Material; y: number; w?: number; d?: number }) {
  return (
    <>
      <mesh geometry={geo.bandX} material={material} position={[0, y, d / 2]} />
      <mesh geometry={geo.bandX} material={material} position={[0, y, -d / 2]} />
      <mesh geometry={geo.bandZ} material={material} position={[w / 2, y, 0]} />
      <mesh geometry={geo.bandZ} material={material} position={[-w / 2, y, 0]} />
    </>
  );
}

/** overall size of the box relative to its modelled dimensions */
const BOX_K = 0.84;

function DeliveryBox() {
  const ctx = useContext(SceneCtx);
  const s = ctx.bounds.s * BOX_K;
  const rb = useRef<RapierRigidBody>(null);
  const lid = useRef<THREE.Group>(null);
  const col = useRef<RapierCollider>(null);
  const solid = useRef(true);
  const L = useRef({ a: 0, v: 0 });
  const M = useMemo(() => boxMaterials(), []);
  const geo = useMemo(() => ({
    body: new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d),
    inner: new THREE.BoxGeometry(BOX.w - 0.1, BOX.h - 0.06, BOX.d - 0.1),
    lidBase: new THREE.BoxGeometry(BOX.w + 0.04, BOX.lid, BOX.d + 0.04),
    dome: domeGeometry(BOX.w + 0.02, BOX.d + 0.02, BOX.dome),
    bandX: new THREE.BoxGeometry(BOX.w + 0.03, 0.045, 0.03),
    bandZ: new THREE.BoxGeometry(0.03, 0.045, BOX.d + 0.03),
    lining: new THREE.PlaneGeometry(BOX.w - 0.12, BOX.d - 0.12).rotateX(-Math.PI / 2),
    post: new THREE.BoxGeometry(0.075, BOX.h + 0.01, 0.075),
    plate: new THREE.BoxGeometry(0.17, 0.22, 0.02),
    ring: new THREE.TorusGeometry(0.075, 0.014, 10, 28),
    foot: new THREE.CylinderGeometry(0.07, 0.085, BOX.foot, 16)
  }), []);
  const x = ctx.bounds.cx + LAYOUT.box.x * ctx.bounds.hx, z = ctx.bounds.cz + LAYOUT.box.z * ctx.bounds.hz;

  useEffect(() => {
    const B = ctx.box.current;
    B.x = x; B.z = z;
    B.top = (BOX.foot + BOX.h + BOX.lid + BOX.dome) * s;
    B.deep = (BOX.foot + BOX.h * 0.45) * s;
    B.reach = 3.4 * ctx.bounds.s;
    B.take = 2.2 * ctx.bounds.s;
  }, [ctx, x, z, s]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const B = ctx.box.current, d = ctx.dragging.current;
    let near = false;
    if (d?.heavy && !B.occupant) {
      const p = d.rb.translation();
      near = Math.hypot(p.x - B.x, p.z - B.z) < B.reach;
    }
    B.near = near;
    // While a saree is being carried around the box, the box stops being solid to it, so a held saree can never jam into
    // (or be shoved by) the chest on its way to the mouth; petals and resting sarees still bump into it otherwise.
    const carrying = !!d?.heavy && Math.hypot(d.rb.translation().x - B.x, d.rb.translation().z - B.z) < B.reach * 1.25;
    const wantSolid = !(carrying || B.phase === 'pull' || B.phase === 'spit');
    if (col.current && wantSolid !== solid.current) { col.current.setSensor(!wantSolid); solid.current = wantSolid; }
    const open = near || B.phase === 'pull' || B.phase === 'spit' ? 1 : 0;
    // a soft hinge spring: swings open with a little settle, closes gently
    [L.current.a, L.current.v] = springStep(L.current.a, L.current.v, open, open ? 34 : 26, open ? 7 : 9, dt);
    if (lid.current) lid.current.rotation.x = -Math.max(0, L.current.a) * 1.85;
  });

  const H = BOX.h, F = BOX.foot;
  return (
    <>
      <ShadowBlob body={rb} w={BOX.w * s} d={BOX.d * s} strength={1.15} />
      <RigidBody ref={rb} type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, LAYOUT.box.ry, 0]}>
        <CuboidCollider ref={col} args={[(BOX.w / 2) * s, ((F + H + BOX.lid) / 2) * s, (BOX.d / 2) * s]} position={[0, ((F + H + BOX.lid) / 2) * s, 0]} friction={1} />
        <group scale={s}>
          {/* feet */}
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([fx, fz]) => (
            <mesh key={`${fx}${fz}`} geometry={geo.foot} material={M.plain} position={[fx * (BOX.w / 2 - 0.12), F / 2, fz * (BOX.d / 2 - 0.12)]} />
          ))}
          <group position={[0, F + H / 2, 0]}>
            <mesh geometry={geo.body} material={M.body} />
            {/* dark interior (seen only when the lid is up) */}
            <mesh geometry={geo.inner} material={M.interior} position={[0, 0.03, 0]} />
            {/* brass: corner posts, two bands, front lock plate, side ring handles */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([px, pz]) => (
              <mesh key={`p${px}${pz}`} geometry={geo.post} material={M.brass} position={[px * BOX.w / 2, 0, pz * BOX.d / 2]} />
            ))}
            <BandRing geo={geo} material={M.brass} y={-H / 2 + 0.07} />
            <BandRing geo={geo} material={M.brass} y={H / 2 - 0.05} />
            {/* velvet lining on the floor inside */}
            <mesh geometry={geo.lining} material={M.velvet} position={[0, -H / 2 + 0.085, 0]} />
            <mesh geometry={geo.plate} material={M.brass} position={[0, H / 2 - 0.17, BOX.d / 2 + 0.012]} />
            <mesh geometry={geo.ring} material={M.brass} position={[0, H / 2 - 0.3, BOX.d / 2 + 0.03]} />
            {[-1, 1].map(sx => (
              <mesh key={`h${sx}`} geometry={geo.ring} material={M.brass} position={[sx * (BOX.w / 2 + 0.02), 0.12, 0]} rotation={[0, Math.PI / 2, 0]} />
            ))}
          </group>
          {/* lid hinged along the back top edge */}
          <group ref={lid} position={[0, F + H, -BOX.d / 2]}>
            <group position={[0, 0, BOX.d / 2]}>
              <mesh geometry={geo.lidBase} material={M.lid} position={[0, BOX.lid / 2, 0]} />
              <mesh geometry={geo.dome} material={M.lid} position={[0, BOX.lid, 0]} />
              <BandRing geo={geo} material={M.brass} y={0.02} w={BOX.w + 0.05} d={BOX.d + 0.05} />
              <mesh geometry={geo.plate} material={M.brass} position={[0, 0.0, BOX.d / 2 + 0.035]} scale={[0.8, 0.7, 1]} />
            </group>
          </group>
        </group>
      </RigidBody>
    </>
  );
}

/* ------------------------------------------------------------------ petals */

/** Light rose petal: floats down slowly (low gravity, high drag), can be picked up and tossed like the drapes. */
const petalDes = new THREE.Vector3(), petalBank = new THREE.Vector3();
const petalUp = new THREE.Vector3(), petalTorque = new THREE.Vector3(), petalWorldUp = new THREE.Vector3(0, 1, 0), petalQ = new THREE.Quaternion();

function Petal({ i, at }: { i: number; at: { x: number; z: number; k: number } }) {
  const ctx = useContext(SceneCtx);
  const geo = usePetalGeometry();
  const rb = useRef<RapierRigidBody>(null);
  const s = ctx.bounds.s * at.k;
  const init = useMemo(
    () => ({
      p: new THREE.Vector3(ctx.bounds.cx + at.x * ctx.bounds.hx, 2.4 + (i % 5) * 0.55, ctx.bounds.cz + at.z * ctx.bounds.hz),
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
    // levelling fades in smoothly as the petal comes down (a hard switch at one height made it snap flat mid-fall)
    const near = 0.07 + 0.93 * (1 - THREE.MathUtils.smoothstep(y, 0.15 * s, 1.2 * s));
    const av = b.angvel();
    b.applyTorqueImpulse(
      { x: (petalTorque.x * 2.6 * near - av.x * 0.06) * m * dt, y: 0, z: (petalTorque.z * 2.6 * near - av.z * 0.06) * m * dt },
      true
    );
    // petals ease apart instead of piling into each other as they fall or settle
    {
      const me = b.translation(), key = `petal-${i}`;
      let px = 0, pz = 0, py = 0;
      ctx.petals.current.forEach((ob, k) => {
        if (k === key) return;
        const o = ob.translation();
        const dx = me.x - o.x, dz = me.z - o.z, dy = me.y - o.y;
        const R = 0.8 * s, d2 = Math.hypot(dx, dz);
        if (d2 >= R || Math.abs(dy) > 0.45 * s) return;
        const f = (1 - d2 / R) ** 1.5, n = d2 > 1e-3 ? 1 / d2 : 0;
        px += (n ? dx * n : Math.cos(i * 2.4)) * f; pz += (n ? dz * n : Math.sin(i * 2.4)) * f;
        py += Math.sign(dy || 1) * f * 0.35;
      });
      if (px || pz) b.applyImpulse({ x: px * 7 * m * dt, y: py * 3 * m * dt, z: pz * 7 * m * dt }, true);
    }
    const air = THREE.MathUtils.smoothstep(y, 0.05, 0.4);   // flutter fades out as it touches down instead of cutting off
    if (air <= 0) return;
    const t = state.clock.elapsedTime + i * 1.3;
    // Falling-leaf swing: a steady left–right sway along a per-petal heading (≈ 1 full swing every 1.9 s) …
    const swing = Math.sin(t * 3.3);
    const ang = i * 1.9 + Math.sin(t * 0.21) * 0.6;
    const ax = Math.cos(ang), az = Math.sin(ang);
    b.applyImpulse({
      x: (ax * swing * 3.2 + Math.sin(t * 1.3) * 0.3) * air * m * dt,
      y: 0,
      z: (az * swing * 3.2 + Math.cos(t * 1.1) * 0.3) * air * m * dt
    }, true);
    // … and it banks into each swing: its face tips toward the side it is gliding to, then back and over to the other.
    const lv = b.linvel();
    const lat = THREE.MathUtils.clamp((lv.x * ax + lv.z * az) * 0.5, -0.28, 0.28);
    petalDes.set(ax * lat, 1, az * lat).normalize();
    petalBank.crossVectors(petalUp, petalDes);
    b.applyTorqueImpulse({ x: petalBank.x * 2.3 * air * m * dt, y: petalBank.y * 2.3 * air * m * dt, z: petalBank.z * 2.3 * air * m * dt }, true);
  });
  return (
    <>
      {/* y: sprites sit below the cupped petal so the shadow never cuts through its body */}
      <ShadowBlob body={rb} w={0.5 * s} d={0.68 * s} strength={0.62} y={-0.04} petal />
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
 * Anime-style "tension arcs": while a saree is held, two small curved strokes sit on either side of it, tremble
 * slightly, lean and trail with the hand's motion and sway, then fade when it is let go. Pure 2D overlay: the scene
 * only moves the two elements (no React state).
 */
function ActionMarks({ arcs }: { arcs?: React.RefObject<HTMLDivElement | null> }) {
  const ctx = useContext(SceneCtx);
  const { camera, size } = useThree();
  const st = useRef({ a: 0, x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, init: false, speed: 0, lean: 0 });
  const v = useMemo(() => new THREE.Vector3(), []);
  const r = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    const root = arcs?.current;
    if (!root) return;
    const L = root.children[0] as HTMLElement | undefined, R = root.children[1] as HTMLElement | undefined;
    if (!L || !R) return;
    const S = st.current, dt = Math.min(delta, 1 / 30);
    const d = ctx.dragging.current;
    const held = !!d?.heavy;
    S.a += ((held ? 1 : 0) - S.a) * (1 - Math.exp(-dt * (held ? 18 : 9)));
    if (S.a < 0.01 && !held) { L.style.opacity = R.style.opacity = '0'; S.init = false; return; }
    if (d) {
      const p = d.rb.translation();
      v.set(p.x, p.y, p.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.width, sy = (-v.y * 0.5 + 0.5) * size.height;
      // half the bundle's on-screen width
      camera.matrixWorld.extractBasis(r, v, v);
      v.set(p.x, p.y, p.z).addScaledVector(r, 1.2 * ctx.bounds.s).project(camera);
      const hw = Math.abs((v.x * 0.5 + 0.5) * size.width - sx);
      if (!S.init) { S.px = sx; S.py = sy; S.init = true; S.x = sx; S.y = sy; }
      S.vx += (((sx - S.px) / Math.max(dt, 1e-3)) - S.vx) * 0.25;
      S.vy += (((sy - S.py) / Math.max(dt, 1e-3)) - S.vy) * 0.25;
      S.px = sx; S.py = sy;
      S.x = sx; S.y = sy;
      (S as unknown as { hw: number }).hw = hw;
    }
    const hw = (S as unknown as { hw?: number }).hw ?? 90;
    const speed = Math.min(1, Math.hypot(S.vx, S.vy) / 700);
    S.speed += (speed - S.speed) * (1 - Math.exp(-dt * 10));
    const t = state.clock.elapsedTime;
    S.lean += ((THREE.MathUtils.clamp(S.vx * 0.02, -16, 16)) - S.lean) * (1 - Math.exp(-dt * 9));
    const sway = Math.sin(t * 6.2) * (2.5 + 5 * S.speed);
    // the arcs breathe: they slip ≈3 px outward and back in, looping (≈1.6 Hz), instead of trembling
    // the small (inner) arc leads and the big (outer) arc follows a beat later, like a ripple travelling outward
    const pulseSmall = 0.5 - 0.5 * Math.cos(t * 10);
    const pulseBig = 0.5 - 0.5 * Math.cos(t * 10 - 1.7);
    const trail = THREE.MathUtils.clamp(-S.vx * 0.025, -16, 16);
    const trailY = THREE.MathUtils.clamp(-S.vy * 0.02, -10, 10);
    const place = (el: HTMLElement, side: -1 | 1) => {
      // whole pixels + no scale transform keep the thin strokes razor sharp
      const x = Math.round(S.x + side * (hw + 16) + trail * 0.5);
      const y = Math.round(S.y - 10 + trailY * 0.5);
      const rot = side * (S.lean * 0.6 + sway);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg)`;
      el.style.opacity = String(Math.min(1, S.a) * 0.55);
      // [0] big arc, [1] small arc — the artwork emanates toward the upper-right, so the left side is the mirrored one
      const imgs = el.querySelectorAll('img');
      if (imgs.length === 2) {
        const sm = 2 * pulseSmall, bg = 2.6 * pulseBig;
        const k = side; // local +x is screen-outward on the right side; the mirrored left side flips it back automatically
        (imgs[1] as HTMLElement).style.transform = `translate(${(sm * (k < 0 ? 1 : 1)).toFixed(2)}px, ${(-sm * 0.55).toFixed(2)}px)`;
        (imgs[0] as HTMLElement).style.transform = `translate(${(bg * (k < 0 ? 1 : 1)).toFixed(2)}px, ${(-bg * 0.55).toFixed(2)}px)`;
      }
    };
    place(L, -1); place(R, 1);
  });
  return null;
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
        [mm.map, mm.roughnessMap, mm.metalnessMap, mm.emissiveMap, mm.bumpMap].forEach(t => t && textures.add(t));
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

function World({ bounds, filter, arcs, onBoxOpen, boxApi }: DrapeSceneProps & { bounds: Bounds }) {
  const box = useRef<BoxState>({ x: 0, z: 0, top: 0, deep: 0, reach: 0, take: 0, px: 0, py: 0, pz: 0, near: false, occupant: null, phase: 'idle' });
  const openCb = useRef(onBoxOpen);
  openCb.current = onBoxOpen;
  const onOpen = useCallback((id: Saree['id']) => openCb.current?.(id), []);
  useEffect(() => {
    if (!boxApi) return;
    boxApi.current.spit = () => { if (box.current.phase === 'inside') box.current.phase = 'spit'; };
  }, [boxApi]);
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
  // A gust is a pressure wave, not a kick: it expands from the landing point and each petal is pushed by a smooth
  // bump (sin²) as the front passes it, so petals ease into motion and sail away instead of jumping.
  const gusts = useRef<{ x: number; z: number; radius: number; power: number; t0: number }[]>([]);
  const gust = useCallback((x: number, z: number, radius: number, power: number) => {
    gusts.current.push({ x, z, radius, power, t0: performance.now() / 1000 });
    if (gusts.current.length > 8) gusts.current.shift();
  }, []);
  useFrame((_, delta) => {
    const G = gusts.current;
    if (!G.length) return;
    const now = performance.now() / 1000, dt = Math.min(delta, 1 / 30);
    const FRONT = 0.3, D = 0.55;                       // seconds for the front to reach the edge / width of the push at a petal
    for (let gi = G.length - 1; gi >= 0; gi--) {
      const g = G[gi], age = now - g.t0;
      if (age > FRONT + D + 0.05) { G.splice(gi, 1); continue; }
      petals.current.forEach((b, key) => {
        const p = b.translation();
        const dx = p.x - g.x, dz = p.z - g.z, dist = Math.hypot(dx, dz);
        if (dist > g.radius) return;
        const local = age - (dist / g.radius) * FRONT;
        if (local <= 0 || local >= D) return;
        const env = Math.sin((Math.PI * local) / D) ** 2;
        const f = Math.pow(1 - dist / g.radius, 1.4) * g.power;
        const nx = dist > 1e-3 ? dx / dist : 1, nz = dist > 1e-3 ? dz / dist : 0;
        const k = env * (2 / D) * dt * b.mass();      // ∫ env dt = D/2 → same total push as the old single kick
        const id = Number(key.slice(6)) || 0;
        b.applyImpulse({ x: nx * f * 26 * k, y: f * 6 * k, z: nz * f * 26 * k }, true);
        b.applyTorqueImpulse({ x: Math.sin(id * 12.9 + g.t0) * f * 0.01 * k, y: Math.sin(id * 7.3 + g.t0 * 2) * f * 0.015 * k, z: Math.cos(id * 5.1 + g.t0) * f * 0.01 * k }, true);
      });
    }
  });

  const ctx = useMemo<Ctx>(
    () => ({
      petals,
      bundles,
      cursor,
      gust,
      startDrag,
      dragging,
      bounds,
      box,
      onBoxOpen: onOpen
    }),
    [bounds, startDrag, dragging, gust, onOpen]
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
      <ActionMarks arcs={arcs} />
      <DeliveryBox />
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
