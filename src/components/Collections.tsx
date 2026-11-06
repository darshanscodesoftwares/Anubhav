import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Lotus } from './Logo';
import { FILTERS, PIECES, type Filter } from '../data/collection';

function Heart({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden>
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
    </svg>
  );
}

export function Collections() {
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const first = useRef(true);

  const shown = PIECES.filter(p => filter === 'All' || p.tags.includes(filter));

  useGSAP(
    () => {
      gsap.from('.js-reveal', {
        y: 50,
        autoAlpha: 0,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.09,
        scrollTrigger: { trigger: root.current, start: 'top 72%' }
      });
    },
    { scope: root }
  );

  // cards rise in again whenever the filter changes (not on first paint — the scroll reveal handles that)
  useGSAP(
    () => {
      if (first.current) { first.current = false; return; }
      gsap.fromTo('.js-piece', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.06, overwrite: true });
      requestAnimationFrame(() => ScrollTrigger.refresh());
    },
    { scope: grid, dependencies: [filter] }
  );

  return (
    <section ref={root} id="collections" className="relative bg-blush px-6 py-24 md:px-[5.6vw] md:py-32">
      <div className="js-reveal flex flex-col gap-5 md:flex-row md:items-center md:gap-10">
        <p className="kicker text-gold md:w-52">Collections</p>
        <h2 className="font-serif text-[clamp(3rem,6vw,5.4rem)] font-medium italic leading-none">Sarees</h2>
        <span className="hidden h-14 w-px bg-ink/25 md:block" />
        <p className="max-w-sm text-[1.02rem] leading-snug text-ink-soft">A curated edit of handloom silks and embroidered drapes.</p>
      </div>

      <div className="js-reveal mt-10 flex flex-wrap items-center gap-x-2 gap-y-2 md:mt-12">
        {FILTERS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-5 py-2 text-[0.95rem] transition-colors duration-500 ease-silk ${
              filter === f ? 'bg-gold-soft/80 text-blush' : 'text-ink/70 hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div ref={grid} className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 md:mt-14 md:gap-x-10 lg:grid-cols-4">
        {shown.map(piece => (
          <article key={piece.id} className="js-reveal js-piece group">
            <div className="relative aspect-[1/1.05] overflow-hidden border-b border-ink/25">
              <img
                src={`/collection/${piece.id}.webp`}
                alt={`${piece.name} saree`}
                loading="lazy"
                width={760}
                height={832}
                draggable={false}
                className="absolute inset-x-0 bottom-0 h-full w-full object-contain object-bottom transition-transform duration-[1.2s] ease-silk group-hover:scale-[1.035]"
              />
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h3 className="font-serif text-[1.35rem] font-medium leading-tight">{piece.name}</h3>
              <button
                type="button"
                aria-label={saved[piece.id] ? 'Remove from saved' : 'Save'}
                aria-pressed={!!saved[piece.id]}
                onClick={() => setSaved(s => ({ ...s, [piece.id]: !s[piece.id] }))}
                className={`mt-1 shrink-0 transition-colors duration-300 ${saved[piece.id] ? 'text-gold' : 'text-ink/60 hover:text-gold'}`}
              >
                <Heart on={!!saved[piece.id]} />
              </button>
            </div>
            <p className="font-serif text-[1.15rem]">{piece.price}</p>
            <p className="mt-1 text-[0.72rem] tracking-wide text-ink-soft">{piece.notes.join('  |  ')}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer id="visit" className="bg-ink px-6 py-20 text-blush md:px-[5.6vw]">
      <div id="about" className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
        <div>
          <Lotus className="mb-4 h-8 w-12 text-gold-soft" />
          <p className="font-serif text-4xl tracking-[0.16em]">ANUBHAV</p>
          <p className="mt-2 text-xs tracking-[0.3em] text-blush/70">CLOTHING ATELIER</p>
        </div>
        <div id="atelier" className="grid gap-2 text-blush/80 md:text-right">
          <p>Store address · City</p>
          <p>Open daily · 10:30 am – 9 pm</p>
          <p>+91 00000 00000</p>
        </div>
      </div>
      <p className="mt-16 text-xs text-blush/50">© {new Date().getFullYear()} Anubhav Clothing Atelier</p>
    </footer>
  );
}
