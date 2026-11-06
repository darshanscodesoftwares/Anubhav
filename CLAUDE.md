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
- **Fabric maps are pre-baked**: run `node scripts/bake-drape-maps.mjs` after changing any saree texture or its tint/roughness/zari in `data.ts`. It writes `public/drape/{top,edge}-<id>-{col,rm}.webp` (needs the dev-only `puppeteer-core`).
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
  - `DrapeSection.tsx` — overlay UI (headline, minimal text filter chips Silk/Organza/Velvet/Bridal/Festive, "View Collection" link),
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
- **2026‑11‑05** — Stack bend fix (owner: "still not bending"): detection required *my centre* over the lower footprint, so a
  bundle hanging mostly off an edge (the case that most needs to bend) was ignored → now any footprint overlap counts
  (|offset| < 1.9·half). Bend is a hinge at the support edge: `pow(clamp(over/1.2),1.25)·1.5·halfY` + 0.08 inward.
- **2026‑11‑05** — Stack bend stronger ("still a little more"): hinge now `pow(clamp(over/0.95),1.1)·2.3·halfY` + 0.12 inward
  (was /1.2, 1.25, 1.5, 0.08) — the overhang slopes down visibly past the edge.
- **2026‑11‑05** — Yellow organza saree redrawn to match the owner's board photo (flat, a little hollow in the centre,
  folded layers): new optional `Saree.shape` (`BundleShape` in `fabric.ts`: h, hollow, rim, ridge, layers, wave) consumed by
  `makeBundleGeometry` — lower body (h 0.36 vs 0.5), centre dips 0.13, rim rises 0.12 (rolled, rounded at the very edge),
  rippled rim, sine-spaced ridges pushed outward along the side walls (5.5 layers). Per-saree thickness feeds `half`, the
  geometry and the collider (`bh`); other sarees keep the pillow. Rounding radii now clamp to the bundle's thickness.
- **2026‑11‑05** — Fresh-load lag fixed (owner: section loads slowly and the site stutters ~2 s after a reload). Measured on
  the production build with the Chrome profiler: one 359 ms stall, all inside three.js `texSubImage2D` (GPU texture
  uploads), plus the old per-pixel fabric colour pass that ran on the main thread on every load. Fixes: (1) the colour
  tint and roughness/metal maps are baked offline by `scripts/bake-drape-maps.mjs` instead of computed in the page;
  (2) faces with the same UV transform share one texture and material, and the hidden bottom/back faces reuse the plain
  edge texture (≈60 uploads → ≈40); (3) sarees mount one per animation frame, so no single frame stalls; (4) the scene
  mounts on `requestIdleCallback` once the section is near. Longest main-thread task went 359 ms → ~105 ms.
  Tried and reverted: pre-decoding textures with `Image.decode()` (no gain, delayed the scene).
- **2026‑11‑05** — Owner: "it glitches 2–3 times before coming into the section while I scroll there." Cause: my staggered
  mount (one bundle per frame) ran *during the scroll toward the section* (scene started 900 px away), so each saree's GPU
  upload landed as its own hitch. Fix = move all the heavy work to the quiet time after page load: `DrapeSection` mounts the
  scene ~1.2 s after `load` on an idle callback (fallback: 1500 px-away observer), and a `Warm` component inside the scene
  calls `gl.initTexture` for every texture in idle slices, then `gl.compileAsync` — so the first visible frame has nothing
  left to do. Frame recorder (headless, production build, wheel-scrolling hero → section): hitches >60 ms 1 → 0, worst frame
  400 ms → 17 ms; also 0 when scrolling immediately after load. Trade-off: those ~6 uploads (67–100 ms each in headless
  Chrome) now happen in the first ~3 s after load, while the visitor is still in the hero. Tried and reverted (no measured gain):
  `Image.decode()` first, and flipping to `ImageBitmap` (just moved the cost into `createImageBitmap`).
  Note: headless Chrome probably uses a software GL path, so absolute per-texture costs will differ on a real GPU.
- **2026‑11‑05** — Owner: make the filter chips minimal and less visible. `Pill` is now plain text (0.78rem, wide tracking) with a
  1.5 px colour dot — no white pill, border or shadow; 40 % opacity at rest, 80 % on hover, 90 % + a thin ink underline when
  active; tighter, wider-spaced row. Also: faded (non-matching) sarees now fade their floor shadow too (`strength` 0.22 when
  dimmed) — before, the contact shadow showed through the translucent cloth as a dark patch.
- **2026‑11‑05** — Owner: "dropped sarees should air-wave too, all sarees should always flow." The edge flutter (`uRipple`) was
  driven only by speed (hovering floors at 0.32), so landed bundles froze. Now every bundle has an always-on **breeze**:
  `breeze = 0.42 + 0.16·sin(0.5t) + 0.08·sin(1.3t)` (per-bundle phase) as the minimum ripple, plus a slow gust that
  nudges the upper layers (`lagTarget` ± 0.035 x / 0.03 z). Verified by comparing frames 2 s apart: a resting saree's
  top edge/corners and borders visibly move. Tune: the `0.42` base and the `0.035/0.03` sway in `DrapeScene.tsx`.
- **2026‑11‑05** — Double-click a saree → it levitates where it is (owner request). `Bundle` got `hoverAt` (x,z target for the
  levitation spring — floaters still use their start position) and an `onDoubleClick` on the mesh that sets `hoverAt` to the
  current spot and `hovering = true`; any single click/drag drops it again via the existing `release()`. Verified: dbl-click on
  the resting yellow saree → hovers with a detached shadow; single click → lands with a contact shadow.
