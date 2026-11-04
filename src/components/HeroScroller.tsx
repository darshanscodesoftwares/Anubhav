import { Fragment, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import { SLIDES, type Slide } from '../data/slides';
import { HeroRenderer } from '../gl/HeroRenderer';
import { getLenis, prefersReducedMotion, scrollToTarget } from '../lib/smooth';
import { ProgressRail } from './ProgressRail';
import { Petals } from './Petals';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const N = SLIDES.length;
/** Scroll distance per scene, in viewport heights. */
const VH_PER_SLIDE = 1.1;

const lines = (text: string) =>
  text.split('\n').map((l, i, a) => (
    <Fragment key={i}>
      {l}
      {i < a.length - 1 && <br />}
    </Fragment>
  ));

function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M0 6h22M17 1l5 5-5 5" />
    </svg>
  );
}

function SlideCopy({ slide, index }: { slide: Slide; index: number }) {
  const Heading = index === 0 ? 'h1' : 'h2';
  return (
    <div
      className="js-slide absolute inset-x-6 bottom-[9vh] max-w-[34rem] md:inset-x-auto md:bottom-auto md:left-[5.6vw] md:top-[28vh]"
      style={{ visibility: index === 0 ? 'visible' : 'hidden' }}
    >
      {slide.kicker && <p className={`js-kicker kicker mb-6 md:mb-8 ${index === 0 ? 'text-ink/85' : 'text-gold'}`}>{slide.kicker}</p>}
      <Heading
        className={`js-title font-serif font-medium leading-[0.95] tracking-[-0.01em] text-ink ${slide.italic ? 'italic' : ''} ${index === 0 ? 'text-[clamp(3.6rem,7vw,7rem)]' : 'text-[clamp(3.2rem,5.8vw,5.8rem)]'}`}
      >
        {lines(slide.title)}
      </Heading>
      <span className="js-rule mt-6 mb-6 block h-[2px] w-12 origin-left bg-gold md:mt-8 md:mb-8" />
      <p className="js-body text-[1.08rem] leading-[1.5] text-ink-soft md:text-[1.35rem]">{lines(slide.body)}</p>
      <a
        href={slide.cta.href}
        onClick={e => {
          e.preventDefault();
          scrollToTarget(slide.cta.href);
        }}
        className={`js-cta group mt-9 inline-flex items-center gap-4 border border-ink/45 text-ink backdrop-blur-[2px] transition-colors duration-500 ease-silk hover:border-ink hover:bg-ink hover:text-blush md:mt-11 ${slide.cta.label ? 'px-7 py-4 text-[1.02rem] font-medium' : 'h-14 w-[5.2rem] justify-center'}`}
        aria-label={slide.cta.label ?? `Explore ${slide.title.replace('\n', ' ')}`}
      >
        {slide.cta.label}
        <Arrow className="h-3 w-6 transition-transform duration-500 ease-silk group-hover:translate-x-1" />
      </a>
    </div>
  );
}

