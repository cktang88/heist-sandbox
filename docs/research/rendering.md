# Rendering research: three.js r185, side-view 2.5D infiltration game

Second pass. The network was open this time, so pages were opened and read, not just snippet-searched. Where this pass contradicts the earlier snippet-only pass, it says so under "Corrections".

## 0. How to read this document

Evidence grades:
- **[SRC]** read in full or in the relevant part: the installed `node_modules/three` r185.1 source, three.js `dev`/tag source on raw.githubusercontent.com, README files, or a slide deck.
- **[DOC]** read from a three.js docs page or README.
- **[INFER]** my engineering judgement. This includes every "ms" or "lights per second" figure that has no source. Treat these as budgets to measure, not facts.

Installed version: `three@0.185.1` and `@types/three@^0.185.4` (`/home/user/orcfall-command/package.json`). npm `latest` is 0.187.0 and r186/r187 exist as of 2026-11-10 [SRC: `registry.npmjs.org/three`]. r185 was published 2026-06-25 [same]. Several things I read on the `dev` branch are r186+ and are **not** in r185; they are flagged.

### 0.1 Corrections to the earlier pass

1. **Native WebGL light probe grid exists in r185 core.** `three/addons/lighting/LightProbeGrid.js` is a **WebGLRenderer** class in r185.1. Its header says "this class can only be used with WebGLRenderer. A version for WebGPURenderer will be added at a later point." `WebGLRenderer.js` handles `object.isLightProbeGrid` (it calls `pushLightProbeGrid`), and the shader chunk `lightprobes_pars_fragment.glsl.js` samples the grid. So per-room baked diffuse irradiance is available **now** with the current renderer, with no custom shader. [SRC: local `examples/jsm/lighting/LightProbeGrid.js`, `src/renderers/WebGLRenderer.js` lines ~1847, 2166, 2265, 2546, 2738.] On `dev` (r186+), the file was split into a WebGPU `LightProbeGrid` and a separate `LightProbeGridWebGL.js`, and `LightMapper.js`, `RayTracedRadiosity.js` and `vxgi/` were added. None of those exist in r185.1 (`ls examples/jsm/lighting` shows only `ClusteredLighting.js`, `DynamicLighting.js`, `LightProbeGrid.js`).
2. **`ClusteredLighting` only clusters non-shadow-casting `PointLight`s in r185.** `ClusteredLightsNode.setLights()` puts a light in the cluster list only if `light.isPointLight === true && light.castShadow !== true`; every other light goes through the ordinary per-material light path. `maxLights` is documented as "maximum number of point lights". So spot lights (lamps, torches) are **not** clustered in r185, and clustering is **WebGPURenderer-only**. [SRC: local `examples/jsm/tsl/lighting/ClusteredLightsNode.js` lines 205-235; `ClusteredLighting.js`.] The migration guide says `TiledLighting` was removed in r185 in favour of `ClusteredLighting` [DOC: github.com/mrdoob/three.js/wiki/Migration-Guide].
3. **`three-gpu-pathtracer` now requires WebGPU** and ships examples importing from `three/webgpu`; the README does not mention WebGL2 [DOC: github.com/gkjohnson/three-gpu-pathtracer]. It is an offline or progressive renderer, not a game-time one.
4. **`three-good-godrays` is tested only for three `>=0.125.0 <0.188.0`** and supports only `PointLight` and `DirectionalLight`. Its README says the light must cast shadows and every scene object must cast and receive shadows [DOC: github.com/ameobea/three-good-godrays]. r185 also ships a TSL port, `GodraysNode` (`three/addons/tsl/display/GodraysNode.js`), with the same limits ("Only point and directional lights are currently supported") [SRC: local file header].
5. **`PCFSoftShadowMap` is deprecated in r185 `WebGLRenderer`.** `WebGLShadowMap.js` at r185 logs "PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead" and switches the type. The migration guide lists it under r182. The r185 docs list only `BasicShadowMap | PCFShadowMap | VSMShadowMap`. [SRC: local `src/renderers/webgl/WebGLShadowMap.js` line ~99; DOC: three.js WebGLRenderer docs page fetched via curl.] Note: `dev`'s `constants.js` says "deprecated since r186", so the exact version of the deprecation is inconsistent between sources. The behaviour in r185 is a fallback to `PCFShadowMap` either way. If the project sets `PCFSoftShadowMap`, change it to `PCFShadowMap`. The docs say `PCFShadowMap` is now soft too.
6. **`GTAONode` in r185 still has `distanceExponent` and `distanceFallOff`** (`this.distanceExponent = uniform( 1 )`). The "deprecated since r186" text is from `dev`. In r185 the migration note says GTAO became "more physically correct. It is darker and reaches wider, so lower `radius` and `scale`" [SRC local `GTAONode.js`; DOC migration guide].
7. **`AnamorphicNode` was removed in r185.** Use `BloomNode` with a custom high-pass or a custom streak pass. `BloomNode` has a comment about injecting a custom high-pass filter "e.g., for anamorphic effects" [DOC migration guide; SRC local `BloomNode.js`].
8. **`PostProcessing` was renamed `RenderPipeline` in r183** (WebGPU/TSL path) [DOC migration guide].

---

## 1. "Ray-traced look" in real time in a browser

### 1.1 Bottom line

With the existing WebGLRenderer + EffectComposer, a convincing "RT look" for a side-view game comes from, in value order: (1) **AO** (N8AO or `GTAOPass`), (2) **baked irradiance probes** per room (native `LightProbeGrid`), (3) **emissive + bloom** for lamps and screens, (4) **planar reflections** for a few wet floors, (5) **contact shadows / a few real shadows** from the key lights. Real SSGI and SSR exist but are costly and have gaps (below). Ray tracing proper (`three-mesh-bvh` in shaders, path tracing) is not suitable for a destructible grid with 60-100 characters. Do **not** migrate to WebGPU just for this; see 1.8.

### 1.2 Ambient occlusion

**N8AO** (WebGL2, works with three `EffectComposer` and pmndrs `postprocessing`) [DOC: github.com/N8python/n8ao]
- Import: `import { N8AOPass } from 'n8ao'` for three's composer; `import { N8AOPostPass } from 'n8ao'` for pmndrs. It replaces the `RenderPass` (it renders the scene itself). Recommends three r161+. Not WebGPU-compatible.
- `n8aopass.configuration`: `aoRadius` (world units, "one or two orders of magnitude smaller than your scene scale"), `distanceFalloff` (default 1), `intensity` (about 2 subtle, about 5 strong), `color` (dark), `screenSpaceRadius` (pixels, typically 16-64), `gammaCorrection` (default true; set false if a later `OutputPass` encodes), `halfRes` (2x-4x speedup "at some loss of fine detail and temporal stability"), `depthAwareUpsampling` (on by default, about 1 ms fixed), `accumulate`.
- `setQualityMode('Performance'|'Low'|'Medium'|'High'|'Ultra'|'Neural-*')`. Documented sample counts: Performance 8 AO samples/4 denoise; Low 16/4; Medium (default) 16/8; High 64/8. "Performance: mobile, low-end iGPUs; Low: high-end mobile, iGPUs; Medium: laptops".
- Gotchas stated in the README: changing quality or sample counts recompiles shaders (do it once at startup); transparent objects are rendered twice; hardware MSAA does not work with AO, so add SMAA afterwards; `enableDebugMode()` gives `lastTime` in ms via `EXT_disjoint_timer_query_webgl2`.
- Cost: README gives only relative speedups. [INFER] On a mid laptop at 1080p, Low + `halfRes` is the sane starting point; measure with `lastTime`.

