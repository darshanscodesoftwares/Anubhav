import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Lotus } from './Logo';

const ITEMS = [
  { id: 'sarees', title: 'Sarees', note: 'Banarasi, Kanjivaram, organza & net', img: '/hero/02.webp', pos: '62% 40%' },
  { id: 'lehengas', title: 'Lehengas', note: 'Bridal and festive, hand embroidered', img: '/hero/03.webp', pos: '58% 45%' },
  { id: 'fusion', title: 'Fusion Wear', note: 'Jackets, co-ords & Indo-western', img: '/hero/04.webp', pos: '50% 40%' },
  { id: 'everyday', title: 'Everyday Drapes', note: 'Light weaves for every day', img: '/hero/05.webp', pos: '55% 35%' }
];

export function Collections() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.js-reveal', {
        y: 60,
        autoAlpha: 0,
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: root.current, start: 'top 70%' }
      });
      gsap.utils.toArray<HTMLElement>('.js-card-img').forEach(img => {
        gsap.fromTo(img, { yPercent: 0 }, { yPercent: -100 / 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, scrub: true } });
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="collections" className="relative bg-blush px-6 py-28 md:px-[5.6vw] md:py-40">
      <div className="js-reveal mb-16 flex flex-col items-start gap-6 md:mb-24 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="kicker mb-6 text-gold">The Atelier</p>
          <h2 className="font-serif text-[clamp(2.8rem,5.5vw,5rem)] font-medium italic leading-none">Curated for you</h2>
        </div>
        <p className="max-w-sm text-lg leading-relaxed text-ink-soft">Every piece is chosen by hand — handloom weaves, heirloom embroidery and modern silhouettes under one roof.</p>
      </div>

      <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(item => (
          <a key={item.id} id={item.id} href={`#${item.id}`} className="js-reveal group block">
            <div className="relative aspect-[3/4] overflow-hidden bg-blush-deep">
              <img
                src={item.img}
                alt={item.title}
                loading="lazy"
                className="js-card-img absolute inset-x-0 top-0 h-[120%] w-full object-cover transition-transform duration-[1.4s] ease-silk group-hover:scale-105"
                style={{ objectPosition: item.pos }}
              />
            </div>
            <h3 className="mt-6 font-serif text-3xl font-medium italic">{item.title}</h3>
            <p className="mt-2 text-ink-soft">{item.note}</p>
          </a>
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
