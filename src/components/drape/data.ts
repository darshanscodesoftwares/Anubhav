export type Tag = 'Silk' | 'Organza' | 'Velvet' | 'Bridal' | 'Festive';

export const TAGS: { tag: Tag; dot: string }[] = [
  { tag: 'Silk', dot: '#6b1424' },
  { tag: 'Organza', dot: '#efc3b4' },
  { tag: 'Velvet', dot: '#1d2154' },
  { tag: 'Bridal', dot: '#e0566a' },
  { tag: 'Festive', dot: '#d79a25' }
];

import type { BundleShape } from './fabric';

export interface Saree {
  id: 'maroon' | 'ivory' | 'navy' | 'black' | 'yellow';
  name: string;
  fabric: string;
  note: string;
  tags: Tag[];
  /** silk-sheen colour for the 3D material */
  sheen: string;
  /** multiplies the texture to land on true jewel tones */
  tint: string;
  roughness: number;
  /** how metallic the detected gold zari is (0 = none) */
  zari: number;
  /** surface model: silk = anisotropic weave highlight, velvet = soft pile sheen, organza = fine light sheen */
  weave: 'silk' | 'velvet' | 'organza';
  /** optional flat/hollow/layered shape instead of the default pillow */
  shape?: BundleShape;
}

export const SAREES: Saree[] = [
  { id: 'maroon', name: 'Banarasi Maroon', fabric: 'Pure silk · gold zari', note: 'Woven buttas and a heavy brocade border — made for the wedding day.', tags: ['Silk', 'Bridal', 'Festive'], sheen: '#ffb38a', tint: '#f7c4cc', roughness: 0.48, zari: 1, weave: 'silk', shape: { h: 0.4, hollow: 0.1, rim: 0.1, ridge: 0.032, layers: 6.5, wave: 0.024 } },
  { id: 'ivory', name: 'Ivory Organza', fabric: 'Organza · resham florals', note: 'Featherlight, with hand-embroidered pink blooms and a gota border.', tags: ['Organza', 'Bridal'], sheen: '#fff1e2', tint: '#ffffff', roughness: 0.42, zari: 0.9, weave: 'organza', shape: { h: 0.34, hollow: 0.14, rim: 0.13, ridge: 0.036, layers: 5, wave: 0.034 } },
  { id: 'navy', name: 'Midnight Velvet', fabric: 'Velvet · zardozi', note: 'Deep navy pile with raised gold zardozi and ruby stones.', tags: ['Velvet', 'Festive'], sheen: '#5d6bd6', tint: '#dcdfff', roughness: 0.85, zari: 1, weave: 'velvet', shape: { h: 0.42, hollow: 0.09, rim: 0.1, ridge: 0.03, layers: 7, wave: 0.02 } },
  { id: 'black', name: 'Noir Silk', fabric: 'Silk · crimson resham', note: 'Black silk with crimson and gold florals for evening occasions.', tags: ['Silk', 'Festive'], sheen: '#ffd2b0', tint: '#dcdce2', roughness: 0.46, zari: 1, weave: 'silk', shape: { h: 0.38, hollow: 0.11, rim: 0.11, ridge: 0.033, layers: 6, wave: 0.028 } },
  { id: 'yellow', name: 'Haldi Organza', fabric: 'Organza · chikan', note: 'Sunlit yellow with ivory thread florals — a haldi favourite.', tags: ['Organza', 'Festive'], sheen: '#fff4c8', tint: '#fff2d8', roughness: 0.42, zari: 0.15, weave: 'organza', shape: { h: 0.36, hollow: 0.13, rim: 0.12, ridge: 0.035, layers: 5.5, wave: 0.03 } }
];