**`GTAOPass`** (three built-in, WebGLRenderer) [SRC: local `examples/jsm/postprocessing/GTAOPass.js`]
- `import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'`; `new GTAOPass(scene, camera, width, height, parameters, aoParameters, pdParameters)`.
- `output` modes in `GTAOPass.OUTPUT` (Default, AO, Denoise, Normal, Depth...). `blendIntensity`. `updateGtaoMaterial({ radius, distanceExponent, thickness, scale, samples, distanceFallOff, screenSpaceRadius })`. Changing `samples`, `screenSpaceRadius` or `distanceFallOff` recompiles. `updatePdMaterial({ lumaPhi, depthPhi, normalPhi, radius, rings, samples })` tunes the Poisson denoise. `setSceneClipBox(box)` limits AO to an AABB, which is useful for confining AO to the visible floors. Doc comment: "better quality than SSAOPass at a higher cost".
- It renders its own depth/normal G-buffer by default (an extra scene render) unless you pass `depthTexture` and `normalTexture` in `parameters`.

**Recommendation:** use N8AO (has a better denoiser, `halfRes`, accumulation, documented quality tiers). `GTAOPass` is the zero-dependency fallback.

### 1.3 Screen-space reflections (SSR)

- WebGL: `SSRPass` (`three/addons/postprocessing/SSRPass.js`) [SRC local]. Options: `{ renderer, scene, camera, width, height, selects, bouncing, groundReflector }`, params `thickness`, `maxDistance` (default 180), `opacity` (0.5), `blur`, `fresnel`, `distanceAttenuation`, `infiniteThick`, `resolutionScale`. It re-renders normals and (in selective mode) metalness, swaps `overrideMaterial`, and uses a `UnsignedShortType` depth texture. It is the heaviest of the three built-in WebGL screen-space passes. [INFER] For a side-view game most reflective surfaces are a few floors and windows, so planar reflectors (1.6) are cheaper and look better.
- WebGPU: `SSRNode` (`three/addons/tsl/display/SSRNode.js`): `quality` 0.5, `maxDistance` 1, `thickness` 0.1, `resolutionScale`, `intensity`, `stochastic`, `binaryRefine`, `blurQuality`, `setHistory()`. Its `environmentNode` must be an equirectangular HDR with CPU-side data; PMREM / `scene.environment` cubemaps are not supported. Since r183, SSR is composited additively [DOC migration guide].
- `realism-effects` also has SSR but see 1.4 for its limits.

### 1.4 Screen-space GI

- **`realism-effects`** `SSGI` [DOC: github.com/0beqz/realism-effects]: runs on pmndrs `postprocessing`; needs `VelocityDepthNormalPass`; also TRAA, motion blur, HBAO, SSR. Documented limitations: **no OrthographicCamera** (PerspectiveCamera only), incomplete `MeshPhysicalMaterial` (transmission, clearcoat, sheen), weak alpha/transparency, no fog support, custom-shader materials unsupported. A v2 and a `poisson-recursive` branch are "work in progress". The README does not state a supported three version. Verdict: risky for this project (it uses FogExp2, transparency for cone shafts, custom lens pass, and probably a perspective camera, but the combination is unproven).
- **`SSGINode`** (WebGPU only, in r185) [SRC local]: `ssgi(beauty, depth, normal, camera)`; `sliceCount` (1-4), `stepCount` (1-32), `radius` (12), `giIntensity` (10), `aoIntensity`, `thickness`. Total samples per pixel = `sliceCount * stepCount * 2`. Documented presets with temporal filtering: low 1 slice/12 steps, medium 2/8, high 3/16. Needs `TRAANode` for temporal filtering or a `DenoiseNode`. Requires the `rg11b10ufloat-renderable` WebGPU feature or logs an error. Docs advise lowering renderer pixel ratio before lowering `resolutionScale`.
- Verdict: SSGI only sees what is on screen, so it cannot light a room from a lamp that is off-screen or from a destroyed wall's off-screen neighbours. In a side view with a fixed camera this is less of a problem, but the cost (1-3 full-res multi-sample passes plus temporal denoise) is poorly matched to a 60-100 character game. **Not recommended** for the first pass.

### 1.5 Contact shadows, light probes, reflection probes

- **Contact shadows:** no built-in. Options: (a) N8AO at small `aoRadius` gives contact darkening; (b) a blob or projected-quad shadow under characters (`ShadowMesh` exists in `examples/jsm/objects`, local listing); (c) a short screen-space shadow march in a custom pass [INFER]. For a side view, a soft dark ellipse decal under each character plus AO is the cheap standard.
- **Irradiance probes: `LightProbeGrid`** [SRC local, r185.1 WebGLRenderer]:
  - `new LightProbeGrid(width, height, depth, widthProbes, heightProbes, depthProbes)`; probe counts default to `Math.max(2, Math.round(size) + 1)` per axis; volume centred on the object position.
  - `grid.bake(renderer, scene, { cubemapSize = 8, near = 0.1, far = 100, bounces = 0, ... })`: renders a cube at each probe, projects to L2 spherical harmonics on the GPU, packs into one `WebGL3DRenderTarget` atlas with Z depth `7 * (nz + 2)`. "Baking is fully GPU-resident: cubemap rendering, SH projection, and texture packing all happen on the GPU with zero CPU readback." Extra `bounces` add indirect passes. During a bake the scene is treated as static.
  - Add the grid to the scene; `WebGLRenderer` picks the grid per object (`findLightProbeGrid`) and sets `USE_LIGHT_PROBES_GRID`. The shader offsets the sample by half a probe spacing along the normal, which limits light leaking at walls.
  - Cost [INFER]: sampling is 7 `texture3D` fetches per fragment for lit materials inside a grid, cheap. Baking cost scales with probe count and `cubemapSize`; keep per-room grids small (one probe per tile or per 2 tiles at 8x8 cube faces), bake at level load and re-bake **one affected room** after destruction or when a light is shot out, not every frame. Timing is `performance.now()` around `bake()`; the source has a commented `console.log` for this.
  - Caveats: it captures diffuse only (no specular). Material shaders change when a grid exists (programs recompile once). I could not find an official list of unsupported material types; test with your photo-scanned `MeshStandardMaterial` set.
- **Reflection probes / env maps:** keep the HDRI PMREM as `scene.environment` for sky/ambient. For interior rooms a per-room low-res `CubeCamera` + `PMREMGenerator.fromCubemap()` bake (once, re-bake on destruction) gives local specular; `LightProbeGenerator` (`examples/jsm/lights/LightProbeGenerator.js`, listed locally) can derive an SH `LightProbe` from a cube render target, which is a lower-tech alternative to `LightProbeGrid` (one `LightProbe` per room costs one extra light term).

### 1.6 Planar reflections for wet floors

- `Reflector` (`three/addons/objects/Reflector.js`): `new Reflector(geometry, { color, textureWidth, textureHeight, clipBias, multisample })` [SRC local]. It re-renders the scene from a mirrored camera each frame it is visible, so cost is about one extra scene render per reflector. `Water`/`Water2` in the same folder build on it.
- [INFER] Budget one or two reflectors at half resolution, and **hide anything expensive** (shafts, particle systems, lamps without a visible need) from the reflection by toggling layers in `onBeforeRender`. One Reflector spanning a whole floor of a 20-storey level is not affordable. Use it only where the camera currently is, and fall back to a fake: a flipped, blurred, low-alpha copy of lamps (emissive quads) drawn just below the floor line.
- Fake wet floor without any render: roughness drop + a `MeshStandardMaterial` `envMap`, + SSR-free "bloom smear" under lamps; sharpen with a rain-ripple normal map (see 3.5).

