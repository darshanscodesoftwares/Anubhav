import { useEffect, useRef, useState } from 'react';
import { Lotus } from './Logo';
import { getLenis } from '../lib/smooth';
import type { Piece } from '../data/collection';

const images = (p: Piece) => [p.id, ...(p.poses ?? [])].map(id => `/collection/${id}.webp`);

/**
 * Quick-buy panel (ref: assets/collection-section/Kaveri Kanchipuram Quick-Buy Panel.png): opens when a collection card
 * is clicked. Photo + thumbnails on the left; name, price, notes, blurb, quantity, Buy Now / Add to Cart and the trust
 * row on the right. Fades in/out smoothly, locks page scroll while open, closes with ×, Esc or a click outside.
 * (No checkout is wired up yet — the two buttons only confirm in place.)
 */
export function QuickBuy({ piece, saved, onSave, onClose }: { piece: Piece | null; saved: boolean; onSave: () => void; onClose: () => void }) {
  // keep the last piece mounted while the panel fades out
  const [shown, setShown] = useState<Piece | null>(piece);
  const [on, setOn] = useState(false);
  const [qty, setQty] = useState(1);
  const [pic, setPic] = useState(0);
  const [done, setDone] = useState<'buy' | 'cart' | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    globalThis.clearTimeout(timer.current);
    if (piece) {
      setShown(piece); setQty(1); setDone(null);
      const imgs = images(piece);
      setPic(imgs.length - 1);                       // start on the full-drape shot when there is one
      const a = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
      return () => cancelAnimationFrame(a);
    }
    setOn(false);
    timer.current = globalThis.setTimeout(() => setShown(null), 700) as unknown as number;
  }, [piece]);
  useEffect(() => () => globalThis.clearTimeout(timer.current), []);

  // scroll lock + Esc while open
  useEffect(() => {
    if (!piece) return;
    const lenis = getLenis();
    lenis?.stop();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { lenis?.start(); document.documentElement.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [piece, onClose]);

  if (!shown) return null;
  const imgs = images(shown);
  const confirm = (k: 'buy' | 'cart') => { setDone(k); globalThis.clearTimeout(timer.current); timer.current = globalThis.setTimeout(() => setDone(null), 1800) as unknown as number; };

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-ink/35 px-4 py-6 transition-[opacity,backdrop-filter] duration-[700ms] ease-silk ${on ? 'opacity-100 backdrop-blur-md' : 'pointer-events-none opacity-0 backdrop-blur-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={shown.name}
      data-lenis-prevent
    >
      <div
        className={`relative my-auto w-full max-w-[880px] rounded-[26px] bg-[#f9e9df] px-6 pb-8 pt-8 shadow-[0_40px_90px_-30px_rgba(60,30,18,0.55)] transition-[opacity,transform] duration-[800ms] ease-silk md:px-10 md:pb-9 md:pt-10 ${on ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-[0.97] opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 grid h-10 w-10 place-items-center text-ink/70 transition-colors hover:text-ink md:right-7 md:top-6">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>

        <div className="grid gap-8 md:grid-cols-[1fr_1.05fr] md:gap-0">
          {/* photo + thumbnails */}
          <div className="flex flex-col items-center md:border-r md:border-ink/15 md:pr-8">
            <div className="relative h-[40vh] w-full md:h-[min(46vh,420px)]">
              <img src={imgs[pic]} alt={shown.name} draggable={false} className="absolute inset-0 h-full w-full object-contain object-bottom" />
            </div>
            {imgs.length > 1 && (
              <div className="mt-5 flex gap-3">
                {[...imgs].reverse().map(src => {
                  const i = imgs.indexOf(src);
                  return (
                    <button key={src} type="button" onClick={() => setPic(i)} aria-label={`View ${i + 1}`} className={`h-16 w-16 overflow-hidden rounded-[10px] border bg-blush transition-colors ${pic === i ? 'border-gold' : 'border-transparent hover:border-gold/50'}`}>
                      <img src={src} alt="" draggable={false} className="h-full w-full object-cover object-top" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* details */}
          <div className="md:pl-9">
            <div className="flex items-start justify-between gap-4 pr-10">
              <h3 className="font-serif text-[clamp(1.8rem,3vw,2.35rem)] font-medium leading-[1.05] text-ink">{shown.name}</h3>
              <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'} className={`mt-1 shrink-0 transition-colors ${saved ? 'text-gold' : 'text-ink/60 hover:text-gold'}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" /></svg>
              </button>
            </div>
            <p className="mt-3 font-serif text-[1.9rem] font-medium text-ink">{shown.price}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {shown.notes.map(n => <span key={n} className="rounded-full bg-[#f3dccf] px-3.5 py-1.5 font-serif text-[0.95rem] text-ink-soft">{n}</span>)}
            </div>
            <p className="mt-5 font-serif text-[1.12rem] leading-snug text-ink">{shown.desc}</p>
            <div className="my-6 h-px bg-ink/15" />
            <div className="flex items-center justify-between gap-4">
              <span className="font-serif text-[1.15rem] text-ink">Quantity</span>
              <div className="flex items-center overflow-hidden rounded-[10px] border border-ink/15 bg-[#f3dccf]/60">
                <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Fewer" className="grid h-10 w-11 place-items-center text-ink/80 hover:text-ink">−</button>
                <span className="grid h-10 w-14 place-items-center bg-[#fbf1ea] font-serif text-lg" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty(q => Math.min(9, q + 1))} aria-label="More" className="grid h-10 w-11 place-items-center text-ink/80 hover:text-ink">+</button>
              </div>
            </div>
            <button type="button" onClick={() => confirm('buy')} className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-[12px] bg-[#ecd5b8] font-serif text-[1.25rem] text-[#6b4a22] transition-colors duration-300 hover:bg-[#e6cba9]">
              {done === 'buy' ? 'Reserved ✓' : 'Buy Now'}
            </button>
            <button type="button" onClick={() => confirm('cart')} className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-[12px] border border-[#a4702e] font-serif text-[1.25rem] text-[#7d5220] transition-colors duration-300 hover:bg-[#f3dccf]/60">
              {done === 'cart' ? 'Added ✓' : 'Add to Cart'}
            </button>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-5 text-[0.82rem] text-ink-soft">
              {['Secure Payment', 'Easy Returns', 'Authentic Silk'].map((t, i) => (
                <span key={t} className="flex items-center gap-4">{i > 0 && <span className="h-4 w-px bg-ink/20" />}{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-4 text-gold">
          <span className="h-px w-24 bg-gold/50 md:w-40" />
          <Lotus className="h-5 w-8" />
          <span className="h-px w-24 bg-gold/50 md:w-40" />
        </div>
      </div>
    </div>
  );
}
