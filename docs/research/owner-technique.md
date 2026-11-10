# The owner's "3D rendered to 2D" technique, and how to port it

Research note, 2026-11-10. Repos cloned (public, `git clone --depth 50`) to
`/tmp/claude-0/-home-user-orcfall-command/ce274ddb-694c-521b-8e3a-9873e2af111e/scratchpad/ownerrepos/`
(commits studied: `2.5d-experiment` @ `36628e8`, `pixelfx` @ `fe7103c`). Paths below are relative to each repo.

Evidence tags: **[SRC]** read in the owner's code or docs. **[three]** read in the installed three@0.185.1 source.
**[GEN]** general real-time graphics practice from my own knowledge. I did not browse the web for this note, so every
**[GEN]** item is unverified against a source and should be checked while implementing.

---

## 0. Headline findings (read this first)

1. **Neither repo contains a low-res, palette-quantised, "pixelated 3D" shader pass.** The owner's phrase "3D rendered
   to 2D" matches `2.5d-experiment` as **"HD-2D"**: a real 3D three.js world (voxels, real lights, shadows, PBR-ish
   Lambert materials) with **billboarded 2D characters** drawn as inked cartoon sprites, finished by soft
   photographic post (tilt-shift, bloom, ambient occlusion, split-tone grade). The "pixel" idea there is only a
   crude toggle (`P`): drop the pixel ratio to 0.34 and set CSS `image-rendering: pixelated`. No snapping, no palette,
   no dither, no outline pass, no integer scale. [SRC `src/main.ts:749-764`]
2. **`pixelfx` is not a post-process at all.** It is a CPU library of 232 hand-coded pixel-art VFX (fire, hits,
   portals...) drawn into small `Uint32Array` frames and upscaled with `image-rendering: pixelated`. It matters to
   this game for its *method*: hue-shifted colour ramps, a 4x4 Bayer ordered dither, and a separate additive light
   buffer. Those are exactly the building blocks of a good pixel post pass. [SRC `src/core/*.js`]
3. **`img2threejs` and `3d-world-objects` contain no stylisation pass.** `img2threejs` rebuilds objects from reference
   images as procedural three.js code. `3d-world-objects` is the photoreal pole (MSAA, GTAO, bloom, 4K shadows,
   photo-scanned Poly Haven PBR textures). It is useful only as a picture of the problem: mixed photo and hand-built
   assets under physical lighting, which is this game's situation.
4. **What actually makes `2.5d-experiment` look unified is not the shader.** It is a set of art rules applied to every
   asset: one shared ink colour, flat fills with cel crescents, one detail-texture style on every block, one grade.
   Section 1.6 lists them. Both halves matter: the owner's request ("one art style, so obv gotta have some kinda gfx
   or shader pass") needs a shader pass **and** asset-level rules.

Because of (1), section 3's port plan combines the owner's repos (HD-2D grade, ink outline discipline, `pixelfx`
ramps/dither/additive light) with the standard "pixel-perfect 3D" recipe (fixed low-res target, camera snapping,
depth/normal outlines, palette LUT, integer nearest upscale). Three.js already ships a starting point for the latter,
`RenderPixelatedPass` (section 3.0).

---

## 1. The owner's technique, as it exists in the repos

### 1.1 What `2.5d-experiment` is

"Blockfall Isle", a voxel survival game. Vite + TypeScript, three.js r169, Rapier, Rust/WASM mesher [SRC `README.md:1-30`].
It began (`42fc1f6`, 2026-10-19) as a *2.5D* side-ish view: commit message "Three.js voxel world with billboarded
procedural pixel-art sprites, HD-2D post (tilt-shift, bloom, grading)". It later became first person (`730543f`),
but the rendering stack and the character art are the same. The README gallery says the screenshots "show the
earlier overhead version" [SRC `README.md:6-18`], and the caption names the look: "Low sun through N8AO, bloom and
tilt-shift; inked vector characters walk the voxel world."

Style history from `git log` (55 commits, none deleted by the shallow clone):

| Commit | Date | Style change |
|---|---|---|
| `42fc1f6` | 10-19 | HD-2D post, procedural **pixel-art** billboard sprites, `P` pixel mode (`pixelMode ? 0.34`) |
| `5d3a94b` | 10-19 | "Pixel detail textures, sun-facing sprite shadow casters, camera lead, trauma shake, hitstop" |
| `2624ce0` | 10-19 | N8AO ambient occlusion and volumetric light shafts |
| `464bf8c` | 10-20 | **"Smooth vector art: inked characters, painterly block textures, vector icons"**: replaces the 16-32 px pixel art with Canvas2D vector drawing, 256 px per frame |

So the owner started with pixel art and **moved away from it** to smooth inked vector sprites with a painterly
block atlas. That is a data point: the owner's taste in that repo is "clean cartoon ink over soft cinematic light",
not strict retro pixel art. The new request for "super high res pixely pass" is a different goal from `2.5d-experiment`'s
end state and a closer match to its first commit.

### 1.2 Pass order (the whole chain)

`setupComposer()` [SRC `src/main.ts:446-466`]:

```ts
this.composer = new EffectComposer(r);
// N8AO renders the scene (replacing a plain RenderPass) and adds ambient occlusion
this.ao = new N8AOPass(this.scene, this.camera, innerWidth, innerHeight);
Object.assign(this.ao.configuration, {
  aoRadius: 2.2, distanceFalloff: 1.2, intensity: 2.2, halfRes: true, aoSamples: 12,
  denoiseSamples: 6, denoiseRadius: 10, gammaCorrection: false, screenSpaceRadius: false });
this.composer.addPass(this.ao);
this.shafts = new VolumetricPass();                         // src/volumetric.ts, half-res shadow-map ray march
this.composer.addPass(this.shafts);
this.tiltH = new ShaderPass(TiltShift(true));  this.tiltV = new ShaderPass(TiltShift(false));
this.composer.addPass(this.tiltH); this.composer.addPass(this.tiltV);
this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.82);
this.composer.addPass(this.bloom);
this.grade = new ShaderPass(Grade);
this.composer.addPass(this.grade);
this.composer.addPass(new OutputPass());
```