- **2026‑11‑05** — Cursor push field for floating sarees (owner: "gentle push, small field, not too strong"). `World` projects the
  pointer onto the hover plane (y = 0.8·s) each frame into `ctx.cursor` {x,z,vx,vz,on} (smoothed velocity; `on` from the
  canvas' pointerenter/leave). In a hovering bundle's levitation block: if the cursor is within `R = 1.9·s` (xz) and nothing is
  being dragged, add an impulse away from the cursor `3.2·(1−d/R)²` m/s² plus 22 % of the cursor's velocity × the same falloff;
  the levitation spring eases it back. Verified: cursor held beside the floating maroon saree → ~27 px drift away, returns
  after the cursor leaves. Tune: `3.2`, `0.22` and `R` in `DrapeScene.tsx`.
  Bug found: `bowl ** 1.4` went NaN at the extreme wall edge (float error → tiny negative base) and drew black slivers
  down both side walls — clamp with `Math.max(0, …)` (found by bisecting: no shape → no slivers).
- **2026‑11‑05** — Cursor push field made stronger (owner: "make it stronger"): `R` 1.9→2.3·s, base push 3.2→7.5 m/s², cursor-velocity coupling 0.22→0.5 (`DrapeScene.tsx`). Levitation spring still eases sarees back; headless run: no console errors.
- **2026‑11‑05** — Owner: saree shadows landed inside nearby petals as a grey lens. Same cause as the earlier petal-cup bug: saree floor shadow sprites sat at y≈0.004 and cut through the cupped petal. `ShadowBlob` now defaults to `y = -0.14` for every body (the floor is invisible, so sprites sit below all petals); petals occlude the shadow instead of being cut by it. Trade-off: saree shadows don't darken petals.
- **2026‑11‑05** — Owner: a saree placed on a slight ledge of another floated there. Bundles are yaw-locked, so they can't tip; the support check in `Bundle` now also measures how far my centre is past the lower bundle's footprint edge (0.9 × half-extent, in its frame) and, when it is, pushes the bundle off the ledge (30 m/s² ramped over 0.3·s of overhang, beats friction 1.25·14) until it clears and drops. Verified by teleport test: centre 1.3 past → slid off and landed on the floor (y 0.18); centred on top → stayed (y 0.80). Tune: `0.9`, `30`.
- **2026‑11‑05** — Ledge slide-off was too eager (it pushed bundles that were still mostly supported). Now it only triggers when my centre is past the lower bundle's footprint edge (threshold 0.9→1.05 × half-extent) and ramps over 0.1·s at 24 m/s² (just above friction, so a real overhang slides off, a mostly-supported bundle never moves). Teleport test: centre ≥ ~1.2 past → slides to the floor; centre ≤ 1.0 → stays put. Tune: `1.05`, `0.1`, `24` in `DrapeScene.tsx`.
- **2026‑11‑05** — Ledge slide-off toned down further (owner: "even more"): threshold 1.05→1.28 × half-extent (only a sliver of support left), ramp 0.1→0.2·s, push 24→20 m/s² (barely above friction, so it creeps off instead of darting). Tune in `DrapeScene.tsx`.
- **2026‑11‑05** — Ledge slide-off threshold raised again (owner: "slips too easily"): 1.28→1.55 × half-extent, so a saree only slips when its centre is far past the edge (almost nothing under it).
- **2026‑11‑05** — Owner: all sarees use the yellow's flat/hollow/layered shape, slightly varied. Every `SAREES` entry in `data.ts` now has a `shape` (thickness h / hollow / rim / ridge / layers / wave): maroon 0.40·0.10·0.10·6.5 layers, ivory 0.34·0.14·0.13·5 (thinnest, deepest dip), navy 0.42·0.09·0.10·7 (thickest, plushest), black 0.38·0.11·0.11·6, yellow unchanged. Thickness feeds geometry, half-extents and colliders automatically. Headless render: no errors.
- **2026‑11‑05** — Owner: shorten the navbar. Past the hero (frosted/solid mode) the bar is now compact: logo `zoom: 0.68`, padding `pt-3 pb-2`, links `pt-1` → ≈75 px tall (was ≈130). The hero still shows the full-size logo; the full-screen menu state is unchanged. Edits in `Nav.tsx`.
- **2026‑11‑05** — Owner: align the compact navbar items on one centre line. In solid mode the header is `items-center` (equal `pt-3 pb-3`), links/menu have no top offset, so logo, links and hamburger share the bar's vertical centre (bar ≈79 px). Hero layout unchanged.
- **2026‑11‑05** — Owner: golds look washed out; reds/pinks too. `bake-drape-maps.mjs` now adds a **vibrance** pass after the tint: gold zari pixels (`goldness` mask) get saturation ×(1+0.7) and drift 35 % toward a true gold hue (≈42°); red/pink pixels (hue 316–360 & 0–16°, sat > 0.26) get ×(1+0.45); silk grounds and creams are untouched. Re-baked all `public/drape/{top,edge}-*-col.webp`. Tune `GOLD_SAT` / `RED_SAT` in the script and re-run it. Zari metalness/roughness maps unchanged.
- **2026‑11‑05** — Owner: make the black saree match `assets/Transparent cut-outs…/Black Silk Saree with Gold Zari Embroidery.png` (black ground, crimson florals, gold sprigs, crimson + gold border). Rectified that photo's top face to a flat 1254² texture with a homography warp (quad corners in image px: (118,444) (690,25) (1450,470) (892,962) → TL,TR,BR,BL; border ends at the bottom/front) and installed it as `public/drape/top-black.webp`; the old black top texture (`Black Silk Brocade with Crimson Florals.png`) is still in `assets/`. Black tint `#5a5c66` → `#dcdce2` (the old tint was darkening the reds to brown); re-baked. Edge texture unchanged. If liked, repeat for the other four sarees from their cut-outs.
- **2026‑11‑05** — Owner: navy saree to match `Embroidered Navy Velvet Saree Fold.png`, with **red gems in every flower centre** (like `assets/saree-textures/5th Navy Silk…`). Same method as the black saree: homography-rectified the cut-out's top face (corners (98,432) (690,15) (1470,478) (888,968)), then painted ten ruby cabochons (gold bezel, dark socket, facets, white glint) over the pearl centres at hand-picked positions (radius 4–10 px at 700 px scale) → `public/drape/top-navy.webp`. Navy tint `#a3abf2` → `#dcdfff` so the rubies stay red; re-baked. Edge texture unchanged.
- **2026‑11‑05** — Owner: maroon saree to match `Folded Maroon Silk Saree with Gold Brocade.png` (the Bundle-textures brocade was the old source). Same recipe: homography-rectified the cut-out's top face (corners (122,436) (690,34) (1428,445) (878,934)) → `public/drape/top-maroon.webp` (deep wine ground, sparse gold buttas, wide gold border at the front). Tint `#f7c4cc` → `#d2c0c6` (keeps the ground burgundy under the scene lights); re-baked. The old, denser vine texture (`Maroon Silk Gold Floral Zari Brocade.png`) is still in `assets/` if the owner prefers it.
- **2026‑11‑05** — Owner: ivory organza saree to match `Ivory Organza Sari with Pink Floral Embroidery.png`. Same recipe: rectified the cut-out's top face (corners (100,432) (662,34) (1432,466) (856,940)) → `public/drape/top-ivory.webp` (cream tissue organza, pink resham florals with gold sprigs, wide gold border and pink piping at the front fold). Tint was already white; re-baked. The old denser texture (`Ornate Pink and Gold Floral Embroidery.png`) stays in `assets/`. Black, navy, maroon and ivory now come from cut-outs; yellow is the remaining original.
- **2026‑11‑05** — Owner: yellow organza to match `Golden Embroidered Organza Saree Fold.png`. Rectified the cut-out's top face (corners (98,470) (708,26) (1468,490) (878,968)) → `public/drape/top-yellow.webp` (golden organza, ivory-white resham florals, pearl centres, ivory embroidered border with gold lattice at the front). The bake's gold vibrance is now skipped for sarees with `zari` ≤ 0.5 (yellow's *ground* is itself gold-hued and was being pushed orange). Re-baked all. **All five sarees now come from the owner's cut-outs**; the older tops from `assets/Bundle textures…` / `assets/saree-textures/` remain as alternates, and the five edge textures are still the originals.
- **2026‑11‑05** — Owner: turn the saree saturation down a little. Vibrance in `bake-drape-maps.mjs`: `GOLD_SAT` 0.7→0.4, `RED_SAT` 0.45→0.25 (still above the original textures); re-baked all `-col.webp`.
- **2026‑11‑05** — Owner: petals on a flowing saree should react and fall off (saree-on-saree see-through explicitly *not* wanted). The cloth's ripple is shader-only, so `Bundle`'s frame now mirrors the shader wave on the CPU for any petal over the bundle's footprint (|q| < 1.2, within −0.12…+0.3·s of the top): lifts it while the cloth under it rises (`max(0, vel)·40`), slides it down the wave's slope (`−grad·70`) and sheds it outward off the flapping edge (`edge·ripple·16`), all as per-frame impulses scaled by petal mass. Skipped while the saree is being held. Verified by teleport test: a petal dropped near the edge slid off and landed on the floor within ~2.5 s; one dropped near the centre wandered ~4 s then slid off. Tune the three gains in `DrapeScene.tsx` (look for `Petals ride the moving cloth`).
- **2026‑11‑05** — Owner: petal shadow shape + a greenish-yellow base (ref: `Dewy Pink Rose Petal.png`). (1) `ShadowBlob` got a `petal` flag: its sprites are a rounded teardrop (`makePetalShadowTex`, pointed tip toward +z) sized 0.5·s × 0.68·s instead of the 0.42·s rounded square, in both the contact and penumbra layers. (2) `makePetalTexture` blends the very base (u < ≈0.34, centre line, fading out to the sides) toward a greenish yellow `rgb(228,222,104)`, like a real rose petal where it joins the flower. Tune the `yg` mask / colour in `models.tsx`.
- **2026‑11‑05** — Owner: yellow was on the wrong end, and the petal should look exactly like `Dewy Pink Rose Petal.png`. The petal now **wears the photo**: `scripts`-free prep (headless canvas) rotated/cropped the cut-out so the pointed yellow base is at u = 0 → `public/drape/petal-dewy.webp` (524×640, transparent outside the petal, ~100 KB). `models.tsx`: the parametric surface is now a full-width patch (`WID` 0.51 = 0.82·`LEN`, with the cup/curl/ripple kept) and `petalMaterial` uses the photo as `map` with `alphaTest 0.5`, so the transparency cuts the real outline; the painted canvas texture and the yellow-green blend were removed. Emissive 0.42→0.16 so the pink isn't washed out. Petal shadow sprite redrawn as a broad rounded body with a gentle point at the base (−z), 0.56·s × 0.68·s.
- **2026‑11‑05** — Owner: the flat petal photo looked copy-pasted from other angles. Petals are now **view-dependent billboards** built from `Pink Rose Petal Animation Grid.png` (12 views of one petal, face-on → edge-on). A headless-canvas prep step keyed out the baked white/grey background (flood-fill from the border, 1 px soft edge), rotated each view so the yellow base points down, centred it on its centroid and packed them, ordered by visible area, into `public/drape/petal-atlas.webp` (4×3 cells of 300 px, ~78 KB). In `Petal`, a plane mesh sibling of the rigid body (shared `petalSpriteMat`, `alphaTest 0.3`, per-petal geometry whose UVs are rewritten only when the frame changes) faces the camera each frame, spins so base→tip matches the petal's screen direction, picks the view from `|petalUp·toCamera|` (idx = round((1−c)^0.9·0.95·11)) and mirrors it for the underside / opposite tilt; nudged 0.1·s toward the camera so it doesn't sink into sarees. Colliders and the teardrop shadow are unchanged. `models.tsx` now only exports `petalAtlas` (the parametric mesh, painted texture and the single-photo `petal-dewy.webp` were removed). Not yet blended between neighbouring views, so a tumbling petal switches view in steps.
- **2026‑11‑05** — Owner: petal views looked like 2D frame snapping. Petals now **blend and ease**: the shared basic material became a per-petal `ShaderMaterial` (`makePetalMaterial`) that samples two neighbouring atlas views and cross-fades them (premultiplied so different outlines blend; alpha cut at 0.32). The continuous view position `f`, the screen spin (`rot`, shortest-angle) and the mirror (`sx`, eased ±1 so it turns through edge-on) are exponentially smoothed with the frame delta (rates 9 / 14 / 10 per s). Tune those rates in `Petal` (`fdt`). Still only 12 source views, so a very fast tumble can look steppy; more views would need another render grid.
- **2026‑11‑05** — Owner: "create an actual 3D petal from what we got". Petals are now **real 3D meshes** again, but built from the photo set: `usePetalGeometry` (40×30 patch, `models.tsx`) is bent like the photographed petal — pinched base, cupped body with rising edges, lengthwise bow, tip curling back, rippled rim and a rolled-over right side (as in the grid's folded views) — and `petalMaterial` (MeshPhysicalMaterial, sheen, faint emissive 0.14) uses `public/drape/petal-face.webp` (face-on view from the grid at native res, 310×336, transparent outside) as colour map with `alphaTest 0.4`, so the photo's alpha cuts the rounded outline. Because it is lit geometry it shades correctly from any direction and tumbles with physics (no view-picking, no frame snapping). The billboard-sprite atlas version is in git (`5c5ae76`) if wanted back; `petal-atlas.webp` was removed. Collider (0.275·s × 0.07·s × 0.375·s half-extents) and the teardrop shadow unchanged; mesh scale = `s`.
- **2026‑11‑05** — Owner: revert the petal work. `DrapeScene.tsx` and `models.tsx` restored to `89bdb56` (painted-canvas petal mesh, teardrop shadow, greenish-yellow base); the photo petal, 12-view sprite petals and 3D photo petal (`cb155ba`…`0e70380`, in git history) are no longer in use, and `public/drape/petal-face.webp` was removed. Kept: all saree changes, and the owner's `Pink Rose Petal Animation Grid.png` asset. Note: in that version the yellow sits on the u = 0 end, which the owner earlier said was the wrong end.
- **2026‑11‑05** — Owner: move the greenish-yellow to the opposite end of the petal. In `makePetalTexture` the `yg` mask now uses `1 - u` (yellow at the pointed `u = 1` end instead of the `u = 0` end).
- **2026‑11‑05** — Owner: tone the petal's greenish-yellow down and whiter: colour `rgb(228,222,104)` → `rgb(242,238,172)`, strength ×1.1 → ×0.85 (`yg` mix in `makePetalTexture`).
- **2026‑11‑05** — Owner: petal lines looked like onion peels. In `makePetalTexture` the veins are now a low-frequency, smooth wave (`sin(v·(2.2+3.2u)·3.1 + warp)`, ≈ 7–17 soft ridges instead of 20–50 hard ones), without the `ss` step and at 0.05 amplitude (was 0.09), so the petal shows gentle shading instead of stripes. Tune `vein`/`streak` in `models.tsx`.
- **2026‑11‑05** — Owner: the logo lingered on top of the next section as the hero scrolled away. `Nav` now tracks `leaving` (scroll > pin end + 30 px): in hero mode the logo fades out in 200 ms and becomes non-interactive (it still shows on the last scene at rest, and fades back in 500 ms in the solid/scroll-up bar). Checked: opacity 1 at the pin end, 0 by +60 px.
- **2026‑11‑05** — Owner: resting petals looked floaty. Cause: their shadow sprites sat 0.14 below the floor (to dodge the old cup-intersection bug), which on the ≈40° camera pushes the shadow visibly away from the petal. Petal `ShadowBlob` is now `y = -0.04` (just under the mesh's lowest point, ≈ −0.01·s) with strength 0.45→0.62, so the contact shadow hugs the petal. No grey cup artefact in the render.
- **2026‑11‑05** — Owner: resting sarees looked floaty too. Same cause as the petals: `ShadowBlob` default `y` was −0.14 (below the floor), shifting the shadow away on the ≈40° camera. Default is now `−0.03` (just under the floor; a saree's underside rests on it and a petal's lowest point is ≈ −0.01·s, so nothing is cut), and the contact layer's peak opacity 0.62→0.7 so a landed saree has a firmer dark seam under it. Floating sarees keep their detached, softer shadow.
- **2026‑11‑05** — Owner: resting sarees still looked floaty (suspected gravity). Measured the rigid bodies: black rests at y 0.189 and yellow at 0.179 with zero velocity — exactly half their thickness, so they *are* on the floor; only floaters levitate. The floaty read was purely visual (no dark line where the rounded underside meets the floor). `ShadowBlob` got a third layer, the **contact seam**: a tight, un-offset, footprint-sized dark sprite (0.98× footprint, opacity 0.6·touch², i.e. only when really resting) drawn just above the offset contact/penumbra layers. Tune the `0.6` / `0.98` in `ShadowBlob`.
- **2026‑11‑05** — Owner: bundles should sit flat on the surface like real folded cloth. `makeBundleGeometry` (`fabric.ts`) now scales the rounding radius by `flat = 0.22 + 0.78·smoothstep(0…0.5 of the height)`: the bottom edge is only ≈ 22 % as rounded as before (a flat underside that meets the floor along its whole footprint), blending back to the full pillow/fold rounding toward the top. Collider unchanged (its flat bottom face already rested at the right height). Applies to all five sarees; the thin shapes (yellow, ivory) show it most.
- **2026‑11‑05** — Owner: shadows a little sharper and longer toward the left. `SHADOW_DIR` (−0.78, 0.62) → (−0.9, 0.42) (more purely leftward); contact offset 0.05→0.15 and penumbra offset 0.12→0.30 of the footprint (+0.5 per unit of lift, was 0.42); core sprite 1.12×/1.1×, penumbra spread 1.12→1.22; sharper falloff: blur CORE 7→4, SOFT 46→34, petal core 5→4, petal soft 34→28.
- **2026‑11‑05** — Owner: shadows were too hard; wanted soft, lengthy ones like the board. Kept the length/direction, softened: blur CORE 4→11, SOFT 34→50, petal 4→9 / 28→42; opacities core 0.7→0.5, penumbra 0.42→0.4, seam 0.6→0.4; penumbra offset 0.3→0.36·size and spread 1.22→1.3 so it reaches further left. SOFT canvas margin is ≈3σ (154 px vs σ 50) — don't raise that blur without enlarging the canvas or lowering `frac`.
- **2026‑11‑05** — Owner: the site must always start at the top of the hero after a reload or any fresh start. Added an inline script at the top of `index.html` (runs before React): `history.scrollRestoration = 'manual'`, strips any `#hash` with `replaceState` (so `/#collections` no longer jumps), reloads on a back/forward-cache restore (`pageshow` persisted) and scrolls to 0 on `beforeunload`; `App.onReady` also calls `scrollTo(0,0)` right before the loader lifts. Verified headless: reload from the drapes section and from mid-hero → scrollY 0; fresh load of `/#collections` → scrollY 0, hash cleared. (In-page menu links still scroll to their sections — they don't change the URL.)
- **2026‑11‑05** — Owner: sarees drop abruptly; wanted a majestically smooth descent. In `Bundle`'s frame, a falling (not held, not levitating) bundle gets a **terminal speed**: `vt = lerp(0.45, 1.7, smoothstep(height above rest, 0.04…0.9))` m/s, enforced with a stiff upward impulse (`40·(−vt − vy)·m·dt`, strong enough to beat gravity 14), so it falls at ≈1.7 m/s, slows over the last ~0.9 units and touches down at < 0.5 m/s instead of a thud. Applies to the opening drop-in (staggered start heights 2.6 + 0.75·i → each lands over ≈1.5–3 s) and to released/tossed sarees. Measured (headless): fall from 2.8 at ≈2.1 m/s (first version, 1.7 after the retune), eased to 0.66 m/s at 0.2 above the floor, then at rest at 0.19. Tune `0.45`, `1.7`, `0.9` in `DrapeScene.tsx`.
- **2026‑11‑05** — Owner supplied a screenshot of the arrangement they want and asked for a slightly faster smooth drop. `LAYOUT.saree` (normalised floor coords) was re-fitted by comparing screen fractions: maroon (0.1, 0.11), ivory (−0.39, −0.04), navy (0.55, −0.18), black (−0.2, 0.68), yellow (0.38, 0.42); `ry` unchanged. (Rule of thumb on the ≈40° camera: ≈0.6 screen-width per unit x, ≈0.5–0.6 screen-height per unit z.) Terminal speed raised 1.7→2.4 m/s and its floor-contact speed 0.45→0.6 (still eases over the last ~0.9 units).
- **2026‑11‑05** — Owner: ivory (white) saree should land more to the right, next to the "a" of "Pick a". `LAYOUT.saree` ivory x −0.39 → −0.29 (z unchanged); it now sits just right of the headline instead of covering the "a".
- **2026‑11‑05** — Owner: petals clustered against the sarees; use the petal positions from their screenshot as the falling spots. `LAYOUT.petal` re-fitted (normalised floor coords, same screen→floor fit as the sarees: x = (fx−0.32)/0.607 − 0.29, z = (fy−0.21)/0.523 − 0.18): (−0.66,−0.3), (0.76,0.21), (−0.54,0.4), (−0.02,0.58), (0.3,−0.42), (−0.47,0.88), (−0.76,0.31), (−0.14,0.3), (0.09,0.61), (0.81,0.85); sizes `k` unchanged. Two back-row petals were nudged outward after a test render showed them landing behind the ivory and maroon sarees. Petals still drift a little when a saree lands (gust), so final resting spots are close to, not exactly, these.
- **2026‑11‑05** — Owner: two petals fell stuck together. Petals now repel each other softly: in `Petal`'s frame, any other petal within 0.8·s horizontally and 0.45·s vertically adds a push apart (`(1 − d/R)^1.5`, ×7 horizontally, ×3 vertically, scaled by mass; exactly-coincident petals split along a per-petal angle), so they ease apart while falling and when settling. Spawn height stagger 0.45→0.7 per petal. Headless check over 12 s: closest horizontal approach of two petals at similar height was 1.59 units (a petal is ≈ 0.55 wide). Tune `R`, `7`, `3` in `DrapeScene.tsx`.
- **2026‑11‑05** — Owner: a petal snapped to a position while falling. Cause: two hard switches in `Petal`'s frame — the levelling torque jumped from 0.07× to 1× when the petal crossed y = 0.5·s (so it flipped flat in one go), and the air flutter cut off abruptly at y = 0.12. Both are now smooth: levelling = `0.07 + 0.93·(1 − smoothstep(y, 0.15·s, 1.2·s))`, flutter scaled by `smoothstep(y, 0.05, 0.4)`. Verified by tracking a petal dropped from 2.4 with spin: largest rotation step 2.1° per 50 ms (at launch), then < 1° through the whole fall and landing.
- **2026‑11‑05** — Owner: add one more petal at the lower right (left of "A soft study of silk"). `LAYOUT.petal` now has 11 entries (new: x 0.36, z 0.95, k 1.15). Found while testing: late-index petals were still in the air after 9 s because spawn height grew with the index (`2.6 + i·0.7`; a petal's terminal speed is only ≈ 0.7 m/s) → spawn height is now `2.4 + (i % 5)·0.55`, so every petal has landed within ≈ 7 s. Small screens still use the first 6.
- **2026‑11‑05** — Owner: anime-style 2D "tension arcs" while picking up a saree. `DrapeSection` renders a pointer-less overlay (`z-[5]`, above the canvas) with two spans, each an SVG of two nested curved strokes (ink `#3a2418`, round caps; the right one mirrored). `DrapeScene` takes it as the `arcs` prop and `ActionMarks` (inside `World`) drives the two elements each frame with no React state: while a *heavy* entry (a saree) is dragged it projects the body and a point 1.2·s to the camera's right to find the bundle's on-screen half-width, places the arcs `hw + 20 px` out on both sides, makes them tremble (random ±0.7–2.1 px jitter + 82–100 % flicker), lean with horizontal hand velocity (≤16°), trail opposite the motion, sway (`sin(6.2t)`, 2.5–7.5°), scale 0.9–1.25 with speed and pop in from 0.6; they ease in (rate 18/s) and fade out (9/s) on release. The held bundle itself also gets a faint tremble and slow sway in its visual tilt (`S.hold·0.004 + shake·0.006` rad at ≈ 55–60 rad/s, sway ≤ 0.014 rad). Verified headless: arcs flank the dragged saree, lean while moving, opacity 0 after release, no console errors. Tune in `ActionMarks` and the SVG in `DrapeSection`.
- **2026‑11‑05** — Owner: make 2–3 random petals smaller. `LAYOUT.petal` sizes `k` for three petals lowered: (−0.54, 0.4) 1.1→0.62, (−0.47, 0.88) 1.05→0.58, (0.09, 0.61) 1.0→0.66 (mesh, collider and shadow all scale with `k`).
- **2026‑11‑05** — Owner: arcs sharp and crisp, pulse instead of vibration, small arc first / big arc second. `ActionMarks`: no random jitter or flicker any more; positions are rounded to whole pixels, there is no scale transform and no `will-change` (both blurred the thin strokes), stroke `#2c1a10` 2.6 with `geometricPrecision`. Each side's two strokes now loop an outward slip on their own SVG paths: the small inner arc moves out up to 3.5 px at ≈1.6 Hz and the big outer arc follows 1.7 rad (~0.27 cycle) later up to 4.5 px — a ripple travelling outward. The held saree's 55 Hz visual tremble was removed too (`vib = 0`); its slow sway stays. Tune `pulseSmall` / `pulseBig` in `ActionMarks`.
- **2026‑11‑05** — Owner (reference: a small arc, then a bigger arc beside it): the tension arcs are now two separate strokes with a clear gap instead of nested ones. SVG in `DrapeSection` is 44×64: big outer arc `M17 6 C 3 20, 3 44, 17 58`, small inner arc `M38 23 C 32 29, 32 35, 38 41` (the right side is mirrored, so on both sides the small arc is nearest the saree and the big one outermost); the existing staggered pulse still applies (small first, big a beat later). Arcs sit `hw + 20 px` from the bundle's edge.
- **2026‑11‑05** — Owner generated the arc artwork (`assets/pickup-drape section/Golden Ripple Arcs.png`: a transparent PNG with a small and a big gold quarter-arc). A headless-canvas prep step split it into its two connected pieces on a shared 238×232 canvas, recoloured to the artwork's gold `rgb(176,137,79)` and wrote `public/drape/arc-big.png` and `arc-small.png` (≈ 9 KB / 8 KB). The SVG strokes in `DrapeSection` were replaced by these two `<img>`s per side (60×58 px; the left side is mirrored with `[&_img]:-scale-x-100`; the artwork emanates toward the upper outer corner). `ActionMarks` keeps its logic: arcs `hw + 26 px` from the bundle's edge and 16 px above its centre, small arc then big arc pulsing outward along the artwork's diagonal (3.5 / 4.5 px, big one 1.7 rad later), leaning and fading as before. (Earlier the right-hand group still had the old nested SVG; both sides now share the same artwork.)
- **2026‑11‑05** — Owner: arcs small, minimal and as invisible as possible. Images 60×58 → 34×33 px, overall opacity ×0.55, pulse travel 3.5/4.5 → 2/2.6 px, placed `hw + 16 px` out and 10 px above the bundle centre (was +26 / 16), trail 0.5×. Tune the `0.55`, the sizes in `DrapeSection` and the offsets in `ActionMarks`.
- **2026‑11‑06** — Owner: petals should fly even more smoothly when a saree lands nearby. The gust was a single impulse (instant velocity jump). `World.gust` now just records a gust event; a `useFrame` in `World` turns each into an **expanding pressure wave**: the front reaches the radius in 0.3 s and each petal is pushed by a `sin²` bump of width 0.55 s as the front passes it (nearer petals first, a visible ripple outward), with the same total impulse (`∫env = D/2`, scaled ×2.6 horizontally / ×2.3 vertically to compensate for the petals' linear damping 3.2, which eats a spread-out push). Per-petal torque is deterministic (sin of the petal id + gust time). Measured (headless, saree dropped 2.3 units from a petal): speed 0 → 1.9 m/s over ≈0.3 s then decays over ≈0.6 s; largest change 0.30 m/s per 33 ms (the old kick jumped by the full amount in one frame). Tune `FRONT`, `D`, `26`, `6` in `DrapeScene.tsx` (look for `pressure wave`).
- **2026‑11‑06** — Owner: the ivory saree's flowers look 3D — try that on the other flowered sarees (revert if not good). Added embroidery **relief** to every saree face material: `bumpMap` = the colour map itself (same cloned texture, so no extra GPU upload; embroidery/zari is brighter than the ground so its red channel works as a height map) with per-saree `BUMP` strength (`DrapeScene.tsx`): maroon 2.2, ivory 0.8, navy 2.6, black 2.4, yellow 1.4. Flowers and zari now catch the key light like raised thread. To undo: remove the `bumpMap`/`bumpScale` lines in `face()` (this is a single commit).
- **2026‑11‑06** — Owner: relief "even more". `BUMP` strengths doubled: maroon 5, ivory 1.8, navy 6, black 5.5, yellow 3.2.
- **2026‑11‑06** — Owner: relief on the navy saree too, "even more". Replaced the colour-map-as-height trick on the top faces with **dedicated height maps** baked by `bake-drape-maps.mjs` (`bakeHeight` → `public/drape/top-<id>-h.webp`, grayscale in the page canvas): luminance of the original texture, high-passed (`0.45·blur2.2 + 0.55·blur6 − blur28`, ×2.4, plus a little fine detail) so motifs stand out of the ground whatever its colour and each reads as a domed cushion. `face()` uses it as `bumpMap` for top faces (edge faces still use the colour map); the `Warm` texture list includes `bumpMap`. `BUMP` strengths raised: maroon 7, ivory 3, navy 9, black 8, yellow 5. Side effects seen in the render: velvet/silk grounds now show a little fabric crinkle, and the black saree's red flowers get faint pink rim highlights. Lower `BUMP` (or the ×2.4 in `bakeHeight`) if it reads rough.
- **2026‑11‑06** — Owner: relief "slightly less". `BUMP` reduced ≈25 %: maroon 5.2, ivory 2.3, navy 6.8, black 6, yellow 3.8.
- **2026‑11‑06** — Owner: relief a little less again. `BUMP` ≈ −27 %: maroon 3.8, ivory 1.7, navy 5, black 4.4, yellow 2.8.
- **2026‑11‑06** — Owner: **Collections section replaced** (old "Curated for you" 4-card block removed) to follow `assets/collection-section/Saree Atelier_ Eight Elegant Portraits.png`, in the site's own fonts and with minimal copy. New `src/data/collection.ts` (`FILTERS`, `PIECES`: id, name, price, three notes, tags) and a rewritten `Collections` in `Collections.tsx`: gold letter-spaced kicker "Collections" + big italic serif "Sarees" + hairline rule + one line; text filter chips All / Silk / Organza / Banarasi / Velvet / Festive (active = soft gold pill); 8 portrait cards (4 columns desktop, 2 mobile) with a hairline under each cut-out, name in serif, price, `a | b | c` notes and a save-heart (local state); GSAP scroll reveal, and cards rise in again on every filter change (`ScrollTrigger.refresh()` after). Portraits: the owner's `saree-menu-collection/*.png` → `public/collection/<id>.webp` (760×832, ~100–200 KB each, transparent). Six of the eight PNGs had a **solid black background, not real transparency** — keyed out in a headless-canvas prep step (flood from the top/sides through pixels with max channel ≤ 5, 80 % down the sides only so dark saree fabric at the bottom isn't eaten; 1 px rim feathered). File → piece: Maroon Banarasi → Gulmohar, Elegant Indian Saree → Noor, Jasmine Gajra → Rajshree, Mustard → Swarna, Green → Kaveri, Lilac → Madhavi, Elegant South Asian Saree → Veena, Purple → Nilambari. Names, prices and tags are the board's placeholders. The reference's "Sort by" and the board's own nav bar were left out (minimal). `#atelier` / `#about` still live in the Footer.
- **2026‑11‑06** — Owner: the collection cut-outs had rough, dark edges. Re-cut all eight portraits at full resolution (1199 px) with a proper matting pass in a headless canvas: foreground mask (real alpha, or the flood-keyed black backdrop, threshold ≤ 9), speck removal (foreground bits < 1500 px dropped, pinholes < 600 px filled), 2 px erosion to kill the dark rim, a 1 px feathered alpha, and **colour de-fringing** (edge pixels take their colour from the solid interior just inside via a normalised blur), then downscaled to 820×897 WebP (~150 KB each). Checked at 2× on the page: no dark outline, smooth hair/saree edges. (The prep script lived in the scratchpad; to redo, re-key from `assets/collection-section/saree-menu-collection/*.png` the same way.)
- **2026‑11‑06** — Owner: swap the Rajshree Velvet portrait for `assets/collection-section/saree-menu-collection/Indian Woman in Embroidered Navy Saree.png` (this one has real transparency; the old `Serene Jasmine Gajra Portrait.png` was removed from `assets/`). Re-cut with the same matting pass → `public/collection/rajshree.webp` (820×897). File → piece map otherwise unchanged.
- **2026‑11‑06** — Owner: Veena Chikankari portrait replaced with `assets/collection-section/saree-menu-collection/Elegant Saree Portrait with Gold Jhumkas.png` — re-cut with the same matting pass → `public/collection/veena.webp` (820×897). The earlier source file for that slot (`Elegant South Asian Saree Portrait.png`) is no longer used.
- **2026‑11‑06** — Owner: Kaveri Kanchipuram portrait replaced with `assets/collection-section/saree-menu-collection/Elegant Indian Woman in Green and Gold Saree.png` → re-cut → `public/collection/kaveri.webp` (820×897).
- **2026‑11‑06** — Owner: cinematic saree reveal on hover — **trial on Kaveri Kanchipuram only**. Assets from `assets/collection-section/saree-hover-transition/` (the 2 supplied stills; the existing portrait is pose 0) matted like the other portraits → `public/collection/kaveri-b.webp` (pallu flourish) and `kaveri-c.webp` (full drape), 820×897. `Piece` got optional `poses: [b, c]` (`data/collection.ts`). `PieceImage` in `Collections.tsx` layers the three stills in the same frame (all `object-contain object-bottom`, so alignment holds) and drives one **GSAP timeline** (`paused`, hover → `play()`, leave → `timeScale(1.7).reverse()`, also on focus/blur): portrait eases out (−3 % x, ×1.03) while the flourish drifts in (+3 % → 0, ×1.04 → 1) over ≈0.8 s; then the full drape is revealed by a soft **mask wipe** (`mask-image: linear-gradient(104deg, #000 calc(var(--wipe)·1% − 13%), transparent calc(var(--wipe)·1% + 13%))` with GSAP tweening `--wipe` −34 → 134 over 1.35 s from t = 0.55) while it settles from ×1.045 / +2.5 % x; the flourish fades out 0.95–1.65 s so the overlap isn't a double exposure. Reduced motion → 0.35 s plain cross-fade portrait → full drape. Pieces without `poses` keep the old subtle hover scale. Verified headless (frames at hover and after leave: flourish → wipe → full drape, then back to the portrait). To extend to other cards: add the two stills as `<id>-b|c.webp` and a `poses` entry.
- **2026‑11‑06** — Owner: hover reveal "good, make it buttery". `PieceImage` smoothing: (1) the flourish pose now carries the **complementary** mask of the full-drape pose, both driven by the same `--wipe`, so the sweep is a true directional cross-dissolve (before, the flourish faded separately and a ghost of its face showed through the soft edge); (2) one overlapping timeline with sine ease-in-out on the wipe (1.7 s), `sine.out` for the flourish arrival, `expo.out` settle (2.0 s) and a slight counter-drift of the flourish (−2 %, ×1.015) as it's wiped away; (3) layers get `transform-gpu` + `will-change`, and the two extra poses load with `decoding="async"` and no lazy-loading so the first hover never pops in. Verified headless: mid-sweep frame shows only the trailing edge of the flourish, no double exposure.
- **2026‑11‑06** — Owner: remove the **Atelier** nav link, keep **About**. `Nav.tsx` `LINKS` is now Collections / About (the full-screen menu uses the same list); the footer address block lost its unused `#atelier` id. The planned Atelier craft-story section is dropped from the queue unless the owner brings it back.
- **2026‑11‑06** — Owner: hamburger only on mobile. `Nav.tsx`: the menu button and the full-screen overlay are `md:hidden` (desktop shows just the Collections / About links); a `matchMedia('(min-width: 768px)')` listener closes the overlay (and so releases the scroll lock) if the window grows past `md` while it is open.
- **2026‑11‑06** — Owner: add the Pick a Drape section to the top nav. `Nav.tsx` `LINKS` is now Pick a Drape (`#drapes`) / Collections / About, in page order; the mobile full-screen menu uses the same list.
- **2026‑11‑06** — Owner: sarees should be able to rest **tilted on another saree**, like their screenshot (ivory leaning over the black). Bodies stay flat and yaw-locked (never-upside-down rule intact), so it's a visual lean: the support check now also records the overhang past 55 % of the lower bundle's half-extent (`lx, lz`, world space), eased into `S.leanX/Z` (12 %/frame so it never jumps when the support is found or lost), and the tilt targets add `±0.3·lean` (clamp ±0.5 rad) so the overhanging side dips toward the ground while it rests (+x-rot drops +z, −z-rot drops +x). The existing slide-off (centre ≥ 1.55 × half-extent past the edge) is unchanged, so a saree leans from 0.55 and only slides when almost nothing is under it. Verified headless: yellow placed with its centre 1.0 past black's centre settled on top (y 0.68) and leans out toward the overhang. Tune `0.55` / `0.3` in `DrapeScene.tsx`.
- **2026‑11‑06** — Owner: edge-rest tilt "slightly less". Lean gain 0.3 → 0.2 and the tilt clamp ±0.5 → ±0.34 rad (≈ 19° max) in `Bundle`'s tilt targets.
- **2026‑11‑06** — Owner: "activate edge slide off too" (alongside the new edge lean). Slide-off threshold 1.55 → 1.2 × half-extent (≈ 1.32 units for the 2.2-wide bundles); ramp/push unchanged (0.2·s ramp, 20 m/s²). Teleport test (yellow on black, centre offset in world units): 1.1 and 1.25 → rests on top, leaning; 1.4 → slides off and lands beside. So a saree now leans from 0.55 and slides once its centre is ≈ 1.3 units past the lower one's centre. Tune the `1.2` in the ledge code of `DrapeScene.tsx`.
- **2026‑11‑06** — Owner: lower the edge tilt more, and the edge "bounce". Lean gain 0.2 → 0.12 and clamp ±0.34 → ±0.24 rad (≈ 14° max); the tilt spring (k 45) is now close to critically damped (c 8 → 12.5; critical ≈ 13.4) so the lean, and the velocity lean on all bundles, settle without overshoot/wobble. Tune in `Bundle`'s tilt block.
- **2026‑11‑06** — Owner: revert the edge-rest tilt and its follow-ups. `DrapeScene.tsx` restored to `6213556` (before `1fe79b5`, `d1955ac`, `ef1e098`, `303b15a`): no lean on bundles resting on another bundle, slide-off threshold back to 1.55 × half-extent, tilt spring back to c 8 / old velocity-lean clamp ±0.38. Those four entries above describe code that is no longer in use (still in git history).

## Next / ideas

- **Next (queued by owner, in this order):** (1) ~~revamp the Collections section~~ (done 2026‑11‑06); (2) ~~build Atelier as a real section~~ (dropped 2026‑11‑06; the nav link was removed) — the craft story: how the sarees are made, the weavers, a studio visit. Today `#atelier` is only the address/hours block inside the footer area of `Collections.tsx`, and the nav link points at it.
- Ask owner for text-free renders at higher res (≥2400 px) for sharper large screens; current plates are 1672 px.
- Real store address/phone in footer; real collection pages behind CTAs (currently anchor to the grid).
- Fine-tune fabric polygons per scene with `?edit` if any edge looks off on owner's screen.
