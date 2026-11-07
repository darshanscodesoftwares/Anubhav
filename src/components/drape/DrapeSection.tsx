import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Lotus } from '../Logo';
import { scrollToTarget, prefersReducedMotion } from '../../lib/smooth';
import { SAREES, TAGS, type Saree, type Tag } from './data';

// three.js + Rapier load only when the visitor approaches this section.
const DrapeScene = lazy(() => import('./DrapeScene'));

const hasWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

function Pill({ active, children, onClick, dot }: { active?: boolean; children: React.ReactNode; onClick: () => void; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pointer-events-auto group relative inline-flex items-center gap-1.5 px-2 py-1.5 text-[0.78rem] tracking-[0.06em] text-ink transition-opacity duration-500 ease-silk ${
        active ? 'opacity-90' : 'opacity-40 hover:opacity-80'
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
      <span
        className={`absolute inset-x-2 -bottom-px h-px origin-left bg-ink/60 transition-transform duration-500 ease-silk ${
          active ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
    </button>
  );
}

/** Static composition used when WebGL is unavailable or the visitor prefers reduced motion. */
function StaticDrapes() {
  const place: Record<Saree['id'], string> = {
    maroon: 'left-[42%] top-[14%] w-[24%] rotate-[-6deg]',
    ivory: 'left-[22%] top-[34%] w-[22%] rotate-[4deg]',
    navy: 'left-[70%] top-[28%] w-[24%]',
    black: 'left-[6%] top-[56%] w-[26%] rotate-[3deg]',
    yellow: 'left-[55%] top-[58%] w-[26%] rotate-[-3deg]'
  };
  return (
    <div className="absolute inset-0">
      {SAREES.map(s => (
        <img key={s.id} src={`/drape/cut-${s.id}.webp`} alt={s.name} className={`absolute drop-shadow-[0_18px_24px_rgba(90,42,30,0.25)] ${place[s.id]}`} />
      ))}
      {['left-[86%] top-[62%] w-[6%] rotate-12', 'left-[48%] top-[50%] w-[5%] -rotate-20', 'left-[36%] top-[22%] w-[4.5%] rotate-45', 'left-[30%] top-[78%] w-[5.5%] -rotate-6', 'left-[90%] top-[20%] w-[4%] rotate-90'].map(c => (
        <img key={c} src="/drape/cut-petal.webp" alt="" className={`absolute ${c}`} />
      ))}
    </div>
  );
}

export function DrapeSection() {
  const root = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [canPlay] = useState(() => hasWebGL() && !prefersReducedMotion());
  const [filter, setFilter] = useState<Tag | null>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const arcs = useRef<HTMLDivElement>(null);
  // square drop zone: a saree released on it shows a short loader, then its details
  const zone = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<{ id: Saree['id']; phase: 'loading' | 'open' } | null>(null);
  const dropTimer = useRef(0);
  const onDropZone = useCallback((id: Saree['id']) => {
    setDrop(d => {
      if (d) return d;
      globalThis.clearTimeout(dropTimer.current);
      dropTimer.current = globalThis.setTimeout(() => setDrop(x => (x && x.id === id ? { id, phase: 'open' } : x)), 1300) as unknown as number;
      return { id, phase: 'loading' };
    });
  }, []);
  useEffect(() => () => globalThis.clearTimeout(dropTimer.current), []);
  // the popup stays mounted while it fades: `show` drives every transition (in on open, out on close)
  const [pop, setPop] = useState<{ id: Saree['id']; show: boolean } | null>(null);
  const popTimer = useRef(0);
  useEffect(() => {
    if (drop?.phase !== 'open') return;
    globalThis.clearTimeout(popTimer.current);
    setPop({ id: drop.id, show: false });
    const a = requestAnimationFrame(() => requestAnimationFrame(() => setPop(p => (p ? { ...p, show: true } : p))));
    return () => cancelAnimationFrame(a);
  }, [drop?.phase, drop?.id]);
  const closeDrop = () => {
    globalThis.clearTimeout(dropTimer.current);
    setDrop(null);
    setPop(p => (p ? { ...p, show: false } : p));
    globalThis.clearTimeout(popTimer.current);
    popTimer.current = globalThis.setTimeout(() => setPop(null), 800) as unknown as number;
  };
  useEffect(() => () => globalThis.clearTimeout(popTimer.current), []);
  useEffect(() => {
    if (!pop?.show) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrop();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pop?.show]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = root.current!;
    // Warm the 3D scene up in the quiet time right after page load — while the visitor is still in the hero — so
    // that reaching this section only has to start the animation (no download, shader compile or texture upload).
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 3000 }) : globalThis.setTimeout(cb, 400));
    let warm = 0;
    const start = () => { warm = globalThis.setTimeout(() => idle(() => setMounted(true)), 1200) as unknown as number; };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    // fallback: if they scroll here before the warm-up fired, mount now
    const near = new IntersectionObserver(([e]) => e.isIntersecting && setMounted(true), { rootMargin: '1500px 0px' });
    const vis = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.15 });
    near.observe(el);
    vis.observe(el);
    return () => {
      globalThis.clearTimeout(warm);
      window.removeEventListener('load', start);
      near.disconnect();
      vis.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      gsap.from('.js-drape-reveal', {
        y: 40,
        autoAlpha: 0,
        duration: 1.1,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 65%' }
      });
    },
    { scope: root }
  );


  return (
    <section
      ref={root}
      id="drapes"
      className="relative h-[calc(max(100svh,640px)*1.2)] w-full overflow-hidden bg-[radial-gradient(ellipse_80%_70%_at_55%_45%,#fdf6f1,#f3e3da)]"
      aria-label="Pick a drape — interactive saree play area"
    >
      {/* Copy sits BEHIND the 3D canvas so drapes and petals pass in front of it (canvas is transparent). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[max(100svh,640px)] px-6 py-8 md:px-[5.6vw] md:py-10">
        {canPlay && (
          <div
            ref={zone}
            className="absolute bottom-[17%] right-6 aspect-square w-[clamp(138px,14vw,184px)] rounded-[20px] border border-gold/80 bg-blush/95 shadow-[0_18px_40px_-22px_rgba(90,42,30,0.35)] md:right-[5.6vw] [transform:perspective(520px)_rotateX(24deg)]"
            aria-label="Drop zone: release a saree here to see its details"
          >
            <span className="absolute inset-[9%] rounded-[14px] border border-gold/25" aria-hidden />
            <div className={`absolute inset-0 transition-opacity duration-300 ${drop?.phase === 'loading' ? 'opacity-30' : 'opacity-100'}`}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center text-gold">
                <svg viewBox="0 0 64 44" className="h-[30%] w-auto" fill="currentColor" aria-hidden>
                  <path d="M6 40 L 18 6 L 32 4 L 46 6 L 58 40 L 46 36 L 32 40 L 18 36 Z" opacity=".92" />
                  <path d="M18 6 L 32 10 L 46 6 M 32 10 L 32 40" fill="none" stroke="#f3e4dc" strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
                  <circle cx="22" cy="18" r="1.6" fill="#f3e4dc" opacity=".7" />
                  <circle cx="42" cy="18" r="1.6" fill="#f3e4dc" opacity=".7" />
                </svg>
                <span className="font-serif text-[0.95rem] italic leading-tight text-ink/80">Place Drape Here</span>
                <Lotus className="h-3 w-5 text-gold/80" />
              </div>
            </div>
          </div>
        )}
        <div className="js-drape-reveal absolute left-6 top-[30%] md:left-[5.6vw] md:top-[22%]">
          <h2 className="font-serif text-[clamp(3.4rem,8vw,7.6rem)] font-medium italic leading-[0.88] text-ink">
            Pick a<br />Drape
          </h2>
          <span className="mt-7 mb-5 block h-[2px] w-10 bg-gold" />
          <p className="text-[1.02rem] text-ink-soft">Lift one, let it go, and watch it settle.</p>
        </div>

        <div className="js-drape-reveal absolute bottom-10 left-[5.6vw] hidden max-w-[15rem] text-left lg:block">
          <p className="text-lg leading-snug text-ink">A soft study of silk,<br />weight and light.</p>
          <span className="invisible mt-4 inline-flex items-center gap-2 border-b pb-1 font-medium" aria-hidden>View Collection →</span>
        </div>
      </div>

      <div className="absolute inset-0">
        {canPlay ? (
          mounted && (
            <Suspense fallback={null}>
              <DrapeScene key={sceneKey} active={active} filter={filter} arcs={arcs} dropZone={zone} onDropZone={onDropZone} onContextLost={() => setSceneKey(k => k + 1)} />
            </Suspense>
          )
        ) : (
          <StaticDrapes />
        )}
      </div>

      {/* 2D "tension arcs" around a held saree — driven by the scene while one is being dragged */}
      <div ref={arcs} className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
        <span className="absolute left-0 top-0 h-[33px] w-[34px] opacity-0 [&_img]:-scale-x-100">
          <img src="/drape/arc-big.png" alt="" width="34" height="33" draggable={false} className="absolute left-0 top-0 block max-w-none" />
          <img src="/drape/arc-small.png" alt="" width="34" height="33" draggable={false} className="absolute left-0 top-0 block max-w-none" />
        </span>
        <span className="absolute left-0 top-0 h-[33px] w-[34px] opacity-0">
          <img src="/drape/arc-big.png" alt="" width="34" height="33" draggable={false} className="absolute left-0 top-0 block max-w-none" />
          <img src="/drape/arc-small.png" alt="" width="34" height="33" draggable={false} className="absolute left-0 top-0 block max-w-none" />
        </span>
      </div>

      {/* the released saree's details */}
      {pop && (() => {
        const sr = SAREES.find(x => x.id === pop.id)!;
        const on = pop.show;
        return (
          <div
            className={`absolute inset-x-0 top-0 z-30 flex h-[max(100svh,640px)] items-center justify-center bg-blush/70 px-6 transition-[opacity,backdrop-filter] duration-[800ms] ease-silk ${on ? 'opacity-100 backdrop-blur-md' : 'pointer-events-none opacity-0 backdrop-blur-0'}`}
            onClick={closeDrop}
            role="dialog"
            aria-modal="true"
            aria-label={sr.name}
          >
            <div className="relative flex w-full max-w-4xl flex-col items-center gap-8 md:flex-row md:gap-14" onClick={e => e.stopPropagation()}>
              <img
                src={`/drape/cut-${sr.id}.webp`}
                alt={sr.name}
                draggable={false}
                className={`h-[40vh] w-auto max-w-[80vw] object-contain drop-shadow-[0_22px_26px_rgba(90,42,30,0.22)] transition-[opacity,transform] duration-[1000ms] ease-silk md:h-[56vh] ${on ? 'translate-y-0 scale-100 opacity-100 delay-75' : 'translate-y-6 scale-[0.94] opacity-0'}`}
              />
              <div className={`max-w-sm text-center transition-[opacity,transform] duration-[900ms] ease-silk md:text-left ${on ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-4 opacity-0'}`}>
                <p className="kicker text-gold">Your selection</p>
                <h3 className="mt-4 font-serif text-[clamp(2.4rem,4.4vw,3.8rem)] font-medium italic leading-none text-ink">{sr.name}</h3>
                <span className="mx-auto mt-6 mb-5 block h-[2px] w-10 bg-gold md:mx-0" />
                <p className="text-[0.95rem] tracking-wide text-ink-soft">{sr.fabric}</p>
                <p className="mt-3 text-lg leading-snug text-ink">{sr.note}</p>
              </div>
              <button type="button" onClick={closeDrop} aria-label="Close" className={`absolute -top-2 right-0 grid h-10 w-10 place-items-center text-ink/70 transition-[opacity,color] duration-700 ease-silk hover:text-ink md:-top-6 md:-right-6 ${on ? 'opacity-100 delay-300' : 'opacity-0'}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><path d="M5 5l14 14M19 5L5 19" /></svg>
              </button>
            </div>
          </div>
        );
      })()}

      {/* overlay UI (pointer-events only on controls so drapes can be grabbed through the copy) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[max(100svh,640px)] px-6 py-8 md:px-[5.6vw] md:py-10">
        {canPlay && (
          <div className={`absolute bottom-[17%] right-6 aspect-square w-[clamp(138px,14vw,184px)] transition-opacity duration-500 ease-silk md:right-[5.6vw] ${drop?.phase === 'loading' ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gold">
              <span className="grid place-items-center rounded-full bg-blush/90 p-3 shadow-[0_0_30px_14px_rgba(243,228,220,0.9)]">
                <span className="block h-7 w-7 motion-safe:animate-spin rounded-full border border-gold/30 border-t-gold" />
              </span>
              <span className="kicker rounded-full bg-blush/90 px-2 text-[0.62rem] text-gold">Unfolding</span>
            </div>
          </div>
        )}
        <div className="js-drape-reveal flex items-center gap-3 text-ink">
          <Lotus className="h-6 w-10 text-gold" />
          <span className="font-serif text-xl tracking-wide">anubhav <span className="text-ink/50">/</span> atelier</span>
        </div>

        <div className="js-drape-reveal absolute inset-x-0 top-24 flex flex-wrap justify-center gap-x-3 gap-y-1 px-6 md:top-9 md:gap-x-5">
          {TAGS.map(t => (
            <Pill key={t.tag} dot={t.dot} active={filter === t.tag} onClick={() => setFilter(f => (f === t.tag ? null : t.tag))}>
              {t.tag}
            </Pill>
          ))}
        </div>

        <div className="absolute bottom-10 left-[5.6vw] hidden max-w-[15rem] text-left lg:block">
          <p className="invisible text-lg leading-snug" aria-hidden>A soft study of silk,<br />weight and light.</p>
          <a
            href="#collections"
            onClick={e => { e.preventDefault(); scrollToTarget('#collections'); }}
            className="pointer-events-auto mt-4 inline-flex items-center gap-2 border-b border-gold pb-1 font-medium text-gold"
          >
            View Collection <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