| # | Pass | Parameters | Toggle / runtime |
|---|---|---|---|
| 1 | **N8AOPass** (renders scene + SSAO) | `aoRadius 2.2, distanceFalloff 1.2, intensity 2.2, halfRes true, aoSamples 12, denoiseSamples 6, denoiseRadius 10, gammaCorrection false, screenSpaceRadius false` | `G` |
| 2 | **VolumetricPass** (light shafts) | shadow-map ray march at half res (`ea66486` "half-res light shafts") | `V`, off at quality level 2+ |
| 3-4 | **TiltShift H then V** (separable 5-tap Gaussian, taps 1.3846/3.2308, weights .2270/.3162/.0703) | `uFocus 0.5`, blur radius `smoothstep(0.12, 0.5, |uv.y - uFocus|) * 3.2 * uAmount` texels | `O`, **off by default** (`tiltOn = false`, `main.ts:285`); the shaders are skipped via `.enabled` (`main.ts:1674`) |
| 5 | **UnrealBloomPass** | strength `0.55`, radius `0.45`, threshold `0.82` | always |
| 6 | **Grade** (custom ShaderPass) | below | `uNight` = `1 - dayK` each frame (`main.ts:1371`), `uHurt` damage flash |
| 7 | **OutputPass** (tone map + sRGB) | | |

Renderer and quality: pixel ratio `min(devicePixelRatio, 1.75) * QUALITY_SCALE[level]` with
`QUALITY_SCALE = [1, 0.8, 0.8, 0.62]` (`main.ts:39, 752`); an automatic scaler steps down when frames are slow.

### 1.3 The grade shader (the only "look" shader) [SRC `src/main.ts:80-102`]

```glsl
vec3 c = texture2D(tDiffuse, vUv).rgb;
float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
c = mix(vec3(l), c, 1.18 - uNight * 0.25);                       // saturation boost, less at night
// split toning: warm highlights, cool shadows
c *= mix(vec3(0.92, 0.97, 1.08), vec3(1.06, 1.0, 0.92), smoothstep(0.0, 0.7, l));
c = mix(c, c * vec3(0.6, 0.72, 1.15), uNight * 0.55);            // night tint
vec2 p = vUv - 0.5;
float vig = smoothstep(0.95, 0.3, length(p * vec2(1.0, 1.15)));
c *= mix(0.45, 1.0, vig);                                         // vignette
c = mix(c, c * vec3(1.6, 0.3, 0.3), uHurt * (1.0 - vig) * 0.9);   // red hurt edge
float n = fract(sin(dot(vUv * uRes + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
c += (n - 0.5) * 0.03 * (0.5 + l);                                // animated film grain, +-1.5%
gl_FragColor = vec4(c, 1.0);
```

No posterise, no dither, no LUT. It is a warm/cool split tone with saturation lift.

### 1.4 The "pixel mode" toggle (the only pixelation) [SRC `src/main.ts:749-764`]

```ts
const pr = this.pixelMode ? 0.34 : Math.min(devicePixelRatio, 1.75) * QUALITY_SCALE[this.qualityLevel];
this.renderer.setPixelRatio(pr);  this.renderer.setSize(w, h);
this.composer.setPixelRatio(pr);  this.composer.setSize(w, h);
const tw = w * pr, th = h * pr;                  // texel uniforms for tilt-shift and grade follow the target size
...
this.canvas.style.imageRendering = this.pixelMode ? 'pixelated' : 'auto';
```

That is the whole technique: the whole composer renders at 0.34 of the window (about 650x370 at 1080p), the browser
upscales the canvas with nearest-neighbour. It has real limits: the factor is not an integer (`1/0.34 = 2.94`), the
canvas is CSS-stretched so pixels come out uneven, nothing is snapped to the pixel grid, bloom and AO run at low
res so they look smeared rather than dithered, and the vector sprites (alpha-tested billboards with mipmaps) are
rendered in the same low-res pass so they pixelate like everything else. Treat it as a proof that "render small
then upscale with nearest" works with a three.js composer, not as the finished look.

### 1.5 Characters, environments, lighting

- **Characters are 2D sprites in a 3D scene.** `makeSprite()` [SRC `src/entities.ts:196-220`]: a `spritePlane` mesh with
  `MeshLambertMaterial({ map, emissiveMap: map, alphaTest: 0.5, side: DoubleSide })`, so the sprite is lit by the scene
  but also carries an "ambient-tinted emissive copy of itself so it never goes muddy". Sheets are 4 walk frames x 3
  views (front/back/side) and the texture is cloned per entity with `repeat (1/4, 1/3)`. A custom depth material with
  `alphaTest` keeps the silhouette in the shadow map, and an invisible caster mesh "that always faces the sun" keeps the
  shadow shape as the billboard turns. An X-ray copy with `depthFunc: GreaterDepth` shows the actor through walls.
- **Characters are drawn as inked vector art**, not pixel art [SRC `src/art/characters.ts`, `src/art/draw.ts`]. One ink
  colour for everything: `INK = '#2a1d29'` ("warm near-black ink shared by every character, item and icon outline",
  `draw.ts:9-10`). Flat fills, cel-shade crescents, round limbs, a heavy outer contour `OUTER = 0.42` drawing units
  (`characters.ts:22`, applied at `:593`). `inkContour(img, r)` (`draw.ts:161-190`) thickens the silhouette with an exact
  Euclidean distance pass (row pass then column pass, a few ms for a whole sheet); the doc comment says the heavy outer
  line "is what makes cartoon figures pop against busy backgrounds, and the extra width keeps the alpha-tested silhouette
  solid in the smaller mips". Cells are 256 px for 32 drawing units; `bake()` (`draw.ts:294`) bleeds edge colour into
  transparent texels and builds coverage-preserving mips so alpha-tested sprites keep their size at distance.
