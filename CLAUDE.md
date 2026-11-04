# ANUBHAV — Clothing Atelier website

React + Vite site with an immersive, scroll-driven hero.

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # type-check + production build → dist/
```

## Stack

- **Vite 8 + React 19 + TypeScript 7**
- **Tailwind CSS v4** (`@tailwindcss/vite`, theme tokens in `src/index.css` `@theme`)
- **GSAP 3.15** — ScrollTrigger (pin + scrub), SplitText (masked line/char reveals), `@gsap/react` `useGSAP`
- **Lenis** — smooth scroll, driven by `gsap.ticker` (single rAF shared with ScrollTrigger)
- **Raw WebGL1 shader** (`src/gl/HeroRenderer.ts`) — no three.js; zoom‑blur transitions + masked fabric sway
- Fonts self-hosted via Fontsource: Cormorant Garamond (headings, italic) + DM Sans (body)

## Design reference

`assets/hero/Anubhav_ Drapes of Timeless Elegance.png` = owner's target design (5 stacked scenes).
`assets/hero/*scroll*.png` = owner's ChatGPT renders (1672×941, **with baked-in text**). `(wideangle)` variants are tiny thumbnails — unused.
`public/hero/01–05.webp` = **clean plates**: baked-in text/UI removed (push‑pull inpainting via a headless‑Chrome canvas script), WebP q0.9 (~180 KB each).
If the owner provides text-free renders, just replace `public/hero/0N.webp` (keep ~16:9, ≥1672 wide) and re-tune masks.

Palette: blush `#f3e4dc`, ink `#3a2418`, gold `#b08440`. Copy: kicker (letter-spaced caps) → italic serif title → gold rule → body → outlined CTA/arrow.

## Structure

- `src/App.tsx` — loader gate, Lenis init, layout.
- `src/data/slides.ts` — **all hero content/config**: copy, image, `focus` (dive point), `mobileX` (portrait crop centre), `fabric` regions.
- `src/components/HeroScroller.tsx` — pinned hero; GSAP timeline (scene progress + text in/out), Lenis-aware snapping, rail, petals.
- `src/gl/HeroRenderer.ts` — WebGL renderer.
- `src/components/` — `Nav` (hides on scroll-down after hero, frosted on scroll-up, full-screen menu), `ProgressRail`, `Petals` (2D canvas, reacts to scroll velocity), `Loader`, `Logo` (lotus SVG), `Collections` + `Footer`.
- `src/lib/smooth.ts` — Lenis singleton, `scrollToTarget`, reduced-motion check.

## How the hero works

- Section is pinned for `(N-1) × 1.1` viewport heights. Timeline time 0…N‑1 = scene progress (`state.p`), scrub 0.35.
- **Snapping**: when wheel/touch input pauses (90 ms) the hero glides (1.2 s) to the next scene in the scroll direction; any flick > 3 % advances. Idle fallback (220 ms) covers keyboard/scrollbar. Verified: one wheel notch = one scene, no bounce-back.
- **Per segment**: old copy blurs/fades up (k+0.08…0.38); image holds 15 %, then dives toward `focus` (exponential zoom ×2.6 + radial zoom blur), warm flash, crossfades into next scene which de-blurs; new copy reveals at k+0.55 (kicker tracking-in, title chars rise from line masks, rule draws, body lines rise, CTA).
- **Fabric sway**: each `fabric` region → mask texture: R = amplitude (radial ramp from `pin`, the attachment point), G = phase, B = flow angle (pin→centroid). Shader runs a travelling wave along the flow direction (perpendicular displacement + fold shading) only inside masks. Image itself is otherwise static (verified by frame-diff: face/body/sky = noise level, fabric moves).
- Crop: desktop narrower than 16:9 keeps the left (copy) side; portrait centres on `mobileX`.
- Subtle pointer parallax. Reduced motion: no sway/zoom/blur/Lenis, native scroll + ScrollTrigger snap.
- `?edit` — tints fabric masks green; click logs image UVs to console for tracing new polygons.

## Progress log

Owner request: append an entry here after every change session.

- **2026‑11‑04** — v1 vanilla site with Wikimedia stock photos, WebGL zoom-blur + sway, Lenis added.
- **2026‑11‑04** — Owner: v1 far from vision; supplied 5 AI renders + design board.
- **2026‑11‑04** — v2 rebuild in React/Vite/TS/Tailwind v4/GSAP/Lenis. Clean plates generated from renders.
  Built nav, progress rail, petals, loader, SplitText reveals, directional fabric shader, Lenis snapping,
  mobile crop + scrims, collections grid + footer. Verified headless Chrome desktop 1440×860 + mobile 390×844:
  snapping exact, transitions render, no console errors, sway only in fabric. Removed old vanilla files.
- **2026‑11‑04** — First commits on `main`, split by concern: design assets → scaffold → hero plates →
  WebGL renderer → Lenis → pinned hero → nav/loader/collections → docs. Not pushed (no remote action taken).

## Next / ideas

- Ask owner for text-free renders at higher res (≥2400 px) for sharper large screens; current plates are 1672 px.
- Real store address/phone in footer; real collection pages behind CTAs (currently anchor to the grid).
- Fine-tune fabric polygons per scene with `?edit` if any edge looks off on owner's screen.
