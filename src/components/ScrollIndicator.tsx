import { useEffect, useRef } from 'react';
import { getLenis } from '../lib/smooth';

/** Slim light-grey scroll thumb that replaces the hidden native scrollbar. Draggable. */
export function ScrollIndicator() {
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = thumb.current!;
    const update = () => {
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      const h = Math.max(36, (vh / (max + vh)) * vh);
      const y = max > 0 ? (window.scrollY / max) * (vh - h) : 0;
      el.style.height = `${h}px`;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    };

    let dragging = false;
    let startY = 0;
    let startScroll = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      startY = e.clientY;
      startScroll = window.scrollY;
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      const travel = vh - el.offsetHeight;
      const target = startScroll + ((e.clientY - startY) / travel) * max;
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(target, { immediate: true });
      else window.scrollTo(0, target);
    };
    const onUp = () => { dragging = false; };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-[60] w-3 [@media(pointer:coarse)]:hidden" aria-hidden>
      <div
        ref={thumb}
        className="pointer-events-auto absolute right-[3px] top-0 w-[4px] cursor-grab rounded-full bg-neutral-400/45 transition-[width,background-color] duration-300 hover:w-[6px] hover:bg-neutral-400/75 active:cursor-grabbing"
      />
    </div>
  );
}
