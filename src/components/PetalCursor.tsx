import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { getLenis } from '../lib/smooth';

/**
 * Rose-petal cursor. It follows the pointer with a soft lag, leans into its movement, and while the page scrolls it
 * flutters like a petal that has just been dropped (sway, flip, drift); it settles back when scrolling stops.
 * Fine pointers only; the native cursor is hidden via the `petal-cursor` class on <html>.
 */
export function PetalCursor() {
  const el = useRef<HTMLDivElement>(null);
  const hand = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const open = useRef<SVGSVGElement>(null);
  const fist = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = el.current!, handNode = hand.current!, dotNode = dot.current!;
    let hover = 0, hoverTarget = 0, frame = 0;
    const CLICKABLE = 'a[href], button, [role="button"], [role="tab"], input, select, textarea, label, summary, [data-clickable]';
    document.documentElement.classList.add('petal-cursor');
    const m = { x: -100, y: -100, seen: false };      // pointer
    const c = { x: -100, y: -100, vx: 0, vy: 0 };     // petal (lagged)
    let rot = -18, flutter = 0, move = 0, tiltX = 0, tiltY = 0, down = 0, lastScrollY = window.scrollY, lastMove = 0;
    const onMove = (e: PointerEvent) => {
      m.x = e.clientX; m.y = e.clientY; lastMove = performance.now();
      if (!m.seen) { m.seen = true; c.x = m.x; c.y = m.y; node.style.opacity = '1'; }
    };
    const onDown = () => { down = 1; };
    const onUp = () => { down = 0; };
    const onLeave = () => { node.style.opacity = '0'; m.seen = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);

    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs, 50) / 1000;
      // scroll speed (Lenis velocity when it is running, else the raw scroll delta)
      const sy = window.scrollY, raw = (sy - lastScrollY) / Math.max(dt, 1e-3);
      lastScrollY = sy;
      const sv = Math.abs(getLenis()?.velocity ?? 0) * 60 + Math.abs(raw) * 0.02;
      const target = Math.min(1, sv / 900);
      flutter += (target - flutter) * (target > flutter ? 0.18 : 0.045);   // quick to start, slow to settle
      const t = performance.now() / 1000;
      // pointer follow: an under-damped spring, so the petal lags, overshoots and wafts like it is in air
      const px = c.x, py = c.y;
      c.vx += ((m.x - c.x) * 260 - c.vx * 15) * dt;
      c.vy += ((m.y - c.y) * 260 - c.vy * 15) * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      const ax = (c.x - px) / Math.max(dt, 1e-3), ay = (c.y - py) / Math.max(dt, 1e-3);   // actual velocity (px/s)
      const speed = Math.hypot(ax, ay);
      move += (Math.min(1, speed / 1400) - move) * (speed / 1400 > move ? 0.25 : 0.06);
      // petal flutter from scrolling
      const sway = Math.sin(t * 4.2) * 10 * flutter;
      const bob = Math.sin(t * 5.6 + 1) * 5 * flutter + flutter * 6;
      const flip = 1 - 0.55 * flutter * Math.abs(Math.sin(t * 3.4));
      // movement: it leans/turns toward where it is going (trailing edge drags), and tips in 3D on every axis
      const lean = Math.max(-40, Math.min(40, ax * 0.03));
      const wave = Math.sin(t * 9) * 9 * move;                    // flutter across the path, only while moving
      const targetRot = -18 + lean + Math.max(-22, Math.min(22, ay * 0.012)) + Math.sin(t * 4.2 + 0.6) * 28 * flutter + wave;
      rot += (targetRot - rot) * 0.22;
      tiltY += (Math.max(-60, Math.min(60, ax * 0.045)) - tiltY) * 0.18;     // rotateY: left/right motion
      tiltX += (Math.max(-60, Math.min(60, -ay * 0.045)) - tiltX) * 0.18;    // rotateX: up/down motion
      const s = (1 - 0.16 * down) * (1 - 0.45 * hover);
      // over a link / button / other clickable: the petal smoothly becomes a small round pink pointer
      if ((frame++ & 3) === 0 && m.seen) {
        const t = document.elementFromPoint(m.x, m.y);
        hoverTarget = t && t.closest(CLICKABLE) && !t.closest('[data-no-dot]') ? 1 : 0;
      }
      hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 16));
      // over something grabbable the 3D scene sets body.style.cursor to grab / grabbing → show a hand instead of the petal
      const cur = document.body.style.cursor;
      const mode = cur === 'grabbing' ? 2 : cur === 'grab' ? 1 : 0;
      node.style.visibility = mode ? 'hidden' : 'visible';
      node.style.opacity = m.seen ? String(Math.max(0, 1 - hover * 1.25)) : '0';
      dotNode.style.opacity = m.seen && !mode ? String(Math.min(0.82, hover * 1.25)) : '0';
      dotNode.style.transform = `translate3d(${c.x - 8}px, ${c.y - 8}px, 0) scale(${(0.35 + 0.65 * hover) * (1 - 0.18 * down)})`;
      handNode.style.visibility = mode ? 'visible' : 'hidden';
      open.current!.style.display = mode === 1 ? 'block' : 'none';
      fist.current!.style.display = mode === 2 ? 'block' : 'none';
      handNode.style.transform = `translate3d(${(m.seen ? c.x : -100) - 17}px, ${(m.seen ? c.y : -100) - 17}px, 0)`;
      node.style.transform = `translate3d(${(c.x + sway).toFixed(1)}px, ${(c.y + bob).toFixed(1)}px, 0) perspective(260px) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg) rotate(${rot.toFixed(1)}deg) scale(${s.toFixed(3)}, ${(s * flip).toFixed(3)})`;
      void lastMove;
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.classList.remove('petal-cursor');
    };
  }, []);

  return (
    <>    <div ref={el} className="pointer-events-none fixed left-0 top-0 z-[9999] opacity-0 will-change-transform" style={{ transformOrigin: '2px 2px' }} aria-hidden>
      <svg width="28" height="34" viewBox="0 0 28 34" style={{ display: 'block', filter: 'drop-shadow(0 2px 2.5px rgba(120,40,60,0.28))' }}>
        <defs>
          <linearGradient id="pc-g" x1="2" y1="2" x2="22" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd4de" />
            <stop offset="0.55" stopColor="#f48aa6" />
            <stop offset="1" stopColor="#d4476f" />
          </linearGradient>
        </defs>
        {/* petal: tip at the top-left (the click point), broad rounded body below */}
        <path d="M2 2 C8 4 20 8 25 17 C28.5 24 22 32.5 14 32 C6 31.4 1.5 21 1.8 12 C1.9 8 2 5 2 2Z" fill="url(#pc-g)" />
        <path d="M2.6 3.4 C6 12 10 22 14 30" fill="none" stroke="#fff2f5" strokeOpacity=".5" strokeWidth=".8" strokeLinecap="round" />
        <path d="M2.6 3.4 C11 7 19 12 22 20" fill="none" stroke="#c63a62" strokeOpacity=".28" strokeWidth=".7" strokeLinecap="round" />
      </svg>
    </div>
      <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[9999] h-4 w-4 rounded-full opacity-0 will-change-transform" style={{ background: 'radial-gradient(circle at 35% 30%, #f2c9d3 0%, #e393a9 55%, #c4607f 100%)', boxShadow: '0 2px 5px rgba(120,40,60,0.3)' }} aria-hidden />
      <div ref={hand} className="pointer-events-none fixed left-0 top-0 z-[9999] will-change-transform" style={{ visibility: 'hidden' }} aria-hidden>
        {/* grab: a dark ring with a cream halo (reads on gold, cream and black cloth alike); grabbing: it closes into a solid dot */}
        <svg ref={open} width="34" height="34" viewBox="0 0 34 34" style={{ display: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}>
          <circle cx="17" cy="17" r="8.5" fill="none" stroke="#fbefe6" strokeWidth="3" strokeOpacity=".9" />
          <circle cx="17" cy="17" r="8.5" fill="none" stroke="#3a2418" strokeWidth="1.1" />
        </svg>
        <svg ref={fist} width="34" height="34" viewBox="0 0 34 34" style={{ display: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}>
          <circle cx="17" cy="17" r="7.5" fill="#3a2418" stroke="#fbefe6" strokeWidth="2.2" />
          <circle cx="17" cy="17" r="2" fill="#c9a463" />
        </svg>
      </div>
    </>
  );
}
