export type Pt = [number, number];

export interface FabricRegion {
  /** Sway strength 0–1. */
  amp: number;
  /** Where the cloth is attached (body/shoulder). Motion grows with distance from here. Image UVs. */
  pin: Pt;
  /** Polygon in image UVs (x 0→1 left→right, y 0→1 top→bottom). */
  pts: Pt[];
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
    fabric: [
      { amp: 1.0, pin: [0.55, 0.55], pts: [[0.63, 0.42], [0.8, 0.3], [0.95, 0.1], [1, 0.05], [1, 1], [0.5, 1], [0.6, 0.75], [0.66, 0.55]] },
      { amp: 0.6, pin: [0.65, 0.25], pts: [[0.65, 0], [1, 0], [0.95, 0.08], [0.75, 0.28], [0.64, 0.22]] },
      { amp: 0.5, pin: [0.25, 0.8], pts: [[0, 0.72], [0.24, 0.7], [0.24, 0.9], [0, 0.95]] }
    ]
  }
];
