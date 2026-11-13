import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { getLenis } from '../lib/smooth';
import { SUBJECTS } from '../data/slides';

interface Petal { x: number; y: number; z: number; r: number; spin: number; vr: number; flip: number; vf: number; hue: number; back: boolean }

/**
 * Drifting rose petals; lightweight 2D canvas, reacts to scroll velocity.
 * ~70 % are "behind" the model: they live on a second canvas under the copy and have the model's silhouette erased
 * (so they slip behind her and her saree); the rest are in front.
 */
export function Petals({ count = 16, getProgress, project }: { count?: number; getProgress?: () => number; project?: (i: number, u: number, v: number) => [number, number] | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  // callbacks arrive as fresh closures every render: keep them in refs so the animation isn't restarted
  const prog = useRef(getProgress);
  const proj = useRef(project);
  prog.current = getProgress;
  proj.current = project;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const bcanvas = backRef.current!;
    const bctx = bcanvas.getContext('2d')!;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      bcanvas.width = w * dpr; bcanvas.height = h * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const petals: Petal[] = Array.from({ length: count }, () => ({
      x: rand(0, 1), y: rand(0, 1), z: rand(0.35, 1),
      r: rand(0, Math.PI * 2), spin: 0, vr: rand(-0.6, 0.6),
      flip: rand(0, Math.PI * 2), vf: rand(0.8, 2), hue: rand(340, 356), back: Math.random() < 0.7
    }));

    let boost = 0;
    const fctx = ctx;
    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs, 50) / 1000;
      const v = getLenis()?.velocity ?? 0;
      boost += (Math.min(Math.abs(v), 60) / 60 - boost) * 0.08;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        const speed = (0.018 + boost * 0.12) * p.z;
        p.x += (speed * 0.9 + Math.sin(p.flip * 0.5) * 0.004) * dt * 3;
        p.y += (speed * 0.55 - (v > 0 ? boost * 0.05 : -boost * 0.05) * p.z) * dt * 3;
        p.r += p.vr * dt;
        p.flip += p.vf * dt;
        if (p.x > 1.08) { p.x = -0.08; p.y = rand(-0.1, 0.9); }
        if (p.y > 1.08) { p.y = -0.08; p.x = rand(-0.1, 0.9); }
        if (p.y < -0.1) p.y = 1.05;
        const size = 7 + p.z * 11;
        const ctx = p.back ? bctx : fctx;
        ctx.save();
        ctx.translate(p.x * w, p.y * h);
        ctx.rotate(p.r);
        ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.flip)));
        ctx.globalAlpha = 0.35 + p.z * 0.5;
        const g = ctx.createLinearGradient(-size, 0, size, 0);
        g.addColorStop(0, `hsl(${p.hue} 55% 62%)`);
        g.addColorStop(1, `hsl(${p.hue} 60% 78%)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.bezierCurveTo(-size * 0.4, -size * 0.75, size * 0.6, -size * 0.55, size, 0);
        ctx.bezierCurveTo(size * 0.5, size * 0.55, -size * 0.4, size * 0.6, -size, 0);
        ctx.fill();
        ctx.restore();
      }
      // cut the model out of the back layer so those petals pass behind her (only meaningful when a scene is at rest;
      // while the saree sweeps between scenes the back petals fade out instead)
      const pg = prog.current?.() ?? 0;
      const idx = Math.round(pg);
      const rest = 1 - Math.min(1, Math.abs(pg - idx) / 0.18);
      bcanvas.style.opacity = String(Math.max(0, rest));
      const poly = SUBJECTS[idx];
      if (poly && rest > 0.01 && proj.current) {
        const pts = poly.map(([u, v]) => proj.current!(idx, u, v));
        if (pts.every(Boolean)) {
          bctx.save();
          bctx.globalCompositeOperation = 'destination-out';
          bctx.filter = 'blur(9px)';
          bctx.fillStyle = '#000';
          bctx.beginPath();
          pts.forEach((pt, k) => (k ? bctx.lineTo(pt![0] * w, pt![1] * h) : bctx.moveTo(pt![0] * w, pt![1] * h)));
          bctx.closePath();
          bctx.fill();
          bctx.restore();
        }
      }
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
    };
  }, [count]);

  return (
    <>
      <canvas ref={backRef} className="pointer-events-none absolute inset-0 z-[4] h-full w-full" aria-hidden />
      <canvas ref={ref} className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden />
    </>
  );
}
