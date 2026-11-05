// Pre-computes the per-saree fabric maps used by the Pick a Drape section, so the browser never has to
// walk every pixel on page load. For each saree texture (public/drape/{top,edge}-<id>.webp) it writes:
//   {top,edge}-<id>-col.webp  silk ground tinted to the saree's jewel tone (zari left as woven)
//   {top,edge}-<id>-rm.webp   G = roughness, B = metalness (gold zari detected by hue/saturation/value)
// Run after changing textures or a saree's tint/roughness/zari in src/components/drape/data.ts:
//   node scripts/bake-drape-maps.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'public/drape');
const data = fs.readFileSync(path.join(root, 'src/components/drape/data.ts'), 'utf8');
const sarees = [...data.matchAll(/id: '([a-z]+)'.*?tint: '(#[0-9a-f]{6})', roughness: ([0-9.]+), zari: ([0-9.]+)/g)]
  .map(m => ({ id: m[1], tint: m[2], roughness: +m[3], zari: +m[4] }));

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new' });
const page = await browser.newPage();
await page.setContent('<canvas></canvas>');

// Same arithmetic the runtime used before: sRGB multiply for the tint, hue/sat/value for zari.
const bake = (dataUrl, tint, baseRoughness, strength) => page.evaluate(async (dataUrl, tint, baseRoughness, strength) => {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, w, h), d = px.data;
  const rm = new ImageData(w, h), o = rm.data;
  const hex = parseInt(tint.slice(1), 16);
  const t = { r: (hex >> 16 & 255) / 255, g: (hex >> 8 & 255) / 255, b: (hex & 255) / 255 };
  const ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    let hue = 0;
    if (max !== min) {
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      hue *= 60; if (hue < 0) hue += 360;
    }
    const goldness = ss(18, 30, hue) * (1 - ss(52, 64, hue)) * ss(0.28, 0.5, sat) * ss(0.38, 0.62, max);
    const gold = goldness * strength;
    d[i] = Math.round(255 * r * (t.r + (1 - t.r) * goldness));
    d[i + 1] = Math.round(255 * g * (t.g + (1 - t.g) * goldness));
    d[i + 2] = Math.round(255 * b * (t.b + (1 - t.b) * goldness));
    o[i] = 255;
    o[i + 1] = Math.round((baseRoughness + (0.32 - baseRoughness) * gold) * 255);
    o[i + 2] = Math.round(gold * 0.9 * 255);
    o[i + 3] = 255;
  }
  cx.putImageData(px, 0, 0);
  const rc = document.createElement('canvas'); rc.width = w; rc.height = h;
  rc.getContext('2d').putImageData(rm, 0, 0);
  return { col: c.toDataURL('image/webp', 0.92), rm: rc.toDataURL('image/webp', 0.95) };
}, dataUrl, tint, baseRoughness, strength);

for (const s of sarees) {
  for (const kind of ['top', 'edge']) {
    const src = path.join(dir, `${kind}-${s.id}.webp`);
    const dataUrl = `data:image/webp;base64,${fs.readFileSync(src).toString('base64')}`;
    const out = await bake(dataUrl, s.tint, s.roughness, s.zari);
    fs.writeFileSync(path.join(dir, `${kind}-${s.id}-col.webp`), Buffer.from(out.col.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(dir, `${kind}-${s.id}-rm.webp`), Buffer.from(out.rm.split(',')[1], 'base64'));
    console.log(`baked ${kind}-${s.id}`);
  }
}
await browser.close();