### 1.7 `three-mesh-bvh` shader ray casting

[DOC: github.com/gkjohnson/three-mesh-bvh README]
- Supports shader-side BVH queries (README points at `example/gpuPathTracingSimple.js` and `example/sdfGeneration.js`; the README itself shows no shader code). Claimed CPU performance: "Casting 500 rays against an 80,000 polygon model at 60fps".
- "The bounds hierarchy is **not** dynamic": skinned/morphed geometry cannot be used (a separate `SkinnedMeshBVH` exists, API may change); modified vertex positions need `refit`; changed topology needs a new BVH. `GenerateMeshBVHWorker` / `ParallelMeshBVHWorker` (SharedArrayBuffer) generate off-thread (`three-mesh-bvh/worker`). `BatchedMesh` is supported through `computeBatchedBoundsTree`.
- Verdict for this game: the world is a chunked, destructible tile grid, so every destruction invalidates a BVH and the shader-side structures (`MeshBVHUniformStruct`; I could not confirm those exact names from the README, they come from my recollection of the library and are listed under "could not verify"). Characters are skinned, so they would not be in the BVH. Use the **tile grid itself** as the acceleration structure instead: a 2D DDA through an occupancy texture (R8, one texel per tile) in a lamp shadow shader is a few dozen texture reads, exact for axis-aligned destructible tiles, and updates with one `texSubImage`. That is the recommended "ray-traced shadow" for the world [INFER; the technique is standard but not documented in three.js].
- The CPU `three-mesh-bvh` is still valuable for **AI line-of-sight and bullets** against chunk meshes with `firstHitOnly` (README), but the tile grid DDA is faster still for this game.

### 1.8 WebGPU status and whether to switch

- Browser support [caniuse.com/webgpu, read 2026-11-10]: Chrome 113+ and Edge supported; Safari 26.0+ **partial**; Firefox **disabled by default** through at least v162; global usage 86.83% supported + 1.8% partial = 88.63%.
- three.js r185: `WebGPURenderer` exists (`three/webgpu`), falls back to a WebGL 2 backend (`forceWebGL: true` to force) [SRC local `WebGPURenderer.js`]. r185 release notes (published 01 Jul per the GitHub release page; npm says 2026-06-25): rendering to texture arrays, WebXR with WebGPU, uncaptured GPU error surfacing, `InstancedMesh` render bundles, `getBuiltinLights`, PCF filter uses `textureGatherCompare` [DOC: github.com/mrdoob/three.js/releases]. Timestamp queries: `trackTimestamp: true` + `await renderer.resolveTimestampsAsync('render')` [SRC local `Renderer.js`, `WebGPUBackend.js`].
- Migration cost: **everything** in the current stack changes: `EffectComposer`/passes become `RenderPipeline` + TSL nodes (renamed in r183), `onBeforeCompile` shader patches (the custom lens pass, the additive cones if they use `ShaderMaterial`) must be rewritten as TSL nodes, N8AO does not support WebGPU, `three-good-godrays` has a TSL port. Known r183-r185 behavioural changes that bite: shadow bias changes (r183), premultiplied alpha change (r185), `SSAAPassNode` clear-colour removal (r185) [DOC migration guide].
- What WebGPU buys here: `ClusteredLighting` (point lights, 1024 default cap), `DynamicLighting` (no recompile when lights are added), GTAO/SSGI/SSR/DoF/motion-blur nodes, compute for particle/crowd work. What it does not buy: shadowed spot lights through the cluster (not clustered in r185).
- **Recommendation:** stay on `WebGLRenderer` for the performance pass and the next feature pass. Revisit WebGPU when (a) Firefox/Safari support is solid and (b) `ClusteredLighting` handles spot lights, or if profiling shows light count is the limiting factor that a different lighting model fixes. A spike is cheap: swap the renderer for `WebGPURenderer({ forceWebGL: true })` in a branch to see how many materials break.

---

## 2. Many dynamic lights

### 2.1 What three.js gives you

| Option | Renderer | Lights it handles | Notes |
|---|---|---|---|
| Default forward lighting | WebGL + WebGPU | all | Every light is evaluated for every fragment of every lit material. Cost is per-pixel x lights. Light count changes recompile programs. |
| `ClusteredLighting` | WebGPU only | non-shadow `PointLight` only (r185) | Defaults `maxLights=1024, tileSize=32, zSlices=24, maxLightsPerCluster=64`. Import `three/addons/lighting/ClusteredLighting.js`; `renderer.lighting = new ClusteredLighting()`. [SRC] |
| `DynamicLighting` | WebGPU only | directional 8, point 16, spot 16, hemisphere 4 (defaults) | Packs lights into uniform arrays so adding/removing lights does not recompile. [SRC] |
| Custom light pooling (current approach) | WebGL | fixed SpotLight pool | Keeps the program light-count constant. |

There is **no** built-in clustered/tiled/deferred path for `WebGLRenderer` in r185. Community deferred/tiled implementations for WebGL exist, but I did not verify any of them (see 9).

The forum has relevant threads (search results from the discourse JSON API): "Clustered Rendering on WebGPU", "Dr.Strangelight or: How I Learned to Stop Worrying and Love the Cluster", "Optimizing Point Lights" [forum search endpoint `discourse.threejs.org/search.json?q=clustered lighting webgpu`; I read only titles, not the posts].

### 2.2 Strategy for hundreds of lights on WebGL (recommended)

Hundreds of lights in the level does not mean hundreds of lights **per pixel**. In a 2.5D side view only the lights near the camera matter.

1. **Light pool + culling by priority.** Keep the pool you have, but drive it from a spatial query (grid cell hash on light positions). Each frame choose the N lights with highest `intensity * falloff(distance to the view centre)` and apply hysteresis so lights do not pop. [INFER]
2. **Pool size** [INFER, measure on target hardware]: a mid laptop iGPU in forward shading with PBR materials will typically cope with about 8-16 non-shadow spot/point lights on screen; about 3-4 shadow-casting spot lights (a 1024 map each); one cascaded/ortho moon light. Beyond that cost grows with full-screen overdraw x lights. These are budgets to verify with GPU timers (section 6), not published numbers.
3. **Fake the rest.** Lamps outside the pool become *emissive geometry + bloom + additive light-pool sprite/decal on the floor and wall* (a pre-made radial gradient quad). This is the standard route to "hundreds of lights" and reads as light in a night scene. Combine with baked `LightProbeGrid` irradiance for "this room is lit warmer".
4. **Baked room lighting + dynamic accents.** Probe grid carries ambient colour per room; only lights that change (flickering, destroyed, alarm) are real dynamic lights.
5. **Disable shadows on distance.** Shadow-casting is by far the dominant cost per light (a cube map for a point light is 6 renders; a spot is 1 render).

### 2.3 Shadow-map caching for static lights

