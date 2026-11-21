import { useCallback, useEffect, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initSmoothScroll } from './lib/smooth';
import { initSectionSnap } from './lib/sectionSnap';
import { Nav } from './components/Nav';
import { Loader } from './components/Loader';
import { ScrollIndicator } from './components/ScrollIndicator';
import { HeroScroller } from './components/HeroScroller';
import { Collections, Footer } from './components/Collections';
import { DrapeSection } from './components/drape/DrapeSection';
import { PetalCursor } from './components/PetalCursor';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    initSmoothScroll()?.stop();
  }, []);

  useEffect(() => (ready ? initSectionSnap() : undefined), [ready]);

  const onReady = useCallback(() => {
    document.fonts.ready.then(() => {
      window.scrollTo(0, 0);
      setReady(true);
      initSmoothScroll()?.start();
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }, []);

  return (
    <>
      <Loader done={ready} />
      <PetalCursor />
      <Nav />
      <ScrollIndicator />
      <main>
        <HeroScroller ready={ready} onReady={onReady} />
        <DrapeSection />
        <Collections />
      </main>
      <Footer />
    </>
  );
}
