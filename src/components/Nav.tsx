import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { getLenis, scrollToTarget } from '../lib/smooth';

const LINKS = [
  { label: 'Collections', href: '#collections' },
  { label: 'Atelier', href: '#atelier' },
  { label: 'About', href: '#about' }
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hero' | 'hidden' | 'solid'>('hero');

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const hero = document.getElementById('top');
      // pinned hero's spacer height = its full scroll length
      const heroEnd = (hero?.parentElement?.offsetHeight ?? window.innerHeight) - window.innerHeight * 0.5;
      const y = window.scrollY;
      if (y < heroEnd) setMode('hero');
      else setMode(y > lastY ? 'hidden' : 'solid');
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock page scroll while the menu is open; Escape closes it.
  useEffect(() => {
    if (!open) return;
    const lenis = getLenis();
    lenis?.stop();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    document.documentElement.style.overflow = '';
    getLenis()?.start();
    scrollToTarget(href);
  };

  return (
    <>
      <header
        className={`js-nav pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between px-6 pt-6 pb-4 text-ink transition-[translate,background-color,backdrop-filter,box-shadow] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:px-[5.5vw] md:pt-8 ${
          mode === 'hidden' && !open ? '-translate-y-full' : 'translate-y-0'
        } ${mode === 'solid' && !open ? 'bg-blush/85 backdrop-blur-md' : ''} ${mode === 'hero' && !open ? 'max-md:bg-[linear-gradient(to_bottom,rgba(243,228,220,0.92)_35%,transparent)] max-md:pb-10' : ''}`}
      >
        <a href="#top" onClick={go('#top')} className="pointer-events-auto" aria-label="Anubhav home">
          <Logo />
        </a>

        {/* Links + menu stay out of the hero so the scenes read like the design board; they appear once past it. */}
        <nav
          aria-hidden={mode === 'hero' && !open}
          inert={mode === 'hero' && !open}
          className={`flex items-center gap-10 pt-5 transition-[opacity,translate,visibility] duration-700 ease-silk ${
            mode === 'hero' && !open ? 'invisible -translate-y-2 opacity-0' : 'pointer-events-auto visible translate-y-0 opacity-100'
          }`}
        >
          <ul className="hidden items-center gap-12 md:flex">
            {LINKS.map(l => (
              <li key={l.href}>
                <a href={l.href} onClick={go(l.href)} className="group relative text-[0.98rem] opacity-90 transition-opacity hover:opacity-100">
                  {l.label}
                  <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-gold transition-transform duration-500 ease-silk group-hover:origin-left group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-6 w-10 flex-col justify-between py-1 rounded-sm outline-none focus-visible:outline-1 focus-visible:outline-offset-[6px] focus-visible:outline-current/40"
          >
            <span className={`h-px w-full bg-current transition-transform duration-500 ease-silk ${open ? 'translate-y-1.75 rotate-45' : ''}`} />
            <span className={`h-px w-full bg-current transition-opacity duration-300 ${open ? 'opacity-0' : ''}`} />
            <span className={`h-px w-full bg-current transition-transform duration-500 ease-silk ${open ? '-translate-y-1.75 -rotate-45' : ''}`} />
          </button>
        </nav>
      </header>

      {/* Outside the header: its transform/backdrop-filter would otherwise trap this fixed overlay inside the header box. */}
      <div
        className={`fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-blush/95 backdrop-blur-md transition-[opacity,visibility] duration-700 ease-silk ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
        aria-hidden={!open}
        inert={!open}
      >
        {[...LINKS, { label: 'Visit the Store', href: '#visit' }].map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            onClick={go(l.href)}
            className={`font-serif text-5xl italic text-ink transition-all duration-700 ease-silk ${open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
            style={{ transitionDelay: open ? `${120 + i * 70}ms` : '0ms' }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </>
  );
}
