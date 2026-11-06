export type Filter = 'All' | 'Silk' | 'Organza' | 'Banarasi' | 'Velvet' | 'Festive';

export const FILTERS: Filter[] = ['All', 'Silk', 'Organza', 'Banarasi', 'Velvet', 'Festive'];

export interface Piece {
  id: string;
  name: string;
  price: string;
  /** three short descriptors, shown as "a | b | c" */
  notes: [string, string, string];
  tags: Exclude<Filter, 'All'>[];
  /** optional hover reveal: [pallu-flourish pose, full-drape pose] (public/collection/<id>-b|c.webp) */
  poses?: [string, string];
}

/** Portraits live in public/collection/<id>.webp (transparent cut-outs). */
export const PIECES: Piece[] = [
  { id: 'gulmohar', name: 'Gulmohar Banarasi', price: '₹18,500', notes: ['Pure Silk', 'Zari Weave', 'Handcrafted'], tags: ['Silk', 'Banarasi'] },
  { id: 'noor', name: 'Noor Organza', price: '₹12,800', notes: ['Organza', 'Thread Work', 'Floral Motif'], tags: ['Organza'] },
  { id: 'rajshree', name: 'Rajshree Velvet', price: '₹24,900', notes: ['Velvet', 'Zardozi', 'Hand Embroidery'], tags: ['Velvet', 'Festive'] },
  { id: 'swarna', name: 'Swarna Organza', price: '₹13,500', notes: ['Organza', 'White Thread Work', 'Lightweight'], tags: ['Organza', 'Festive'] },
  { id: 'kaveri', name: 'Kaveri Kanchipuram', price: '₹21,900', notes: ['Pure Silk', 'Temple Border', 'Traditional'], tags: ['Silk', 'Festive'], poses: ['kaveri-b', 'kaveri-c'] },
  { id: 'madhavi', name: 'Madhavi Organza', price: '₹15,200', notes: ['Organza', 'Sequins Work', 'Pastel Edit'], tags: ['Organza'] },
  { id: 'veena', name: 'Veena Chikankari', price: '₹16,800', notes: ['Georgette', 'Chikankari', 'Handcrafted'], tags: ['Festive'] },
  { id: 'nilambari', name: 'Nilambari Silk', price: '₹20,500', notes: ['Pure Silk', 'Butta Work', 'Festive Wear'], tags: ['Silk', 'Festive'] }
];
