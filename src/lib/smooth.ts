import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/** One Lenis instance driven by GSAP's ticker so ScrollTrigger and Lenis share a single rAF. */
export function initSmoothScroll() {
  if (lenis || prefersReducedMotion()) return lenis;
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, touchMultiplier: 1.4, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export const getLenis = () => lenis;

export function scrollToTarget(target: string | number, opts: { duration?: number; immediate?: boolean } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { duration: opts.duration ?? 1.6, immediate: opts.immediate, easing: t => 1 - Math.pow(1 - t, 4) });
    return;
  }
  if (typeof target === 'number') window.scrollTo({ top: target });
  else document.querySelector(target)?.scrollIntoView();
}
