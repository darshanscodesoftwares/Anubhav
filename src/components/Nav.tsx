import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { scrollToTarget } from '../lib/smooth';

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

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollToTarget(href);
  };

  return (
    <header
      className={`js-nav pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between px-6 pt-6 pb-4 text-ink transition-[transform,background-color,backdrop-filter] duration-700 ease-silk md:px-[5.5vw] md:pt-8 ${
        mode === 'hidden' && !open ? '-translate-y-full' : 'translate-y-0'
      } ${mode === 'solid' && !open ? 'bg-blush/85 backdrop-blur-md' : ''} ${mode === 'hero' ? 'max-md:bg-[linear-gradient(to_bottom,rgba(243,228,220,0.92)_35%,transparent)] max-md:pb-10' : ''}`}
    >
      <a href="#top" onClick={go('#top')} className="pointer-events-auto" aria-label="Anubhav home">
        <Logo />
      </a>

      <nav className="pointer-events-auto flex items-center gap-10 pt-5">
        <ul className="hidden items-center gap-12 md:flex">
          {LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} onClick={go(l.href)} className="group relative text-[0.98rem] text-ink/90 transition-colors hover:text-ink">
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
          className="flex h-6 w-10 flex-col justify-between py-1"
        >
          <span className={`h-px w-full bg-ink transition-transform duration-500 ease-silk ${open ? 'translate-y-1.75 rotate-45' : ''}`} />
          <span className={`h-px w-full bg-ink transition-opacity duration-300 ${open ? 'opacity-0' : ''}`} />
          <span className={`h-px w-full bg-ink transition-transform duration-500 ease-silk ${open ? '-translate-y-1.75 -rotate-45' : ''}`} />
        </button>
      </nav>

      <div
        className={`pointer-events-auto fixed inset-0 -z-10 flex flex-col items-center justify-center gap-8 bg-blush/95 backdrop-blur-md transition-[opacity,visibility] duration-700 ease-silk ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
      >
        {[...LINKS, { label: 'Visit the Store', href: '#visit' }].map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            onClick={go(l.href)}
            className={`font-serif text-5xl italic transition-all duration-700 ease-silk ${open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
            style={{ transitionDelay: open ? `${120 + i * 70}ms` : '0ms' }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </header>
  );
}
