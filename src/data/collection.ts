export type Filter = 'All' | 'Silk' | 'Organza' | 'Banarasi' | 'Velvet' | 'Festive';

export const FILTERS: Filter[] = ['All', 'Silk', 'Organza', 'Banarasi', 'Velvet', 'Festive'];

export interface Piece {
  id: string;
  name: string;
  price: string;
  /** three short descriptors, shown as "a | b | c" */
  notes: [string, string, string];
  tags: Exclude<Filter, 'All'>[];
  /** one-line description shown in the quick-buy panel */
  desc: string;
  /** optional hover reveal: [pallu-flourish pose, full-drape pose] (public/collection/<id>-b|c.webp) */
  poses?: [string, string];
}

/** Portraits live in public/collection/<id>.webp (transparent cut-outs). */
export const PIECES: Piece[] = [
  { id: 'gulmohar', desc: 'A Banarasi in deep maroon with a rich zari border and woven gold motifs.', name: 'Gulmohar Banarasi', price: '₹18,500', notes: ['Pure Silk', 'Zari Weave', 'Handcrafted'], tags: ['Silk', 'Banarasi'] },
  { id: 'noor', desc: 'Featherlight organza with hand-stitched pink floral thread work.', name: 'Noor Organza', price: '₹12,800', notes: ['Organza', 'Thread Work', 'Floral Motif'], tags: ['Organza'] },
  { id: 'rajshree', desc: 'Midnight velvet with raised zardozi vines, made for long evenings.', name: 'Rajshree Velvet', price: '₹24,900', notes: ['Velvet', 'Zardozi', 'Hand Embroidery'], tags: ['Velvet', 'Festive'] },
  { id: 'swarna', desc: 'Sunlit mustard organza finished with fine white thread work.', name: 'Swarna Organza', price: '₹13,500', notes: ['Organza', 'White Thread Work', 'Lightweight'], tags: ['Organza', 'Festive'] },
  { id: 'kaveri', desc: 'A classic Kanchipuram in rich green with authentic temple border and gold motifs.', name: 'Kaveri Kanchipuram', price: '₹21,900', notes: ['Pure Silk', 'Temple Border', 'Traditional'], tags: ['Silk', 'Festive'], poses: ['kaveri-b', 'kaveri-c'] },
  { id: 'madhavi', desc: 'Soft lilac organza with delicate sequin work, a pastel favourite.', name: 'Madhavi Organza', price: '₹15,200', notes: ['Organza', 'Sequins Work', 'Pastel Edit'], tags: ['Organza'] },
  { id: 'veena', desc: 'Cream georgette with intricate Chikankari embroidery, finished by hand.', name: 'Veena Chikankari', price: '₹16,800', notes: ['Georgette', 'Chikankari', 'Handcrafted'], tags: ['Festive'] },
  { id: 'nilambari', desc: 'Pure silk in deep purple with gold butta work for festive days.', name: 'Nilambari Silk', price: '₹20,500', notes: ['Pure Silk', 'Butta Work', 'Festive Wear'], tags: ['Silk', 'Festive'] }
];
