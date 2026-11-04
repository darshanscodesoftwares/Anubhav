import { useCallback, useEffect, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initSmoothScroll } from './lib/smooth';
import { Nav } from './components/Nav';
import { Loader } from './components/Loader';
import { HeroScroller } from './components/HeroScroller';
import { Collections, Footer } from './components/Collections';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    initSmoothScroll()?.stop();
  }, []);

  const onReady = useCallback(() => {
    document.fonts.ready.then(() => {
      setReady(true);
      initSmoothScroll()?.start();
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }, []);

  return (
    <>
      <Loader done={ready} />
      <Nav />
      <main>
        <HeroScroller ready={ready} onReady={onReady} />
        <Collections />
      </main>
      <Footer />
    </>
  );
}
