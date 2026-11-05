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
- **three + @react-three/fiber + drei + @react-three/rapier** — only in the lazy `DrapeScene` chunk (~1.1 MB gz incl. Rapier wasm)
- **Raw WebGL1 shader** (`src/gl/HeroRenderer.ts`) — no three.js; saree-sweep transitions + masked fabric sway
- Fonts self-hosted via Fontsource: Cormorant Garamond (headings, italic) + DM Sans (body)

## Design reference

`assets/hero/Anubhav_ Drapes of Timeless Elegance.png` = owner's target design (5 stacked scenes).
`assets/hero/*scroll*.png` = owner's ChatGPT renders (1672×941, **with baked-in text**). `(wideangle)` variants are tiny thumbnails — unused.
`public/hero/01–05.webp` = **clean plates**: baked-in text/UI removed (push‑pull inpainting via a headless‑Chrome canvas script), WebP q0.9 (~180 KB each).
If the owner provides text-free renders, just replace `public/hero/0N.webp` (keep ~16:9, ≥1672 wide) and re-tune masks.

Palette: blush `#f3e4dc`, ink `#3a2418`, gold `#b08440`. Copy: kicker (letter-spaced caps) → italic serif title → gold rule → body → outlined CTA/arrow.

## Structure

- `src/App.tsx` — loader gate, Lenis init, layout.
- `src/data/slides.ts` — **all hero content/config**: copy, image, `focus` (camera-push anchor), `mobileX` (portrait crop centre), `sweep` (entry transition), `fabric` regions.
- `src/components/HeroScroller.tsx` — pinned hero; GSAP timeline (scene progress + text in/out), Lenis-aware snapping, rail, petals.
- `src/gl/HeroRenderer.ts` — WebGL renderer.
- `src/components/` — `Nav` (in the hero only the logo shows — links/menu are hidden + inert per owner; after the hero: hides on scroll-down, frosted on scroll-up, full-screen menu), `ProgressRail`, `Petals` (2D canvas, reacts to scroll velocity), `Loader`, `Logo` (lotus SVG), `ScrollIndicator` (custom scrollbar), `Collections` + `Footer`.
- `src/lib/smooth.ts` — Lenis singleton, `scrollToTarget`, reduced-motion check.
- `src/components/drape/` — **"Pick a Drape" 3D play section** (after the hero), lazy-loaded chunk:
  - `DrapeSection.tsx` — overlay UI (headline, filter chips Silk/Organza/Velvet/Bridal/Festive, "View Collection" link),
    mounts the scene via `React.lazy` when within 900px, runs it only while visible; static cut-out fallback (no WebGL / reduced motion).
  - `DrapeScene.tsx` — R3F canvas, Rapier physics, camera rig that raycasts screen corners onto the floor to place walls,
    drag-and-throw (velocity-driven toward a lift plane, gravity off while held, throw keeps release velocity), saree bundles, rose petals, two-layer soft shadows.
  - `fabric.ts` — `makeFabricMaps` (per-texture: tints the silk ground only + detects gold zari → roughness/metalness map) · pillowy rounded bundle geometry (keeps BoxGeometry face groups/UVs) + **saree wobble** vertex deform:
    layer lag (top layers trail acceleration), edge flutter wave with speed, soft slump on landing, held droop (`uHold` + `uGrab`: cloth sags away from the grab point while picked up), stacked drape (`uSup`/`uSupRot`/`uSag`: a bundle resting on another sags around the lower one's edge); JS springs per bundle (Soft vs Firm).
  - `models.tsx` — lotus/rose petal: parametric cupped surface (pointed tip, lengthwise curl, rippled edge) + painted canvas texture (deep rim/tip → pale centre, faint veins) with a translucent self-glow material.
  - `data.ts` — sarees (name, fabric, note, tags, sheen) + filter chips.
  - Assets: `public/drape/` top-*/edge-* textures and cut-* fallbacks (from owner's `assets/Bundle textures…` + `assets/Transparent cut-outs…`).

## How the hero works

- Section is pinned for `(N-1) × 1.5` viewport heights. Timeline time 0…N‑1 = scene progress (`state.p`), scrub 0.6.
- **Snapping**: when wheel/touch input pauses (90 ms) the hero glides (2.4 s, ease-out) to the next scene in the scroll direction; any flick > 3 % advances. Idle fallback (220 ms) covers keyboard/scrollbar. Verified: one wheel notch = one scene, no bounce-back.
- **Saree-sweep transition** (owner's idea: like a dancer swinging her pallu across the camera): entering scene B, a sheer length of *B's own saree* sweeps across the lens along `sweep.dir` (= the flow direction of B's saree in the pose). Cloth is textured from `sweep.swatch`/`half` (a fabric-only patch of B, mirror-tiled so no skin/background shows), with billowing S-curve leading edge, zari gold border with glints, moving folds, sheen and a cast shadow on scene A. Trailing half is sheer so B shows through as it departs. A gets a slight camera push; B settles from a 9 % zoom while its fabric sway is boosted ×2.4 and calms (the saree "lands" in the pose). `sweepProgress(f)`: 6 % hold, then linear (the snap glide supplies the easing).
- **Copy**: old copy blurs/fades up at k+0.03; scrim fades to 15 % during the sweep and returns at k+0.6; new copy reveals at k+0.62 (kicker tracking-in, title chars rise from line masks, rule draws, body lines rise, CTA).
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
- **2026‑11‑04** — Owner: zoom-blur transition felt old-style and too fast. Replaced with the **saree-sweep**
  transition (next scene's saree swings across the camera in its pose's flow direction, then reveals the pose).
  Slowed pacing (1.5 vh/scene, 2.4 s glide). Scrim dips during sweeps so mobile shows the cloth. Verified all 4
  transitions desktop + mobile in headless Chrome, no errors, build passes.
- **2026‑11‑04** — Owner: no navbar inside the hero. Nav links + menu icon now hidden (and inert) throughout the hero;
  logo stays (it's on every scene of the design board). Full nav returns past the hero. Replaced the browser's
  blue focus box on the menu button with a gold `focus-visible` ring.
- **2026‑11‑04** — Fixed hamburger menu: overlay was clipped to the header (fixed element inside a parent with
  transform/backdrop-filter). Overlay now renders outside `<header>` as a true full-screen layer; page scroll
  locks while open (Lenis stop + overflow hidden), Escape closes, menu links resume scroll before navigating.
- **2026‑11‑04** — Native scrollbar hidden (full-width page); `ScrollIndicator` draws a slim light-grey draggable
  thumb (hidden on touch devices). Fixed blank strip on collection card images (double offset + parallax range).
- **2026‑11‑04** — Nav reveal on scroll-up now slides smoothly (Tailwind v4 uses the CSS `translate` property, so the
  transition list must include `translate`, not `transform`; 900 ms ease-out). Card images: GSAP alone owns the
  parallax (img 120% tall, 0 → −1/6 of its height) so the frame is always covered — no top strip.
- **2026‑11‑04** — Hamburger menu reimagined (`SareeMenu`): five hanging sarees (one per scene's fabric) unroll from
  alternating top/bottom at slight tilts with a rolling-bolt highlight, folds, gold zari borders and an elastic
  settle, plus a feathered sheer silk band sweeping in from the left. Dark veil + ivory italic links rise in; header
  turns ivory while open. Close = reverse at 1.7×. GSAP timeline; reduced motion = fade.
- **2026‑11‑04** — Saree menu polish (owner: muddy/low texture): crops now from in-focus embroidery in the lower half
  of each scene (240vh bg, −84vh offset → no faces/skin) at ~1.7× instead of 2.6×; soft drape shading + woven grain
  (SVG noise + weave) + sheen sweep replace flat stripes; taller/wider overlapping drapes + deep maroon base (no gaps);
  after unrolling, drapes blur (7px) and dim so links read clearly.
- **2026‑11‑04** — Owner: menu crops still look like badly zoomed images. **Status: waiting on owner's generated
  saree textures** (one per scene) to replace the crops in `SareeMenu` DRAPES. Also tone down the gold focus box
  on the close (X) button in the same pass.
- **2026‑11‑04** — Owner supplied 5 saree textures (`assets/saree-textures/`, 1672×941 PNG, sharp, folds baked in).
  Converted to `public/menu/saree-{maroon,ivory,navy,black,yellow}.webp` (~300 KB each) and used for the menu
  drapes (bg `auto 130vh`, per-drape x slice + tint fallback); removed synthetic grain/weave, lighter shading.
  Close/menu button focus ring softened to a thin offset outline. Ideal future textures: portrait ≥1600×3200,
  vertically seamless, zari border along long edges.
- **2026‑11‑04** — Owner: roll-down/roll-up + square gold borders looked ugly. Menu rebuilt as a minimal **ghost silk**
  transition: five overlapping texture panels with fully feathered edges (mask-composite intersect, no borders/shadows)
  fade + drift in from blur, then soften (blur 8px, dim) behind ivory links. While open, each panel sways/ripples/
  drifts in a continuous breeze (GSAP yoyo transforms, staggered rhythms). Close = quick 0.5s fade of the whole layer.
  Note: don't tween background-position from a % value with GSAP (it converts to wrong px).
- **2026‑11‑04** — Owner: don't show the crisp silk phase. Menu now opens **full white → straight into the already-
  blurred silk** (white layer dissolves over 1.1s, slight 1.05→1 settle, breeze running from the start; links rise
  at 0.75s). Close: links/veil fade, wash to white, then the whole layer fades out.
- **2026‑11‑04** — White→blur made faster/smoother: white dissolves in 0.6s (sine.inOut) from 0.14s, links at 0.38s,
  whole open ≈1s; close ≈0.55s. will-change on white layer + drapes for GPU-smooth fades.
- **2026‑11‑04** — Owner: revert hamburger entirely to normal (no saree behind). `SareeMenu` removed; menu is the plain
  full-screen blush overlay again (ink italic links fade/rise in, scroll lock, Esc, links navigate). Saree textures kept
  (`assets/saree-textures/` originals, `public/menu/*.webp`) for the owner's next idea. **Status: waiting on new idea.**
- **2026‑11‑04** — Built **"Pick a Drape"** (owner idea from a jelly-physics site; owner: "jelly wobble = saree physics
  wobble"). Owner generated reference board (`assets/pickup-drape section/`), bundle top/edge textures and cut-outs.
  Rapier rigid bodies + fabric vertex deformation (not jelly: low restitution, layer lag, edge flutter, soft slump).
  Notes: drei ContactShadows rendered nothing on the transparent canvas → replaced with per-body blob shadows; bundle
  mass ≈0.38 so impulses must scale by `rb.mass()`; NeutralToneMapping keeps saree colours true. Verified desktop +
  390px mobile: drop-in, drag/throw, filter hop+fade, Unfold card, Shake, Reset, 60fps headless, no errors.
- **2026‑11‑04** — Matched the design board (`assets/pickup-drape section/`) more closely: bundles are now folded
  cloth (large rounded front fold, pillow + wrinkles, averaged normals) with the top's zari border wrapping over the
  fold; per-saree colour tints + lower env reflection for true jewel tones; camera lowered to ≈40° (board angle);
  jhumkas/bangles stay upright (tilt-locked) and earrings sway like pendulums; maroon drape floats mid-toss until
  grabbed/shaken (Reset restores); petals curled with base→tip colour. Composition pulled in to match the board.
  Known: black texture is warm-toned so it reads dark brown — a cooler/blacker texture would fix it.
- **2026‑11‑04** — Owner: removed jhumkas + bangles; 10 rose petals instead (6 on mobile), varied sizes, float down
  slowly and can be tossed. Jewellery models/colliders, upright/swing logic and `cut-jhumka`/`cut-bangles` assets deleted;
  static fallback shows scattered petals.
- **2026‑11‑04** — Silk shine + gold zari, physically based (owner: "not too much shine just for the sake of it"):
  zari pixels detected by hue/sat/value → metallic + smoother via roughness/metalness map, so only the gold threads
  glint and the glint moves with the drape's angle; silk ground is dielectric with anisotropic highlight along the
  weave (silk 0.55, organza 0.3), velvet uses soft sheen. Tint applied per-pixel to the ground only (sRGB maths — three's
  Color is linear!). Environment gets a warm room background so metal reflects warm light, not black. Yellow organza
  zari strength 0.15 (its ground is itself golden).
- **2026‑11‑04** — Owner rule: **a saree must never turn upside down.** Bundle rigid bodies are rotation-locked to yaw
  (`enabledRotations={[false,true,false]}`), so physics can never tip/flip them (shake, throws, stacking all stay
  top-up). Tilt is purely visual: a spring on a wrapper group leans the bundle into its motion and back flat; floaters
  hold a mid-toss lean. Owner: 3 float + 2 rest → `FLOATING = ['ivory','maroon','navy']` hover at staggered heights
  with yaw drift; black + yellow rest. Grab/Shake drops a floater, Reset re-floats.
- **2026‑11‑04** — Owner: picking up a saree should bend a little in the centre like lifting folded cloth. Added
  `uHold` vertex term: while dragged, ends droop (q.x² falloff, ≈0.42·halfHeight) and draw in slightly; spring k70/c9
  gives a small settle on pickup and relaxes flat on release. Firm mode uses 45% of the droop.
- **2026‑11‑04** — Owner: removed the control bar (hint + Firm/Soft/Shake/Unfold/Reset) — the interaction itself is the
  UI. Deleted firm mode, shake/reset command plumbing, entry registry, Unfold card + onPick. Fabric is always "soft".
  Held bend doubled (droop 0.85·halfHeight, z 0.14, draw-in 0.022).
- **2026‑11‑04** — Edge pickups (owner accepted the no-true-cloth-sim trade-off): grab point stored in the bundle's
  local frame (−1..1); droop is measured from the grab point (far side hangs most, centre grab = old arch), and the
  visual tilt lifts the grabbed side slightly (≈0.22 rad across width, 0.16 across depth, scaled by hold). Physics
  stays yaw-locked, so the never-upside-down rule holds.
- **2026‑11‑04** — Lighting: key light moved to the **top-right of the section** (+x, behind: `[7,9,-4]`), soft warm
  fill lower-left; main env Lightformer moved to match so silk/zari highlights agree. Blob shadows offset along
  `SHADOW_DIR` (−x, +z → down-left on screen) by 9% of footprint + 0.42·height, so lifted pieces cast farther.
- **2026‑11‑04** — Shadows rebuilt to match the board ("thick yet soft"): footprint-shaped rounded-rect sprites that turn
  with the body, two layers — **contact** (dense 0.62, tight blur, fades out within ~25cm of lift) + **penumbra**
  (wide blur, grows ×(1.12→1.82) and fades with height). Sprites keep >3× blur margin so overlaps show no seams.
  Petals use strength 0.45.
- **2026‑11‑04** — Petals blow away like feathers: a falling (non-hovering, not-held) bundle fires one air **gust** just
  before touchdown (vy < −1.6, y < 0.75·s) — power from fall speed, radius 3.4·s, falloff (1−d/r)^1.4; impulse mostly
  outward (4.2) with a light lift (0.8–1.3) + random tumble, scaled by petal mass so drag/low gravity give a feather
  drift. Picking a saree up gives a small draft too. Gust fires before contact so petals scatter from under the cloth.
  Petal spawn points moved off the floaters' footprints.
- **2026‑11‑04** — Gravity everywhere (owner: "all to have gravity and floating smoother"): `GRAVITY = 14` constant; floaters
  no longer use gravityScale 0 + direct setLinvel. They carry full gravity and are held by a levitation spring force
  (impulse = m·(g + 16·Δy − 6.2·vy)·dt; horizontal k5/c4.2; slow 0.9 Hz bob ±0.08) → sag-in, inertial bob, natural
  reaction to bumps; grabbing just ends the levitation. Petals gravity 0.35→0.6, drag 2.4→1.9.
- **2026‑11‑04** — Sarees feel heavy in the hand (`Entry.heavy`): carry follows the cursor with gain 5.5 (petals 13) and
  top speed 6.5 m/s, so it lags the hand; release keeps 55% of hand speed, capped at 5.5 m/s, upward ≤1.5 m/s; bundle
  linearDamping 0.95, angularDamping 2.2, friction 1.25 → lands with a thud, short slide, no skating/bouncing.
- **2026‑11‑04** — Petals feather-light: `PETAL_GRAVITY = 0.16`, linearDamping 3.2, angularDamping 1.1, plus an airborne
  flutter (gentle sinusoidal side-sway + tumble impulses while y > 0.12). Gust impulse raised (outward 10, lift 2–3.2)
  so a landing saree darts nearby petals away fast, then drag slows them into a slow floating settle.
- **2026‑11‑05** — Owner: section copy goes behind the 3D objects. In `DrapeSection` the headline/caption and the right-hand
  paragraph now render in a layer *below* the (transparent) canvas, so sarees and petals occlude the text; chips and the
  logo stay above. The "View Collection" link needs clicks, so it lives in the top overlay with an invisible twin
  of the paragraph (and an invisible link twin in the behind layer) keeping both layouts identical.
- **2026‑11‑05** — Petals redrawn from the owner's reference photo (cupped lotus petal, not flat): `usePetalGeometry` is a
  28×18 parametric surface (u base→tip, v edge→edge; width profile `sin(π·u^0.72)^0.85`, cup `0.11·|v|^1.7`, curl, ripples);
  collider is now 0.22·1.25 × 0.07 × 0.3·1.25. Texture painted per-pixel (deep `#d64270` rim/base/tip → pale `#fde4e9`
  centre + faint veins); material roughness 0.55, sheen, low env, `emissiveMap` = colour map @0.42 to mimic translucency.
  Bug found: floor shadow sprites (plane y≈0.004) cut through a resting petal's cupped bottom and showed as a grey
  lens in the pale centre — petal `ShadowBlob` now takes `y={-0.14}` so sprites sit below the cup.
- **2026‑11‑05** — Collision fixes (petal sank into a saree): the bundle's visual top (pillow `bulge` 0.09 + wrinkles) rose
  ~0.1 above its collider, so petals rested inside the cloth → bundle `RoundCuboidCollider` now taller by `BULGE_PAD`
  (0.06 each way, shifted up 0.06·s) to match the visible shape. Petals also stood on their edge against sarees →
  per-frame **settle torque** in `Petal` (cross(petalUp, worldUp)·2.6 when y < 0.5·s, 0.07 in open air so they still
  tumble) plus slight spin damping; verified by reading rigid-body state (all resting petals flat=1.00).
- **2026‑11‑05** — Owner saw the Pick-a-Drape canvas blank (text only) although fresh loads render fine in headless Chrome
  (no console errors) → most likely a dropped WebGL context after a long dev session / many HMR reloads. Added
  recovery: `DrapeScene` listens for `webglcontextlost` (preventDefault + `onContextLost`) and `DrapeSection` remounts the
  scene via a `key`; tested by forcing `WEBGL_lose_context.loseContext()` — scene rebuilds and renders in ~6 s.
  If it ever happens during dev, a hard refresh (⌘⇧R) also fixes it.
- **2026‑11‑05** — Stacked bundles bend (owner: "bend inwards a little when on top of another bundle"): `ctx.bundles` registry;
  each frame an un-held, non-floating bundle looks for a bundle directly beneath it (dy 0.3–0.95·s, my centre inside its
  footprint + 0.25) and passes that footprint (centre/half-extents in my local frame + relative yaw) as `uSup/uSupRot`.
  Vertex shader: distance outside the support rect → `smoothstep(0.02,1.15)`·`uSag`·0.62·halfY downward + 0.05 inward pull,
  so only the overhang drapes; `uSag` springs (k46/c9) to 1 when supported, 0 otherwise. Colliders unchanged (visual only).
  Verified by state: yellow resting on black at y 0.87 → sag 1, support offset (−1.09,−0.69).

## Next / ideas

- Ask owner for text-free renders at higher res (≥2400 px) for sharper large screens; current plates are 1672 px.
- Real store address/phone in footer; real collection pages behind CTAs (currently anchor to the grid).
- Fine-tune fabric polygons per scene with `?edit` if any edge looks off on owner's screen.