- **Environment is voxels with a painterly detail atlas.** Block faces get a per-block hash tint and painterly patches
  in the fragment shader (`src/world.ts:233-265`), a 96 px seamless detail tile sampled with `textureGrad` from the
  unwrapped coordinate (avoids blurry seams), `diffuse *= 0.55 + detail * 0.9`, procedural damage cracks. Per-vertex AO
  from the mesher plus N8AO. Fog is squared-exponential (`FOG_DENSITY = 1/1100`).
- **Lighting is plain three.js**: a shadow-casting sun, `HemisphereLight(0xcfe6ff, 0x6a5a40, 1.0)`, and pooled
  `PointLight`s for lanterns (3, `0xffc070`, range 13) and muzzle flashes (2, `0xffa040`, range 18)
  (`main.ts:395-403`). Sun and moon swap on a day cycle; `dayK` drives the grade. No 2D normal-mapped lighting, no light
  buffer.
- **Camera**: perspective, `CAM_PITCH = 0.8` rad tilted look-down (`main.ts:55`), camera lead, trauma shake. Not
  orthographic, so there is no parallax-free pixel grid.
- **What is stable under camera motion:** nothing special. There is no pixel-creep fix because there is no pixel grid.
  At 0.34 ratio, edges crawl as the camera moves.

### 1.6 What I would call the owner's "unity" rules (the part worth copying)

1. **One ink colour, one outline weight** across characters, items and icons (`INK`, `OUTER`).
2. **Flat fills with a single cel crescent**, no photographic texture on characters.
3. **One texture treatment for all terrain**: the painterly detail atlas multiplied into the albedo with the same formula.
4. **One grade over everything** (split tone, saturation lift, vignette), with day/night driven by a single scalar.
5. **Emissive floor on sprites** so lit sprites never go dark: a consistency device against lighting variance.
6. **Soft cinematic post** (AO, bloom, optional tilt-shift) so the voxel geometry reads as a diorama.

### 1.7 Screenshots (read with the image tool)

- `docs/screenshots/sunset-castle.jpg`: top-down 3/4 view of a brick castle with crenellations, a moat, trees made of
  chunky green voxel crosses, warm orange lantern glow inside the keep, a long low-sun shadow. Shallow depth of field
  at the screen edges (tilt-shift), strong dark vignette, saturated greens and orange brick. Tiny inked cartoon
  characters (a hat-wearing player, two small zombies in red and blue, a big green brute) with thick dark outlines
  sit in the lower half. The characters are crisp vector; the world is soft.
- `docs/screenshots/characters-cracks.jpg`: close-up. The brick wall faces show **hard pixel-art cracks** (black chunky
  jagged lines, a deliberately crunchy 16-ish px grid) over smooth brick pattern; stone caps are grey with hairline
  cracks; the grass is a flat yellow-green with dark triangular hand-drawn tufts and flowers; the player and a hunched
  zombie are cartoon figures with a ~6 px dark-plum outline, cel highlights and rosy cheeks; the shadows are hard
  and flat. This is the clearest statement of the look: **a flat, graphic, thick-ink cartoon over geometric voxels,
  with lighting kept clean**. It is not retro low-res.
- Other shots in `docs/screenshots/{first-person,survival,defenses,...}/` show the same grade in first person.
- `pixelfx/docs/readme/montage.gif` (first frame): 15 dark-background tiles of tiny pixel VFX (campfire, burning
  skull, waterfall, plasma ball, portal, tornado, slime...), each with a **small hue-shifted ramp of 6-8 colours**,
  hard 1 px edges, dithered fades, and glows that read as bright banded halos. Everything sits on one dark brick floor.

### 1.8 `pixelfx` in detail

- **Layout**: `src/core/*` (painter, sim, particles, colour), `src/fx/<category>/<name>.js` (232 effects in 20 categories:
  fire, explosions, water, ice, lightning, sci-fi, melee, impacts, projectiles, spawn and death, arcane, holy, shadow,
  status, nature, weather, ui, pickups, transitions, critters), `tools/` (render, sheets, check), `skills/pixelfx/SKILL.md`,
  `gallery/`. MIT. Based on Hugo Duprez's Sprite Fusion effects (`NOTICE.md`). Fork of `patch-gg/pixelfx`; all 7
  commits are by the upstream author.
- **Two buffers** [SRC `src/core/painter.js:1-4`, `README.md` "how it works"]: `color` takes opaque pixels, faded only
  by ordered dither, never blended; `light` takes additive glow. `composite()` (`src/core/fx.js:100-131`) adds the
  light buffer on top: "Hot things look hot because of the light buffer."
- **Bayer dither** [SRC `painter.js:9-10, 46-50`]:
  ```js
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  put(sx, sy, c, a = 1) { ... if (a < 1 && a <= BAYER[((sy & 3) << 2) | (sx & 3)]) return; ... }
  ```
  Translucency is a threshold test against the pixel's screen coordinate, so there is no blending and no new colours.
- **Ramps** [SRC `src/core/color.js`]: `PAL` holds about 27 named ramps, 6-8 hex stops each, "hue-shifted ramps, dark to
  bright: shadows lean cool or deep, highlights lean warm or white", e.g. `fire: #1f0b10 #4a1118 #8c1d1c #cc3a1a #f2701f
  #ffae35 #ffe27a #fff8d6`, `stone: #0e0e12 ... #d0d0da`, `leaf: #0c1a0e ... #e4ffb0`, `metal`, `wood`, `bone`, `night`.
  `at(ramp, t)` picks a step with no blending ("pixel art picks a color, it doesn't fade between two"); `blend()` is
  reserved for light. `fit(ramp, n)` resamples a ramp to n steps keeping both ends; `INK = #0b0a10`.