- Per-light and global switches exist in r185 `WebGLShadowMap`: `renderer.shadowMap.autoUpdate` and `renderer.shadowMap.needsUpdate`; and per light `light.shadow.autoUpdate` (default `true`) and `light.shadow.needsUpdate` (default `false`). The render loop skips a light if `shadow.autoUpdate === false && shadow.needsUpdate === false`, and clears `needsUpdate` after rendering. [SRC local `src/renderers/webgl/WebGLShadowMap.js`; `LightShadow.js` doc comments.]
- Pattern: set `light.shadow.autoUpdate = false` for static lamps and set `light.shadow.needsUpdate = true` when a tile within the lamp radius is destroyed, when the lamp is assigned to a pool slot, or on first use. When a pooled shadow-casting SpotLight moves to a new lamp, set `needsUpdate = true` once.
- Gotcha: with a pool, the shadow map belongs to the **pool slot**, not the lamp, so re-assigning a slot invalidates it. Stagger: refresh at most one or two moved shadow maps per frame.
- Changing `shadowMap.type` recompiles all materials and recreates maps [SRC].
- VSM is not supported for point lights in `WebGLShadowMap` (code skips them with a warning) [SRC].
- Shadow tuning: `mapSize` (default 512, power of two), `bias` (about 1e-4 order), `normalBias`, `radius` (blur, no effect with `BasicShadowMap`), `blurSamples` for VSM [SRC `LightShadow.js`]. With `PCFShadowMap` only; do not use `PCFSoftShadowMap` (deprecated, fallback).

### 2.4 Cascaded shadow maps

`DirectionalLight` has one shadow map; r185 has no `CSMShadowNode` in `WebGLRenderer`. (The `three/addons/csm/CSM.js` exists in the addons for WebGL; I did not open it, see 9.) For a side view with an orthographic-like view of a bounded area, a **single moon shadow map fitted to the visible area** (re-fit the ortho shadow camera each frame and snap to texel increments to avoid shimmer) is simpler than cascades. [INFER]

### 2.5 Light cookies and IES-style falloff

- `SpotLight.map` is a cookie texture: "A texture used to modulate the color of the light"; **disabled when `castShadow` is false** (doc warning) [SRC local `SpotLight.js`]. So a cookie requires a shadow-casting spot, which costs a shadow render. For non-shadow lamps, fake a cookie with a projected decal or an additive quad.
- There is no IES support in `SpotLight` (the source has no IES references). IES-like falloff can be had by baking the profile into the cookie texture (the cookie multiplies colour, and a cookie texture can encode an angular falloff), or by custom `onBeforeCompile` patch of the spot attenuation (not recommended for a fixed-pool WebGL pipeline unless profiling demands it).
- Also in the same file: `angle` (max PI/2), `penumbra` (0-1), `decay` (2; don't change for physically correct), `distance` (0 = infinite; **set it finite for culling**, since three skips nothing automatically but a finite range lets you reason about the light's reach).

### 2.6 RectAreaLight for fluorescent panels

- Constraints [DOC: three.js RectAreaLight docs page, fetched]: "There is no shadow support. Only PBR materials are supported." You must init the LTC data: `RectAreaLightUniformsLib.init()` for `WebGLRenderer` (`three/addons/lights/RectAreaLightUniformsLib.js`) or `RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())` for WebGPU.
- Cost [INFER]: LTC evaluation is more expensive per light than a spot. Use for 1-3 hero fluorescent panels near the camera; use emissive plane + bloom for the rest.

### 2.7 Emissive-plus-bloom tricks

- Bright emissive materials (`emissiveIntensity` > 1 with `toneMapped` as needed) feed `UnrealBloomPass`; the bloom threshold selects them. This is the cheapest "light source" there is, with zero light cost.
- INSIDE's lesson, from the Playdead GDC 2016 slide notes: "If bloom calculated with a certain intensity, we need to show source pixel with the same intensity... made a big visual difference to do it right", and they used a separate tight glow pass and a wide fog-glow pass because "the fog-glow and the narrow glows interfered too much" [DOC: loopit.dk/rendering_inside.pdf, notes text extracted]. They also clamp fog to a max value so bright objects such as headlights "bleed through".
- Call of Duty Modern Warfare (2019): the lead engine developer states "every single light in the game is volumetric light; a real light with volumetrics built into it" and that artists control air density per area [DOC: gameinformer.com/2019/08/26/the-impressive-new-tech-behind-call-of-duty-modern-warfare]. Takeaway for a browser game: fake volumetrics per light (see 3.1) rather than one global effect.

---

## 3. Volumetrics and atmosphere

### 3.1 Light shafts

