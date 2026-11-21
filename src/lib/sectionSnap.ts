import { getLenis } from './smooth';

/**
 * Smooth section snapping for everything *after* the hero's own scene snapping
 * (HeroScroller handles scroll positions inside the pinned hero).
 *
 * Rest points (absolute scroll positions): the hero's last scene, the top of Pick a Drape, the top of
 * Collections, and the end of the page. When wheel input pauses (or scrolling goes idle) the page glides
 * to the next rest point in the direction of travel — but only if that point is close enough ("zone"),
 * so the tall collections grid can still be read freely and is only pulled in near its edges.
 */

const ZONE = 0.6; // × viewport height: how close the next rest point must be to pull the page in
const END_ZONE = 0.3; // smaller pull at the very bottom of the page
const AT_REST = 12; // px: closer than this to a rest point counts as already there

export function initSectionSnap() {
  const lenis = getLenis();
  if (!lenis) return () => {};

  let inputTimer = 0;
  let idleTimer = 0;
  let snapping = false;

  const points = () => {
    const vh = window.innerHeight;
    const top = (id: string) => {
      const el = document.getElementById(id);
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    };
    const drapes = top('drapes');
    const collections = top('collections');
    const footer = top('visit');
    const hero = document.getElementById('top');
    if (drapes == null || collections == null || !hero) return null;
    const maxScroll = document.documentElement.scrollHeight - vh;
    const end = Math.min(footer ?? maxScroll, maxScroll);
    const pts = [drapes - hero.offsetHeight, drapes, collections];
    if (end > collections + AT_REST) pts.push(end);
    return { pts, vh };
  };

  const snap = () => {
    if (!lenis || lenis.isStopped) return;
    const geo = points();
    if (!geo) return;
    const { pts, vh } = geo;
    const t = lenis.targetScroll;
    // above the hero's last scene → the hero's own snapping owns it; beyond the last point → nothing to do
    if (t <= pts[0] + 2 || t >= pts[pts.length - 1] - 2) return;

    let i = 0;
    while (i < pts.length - 2 && t > pts[i + 1]) i++;
    const lower = pts[i];
    const upper = pts[i + 1];
    if (t - lower < AT_REST || upper - t < AT_REST) return;

    const down = lenis.direction >= 0;
    const ahead = down ? upper : lower;
    const d = Math.abs(ahead - t);
    const seg = upper - lower;
    const isEnd = down && i + 1 === pts.length - 1;
    // hero ↔ drapes is a viewport-sized "page turn": any deliberate scroll advances
    const zone = i === 0 ? seg * 0.97 : (isEnd ? END_ZONE : ZONE) * vh;
    if (d > zone) return;

    snapping = true;
    lenis.scrollTo(ahead, {
      duration: 1.4 + 0.8 * Math.min(1, d / vh),
      easing: x => 1 - Math.pow(1 - x, 3),
      onComplete: () => { snapping = false; }
    });
  };

  const onWheel = () => {
    snapping = false;
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(snap, 90);
  };
  const onScroll = () => {
    window.clearTimeout(idleTimer);
    if (!snapping) idleTimer = window.setTimeout(snap, 220);
  };

  window.addEventListener('wheel', onWheel, { passive: true });
  lenis.on('scroll', onScroll);
  return () => {
    window.removeEventListener('wheel', onWheel);
    lenis.off('scroll', onScroll);
    window.clearTimeout(inputTimer);
    window.clearTimeout(idleTimer);
  };
}