export function HeroScroller({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ p: 0 });
  const trigger = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);
  const [noGL, setNoGL] = useState(false);

  // WebGL scene
  useEffect(() => {
    const lowPower = window.matchMedia('(max-width: 768px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    const edit = new URLSearchParams(location.search).has('edit');
    const renderer = HeroRenderer.create(canvas.current!, { reduceMotion: prefersReducedMotion(), lowPower, showMask: edit });
    if (!renderer) {
      setNoGL(true);
      onReady();
      return;
    }

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(section.current!);

    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const tick = (time: number) => {
      if (!visible) return;
      pointer.x += (target.x - pointer.x) * 0.045;
      pointer.y += (target.y - pointer.y) * 0.045;
      renderer.render(state.current.p, time, pointer);
    };

    const onEditClick = (e: MouseEvent) => {
      const r = canvas.current!.getBoundingClientRect();
      const uv = renderer.pickUV(Math.round(state.current.p), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      console.log(`[edit] slide ${Math.round(state.current.p) + 1}:`, JSON.stringify(uv));
    };
    if (edit) section.current!.addEventListener('click', onEditClick);

    let cancelled = false;
    renderer
      .load(SLIDES)
      .then(() => {
        if (cancelled) return;
        gsap.ticker.add(tick);
        onReady();
      })
      .catch(err => {
        console.error(err);
        setNoGL(true);
        onReady();
      });

    return () => {
      cancelled = true;
      gsap.ticker.remove(tick);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      section.current?.removeEventListener('click', onEditClick);
      renderer.dispose();
    };
  }, [onReady]);

  // Scroll choreography
  useGSAP(
    () => {
      if (!ready) return;
      const reduce = prefersReducedMotion();
      const blocks = gsap.utils.toArray<HTMLElement>('.js-slide');
      const parts = blocks.map(b => {
        const title = SplitText.create(b.querySelector('.js-title'), { type: 'lines,chars', mask: 'lines' });
        const body = SplitText.create(b.querySelector('.js-body'), { type: 'lines', mask: 'lines' });
        [...title.masks, ...body.masks].forEach(m => m.classList.add('split-mask'));
        return {
          block: b,
          kicker: b.querySelector('.js-kicker'),
          chars: title.chars,
          rule: b.querySelector('.js-rule'),
          body: body.lines,
          cta: b.querySelector('.js-cta')
        };
      });

      const reveal = (tl: gsap.core.Timeline, p: (typeof parts)[number], at: number, speed = 1) => {
        if (p.kicker) tl.fromTo(p.kicker, { autoAlpha: 0, y: 18, letterSpacing: '0.55em' }, { autoAlpha: 1, y: 0, letterSpacing: '0.32em', duration: 0.3 * speed, ease: 'power2.out' }, at);
        tl.fromTo(p.chars, { yPercent: 118, rotate: 5 }, { yPercent: 0, rotate: 0, duration: 0.28 * speed, stagger: { amount: 0.12 * speed }, ease: 'power3.out' }, at + 0.03 * speed);
        tl.fromTo(p.rule, { scaleX: 0 }, { scaleX: 1, duration: 0.24 * speed, ease: 'power2.out' }, at + 0.16 * speed);
        tl.fromTo(p.body, { yPercent: 108 }, { yPercent: 0, duration: 0.26 * speed, stagger: 0.04 * speed, ease: 'power3.out' }, at + 0.12 * speed);
        tl.fromTo(p.cta, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.2 * speed, ease: 'power2.out' }, at + 0.2 * speed);
      };

      // Intro for scene 1 (time-based, plays once)
      const intro = gsap.timeline({ delay: 0.15 });
      intro.from(document.querySelector('.js-nav'), { autoAlpha: 0, y: -16, duration: 1.1, ease: 'power3.out', clearProps: 'all' }, 0);
      intro.from('.js-rail', { autoAlpha: 0, x: 16, duration: 1.1, ease: 'power3.out' }, 0.3);
      reveal(intro, parts[0], 0.1, 3.2);

      // Scroll-scrubbed journey
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section.current,
          start: 'top top',
          end: () => `+=${window.innerHeight * VH_PER_SLIDE * (N - 1)}`,
          pin: true,
          scrub: reduce ? true : 0.35,
          invalidateOnRefresh: true,
          snap: getLenis() ? undefined : { snapTo: 1 / (N - 1), duration: { min: 0.3, max: 0.8 }, ease: 'power2.inOut' },
          onUpdate: () => setActive(Math.round(state.current.p))
        }
      });
      trigger.current = tl.scrollTrigger ?? null;

      tl.to(state.current, { p: N - 1, duration: N - 1 }, 0);
      parts.forEach((p, k) => {
        if (k > 0) {
          const at = k - 1 + 0.55;
          tl.set(p.block, { autoAlpha: 1 }, at);
          reveal(tl, p, at);
        }
        if (k < N - 1) {
          tl.to(p.block, { autoAlpha: 0, y: -40, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, k + 0.08);
        }
      });
      blocks.slice(1).forEach(b => gsap.set(b, { autoAlpha: 0 }));

      // Lenis-aware snapping. As soon as wheel/touch input pauses, glide to the next scene in the
      // direction of travel (any deliberate flick advances one scene). Lenis retargets smoothly, so
      // there's no stop-and-go. A slower idle check covers keyboard/scrollbar scrolling.
      const lenis = getLenis();
      let inputTimer = 0;
      let idleTimer = 0;
      let snapping = false;
      const snap = () => {
        const st = trigger.current;
        if (!st || !lenis) return;
        const target = lenis.targetScroll;
        if (target < st.start - 2 || target > st.end + 2) return;
        const span = st.end - st.start;
        const p = ((target - st.start) / span) * (N - 1);
        const f = p - Math.floor(p);
        if (f < 0.003 || f > 0.997) return;
        const to = lenis.direction >= 0 ? (f > 0.03 ? Math.ceil(p) : Math.floor(p)) : f < 0.97 ? Math.floor(p) : Math.ceil(p);
        snapping = true;
        lenis.scrollTo(st.start + (to / (N - 1)) * span, {
          duration: 1.2,
          easing: t => 1 - Math.pow(1 - t, 3),
          onComplete: () => { snapping = false; }
        });
      };
      const onInput = () => {
        snapping = false;
        window.clearTimeout(inputTimer);
        inputTimer = window.setTimeout(snap, 90);
      };
      const onScroll = () => {
        window.clearTimeout(idleTimer);
        if (!snapping) idleTimer = window.setTimeout(snap, 220);
      };
      window.addEventListener('wheel', onInput, { passive: true });
      window.addEventListener('touchend', onInput, { passive: true });
      lenis?.on('scroll', onScroll);
      return () => {
        window.removeEventListener('wheel', onInput);
        window.removeEventListener('touchend', onInput);
        lenis?.off('scroll', onScroll);
        window.clearTimeout(inputTimer);
        window.clearTimeout(idleTimer);
      };
    },
    { scope: section, dependencies: [ready] }
  );

  const goTo = (i: number) => {
    const st = trigger.current;
    if (!st) return;
    scrollToTarget(st.start + (i / (N - 1)) * (st.end - st.start), { duration: 1.4 + Math.abs(i - active) * 0.25 });
  };

  return (
    <section ref={section} id="top" className="relative h-svh w-full overflow-hidden bg-blush" aria-label="Anubhav collections">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
      {noGL && <img src={SLIDES[0].image} alt="" className="absolute inset-0 h-full w-full object-cover" />}

      {/* soft light behind copy for legibility on every scene */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_55%_70%_at_12%_50%,rgba(246,232,224,0.55),transparent_70%)] max-md:bg-[linear-gradient(to_top,rgba(243,228,220,0.97)_12%,rgba(243,228,220,0.82)_40%,rgba(243,228,220,0.35)_58%,transparent_72%)]" />

      <Petals count={window.matchMedia('(max-width: 768px)').matches ? 9 : 16} />

      <div className="relative z-20 h-full">
        {SLIDES.map((s, i) => (
          <SlideCopy key={s.id} slide={s} index={i} />
        ))}
      </div>

      <ProgressRail count={N} active={active} onSelect={goTo} labels={SLIDES.map(s => s.title.replace('\n', ' '))} />
    </section>
  );
}