- **Frame model**: effects draw at the 24x38 px stock-character scale into small frames (typically 96-320 px wide, 320x180
  transitions), then CSS `image-rendering: pixelated` (`gallery/style.css:114`) and integer scaling to the stage
  (`gallery/app.js:22`). Pixel resolution in the README example: `createFrame(320, 180)`.
- **Relevant effect families for this game**: `transitions/crt-off`, `transitions/pixel-dissolve`, `transitions/glitch-wipe`,
  `impacts/*`, `projectiles/bullet-tracer`, `explosions/*`, `status/*`, `ui/damage-number`. These are drawable into a
  small pixel canvas layered over the world, so FX would match the pixel pass in art style without being post-processed.
- **Which pixelfx ideas unify a mixed asset set**, ranked: (1) a **single shared palette** with hue-shifted ramps,
  (2) **ordered dither instead of alpha blending** for fades and shadows, (3) **lights as an additive layer that is
  quantised last**, (4) **one global pixel grid** that every layer draws into at integer scale, (5) a single ink colour
  (`INK`).

### 1.9 The other two repos, for completeness

- `img2threejs` (Apache-2.0, upstream hoainho): Claude skill that rebuilds one reference image as a procedural
  three.js `Group` factory with a quality gate loop. Docs mention stylised models only as a modelling choice
  (`SKILL.md:22,33,138`); `grimoire/feedback/shading_realism.md` is about matching real PBR materials. **No render style
  or post-process.** Useful only for generating hand-built props in code.
- `3d-world-objects` (README "Detail" and "Realism" sections): `Rendering: MSAA, ground-truth ambient occlusion (GTAO), bloom,
  a physical sky ... and 4K shadow maps`; `src/materials.ts` triplanar procedural surfaces; `scripts/fetch_pbr.py`
  builds `public/pbr.json` from CC0 Poly Haven photo-scanned sets. `src/ambient-occlusion.ts` has a `stabilizeGtao` fix.
  This is the photoreal baseline the new pass has to tame: a **pixel/ink pass is the standard way to hide the seam
  between a photo-scanned texture and a hand-built prop**.

---

## 2. Pass list and parameters (summary)

Owner's chain today: `N8AO -> light shafts -> [tilt-shift H, V] -> UnrealBloom -> Grade -> OutputPass`, with a bolt-on
`pixel mode` (`pixelRatio 0.34`, CSS `image-rendering: pixelated`).

| Parameter | Value |
|---|---|
| AO | radius 2.2, falloff 1.2, intensity 2.2, 12 samples, half res, denoise 6 samples radius 10 |
| Tilt-shift | focus 0.5, blur ramp 0.12 to 0.5 of screen height, max 3.2 texels |
| Bloom | strength 0.55, radius 0.45, threshold 0.82 |
| Saturation | `1.18 - 0.25 * night` |
| Split tone | shadows `(0.92, 0.97, 1.08)`, highlights `(1.06, 1.0, 0.92)`, ramp `smoothstep(0, 0.7, luma)` |
| Night tint | `(0.6, 0.72, 1.15)` at 0.55 |
| Vignette | `smoothstep(0.95, 0.3, len)`, floor 0.45 |
| Grain | +-1.5%, luma-weighted, animated |
| Pixel mode | ratio 0.34, `image-rendering: pixelated` |
| Ink | `#2a1d29`, outer contour 0.42 / 32 of a sprite cell |
| pixelfx dither | Bayer 4x4, threshold `(v+0.5)/16` |
| pixelfx ramps | 6-8 stops, hue-shifted, per material |

---

## 3. Port plan for this game

### 3.0 Starting point and what exists

Current chain [SRC this repo `src/render3d/post.ts`]: `RenderPass -> UnrealBloomPass(0.4, 0.55, 1.4) -> LensShader -> OutputPass`.
`LensShader` has chromatic fringing, vignette, and **animated film grain** (`grain(vUv*900)` with `time`), all of which
fight a pixel look (see pitfalls). Renderer [`src/render3d/renderer3d.ts`]: `PerspectiveCamera` FOV 30, `TILES_TALL = 24`,
`CAMERA_DISTANCE = 12 / tan(15deg) = 44.78`, camera looks straight down -z at the plane z = 0, shake is
`Math.random()` per frame, `renderer.setPixelRatio(1)`, `ACESFilmicToneMapping` exposure 1.15, `PCFShadowMap`,
`FogExp2`. `renderer.setSize(w, h, false)` is driven by `resize(canvas.width, canvas.height)` from `main.ts:52-57`
where `canvas.width = css * min(2, dpr)`.

HTML has **two canvases** (`index.html`): `#stage` (WebGL) under `#game` (2D HUD). So HUD text is already outside the
3D pipeline and stays crisp whatever the 3D pass does (3.6).

Three.js ships `examples/jsm/postprocessing/RenderPixelatedPass.js` (r185.1, 314 lines) [three]: it renders beauty and a
`MeshNormalMaterial` normal pass into targets of `size / pixelSize` (integer divide) and applies depth and normal edge
indicators in one shader (`depthEdgeIndicator`, `normalEdgeIndicator`, lines 227-278) as `texel * Strength`: depth edges
darken by `1 - depthEdgeStrength*dei`, normal edges brighten by `1 + normalEdgeStrength*nei`. It has no snapping, no
palette, no dither and no ink colour, and it creates its own targets (so it does not compose with a shared HalfFloat
chain). Use it as a prototype in one line (`new RenderPixelatedPass(4, scene, camera, {normalEdgeStrength:.3, depthEdgeStrength:.4})`
to see the direction), then replace it with the custom chain below.

### 3.1 Target chain (ordered)

Everything up to and including the quantiser runs at the **internal pixel resolution** `W x H`. Only the last step
touches the full-resolution canvas.