Options, ordered by cost:
1. **Additive cone meshes (current).** Keep, but add: depth-fade (soft particles) so the cone does not cut hard against walls, a noise texture scrolled through the cone, a fresnel-ish edge fade, `depthWrite: false`, and fade by camera distance. Cost: overdraw only.
2. **Local fog volumes à la INSIDE.** The INSIDE talk renders per-light shadowed volumetrics: box-shaped fog volumes defined in the editor, **additive** ("we add the light caught by fog in the room, we do not add fog locally"), geometric clipping of the cone against the volume (3D Sutherland-Hodgman), blue-noise-jittered shadow-map ray march at half resolution, edge-preserving blur, then TAA to integrate. They found brute force needed about 128 samples (3.2 ms) and used about 3 noisy samples with blue noise + TAA instead; the technique is "primarily bandwidth bound" [DOC: loopit.dk/rendering_inside.pdf notes]. This is the best-matching published design for a 2.5D side view. It needs custom shader work in three.js (a half-res pass reading a spot light's shadow map).
3. **`three-good-godrays`** (`GodraysPass(light, camera, params)`, pmndrs `postprocessing` `EffectComposer`): params `density` 1/128, `maxDensity` 0.5, `edgeStrength` 2, `edgeRadius` 2, `distanceAttenuation` 2, `raymarchSteps` 60, `blur` true, `gammaCorrection` true. **Only `PointLight` and `DirectionalLight`**, requires shadow-casting and all objects casting/receiving shadows, tested for three `<0.188` [DOC README]. It does not support `SpotLight`, which is what lamps are here. Not a fit for pooled spot lamps; possible for the single moon `DirectionalLight` through a window.
4. **Frostbite-style froxel volumetrics** (Hillaire, SIGGRAPH 2015: cascaded extinction volume, particle voxelisation, volumetric shadow maps usable by any light; per the course page text "Towards Unified and Physically-Based Volumetric Lighting in Frostbite") [DOC: advances.realtimerendering.com/s2015]. I could not read the slides themselves (the PDF URL I tried returned a 355-byte non-PDF). It requires compute-like 3D texture passes; **not recommended** on WebGL here.

Recommendation: improve the existing cones (1) and add a fake-volume lamp-pool-slot shader, then consider (2) for the 3-4 shadow-casting spots only.

### 3.2 Fog volumes

`FogExp2` is a single global value. For per-room mood: lerp `scene.fog.density` by the room the camera/player is in (ease over about 1 s), and tint colour per room. Local fog boxes: additive back-faced boxes with a depth-based thickness shader (read scene depth; thickness = clamp(back-face depth - front-face-or-scene depth)), cheap in a side view [INFER]. INSIDE recommends keeping fog simple and linear for artistic control: "Simple linear fog!" and "we rely on simple fog A LOT" [DOC loopit.dk].

### 3.3 Dust motes

`Points` or `InstancedMesh` of tiny billboards (single draw call), vertex-shader drift, lit by faking brightness from distance to the nearest 4 lamp positions passed as uniforms, or only drawn inside lamp cones. Spawn only inside the current view and near lights. Cost: negligible for a few thousand points [INFER].

### 3.4 Rain

Instanced streak quads (one draw call), vertex-shader falling with wrap-around, additive, count tied to a quality setting; splash sprites at floor height; ripple rings on puddles via a scrolling normal map or small instanced rings. Shelter volumes: a coverage texture (R8) from the tile grid marks tiles with a roof, so rain only draws where open to the sky [INFER; design suggestion].

### 3.5 Puddle ripples, wetness, heat haze

- Puddle ripples: normal-map layer (tiled ripple flipbook) blended by a `wetness` mask; for `MeshStandardMaterial` patch via `onBeforeCompile` to mix roughness down and add a normal (see 4.5).
- Heat haze: render-to-texture of the scene (already in the composer), distort UVs with scrolling noise inside a mask region in a custom pass; keep to explosions and vents. [INFER]

### 3.6 Smoke that receives light

Soft billboard particles (instanced) with a lit shader: sample the nearest few pooled lights (or the baked room probe) in the vertex shader and tint per-particle; this is the cheap way [INFER]. Full volumetric smoke needs 3D textures and is out of scope on WebGL.

---

## 4. Materials

### 4.1 Detail normals
Add a second tiled normal map for micro-detail on large surfaces: patch `normalmap_pars_fragment`/`normal_fragment_maps` chunks through `onBeforeCompile` to blend (UDN or RNM) a tiled detail normal at about 8-16x frequency. Cost: one extra texture fetch per fragment [INFER]. Verify chunk names against `src/renderers/shaders/ShaderChunk/` for r185 before patching.

### 4.2 Decals
- `DecalGeometry` (`three/addons/geometries/DecalGeometry.js`): `new DecalGeometry(mesh, position, orientation, size)`; it clips the mesh's triangles to a box and builds new geometry [SRC local: constructor args `mesh, position, orientation (Euler), size`]. It is CPU work per decal and **creates a mesh per decal**, so hundreds of bullet holes or scorch marks means hundreds of draw calls and a CPU clip each time. Do not use it for a destructible tile world at scale.
- Recommended instead [INFER]: for a flat side-view wall, a decal is a **camera-facing quad slightly in front of the wall plane**, with `polygonOffset` and `depthWrite:false`, rendered as **one `InstancedMesh`** (or `BatchedMesh`) with a decal atlas texture and per-instance UV offset, tint and alpha. Ring-buffer it (for example 256 slots); the oldest is replaced. When a tile is destroyed, remove decals whose centre is inside the tile.
- Grime: bake into the tile atlas variants (3-4 variants per tile type) selected per tile at mesh time, no runtime cost. Screen-space deferred decals are not available in WebGL forward rendering without a depth+normal pre-pass.

### 4.3 Parallax occlusion mapping
three has `displacementMap` (real vertex displacement, needs tessellation) but no built-in POM in r185 `MeshStandardMaterial` (I found no parallax chunk in the shader chunk list; see 9). A POM patch via `onBeforeCompile` costs 8-32 texture fetches per fragment on every affected pixel. For a flat side-view wall that is viewed nearly head-on, parallax has little visible effect. **Not recommended**; rely on good normal maps + AO + the detail normal.

### 4.4 Emissive screens, neon, flicker
- Emissive: `emissive`, `emissiveMap`, `emissiveIntensity` driven per frame. Flicker: drive `emissiveIntensity` from a shared noise function; for 100 neon signs use a single uniform array and an instance attribute rather than 100 materials.
- **Material count discipline:** one material per texture-set, flicker by instance attribute or by `onBeforeRender` uniform, not by cloning the material per sign. Cloned materials = more programs only if defines differ, but more state changes and draw calls regardless.
- Bloom threshold: keep `UnrealBloomPass` threshold just above the brightest lit surface so only emissive screens and neon glow.

### 4.5 Wetness
Single uniform `wetness` (0-1) and a per-tile or per-vertex mask attribute: `roughness = mix(roughness, 0.1, wet)`, `diffuse *= mix(1, 0.6, wet)`, optionally sharper env reflection. Implement through `onBeforeCompile` replacing `roughnessmap_fragment`. Cost: nearly free [INFER].

### 4.6 Glass and transmission
`MeshPhysicalMaterial.transmission` triggers an extra opaque-scene render pass (`renderTransmissionPass` in `WebGLRenderer`; I confirmed that function exists in the source) and is expensive when many glass objects are visible. For windows in a side-view level, use `MeshStandardMaterial` with `transparent: true, opacity ~0.15-0.3`, a roughness 0 + env map, and a thin fresnel/specular streak texture. Reserve true transmission for one or two hero objects. [INFER on cost; SRC for the function's existence.]

### 4.7 Keeping draw calls and materials low
- **Texture arrays / atlases:** photo-scanned PBR sets (albedo, normal, ARM) per material means at least 3 textures per material. Pack roughness/metalness/AO into one ARM texture. A `DataArrayTexture` with per-instance layer index gives many surface types in one material and one `InstancedMesh` (needs a small shader patch). KTX2 supports array/cube data; the loader is `three/addons/loaders/KTX2Loader.js` (local listing).
- **Chunk meshing (current):** 16x16 chunks are already the right granularity: one draw call per material per chunk. Merge opaque geometry of one chunk by material (vertex-colour or attribute-based tile variants), and re-mesh only dirty chunks. Add a **second, coarser LOD** or merge distant chunks when they are static.
- **`InstancedMesh`:** props, decals, rain, dust. r185 adds full render-bundle support for `InstancedMesh` on WebGPU [DOC release notes]; this does not apply to WebGL.
- **`BatchedMesh`** [SRC local `src/objects/BatchedMesh.js`]: `new BatchedMesh(maxInstanceCount, maxVertexCount, maxIndexCount, material)`; `addGeometry(geometry, reservedVertexCount, reservedIndexCount)` returns an id; `addInstance(geometryId)`; `setMatrixAt`, `setColorAt` (lazy colour texture), `setVisibleAt`, `setGeometryIdAt`; `deleteInstance`, `deleteGeometry`, `optimize()`; `perObjectFrustumCulled` (default `true`) and `sortObjects` (default `true`; transparent back-to-front, opaque front-to-back) and `setCustomSort`. It draws **many different geometries sharing one material in one call** via multi-draw (WebGL uses `WEBGL_multi_draw` where available [INFER, I did not open the extension handling]). There is **no LOD API** in the file. Good fit for: crates, doors, props with the same material; characters if they share a material and you animate them without skeletons (see 6.4). No r185-specific `BatchedMesh` changes appear in the r185 release notes read (only `getColorAt` fixes in r184) [DOC releases].
- **Merging static geometry:** `BufferGeometryUtils.mergeGeometries` (`three/addons/utils/BufferGeometryUtils.js`) for fully static scenery chunks.

---

## 5. Post-processing stack, filmic grungy cyberpunk night and overcast day

### 5.1 Tone mapping choice
r185 constants: `NoToneMapping 0, Linear 1, Reinhard 2, Cineon 3, ACESFilmic 4, Custom 5, AgX 6, Neutral 7` [SRC local `constants.js`]. `OutputPass` reads `renderer.toneMapping` and defines `ACES_FILMIC_TONE_MAPPING`, `AGX_TONE_MAPPING`, `NEUTRAL_TONE_MAPPING` etc., copies `toneMappingExposure` every frame, and recompiles only when the mode or output colour space changes [SRC local `OutputPass.js`].
- **ACES Filmic:** contrasty, saturated, hue-skews bright saturated lights toward white/yellow. Good punchy night with neon, but clips neon blues and magentas toward cyan/white. [INFER]
- **AgX:** keeps saturated bright colours from skewing; lower contrast; desaturates highlights more naturally. Good for the overcast day; pair with a contrast curve/LUT. [INFER]
- **Neutral (Khronos PBR Neutral):** colour-accurate, minimal look, intended for product viewers; flat for a stylised look unless graded. [INFER; the constant doc says "based on the Khronos 3D Commerce Group standard"]
- Recommendation: **AgX for day, ACES for night** (or AgX + a grading LUT for both so look is authored, not accidental). Tone map **once**, in `OutputPass` at the end (the current design); keep the composer in `HalfFloatType`. Note pmndrs `postprocessing` advises `NoToneMapping` on the renderer and a `ToneMappingEffect` at the end of the chain [DOC README].

### 5.2 Order (WebGL EffectComposer)
1. `RenderPass` (HDR half-float target), or N8AO replacing it
2. AO (N8AO) / SSR if used
3. Depth of field (`BokehPass`), if used (see 5.5)
4. `UnrealBloomPass` (HDR, before tone map)
5. Motion blur (see 5.6) - before bloom is also defensible
6. Custom pass: chromatic fringe, lens dirt (needs HDR input to be meaningful), anamorphic streak
7. `LUTPass` (grading) - note: after tone map for a conventional LDR LUT; before for a log/HDR LUT
8. `OutputPass` (tone map + sRGB)
9. `SMAAPass` (needs LDR sRGB input) or TAA
10. Film grain + vignette last (perceptual, post-AA so grain is not smoothed)

[INFER on ordering; grounded in: three's `UnrealBloomPass`/`SMAAPass`/`LUTPass`/`BokehPass` classes exist in `examples/jsm/postprocessing` (local listing); N8AO README says add SMAA afterwards since MSAA does not work with AO; Playdead notes that TAA must precede bloom so the bloom mask is anti-aliased: "TAA feeds into the bloom (important, as it also AAs the bloom-mask - very hard to do decent HDR-glow with aliasing input)" [DOC loopit.dk].]

### 5.3 Bloom
`UnrealBloomPass(resolution, strength=1, radius, threshold)` [SRC local]. Starting values [INFER]: night: `strength 0.6-1.0`, `radius 0.5-0.8`, `threshold 0.85-1.0` (on HDR values, so emissive > 1 blooms); day: `strength 0.15-0.3`, `threshold 1.0`. Run the pass at **half resolution** (pass `new Vector2(w/2, h/2)`); the mip chain makes it soft anyway. INSIDE used a 9-tap bilinear-exploiting blur instead of 13 taps to save about 0.1 ms [DOC loopit.dk].

### 5.4 Colour grading, LUTs
`LUTPass` (`three/addons/postprocessing/LUTPass.js`) takes `{ lut: Data3DTexture, intensity }` [SRC local]. Load `.cube` with `LUTCubeLoader` or `.3dl` with `LUT3dlLoader` (`three/addons/loaders/`; I did not list them locally, see 9). One 32x32x32 LUT per mood, cross-fade between two by intensity at room transitions. Cheap (one fetch).

### 5.5 Depth of field for foreground blur
`BokehPass(scene, camera, { focus, aperture, maxblur })` [SRC local, parameters inferred from the file's `Options` typedef; I did not read its body]. It re-renders the scene for depth, so it adds a scene pass. In a side-view game the useful DoF is **foreground blur** (out-of-focus pipes, grates, railings close to the camera). Cheaper alternative: render foreground layer objects to a separate low-res target, blur (Kawase), and composite over the frame [INFER]. WebGPU has `DepthOfFieldNode` (`dof(node, viewZ, focusDistance, focalLength, bokehScale)`) [SRC local]. Use sparingly: DoF with a cheap blur on a single foreground layer is better than full-scene DoF.

### 5.6 Motion blur
Needs per-object velocity. WebGPU: `motionBlur(inputNode, velocity, numSamples=16)` [SRC local `MotionBlur.js`]. WebGL: only via `realism-effects` (needs `VelocityDepthNormalPass`) [DOC]. For a side-view game, skip full motion blur; use **camera-shake blur / directional blur on explosions** and per-sprite smear.

### 5.7 Film grain, anamorphic streaks, lens dirt
- Grain: the existing custom lens pass is fine; apply after tone map, luminance-weighted (more in shadows), animated per frame.
- Anamorphic streaks: bloom variant stretching horizontally; since `AnamorphicNode` was removed, use `BloomNode` high-pass injection (WebGPU) or a custom 2-3 tap-per-mip horizontal blur from the bright-pass in WebGL. INSIDE references the Oat "steerable streak filter" for such effects [DOC loopit.dk notes]. Only on the brightest pixels (threshold higher than bloom).
- Lens dirt: multiply a dirt texture by the **bloom buffer** (not the final image) so it only shows around bright lights.

### 5.8 Anti-aliasing after post
- **SMAA** (`SMAAPass`) after `OutputPass` is the safe default (MSAA does not work with AO, N8AO README).
- **TAA** (`TAARenderPass`, WebGL, `three/addons/postprocessing/TAARenderPass.js`; local listing) renders the scene multiple times with jitter and accumulates; it is intended for still scenes and ghosts on motion. For a moving side-view game with characters, prefer SMAA. A real TAA with velocity needs motion vectors (`TRAANode` on WebGPU; `realism-effects` `TRAA` on pmndrs). INSIDE's use of TAA to integrate undersampled effects is an important design lesson but needs a velocity buffer [DOC loopit.dk].

---

## 6. Performance practice at this scale

### 6.1 Profiling
- `renderer.info`: `render.calls`, `render.triangles`, `memory.geometries`, `memory.textures`; set `renderer.info.autoReset = false` and call `renderer.info.reset()` once per frame when using the composer, otherwise the counters reflect only the last pass [SRC/DOC: WebGLRenderer docs: "when having multiple render passes per frame (e.g. when using post processing) it can be preferred to reset with a custom pattern. First, set autoReset to false"].
- GPU timing, WebGL: `EXT_disjoint_timer_query_webgl2` through `gl.getExtension`, wrap each pass; N8AO already exposes `lastTime` via `enableDebugMode()` [DOC]. Many browsers restrict this extension (privacy); expect it unavailable in some, in which case use frame-time deltas with passes toggled.
- GPU timing, WebGPU: `new WebGPURenderer({ trackTimestamp: true })`, then `await renderer.resolveTimestampsAsync('render')` [SRC local]. 
- Chrome DevTools Performance panel and the Spector.js extension for draw call capture [INFER; not read].

### 6.2 Draw call budget
[INFER] A realistic budget for a mid laptop on WebGL: under about 500-1000 draw calls and under about 3-5M triangles per frame, the CPU side of three.js usually dominating before the GPU. Measure with `renderer.info.render.calls`. Shadow passes multiply: each shadow-casting light is another scene traversal, so **count them**: `calls_total = main + sum(shadow passes) + AO G-buffer + reflector`. Disable `castShadow` on small props and on far chunks, and give shadow lights a restricted `shadow.camera` near/far so fewer objects are in frustum.

### 6.3 Culling, LOD, dirty chunks
- Frustum culling is automatic per object (`frustumCulled`); make sure chunk meshes have correct `boundingSphere` after remeshing (`geometry.computeBoundingSphere()`), otherwise they will be culled wrongly or never.
- Floors outside the camera's vertical range (a 20-storey complex): hide chunk groups by floor index rather than relying on frustum tests; set `object.visible = false` (skips traversal of the subtree).
- Distance-cull characters, particles, and lights (pool selection) by floor and screen distance. Pause animation updates for characters off-screen (AI keeps ticking at lower frequency).
- Only remesh chunks flagged dirty, at most N per frame, on a worker if meshing is heavy; reuse `BufferAttribute` buffers and use `setDrawRange`/`updateRanges` rather than allocating new geometry; dispose old geometry. [INFER]

### 6.4 Instancing characters
60-100 characters is fine as separate meshes **if** they share geometry/material and are culled. Options: (1) `SkinnedMesh` per character: one draw call each plus bone uniform upload; bone count limits apply. (2) `BatchedMesh` for static-pose or sprite-sheet-like characters (no per-instance skeleton in r185 `BatchedMesh`; I found none in the API listing). (3) For a 2.5D game, characters as **instanced animated quads with a sprite/atlas** or vertex-animation-texture meshes: one draw call for all. Measure before choosing; 100 skinned meshes (100 calls) is acceptable on desktop. [INFER]

### 6.5 Adaptive resolution
Dynamic pixel ratio: measure a moving average of frame time; if above the budget (for example 18 ms) for N frames, step `renderer.setPixelRatio()` (and `composer.setPixelRatio()`, `composer.setSize`) down by 0.1-0.25 with a floor of about 0.6-0.75, step up slowly after a long stable run. Resizing render targets causes a hitch, so quantise to a few steps. Screen-space passes (AO, bloom) scale with it, so this is the first lever to pull. N8AO `halfRes` is a second, independent lever. [INFER; API: `setPixelRatio` and `getPixelRatio` exist in `WebGLRenderer` (docs).]

### 6.6 Shader compile stutter
`renderer.compileAsync(scene, camera, targetScene)` uses `KHR_parallel_shader_compile` and returns a Promise resolving when the scene can render without compile stalls [SRC local `WebGLRenderer.js` doc comment]. Call it at load for a **warm-up scene** that contains one of every material variant and with the **full light pool enabled** (programs depend on light counts, shadow flags, fog, probe-grid presence (`USE_LIGHT_PROBES_GRID`), tone mapping). Keep the light/shadow counts constant at runtime (fixed pool) so no new program is needed. Also pre-render N8AO/Bloom once and avoid changing N8AO quality or `GTAOPass` `samples`/`screenSpaceRadius` at runtime (they recompile, per N8AO README and `GTAOPass.js`).

### 6.7 Texture memory
`KTX2Loader` (`three/addons/loaders/KTX2Loader.js`, local listing) with `.setTranscoderPath()` for the basis transcoder and `.detectSupport(renderer)`; Basis UASTC for normal maps, ETC1S for albedo. GPU-compressed textures cut VRAM about 4-8x versus RGBA8, and also cut upload time. `MeshoptDecoder`/`DRACOLoader` exist for geometry (local listing). Generate mipmaps, limit anisotropy to 4-8 on tile textures. Share textures between materials; `dispose()` things you remove (check `renderer.info.memory`). [INFER on ratios.]

### 6.8 Other
- `powerPreference: 'high-performance'` on the context (documented option). `antialias: false` when using composer + SMAA. `logarithmicDepthBuffer` disables early-Z through `gl_FragDepth` per the docs, so do not enable it; `reversedDepthBuffer` is the documented faster alternative, needing `EXT_clip_control` [SRC docs text: "This is a more faster and accurate version than logarithmic depth buffer"].
- Avoid per-frame allocation (`new Vector3()` in loops), sort transparent particle layers manually, set `matrixAutoUpdate = false` on static objects and `updateMatrix()` once.

---

## 7. Costs and recommendations summary

| Effect | Best option now | Cost [INFER unless noted] | Verdict |
|---|---|---|---|
| AO | N8AO Low + `halfRes` | 1-2 ms mid GPU; `lastTime` to measure | Do first |
| Local GI | `LightProbeGrid` per room (r185 core) | bake once per room; 7 3D fetches per fragment | Do second |
| Reflections (floors) | 1-2 `Reflector`s + fake streaks | +1 scene render each | Selective |
| SSR | skip | heavy | No |
| SSGI | skip | heavy, WebGPU or unproven lib | No |
| Contact shadows | AO + blob under characters | trivial | Yes |
| Real shadows | moon (1) + 3-4 spots, cached with `shadow.autoUpdate=false` | per light one scene render when updated | Keep, cache |
| Many lights | pool + fakes (emissive/bloom/light-pool quads) | cheap | Yes |
| Light shafts | improve cones; INSIDE-style local volumes later | overdraw / half-res pass | Improve |
| Godrays | `three-good-godrays` only for moon | n/a; spot unsupported | Maybe |
| Decals | one instanced quad-decal system | 1 draw call | Yes; skip `DecalGeometry` |
| POM | skip | high | No |
| Glass | alpha + env map | cheap vs transmission | Yes |
| Path tracing / BVH shader rays | skip | n/a | No (tile DDA instead) |
| WebGPU | stay on WebGL | rewrite | Defer |

---

## 8. (a) Recommended rendering architecture, in priority order

1. **Measure first.** Add a debug HUD: `renderer.info.render.calls/triangles`, frame time moving average, per-pass GPU timing where the timer extension exists, and a toggle for each effect. Everything below is gated on numbers from the target laptop.
2. **Fix the lighting budget structure.** Fixed-size light pool selected by spatial priority + hysteresis; shadow-casting lights capped (moon + 3-4 spots) with `light.shadow.autoUpdate = false` and `needsUpdate` triggered by tile destruction or slot reassignment; non-pool lamps become emissive + bloom + light-pool quads. Set finite `SpotLight.distance`. Replace `PCFSoftShadowMap` with `PCFShadowMap`.
3. **Per-room baked irradiance with `LightProbeGrid`** (r185 WebGLRenderer, no custom shader). Bake at load, re-bake the affected room on major destruction or light-out events, ranged/spread over frames if needed. This provides the "RT-style" coloured bounce lighting cheaply and decouples ambient look from the dynamic pool.
4. **N8AO** for AO (Low or Medium + `halfRes`), SMAA after output. Avoid MSAA.
5. **Tone mapping and grade:** AgX for day, ACES for night through `OutputPass`; one 32^3 LUT per mood; HDR half-float composer; bloom at half resolution with emissive-driven threshold; custom lens pass last.
6. **Atmosphere:** upgrade cone shafts (soft depth fade, noise); per-room fog density/colour; instanced dust and rain with a roof mask from the tile grid; later, INSIDE-style half-res noisy volumetrics for shadow-casting spots.
7. **Draw-call and material hygiene:** instanced decals; `BatchedMesh` or instancing for props; chunk meshes merged per material; texture atlas/array; KTX2 textures; characters at 60-100 with culling by floor and distance.
8. **Selective reflections:** one or two half-res `Reflector`s on hero wet floors; fake elsewhere.
9. **Revisit WebGPU** when `ClusteredLighting` supports spot lights (or when the many-lights problem dominates and Firefox/Safari are acceptable), as a branch spike with `forceWebGL: true` to estimate the porting cost.

## 9. (b) Performance-pass checklist

- [ ] `renderer.info.autoReset = false`; reset once per frame; log calls, triangles, geometries, textures.
- [ ] Count shadow-casting lights; each is a full scene traversal. Cap at moon + 3-4.
- [ ] Set `light.shadow.autoUpdate = false` on static lamps; `needsUpdate = true` on tile destruction nearby and on pool slot reassignment; stagger at most 1-2 refreshes per frame.
- [ ] `shadowMap.type = PCFShadowMap` (not `PCFSoftShadowMap`).
- [ ] Right-size shadow `mapSize` (512-1024), tight `shadow.camera` near/far/fov, `bias` ~1e-4 and `normalBias`.
- [ ] Fixed light pool; constant light/shadow counts so programs never change at runtime.
- [ ] `renderer.compileAsync(warmupScene, camera)` at load with the full pool, all materials, fog, probe grid, and each toneMapping the game will use.
- [ ] No runtime change of N8AO quality, `GTAOPass` `samples`, or `shadowMap.type`.
- [ ] Composer in `HalfFloatType`; bloom at half-res; AO `halfRes`; one tone map in `OutputPass`.
- [ ] Dynamic pixel ratio with 3-5 quantised steps, floor about 0.6-0.75.
- [ ] Hide whole floors/chunk groups outside the camera range (`visible = false`); recompute `boundingSphere` on remesh; remesh only dirty chunks, N per frame.
- [ ] Characters: share geometry/material; cull by floor/distance; throttle off-screen animation; consider instanced sprite/VAT for crowd.
- [ ] Instanced decals with ring buffer; instanced rain/dust; no `DecalGeometry` at scale.
- [ ] Merge static props; `BatchedMesh` for shared-material props; `matrixAutoUpdate = false` on static objects.
- [ ] KTX2 (Basis) textures with mipmaps; pack ARM; reduce anisotropy; dispose what you remove; watch `info.memory.textures`.
- [ ] Remove unused `transparent` flags and double-sided where not needed; keep transparent overdraw (cones, glass, particles) small; `depthWrite:false` on additive.
- [ ] `powerPreference: 'high-performance'`; `antialias: false` with composer + SMAA.
- [ ] Verify results on a mid laptop with GPU timers (or toggling passes) before and after every change; keep a table of ms per pass.

---

## 10. Could not verify

- **threejs.org docs hosts:** `WebFetch` could not resolve `threejs.org`, but `curl` worked for `RectAreaLight.html` and `WebGLRenderer.html`; `WebGLShadowMap.html` returned a redirect stub. I therefore relied on the installed r185.1 source for most API facts. Docs pages for `SpotLightShadow`, `BatchedMesh`, the WebGPU post-processing manual (`threejs.org/manual/en/webgpu-postprocessing`) were not read.
- **Digital Foundry on MW2019:** the Eurogamer URLs I tried returned 404; I found no DF analysis. The MW2019 evidence here is a Game Informer interview with Michal Drobot (gameinformer.com) and the Activision blog "Initial Intel" article (read, only photogrammetry/volumetric/spectral rendering points used). I did **not** read the SIGGRAPH 2020 "Advances" talks by Infinity Ward (the index page lists them) so nothing is claimed about their light culling or shadow-atlas details.
- **Frostbite volumetric slides:** the EA/Frostbite pages returned 404 and the PDF link I guessed returned a stub. The description in 3.1 comes only from the SIGGRAPH 2015 course index page text (via `advances.realtimerendering.com/s2015/index.html`). Froxel grid sizes and timings are **not** verified.
- **Trine rendering:** the Frozenbyte postmortem page I fetched (gamedeveloper.com) contains no rendering content; I found no primary Trine rendering talk. Nothing is claimed from Trine.
- **INSIDE:** read from the slide-notes PDF at `loopit.dk/rendering_inside.pdf`; the GDC Vault page is behind a login. Slide images and numbers not in the notes text are unverified.
- **Performance numbers:** every ms figure, light budget (8-16 unshadowed, 3-4 shadowed), draw-call budget (500-1000), and VRAM ratio is my estimate [INFER]. No benchmark of this game or of mid-laptop GPUs was available or run.
- **`three-mesh-bvh` shader API names** (`MeshBVHUniformStruct`, `bvhIntersectFirstHit`, `shaderStructs`, `shaderIntersectFunction`): the README does not mention them; I did not open the library source or examples.
- **`LightProbeGrid` material compatibility** (which material types sample the grid), its re-bake cost, and any seam/leak behaviour: not measured; only source structure was read.
- **`three/addons/csm/CSM.js`, `LUTCubeLoader`, `LUT3dlLoader`, `TAARenderPass` internals, `BokehPass` body, `ShadowMesh` behaviour, `BufferGeometryUtils`**: existence inferred from listings or memory; bodies not read.
- **WebGL multi-draw for `BatchedMesh`:** the class doc says draws use `_updateDrawParameters`; I did not confirm `WEBGL_multi_draw` use or its fallback speed.
- **Detail-normal and wetness shader chunk names** for `onBeforeCompile` patches: not checked against the r185 chunk list.
- **Community WebGL deferred/tiled/clustered implementations:** I did not evaluate any. The forum titles listed in 2.1 are search-result titles only; the posts were not read.
- **Firefox/Safari WebGPU current state beyond caniuse:** caniuse data only; no vendor release notes read.
- **WebGPU `ClusteredLighting` limits behaviour** when `maxLights` or `maxLightsPerCluster` is exceeded: not documented in the source I read.

## 11. Sources

three.js (r185.1 installed source and repo)
- `/home/user/orcfall-command/node_modules/three` (package.json 0.185.1): `src/renderers/WebGLRenderer.js`, `src/renderers/webgl/WebGLShadowMap.js`, `src/lights/SpotLight.js` and `LightShadow.js` (also read at raw.githubusercontent.com/mrdoob/three.js/dev/src/lights/), `src/objects/BatchedMesh.js`, `src/constants.js`, `examples/jsm/lighting/{ClusteredLighting,DynamicLighting,LightProbeGrid}.js`, `examples/jsm/tsl/lighting/ClusteredLightsNode.js`, `examples/jsm/tsl/display/{GTAONode,SSGINode,SSRNode,GodraysNode,BloomNode,DepthOfFieldNode,MotionBlur}.js`, `examples/jsm/postprocessing/{GTAOPass,SSRPass,OutputPass,UnrealBloomPass,SMAAPass,LUTPass,BokehPass}.js`, `examples/jsm/geometries/DecalGeometry.js`, `examples/jsm/objects/Reflector.js`, `src/renderers/common/Renderer.js`, `src/renderers/webgpu/{WebGPURenderer,WebGPUBackend}.js`
- https://github.com/mrdoob/three.js/releases (r185, partial r184)
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
- https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/lighting/ (LightProbeGrid, LightProbeGridWebGL, RayTracedRadiosity, DynamicLighting, ClusteredLighting; `dev` = r186+)
- https://threejs.org/docs/pages/RectAreaLight.html and https://threejs.org/docs/pages/WebGLRenderer.html (fetched with curl)
- https://registry.npmjs.org/three (versions and dates)
- https://discourse.threejs.org/search.json?q=clustered%20lighting%20webgpu (titles only)

Libraries
- https://github.com/N8python/n8ao
- https://github.com/0beqz/realism-effects
- https://github.com/pmndrs/postprocessing
- https://github.com/ameobea/three-good-godrays
- https://github.com/gkjohnson/three-mesh-bvh (README also at raw.githubusercontent.com/gkjohnson/three-mesh-bvh/master/README.md)
- https://github.com/gkjohnson/three-gpu-pathtracer

Platform and talks
- https://caniuse.com/webgpu
- INSIDE rendering slides (notes text): https://loopit.dk/rendering_inside.pdf ; GDC Vault listing https://www.gdcvault.com/play/1023002/Low-Complexity-High-Fidelity-INSIDE
- https://gameinformer.com/2019/08/26/the-impressive-new-tech-behind-call-of-duty-modern-warfare
- https://blog.activision.com/call-of-duty/2019-06/Initial-Intel-Call-of-Duty-Modern-Warfares-game-engine-is-put-through-its-paces
- https://advances.realtimerendering.com/s2015/index.html (Hillaire, Frostbite volumetrics: course description only)
- https://advances.realtimerendering.com/s2020/index.html (listed by search; not read)
