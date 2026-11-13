export type Pt = [number, number];

export interface FabricRegion {
  /** Sway strength 0–1. */
  amp: number;
  /** Where the cloth is attached (body/shoulder). Motion grows with distance from here. Image UVs. */
  pin: Pt;
  /** Polygon in image UVs (x 0→1 left→right, y 0→1 top→bottom). */
  pts: Pt[];
}

export interface Sweep {
  /** Direction the cloth travels across the camera when entering this scene (screen space, y down). Follows the saree's flow in the pose. */
  dir: Pt;
  /** Centre of a fabric-only patch of this scene's saree (image UVs) used to texture the sweeping cloth. */
  swatch: Pt;
  /** Half-size of that patch (image UVs); it is mirror-tiled so the cloth never shows skin/background. */
  half: Pt;
  /** How much of the patch one screen-height of cloth shows (smaller = bigger motifs). */
  scale: number;
}

export interface Slide {
  id: string;
  image: string;
  kicker?: string;
  title: string;
  italic?: boolean;
  body: string;
  cta: { label?: string; href: string };
  /** Point the camera dives into when leaving this scene. Image UVs. */
  focus: Pt;
  /** Image x to centre on for portrait/mobile screens (usually just right of the face). */
  mobileX: number;
  sweep: Sweep;
  fabric: FabricRegion[];
}

export const SLIDES: Slide[] = [
  {
    id: 'welcome',
    image: '/hero/01.webp',
    kicker: 'Step into',
    title: 'Anubhav',
    italic: true,
    body: 'A curated world of drapes,\nweaves and timeless elegance.',
    cta: { label: 'Explore the Collection', href: '#collections' },
    focus: [0.78, 0.6],
    mobileX: 0.5,
    sweep: { dir: [0.8, -0.6], swatch: [0.8, 0.78], half: [0.14, 0.15], scale: 0.55 },
    fabric: [
      { amp: 1.0, pin: [0.55, 0.62], pts: [[0.66, 0.4], [0.8, 0.36], [0.92, 0.22], [1, 0.13], [1, 1], [0.55, 1], [0.6, 0.75], [0.68, 0.6]] },
      { amp: 0.8, pin: [0.62, 0.45], pts: [[0.6, 0], [0.98, 0], [0.95, 0.3], [0.8, 0.42], [0.64, 0.42], [0.59, 0.2]] },
      { amp: 0.7, pin: [0.27, 0.9], pts: [[0, 0.78], [0.12, 0.78], [0.26, 0.84], [0.26, 1], [0, 1]] }
    ]
  },
  {
    id: 'sarees',
    image: '/hero/02.webp',
    kicker: 'The Saree Gallery',
    title: 'Sarees',
    italic: true,
    body: 'Drapes that\nspeak tradition\nand grace.',
    cta: { href: '#sarees' },
    focus: [0.75, 0.55],
    mobileX: 0.42,
    sweep: { dir: [0.86, -0.5], swatch: [0.72, 0.75], half: [0.14, 0.14], scale: 0.55 },
    fabric: [
      { amp: 1.0, pin: [0.45, 0.55], pts: [[0.55, 0.42], [0.75, 0.36], [0.9, 0.2], [1, 0.05], [1, 1], [0.45, 1], [0.5, 0.8], [0.55, 0.62]] },
      { amp: 0.6, pin: [0.55, 0.35], pts: [[0.55, 0], [1, 0], [1, 0.1], [0.85, 0.3], [0.62, 0.4], [0.52, 0.25]] },
      { amp: 0.5, pin: [0.2, 0.95], pts: [[0, 0.82], [0.18, 0.84], [0.24, 1], [0, 1]] }
    ]
  },
  {
    id: 'lehengas',
    image: '/hero/03.webp',
    kicker: 'The Lehenga Lounge',
    title: 'Lehengas',
    italic: true,
    body: 'For celebrations\nthat stay in memory.',
    cta: { href: '#lehengas' },
    focus: [0.72, 0.68],
    mobileX: 0.44,
    sweep: { dir: [0.85, 0.45], swatch: [0.75, 0.8], half: [0.16, 0.12], scale: 0.5 },
    fabric: [
      { amp: 0.9, pin: [0.45, 0.66], pts: [[0.55, 0.6], [0.75, 0.5], [0.92, 0.3], [1, 0.2], [1, 1], [0.1, 1], [0.24, 0.83], [0.42, 0.7]] },
      { amp: 0.6, pin: [0.6, 0.45], pts: [[0.6, 0.15], [0.85, 0], [1, 0], [1, 0.18], [0.85, 0.38], [0.6, 0.55], [0.59, 0.4]] },
      { amp: 0.5, pin: [0.25, 0.78], pts: [[0, 0.74], [0.24, 0.7], [0.24, 0.8], [0.08, 0.98], [0, 1]] }
    ]
  },
  {
    id: 'fusion',
    image: '/hero/04.webp',
    kicker: 'The Fusion Edit',
    title: 'Fusion Wear',
    italic: true,
    body: 'Contemporary silhouettes\nwith a cultural soul.',
    cta: { href: '#fusion' },
    focus: [0.8, 0.62],
    mobileX: 0.45,
    sweep: { dir: [1, -0.15], swatch: [0.84, 0.75], half: [0.12, 0.17], scale: 0.5 },
    fabric: [
      { amp: 0.9, pin: [0.6, 0.5], pts: [[0.62, 0.38], [0.8, 0.45], [0.95, 0.2], [1, 0.2], [1, 1], [0.55, 1], [0.62, 0.78], [0.66, 0.55]] },
      { amp: 0.6, pin: [0.55, 0.38], pts: [[0.5, 0], [1, 0], [1, 0.2], [0.85, 0.4], [0.62, 0.38], [0.5, 0.25]] },
      { amp: 0.5, pin: [0.22, 0.85], pts: [[0, 0.72], [0.22, 0.75], [0.18, 1], [0, 1]] }
    ]
  },
  {
    id: 'collections',
    image: '/hero/05.webp',
    title: 'Our\nCollections',
    italic: true,
    body: 'From everyday elegance\nto grand occasions.',
    cta: { label: 'Browse All Collection', href: '#collections' },
    focus: [0.75, 0.55],
    mobileX: 0.44,
    sweep: { dir: [0.72, -0.7], swatch: [0.78, 0.7], half: [0.15, 0.17], scale: 0.55 },
    fabric: [
      { amp: 1.0, pin: [0.55, 0.55], pts: [[0.63, 0.42], [0.8, 0.3], [0.95, 0.1], [1, 0.05], [1, 1], [0.5, 1], [0.6, 0.75], [0.66, 0.55]] },
      { amp: 0.6, pin: [0.65, 0.25], pts: [[0.65, 0], [1, 0], [0.95, 0.08], [0.75, 0.28], [0.64, 0.22]] },
      { amp: 0.5, pin: [0.25, 0.8], pts: [[0, 0.72], [0.24, 0.7], [0.24, 0.9], [0, 0.95]] }
    ]
  }
];

