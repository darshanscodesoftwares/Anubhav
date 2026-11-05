import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
      className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.92rem] shadow-[0_6px_20px_rgba(90,42,30,0.08)] transition-all duration-300 ease-silk md:px-6 ${
        active ? 'bg-ink text-blush' : 'bg-white/85 text-ink hover:bg-white'
      }`}
    >
      {dot && <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />}
      {children}
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

  useEffect(() => {
    const el = root.current!;
    const near = new IntersectionObserver(([e]) => e.isIntersecting && setMounted(true), { rootMargin: '900px 0px' });
    const vis = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.15 });
    near.observe(el);
    vis.observe(el);
    return () => {
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
      className="relative h-svh min-h-[640px] w-full overflow-hidden bg-[radial-gradient(ellipse_80%_70%_at_55%_45%,#fdf6f1,#f3e3da)]"
      aria-label="Pick a drape — interactive saree play area"
    >
      {/* Copy sits BEHIND the 3D canvas so drapes and petals pass in front of it (canvas is transparent). */}
      <div className="pointer-events-none absolute inset-0 px-6 py-8 md:px-[5.6vw] md:py-10">
        <div className="js-drape-reveal absolute left-6 top-[30%] md:left-[5.6vw] md:top-[22%]">
          <h2 className="font-serif text-[clamp(3.4rem,8vw,7.6rem)] font-medium italic leading-[0.88] text-ink">
            Pick a<br />Drape
          </h2>
          <span className="mt-7 mb-5 block h-[2px] w-10 bg-gold" />
          <p className="text-[1.02rem] text-ink-soft">Lift one, let it go, and watch it settle.</p>
        </div>

        <div className="js-drape-reveal absolute bottom-10 right-[5.6vw] hidden max-w-[15rem] text-right lg:block">
          <p className="text-lg leading-snug text-ink">A soft study of silk,<br />weight and light.</p>
          <span className="invisible mt-4 inline-flex items-center gap-2 border-b pb-1 font-medium" aria-hidden>View Collection →</span>
        </div>
      </div>

      <div className="absolute inset-0">
        {canPlay ? (
          mounted && (
            <Suspense fallback={null}>
              <DrapeScene active={active} filter={filter} />
            </Suspense>
          )
        ) : (
          <StaticDrapes />
        )}
      </div>

      {/* overlay UI (pointer-events only on controls so drapes can be grabbed through the copy) */}
      <div className="pointer-events-none absolute inset-0 px-6 py-8 md:px-[5.6vw] md:py-10">
        <div className="js-drape-reveal flex items-center gap-3 text-ink">
          <Lotus className="h-6 w-10 text-gold" />
          <span className="font-serif text-xl tracking-wide">anubhav <span className="text-ink/50">/</span> atelier</span>
        </div>

        <div className="js-drape-reveal absolute inset-x-0 top-24 flex flex-wrap justify-center gap-2.5 px-6 md:top-9 md:gap-3">
          {TAGS.map(t => (
            <Pill key={t.tag} dot={t.dot} active={filter === t.tag} onClick={() => setFilter(f => (f === t.tag ? null : t.tag))}>
              {t.tag}
            </Pill>
          ))}
        </div>

        <div className="absolute bottom-10 right-[5.6vw] hidden max-w-[15rem] text-right lg:block">
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