```
 1  RenderPass            scene -> internal HDR target (HalfFloat, NearestFilter, depthTexture, no MSAA)
 2  NormalIdPass          scene.overrideMaterial = MeshNormalMaterial (+ optional per-material ID) -> normal RT
 3  Bloom (low-res)       UnrealBloomPass at W x H  -> additive HDR glow            (before tone map, before quantise)
 4  Ink outline           depth + normal + ID edges -> INK colour, 1 internal pixel wide
 5  (optional) AO/shade   cheap contact darkening; or keep the game's own baked darkness
 6  Tone map + grade      OutputPass-equivalent in linear -> sRGB, then split-tone grade (owner's Grade, no vignette/grain yet)
 7  Palette quantise      ordered dither (Bayer 4x4 or 8x8) + nearest palette colour (LUT)
 8  Upscale blit          nearest, integer scale k, letterbox, sub-pixel camera offset   -> screen
 9  (optional) CRT        scanline / mask / vignette at OUTPUT resolution
```

Rationale for the order: the outline must read depth and normals, so it runs before anything that mixes pixels. Bloom
before the quantiser means glows are **banded and dithered like pixelfx light**, not smooth. Tone mapping before
quantising, because the palette is an sRGB palette. Grain and vignette after quantising (or removed). CRT last, at
output resolution, so scanlines are not themselves pixelated into the art grid.

### 3.2 Pass 1: internal resolution, with camera snapping (the "pixel-creep" fix)

Choose an **integer pixel size `k`** (device pixels per art pixel) and derive the internal size from the canvas:

```ts
// canvasW/H are device pixels (what main.ts passes to resize)
const TARGET_H = 360                      // chunky 270, crisp 360, "HD pixel" 540 (see 3.5)
const k = Math.max(1, Math.round(canvasH / TARGET_H))
const W = Math.ceil(canvasW / k), H = Math.ceil(canvasH / k)   // internal size; overscan by +2 px for the sub-pixel shift
```

Create the composer on explicit targets so the whole chain runs small and the HDR format is explicit:

```ts
const target = new WebGLRenderTarget(W + 2, H + 2, {
  type: HalfFloatType, magFilter: NearestFilter, minFilter: NearestFilter,
  depthTexture: new DepthTexture(W + 2, H + 2), samples: 0 })
const composer = new EffectComposer(renderer, target)
composer.setPixelRatio(1); composer.setSize(W + 2, H + 2)    // sizes the targets only; the canvas is untouched
```

Camera snap. The camera looks straight down -z, so at the play plane z = 0 one internal pixel is a fixed world size:

```
unit = TILES_TALL / H          // world units (tiles) per internal pixel at z = 0 (2 * D * tan(fov/2) / H, D chosen so it equals TILES_TALL)
```

Each frame, in `renderer3d.draw`:

```ts
const unit = TILES_TALL / H
const sx = Math.round(view.x / unit) * unit,  sy = Math.round(-view.y / unit) * unit
camera.position.set(sx + shakeX, sy + shakeY, CAMERA_DISTANCE)          // shakeX/Y are multiples of `unit` (quantise the random jolt)
camera.lookAt(camera.position.x, camera.position.y, 0)
const subX = (view.x - sx) / unit,  subY = (-view.y - sy) / unit         // residual in internal pixels, |.| <= 0.5
blit.uniforms.uSub.value.set(subX, subY)
```