/**
 * Rough silhouette of the model + saree in each plate (image UVs), used to let the "behind" petals pass behind her.
 * Traced by eye from public/hero/0N.webp; edges are blurred when applied, so it need not be exact.
 */
export const SUBJECTS: Pt[][] = [
  [[0.296, 0.276], [0.299, 0.159], [0.341, 0.074], [0.407, 0.04], [0.472, 0.043], [0.514, 0.085], [0.559, 0.17], [0.571, 0.276], [0.547, 0.372], [0.538, 0.409], [0.652, 0.446], [0.748, 0.361], [0.897, 0.351], [1.0, 0.159], [1.0, 1.0], [0.257, 1.0], [0.26, 0.744], [0.287, 0.68], [0.347, 0.638], [0.389, 0.553], [0.335, 0.521], [0.311, 0.446]],
  [[0.263, 0.244], [0.287, 0.159], [0.335, 0.101], [0.407, 0.087], [0.455, 0.122], [0.49, 0.213], [0.487, 0.319], [0.455, 0.351], [0.538, 0.409], [0.706, 0.351], [0.867, 0.298], [1.0, 0.096], [1.0, 1.0], [0.197, 1.0], [0.239, 0.808], [0.197, 0.744], [0.191, 0.691], [0.251, 0.616], [0.323, 0.553], [0.281, 0.499], [0.275, 0.404]],
  [[0.347, 0.17], [0.365, 0.085], [0.419, 0.062], [0.49, 0.064], [0.538, 0.117], [0.574, 0.202], [0.583, 0.319], [0.574, 0.446], [0.538, 0.499], [0.55, 0.595], [0.658, 0.579], [0.807, 0.531], [0.897, 0.404], [1.0, 0.244], [1.0, 1.0], [0.078, 1.0], [0.179, 0.914], [0.251, 0.765], [0.299, 0.691], [0.293, 0.595], [0.323, 0.499], [0.365, 0.425], [0.371, 0.383], [0.35, 0.319]],
  [[0.281, 0.213], [0.311, 0.117], [0.359, 0.048], [0.419, 0.037], [0.467, 0.074], [0.49, 0.181], [0.487, 0.276], [0.467, 0.34], [0.508, 0.351], [0.598, 0.383], [0.718, 0.499], [0.807, 0.468], [0.897, 0.351], [1.0, 0.213], [1.0, 1.0], [0.239, 1.0], [0.173, 0.994], [0.197, 0.85], [0.251, 0.68], [0.251, 0.553], [0.293, 0.499], [0.347, 0.425], [0.335, 0.34], [0.299, 0.319], [0.281, 0.276]],
  [[0.341, 0.191], [0.359, 0.096], [0.419, 0.043], [0.478, 0.032], [0.532, 0.074], [0.574, 0.138], [0.61, 0.213], [0.628, 0.276], [0.598, 0.393], [0.658, 0.414], [0.778, 0.351], [0.897, 0.244], [1.0, 0.106], [1.0, 1.0], [0.15, 1.0], [0.197, 0.935], [0.251, 0.85], [0.251, 0.744], [0.281, 0.638], [0.335, 0.553], [0.401, 0.425], [0.419, 0.393], [0.371, 0.361], [0.341, 0.298]],
];