The blit then shifts the finished image by `round(sub * k)` **device** pixels, so scrolling is smooth at output
resolution while every art pixel stays a fixed k x k block and edges never crawl (this is the "pixel-perfect camera
with sub-pixel offset" scheme [GEN]). Overscan of one internal pixel on each side hides the shifted edge.

Caveat: this only stops shimmer **at depth z = 0**. A perspective camera moves nearer and farther layers by different
amounts, so rooms behind the plane (the game draws rooms with depth) and parallax props will still swim by up to
`(D / (D - z))` times the snap step. Options, in order of preference: (a) **switch the pixel mode to an orthographic
camera** (`OrthographicCamera(-W*unit/2, W*unit/2, H*unit/2, -H*unit/2)`), so all depths move identically and the
snap is exact, at the cost of losing perspective parallax (the 2D look wants this anyway); (b) keep perspective and
accept slight swim on far layers; (c) snap far layers' own offsets. This game's old 2D camera was orthographic
(`renderer3d.ts:19` comment: "Matches the 2D camera"), so (a) is faithful.

Replace the random shake with a **pixel-quantised** one: `Math.round(rand * jolt / unit) * unit`, otherwise shake
reintroduces sub-pixel motion.

### 3.3 Passes 2-4: outline from depth, normal and ID

Outline is the single most "artsy" element in the owner's repo (the thick plum ink on every character, `INK = #2a1d29`).
For 3D assets mixed from scans and hand-built meshes, depth and normal edges alone will miss flat colour boundaries and
will draw ink inside noisy scanned normal maps. Recommended inputs:

1. **Depth** from the beauty target's `depthTexture` (linearise before differencing; edges must be relative to distance).
2. **Normals** from a second render with `scene.overrideMaterial = new MeshNormalMaterial()` (what `RenderPixelatedPass`
   does). Use *geometric* normals only: `MeshNormalMaterial` ignores normal maps unless `normalMap` is set on it, which is
   what we want, so photo normal-map noise does not become ink.
3. **Object/material ID** (optional, best for unity): a third render with a flat ID colour per material "family"
   (`MeshBasicMaterial` with colour from a hash of `mesh.userData.styleId`) or write ID into the alpha of the normal
   pass. An ID edge draws ink exactly at material boundaries and silhouettes of props, which is the owner's inked-contour
   rule.

Overriding materials breaks alpha-tested billboards, instanced meshes with custom shaders and transparent decals;
handle by setting `material.alphaTest` on the override or by using a per-pass `onBeforeRender` swap, and skipping sky and
FX layers via `layers`.

Outline fragment sketch (internal resolution, `uTexel = 1/vec2(W+2, H+2)`):

```glsl
uniform sampler2D tDiffuse, tDepth, tNormalId;
uniform vec2 uTexel; uniform float uNear, uFar;
uniform vec3 uInk;                 // 0x2a1d29 -> linear
uniform float uDepthK, uNormalK;   // e.g. 0.06 (relative), 0.55
varying vec2 vUv;

float linDepth(vec2 uv) {          // perspective; for an OrthographicCamera use: uNear + d * (uFar - uNear)
  float d = texture2D(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec2 o[4] = vec2[4](vec2(1,0), vec2(-1,0), vec2(0,1), vec2(0,-1));
  float d0 = linDepth(vUv);
  vec4  n0 = texture2D(tNormalId, vUv);
  float edge = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + o[i] * uTexel;                 // 1 internal pixel => 1 art-pixel-wide ink
    float dd = linDepth(uv) - d0;                  // only the nearer pixel inks: dd > 0 means neighbour is farther
    vec4  nn = texture2D(tNormalId, uv);
    float depthEdge  = smoothstep(uDepthK, uDepthK * 2.0, dd / d0);
    float normalEdge = step(uNormalK, 1.0 - dot(n0.rgb * 2.0 - 1.0, nn.rgb * 2.0 - 1.0)) * step(-0.01, dd);
    float idEdge     = step(0.5 / 255.0, abs(n0.a - nn.a)) * step(-0.01, dd);
    edge = max(edge, max(depthEdge, max(normalEdge, idEdge)));
  }
  gl_FragColor = vec4(mix(base.rgb, uInk, edge), base.a);
}
```

(`RenderPixelatedPass` in three.js 0.185.1 uses the same structure: sum of four-neighbour depth differences and
`1 - dot(normal, neighborNormal)`, lines 239-278; it multiplies the colour instead of replacing it with ink.)

Variants: 2 px outline for characters only (render characters on a layer, outline on that layer's ID), inner lines
lighter than outer (outer = depth/ID edge, inner = normal edge at 50% ink, matching the owner's "heavier outer contour
than inner lines").

### 3.4 Passes 6-7: grade, palette and dither

**Grade first** (owner's `Grade` minus vignette and grain, linear in, sRGB out). Keep the split tone and saturation
lift; they give the one-grade-over-everything unity [SRC `main.ts:84-91`].

**Palette quantisation**, two options:

(A) **Ramp-based posterise** (pixelfx style): convert to luma, pick a step in a hue-shifted ramp, keep chroma from the
source. Cheap, preserves per-asset hue, good for a mixed asset set because every asset collapses onto the same value
steps.

(B) **Fixed palette via a 3D LUT** (stronger unity, "one art style"): bake a 32x32x32 LUT (or 64 wide strip) on the CPU
where each cell holds the **nearest palette colour in OKLab**, upload as a `Data3DTexture` (NearestFilter), and look it
up after adding the dither offset. Palette: 24-48 colours; start from the game's own `REFERENCES.md` palette (walls
`#2a2f36 #3a3f44 #1c2026 #5a4a3c`, neon `#ff2d95 #00e5ff #ffb000 #7cff4f #ff3b30 #8a5cff`, light sodium `#ffb347` and
fluorescent `#cfe8ff`) and extend each material ramp to 5-7 steps hue-shifted as in `pixelfx/src/core/color.js`
(shadows toward blue-violet, highlights toward warm).

Dither uses the **internal pixel coordinate**, never the output coordinate, so each dither cell is one art pixel:

```glsl
uniform sampler3D uLut;           // 32^3, NearestFilter, sRGB palette result
uniform float uDither;            // 0.0 .. 1.0 strength (~ 1/levels)
varying vec2 vUv;
const float BAYER4[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;                        // already tone-mapped, sRGB
  ivec2 p = ivec2(gl_FragCoord.xy);                            // internal-resolution pixel (this pass renders at W x H)
  float t = (BAYER4[(p.y & 3) * 4 + (p.x & 3)] + 0.5) / 16.0 - 0.5;   // same table as pixelfx painter.js:10
  c += t * uDither;                                            // dither BEFORE the nearest-palette lookup
  gl_FragColor = vec4(texture(uLut, clamp(c, 0.0, 1.0)).rgb, 1.0);
}
```

Use a dither strength on the order of the palette step size (about `1/6` for a 6-step ramp) [GEN]; pixelfx also uses the
Bayer test directly as a "fade" (`a <= BAYER[...]` discards the pixel) which is the right way to do **shadow penumbrae
and fog as stippled patterns** in a custom shader instead of dithering after the fact.

**Lights** (pixelfx light buffer idea): leave real three.js lights in; because bloom precedes the quantiser, additive
glow is quantised into banded halos. If a lamp halo looks too soft, use a stepped falloff (floor the falloff to 3-4 bands)
in the light's own sprite shader.

### 3.5 Pass 8: the "super high res pixely pass" option

This is the same chain with different numbers. Offer as presets (a settings enum, plus the existing `quality` flag):

| Preset | `TARGET_H` | `k` at 1080p | Look |
|---|---|---|---|
| Chunky | 270 | 4 | classic retro, 480x270, big dither |
| Crisp | 360 | 3 | default recommendation; characters still readable |
| **HD pixel** | 540 | 2 | "super high res pixely": fine hard-edged pixels, 1 px (=2 device px) ink, finer dither (Bayer 4 at low strength, or none) |
| Smooth | off | 1 | current look |

Blit shader (nearest, integer scale, letterbox optional):

```glsl
uniform sampler2D tDiffuse;      // internal target, (W+2) x (H+2), NearestFilter
uniform vec2 uInternal;          // W+2, H+2 (texels)
uniform vec2 uOut;               // canvas device pixels
uniform float uK;                // integer scale
uniform vec2 uSubDevice;         // round(sub * k): sub-pixel camera offset in device pixels
varying vec2 vUv;
void main() {
  vec2 fragDev = vUv * uOut - uSubDevice;                 // device pixel centre, shifted
  vec2 texel = floor(fragDev / uK) + 1.0;                 // +1 skips the overscan ring
  gl_FragColor = texelFetch(tDiffuse, ivec2(texel), 0);   // exact nearest: no filtering, no blur at any DPR
}
```

(`texelFetch` requires WebGL2, which three r185 uses.) Because `k` is an integer and the sampling is explicit, there is
no dependence on the browser's `image-rendering` or on CSS scaling; the `#stage` canvas stays 100vw x 100vh as in
`index.html`. Do not use `renderer.setPixelRatio(0.34)` like the owner's toggle does; it produces `1/0.34 = 2.94`
pixels per art pixel.

### 3.6 Keeping HUD and text crisp

- The HUD is already a separate full-resolution 2D canvas above the WebGL canvas (`index.html`, `main.ts:19, 87`), so **do
  not route it through the pixel pass**. Keep UI text at native resolution for legibility.
- Anything that must live in the world (door labels, damage numbers, speech bubbles): either (i) draw them in the HUD
  canvas at world-projected positions snapped to `k` device px, or (ii) for a unified pixel look, draw them into the small
  internal-resolution canvas through `pixelfx`-style `put()` (integer positions, ordered dither), `ctx.imageSmoothingEnabled
  = false`, and a pixel font. `pixelfx/src/core/font.js` (88 lines) already has a rasteriser for this.
- If the HUD is to look pixel-native too: render the HUD into an offscreen canvas of size `W x H`, and draw it with
  `image-rendering: pixelated` at integer scale on top, at the cost of crisp text.
- Cursor, crosshair and aim line: draw at output resolution, snapped to multiples of `k`.

### 3.7 Pass 9: optional CRT

At output resolution after the blit, so it is a separate pass writing to screen: scanlines
`0.9 + 0.1 * sin(gl_FragCoord.y * PI / k)` (one dark line per art pixel row), slight aperture-mask tint, and the
corner vignette moved here from `LensShader`. Keep chromatic fringing off or limited to 0.5 device px. pixelfx has a
`transitions/crt-off` effect for the shutdown animation, and the `slow` tint from the existing `LensShader` can move here.

### 3.8 Asset-level rules (the other half of "one art style")

A post pass hides but does not fix mismatched assets. Apply the owner's "unity rules" (1.6) to the 3D scene:

1. **Textures**: downscale all albedo textures to a shared texel density (about 1 texel per art pixel at the play plane),
   box filter, then posterise in the same palette (offline script, or `Texture.generateMipmaps = false` plus `NearestFilter`
   on albedos for the pixel look). Photo-scanned PBR sets (the `public/textures*` Poly Haven sets) should be reduced to
   albedo plus AO; drop or weaken `normalMap` and `roughnessMap` strength so all surfaces shade alike.
2. **Materials**: unify roughness/metalness ranges (for example clamp `roughness` to 0.6-1.0 and `metalness` to 0-0.3 via a
   one-pass traversal over the scene's materials when loading). Cut `scene.environmentIntensity` (currently 2.2 for the HDR
   night sky, `renderer3d.ts:15`) or cap it, because photographed reflections are the loudest "different asset" tell.
3. **Lighting**: replace per-asset light tuning with the two-light + hemisphere idea from the owner's scene (sun/moon,
   `HemisphereLight`, pooled point lights) and keep shadows hard-edged (`PCFShadowMap` with a low map size) so shadows are
   also pixel shapes.
4. **Characters**: either keep 3D `people3d.ts` models and ink them with the ID outline, or switch to the owner's billboard
   sprite approach (inked sprite sheets, emissive floor, lit Lambert, silhouette shadow caster). The second is the owner's
   proven method but changes the content pipeline.
5. **One ink**: choose a single ink colour for the whole game (owner's `#2a1d29` is a warm plum; for this game's cyberpunk
   look a deep blue-black like `#0b0a10`, pixelfx's `INK`, may suit better). It is a single uniform in the outline pass.

---

## 4. Pitfalls

1. **Shimmer when the camera moves.** Without snapping to the pixel grid (3.2), pixel edges crawl; with a perspective
   camera, off-plane layers still swim. Fix: orthographic camera in pixel mode, snap, and apply the residual as a
   device-pixel shift in the blit. Quantise camera shake. Rooms with depth in this game (interiors extend back from
   `FRONT`) are the likely victims.
2. **Shadow-map shimmer.** The moon's shadow camera (`lights.ts:95-101`, +-34 x +-26 world units) moves with the target;
   shadow edges flicker when it translates by sub-texel amounts. Snap the shadow camera/light target to the shadow texel
   grid [GEN]. Use hard (`PCFShadowMap`) shadows, not PCSS.
3. **Bloom versus pixelation order.** Bloom after quantising gives smooth coloured halos that break the palette. Bloom
   before it, at internal resolution, gives banded halos. `UnrealBloomPass` mips shrink fast at 480x270: lower `radius`
   and watch the lowest mip (it samples 5 mips; at 270 px tall that is 8 px), or run bloom on a half-res copy then
   upsample with nearest. Threshold is in linear HDR, so keep `HalfFloatType` targets.
4. **Anti-aliasing conflicts.** MSAA on the default framebuffer is irrelevant (the composer renders to targets) and the
   current `antialias: !lowDetail` does nothing for the chain [three]. MSAA on the internal target (`samples: 4`) softens
   edges that outline passes then fail to find, so keep `samples: 0` and use the outline as the AA. Do not use FXAA or
   SMAA after quantising. Alpha-tested sprites need `alphaToCoverage: false` and `alphaTest ~0.5` so edges are binary.
5. **Mipmaps and anisotropy** make textures blur or shimmer at distance: with `NearestFilter` plus lower texture resolution
   or `minFilter: NearestMipmapNearestFilter` the texel pattern stays stable. A texture sampled at a rate different from
   the art grid creates moire; match texel density (3.8).
6. **Grain and chromatic fringing from the existing `LensShader`** must move after the blit or be removed. Animated grain
   at output resolution makes pixels fizz; if a grain is wanted, make it a static dither or a per-art-pixel hash.
7. **Tone mapping and colour space.** Quantise after tone map in sRGB, and compute the LUT with the same transfer
   function. Quantising linear HDR gives wrong bands. `OutputPass` does tone map plus sRGB, so either keep it before the
   quantiser (then the quantiser reads display-referred values) or inline its math.
8. **Depth precision for outlines.** Perspective depth is non-linear; the near=1, far=400 range in `renderer3d.ts:49` is
   wide, so use linearised depth and relative thresholds, or tighten near/far to the playfield. In ortho the depth is
   linear already.
9. **Override-material passes** (normals/ID) double draw calls. With the many `MeshStandardMaterial`s in `render3d`
   (27 uses) and instanced props, expect roughly 2x scene CPU cost. Mitigations: render normals at the internal (small)
   size only (cheap fill), reuse frustum culling, put sky, FX, sprites and HUD on layers excluded from the normal pass;
   or use MRT (`new WebGLRenderTarget(w, h, { count: 2 })` with a custom `layout(location=1)` output) to get normals from
   one draw [three, GEN]; r185 supports `count` on `WebGLRenderTarget`.
10. **Performance.** Rendering at 360 p instead of 1080 p is a net win (about 9x fewer fragments) and pays for the extra
    outline and normal pass. Bayer dither and a LUT lookup are a handful of ALU/texture ops. The blit is one texel fetch per
    device pixel. N8AO or GTAO at internal res is cheap too. Measure with `?quality=low`; the existing `lowDetail`
    flag can map to "Chunky" preset.
11. **Resizing.** Re-derive `k` on every resize and on `devicePixelRatio` change; recreate targets only when `W x H`
    changes. `composer.setPixelRatio(1)` is required or three will multiply the internal size by the renderer ratio.
12. **Letterboxing vs. variable art resolution.** With `W = ceil(canvasW / k)`, the visible world height in tiles changes
    slightly with window size (`TILES_TALL` is fixed, `unit` changes). That is fine for a single-screen platformer view.
    For a competitive/consistent view lock `W x H` and letterbox with black bars instead.
13. **Photo-textured walls will still look wrong** if albedo textures are not reduced first (3.8). A post pass cannot make
    a 4K brick photo look hand-painted; it only quantises the colours. Budget asset work.

---

## 5. Sources and links

### Owner repositories (cloned and read)
- https://github.com/cktang88/2.5d-experiment (HEAD `36628e8`, "Blockfall Isle")
  - `README.md` (gallery, controls: `P / O / G / V / M = pixel mode / tilt-shift / ambient occlusion / light shafts / mute`, line 77)
  - `src/main.ts` lines 39 (`QUALITY_SCALE`), 55 (`CAM_PITCH`), 63-79 (`TiltShift`), 80-102 (`Grade`), 395-403 (lights),
    446-466 (`setupComposer`), 749-764 (`onResize`, `togglePixel`), 1371 (`uNight`), 1673-1674 (`uHurt`, tilt enable)
  - `src/entities.ts:196-220` (`makeSprite`), `src/art/draw.ts:9-10, 161-190, 294` (`INK`, `inkContour`, `bake`),
    `src/art/characters.ts:22, 593`, `src/world.ts:233-265` (detail atlas shader), `src/volumetric.ts`
  - `docs/screenshots/sunset-castle.jpg`, `docs/screenshots/characters-cracks.jpg` (viewed)
  - Commits `42fc1f6`, `5d3a94b`, `2624ce0`, `ea66486`, `464bf8c` via `git log` / `git show`
- https://github.com/cktang88/pixelfx (fork of https://github.com/patch-gg/pixelfx, HEAD `fe7103c`)
  - `README.md`, `docs/AUTHORING.md`, `docs/CATALOG.md`, `NOTICE.md`, `skills/pixelfx/SKILL.md`
  - `src/core/painter.js:1-60` (dither), `src/core/color.js` (ramps), `src/core/fx.js:100-131` (`composite`), `src/core/font.js`,
    `gallery/style.css:114`, `gallery/app.js:22`, `docs/readme/montage.gif` (viewed)
- https://github.com/cktang88/img2threejs (upstream https://github.com/hoainho/img2threejs): `README.md`, `SKILL.md`,
  `grimoire/feedback/shading_realism.md`. No render style.
- https://github.com/cktang88/3d-world-objects: `README.md` ("Detail" and "Realism" sections), `src/ambient-occlusion.ts`,
  `src/lighting.ts`. Photoreal.

### Referenced by the repos (not opened by me)
- Hugo Duprez, "How to make (good) pixel art effects with Claude": https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude
- Sprite Fusion open-source pixel art VFX (MIT): https://www.spritefusion.com/pixel-art-vfx
- Kenney Starter Kit FPS (CC0 flying enemy model in 2.5d-experiment): https://github.com/KenneyNL/Starter-Kit-FPS

### Local files read
- `/home/user/orcfall-command/src/render3d/post.ts`, `/home/user/orcfall-command/src/render3d/renderer3d.ts`,
  `/home/user/orcfall-command/index.html`, `/home/user/orcfall-command/package.json` (three `^0.185.1`),
  `/home/user/orcfall-command/docs/REFERENCES.md` (section 0 and palette), `/home/user/orcfall-command/docs/research/rendering.md` (header)
- `/home/user/orcfall-command/node_modules/three/examples/jsm/postprocessing/RenderPixelatedPass.js` (r185.1, lines 1-314)

### Not verified (search these before building)
Pixel-perfect camera with sub-pixel offset (Ben Golus, "Pixel Art Sprite Anti-Aliasing" and Unity pixel perfect camera
docs); t3ssel8r's pixel-art 3D devlog (snapping, outlines, Bayer); the "RenderPixelatedPass" three.js example
(`examples/webgl_postprocessing_pixel`); OKLab nearest-palette LUT baking; shadow-map texel snapping. These are the
**[GEN]** items above.
