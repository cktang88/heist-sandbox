# Rendering and loading performance research: Smash & Grab

Date: 2026-11-10. Installed: `three@0.185.1` (`/home/user/orcfall-command/node_modules/three`).

The target: about twice the frame rate and no hitches, from a starting point of about 1,500 draw calls, 4.85 M triangles, 989 textures and 148 shader programs in a typical view.

## How to read this

- **[SRC]** means I read it in the installed three.js source and the API exists in 0.185.1.
- **[DOC]** means I read it on a web page (MDN, web.dev, glTF-Transform docs, npm registry).
- **[INFER]** is my judgement. Every "large / medium / small" size is an estimate from the numbers you gave me, not a measurement. Measure before and after (section 9).
- GitHub pages could not be fetched from this environment (the proxy blocks them), so links to GitHub repos are listed from memory of where those projects live. I checked their npm versions from the npm registry where noted.
- `docs/research/rendering.md` already covers lights, shadow caching, probes and WebGPU in depth. This file does not repeat it; it points to it and focuses on cost.

## What the code does today (read from `/home/user/orcfall-command/src`)

- `src/render3d/renderer3d.ts`: `WebGLRenderer({ antialias: false })`, `PCFShadowMap`, `shadowMap.autoUpdate = true`, `renderer.info.autoReset = false`, a quality ladder with resolution scale. `warmUp()` already calls `renderer.compileAsync(scene, camera)` after building a level, with a time limit.
- `src/render3d/post.ts`: a `EffectComposer` with a half-float target that has a depth texture, then `RenderPass`, `GTAOPass` (full resolution), `UnrealBloomPass`, `OutputPass`, `SMAAPass` (or 4x MSAA on the top rung), and one custom grade `ShaderPass`. That is 6 to 7 full-screen passes plus the AO internals.
- `src/render3d/propbatch/batchPlan.ts`: one `BatchedMesh` per batch plan, built synchronously in `build()`; `sortObjects` is off for opaque materials. It does not set `perObjectFrustumCulled`.
- 90 `CanvasTexture` uses across `src/render3d` (props, art, skyline, neighbours, foreground). These are the likely source of most of the 989 textures.
- `src/render3d/lighting/lampLights.ts`: a fixed pool of `PointLight` and `SpotLight`. This is already the right design for keeping programs stable.

The three source facts that matter most:

- `compileAsync(scene, camera, targetScene)` exists, uses `KHR_parallel_shader_compile` when present, and polls `program.isReady()` [SRC `WebGLRenderer.js` ~1487].
- `initTexture(texture)` exists and uploads a texture before first use [SRC ~3529].
- A program's cache key includes `numSpotLights`, `numPointLights`, `numSpotLightShadows` and so on [SRC `WebGLPrograms.js` ~340-348, 474], and `material.customProgramCacheKey()` which defaults to `onBeforeCompile.toString()` [SRC `Material.js` 543-545]. So many materials with the same patch but different closures share one program only if the patch source text is identical.
- `BatchedMesh` does a CPU loop over every instance each frame for frustum culling and (optionally) sorting [SRC `BatchedMesh.js` ~1522-1677]. Flags: `perObjectFrustumCulled`, `sortObjects`, `setCustomSort`. It uses `WEBGL_multi_draw` when the browser has it [SRC `WebGLBufferRenderer.js` 33, `WebGLIndexedBufferRenderer.js` 42].

---

## Do these first (ranked)

1. **Measure first, in a fixed benchmark (small effort, enabler for everything).** Add a GPU timer (`EXT_disjoint_timer_query_webgl2`) and a long-task observer to the existing `?debug=1` overlay, and record a scripted camera walk through the level so every change is compared on the same path. Without this, the rest is guessing. Section 9.
2. **Stop building on the main thread: time-slice the builds and move geometry work to workers (large for hitches).** Build chunks and prop batches in a queue with a per-frame time budget, build vertex arrays in a worker and transfer the `ArrayBuffer`s, and build ahead of the camera (prefetch regions in the travel direction). Sections 1.3, 1.4.
3. **Pre-warm everything that can appear, not just what is on screen (large for hitches).** Run `compileAsync` and `initTexture` on one hidden "all material variants" showcase at level load, and for each newly streamed region upload its textures and compile its materials one per frame before it is made visible. Sections 1.1, 1.2.
4. **Cut the 989 textures and 148 programs with atlases and shared materials (large for CPU cost and hitches, medium for GPU).** Pack the procedural canvas textures into a few atlases (or array textures), share materials, make `onBeforeCompile` patches produce identical program keys. Sections 1.5, 1.6, 4.1.
5. **Remove triangles that can never be seen (large; 4.85 M is far more than a fixed side camera needs).** Delete the faces of tile walls that touch another solid tile, the backs of props that face away from the camera, and the far side of anything against a wall; merge coplanar wall faces. Then simplify props with meshoptimizer. Sections 3.1, 3.2.
6. **Stop redrawing shadows every frame (large; the shadow pass draws the scene again for every shadow light).** Cache static shadow maps with `light.shadow.autoUpdate = false` plus `needsUpdate`, restrict `castShadow` to props that matter, and add a cheap blob/contact shadow for people and small props. Section 5. Details already in `docs/research/rendering.md` section 2.3.
7. **Make post-processing cheaper (medium to large; fill rate is probably the limit at full resolution).** Run AO at half resolution, fold the output and grade passes together, drop SMAA or MSAA in favour of one choice, and let the existing resolution ladder scale the whole chain. Section 6.
8. **Pre-render things that never change relative to the camera (medium to large).** Distant skyline, neighbour buildings, and far-away rooms become flat cards or sprites; people at small size can be sprite atlases. This is the standard trick for a fixed camera. Sections 3.5, 7.
9. **Reduce draw calls by merging static geometry per region and turning off per-instance work you do not need (medium).** Merge the 16x16 wall chunks that never change; give opaque `BatchedMesh` `perObjectFrustumCulled = false` for small regions, and cull whole regions instead. Section 3.4.
10. **Compressed textures (KTX2/Basis) for anything loaded from files (medium; mostly GPU memory and upload time, not frame rate).** Not useful for `CanvasTexture`s unless they are baked to files first, so it follows item 4. Section 1.7.

Not recommended now: moving the whole renderer into a worker (section 2) and switching to WebGPU (section 8). Both are large costs for gains that items 2 to 7 deliver more cheaply.

---

## 1. Avoiding hitches

A hitch is a frame that takes far longer than the others. In your game the causes are known: building geometry (CPU), compiling a new shader (CPU stall, then GPU), uploading a texture or a big buffer (CPU and driver stall), and creating a render target or shadow map.

### 1.1 `WebGLRenderer.compileAsync` (you already use it once)

- **What:** compiles every material in a scene without blocking, using the browser's parallel shader compiler, and resolves when all are ready. [SRC `WebGLRenderer.js` 1487] `compile()` (sync) returns the set of materials; `compileAsync` waits for them.
- **Gain:** large for hitches caused by first sight of a material. Your level-load call covers only what exists in the scene at that time.
- **How to extend it:** `compile` collects lights with `traverseVisible` but collects materials with a plain `traverse` of the object you pass, so meshes with `visible = false` are still compiled and frustum position is irrelevant [SRC `WebGLRenderer.js` ~1380-1440]. So (a) put one tiny hidden instance of each material variant in a "showcase" group and compile that at load; (b) when a new region is built, add it to the scene with `visible = false`, call `compileAsync(region.group, camera, scene)`, wait, then reveal it. Confirm with a test that `renderer.info.programs.length` does not grow when the region is revealed.
- **Light count:** compile with the same pooled lights present (lights in the scene), because the light counts are part of the program key. If you compile with lights at intensity 0 but still in the scene, the programs still match. Do not add or remove pool lights later.
- **Cost / risk:** low. A fixed time limit (you have one) is right; on drivers without `KHR_parallel_shader_compile` it falls back to polling every 10 ms [SRC 1527-1545].
- **Links:** three.js docs `WebGLRenderer.compileAsync`; Khronos `KHR_parallel_shader_compile`.

### 1.2 `WebGLRenderer.initTexture`

- **What:** uploads a texture to the GPU now instead of at first draw. [SRC `WebGLRenderer.js` 3529]
- **Gain:** medium to large for hitches: a 1024 or 2048 canvas texture upload can take several ms on the main thread, and several in one frame is a visible hitch.
- **How:** keep a queue; each frame call `renderer.initTexture(tex)` for one or two textures (more if the frame has spare time). Call it for the textures of a region before revealing the region.
- **Cost / risk:** low. It does not avoid the CPU work of drawing a `CanvasTexture` (that is the real cost, see 1.4).
- **Links:** three.js docs `WebGLRenderer.initTexture`.

### 1.3 Time-sliced building

- **What:** split work into small jobs and run jobs until a budget (say 3 to 4 ms) is used, then yield to the next frame. Use `scheduler.postTask` where available, or `requestIdleCallback`, or a plain per-frame budget loop. You already know the frame time (`quality.frame(dt)`), so the budget can adapt.
- **Gain:** large for hitches. A region that now builds in one 300 ms block becomes thirty 10 ms blocks hidden behind normal frames.
- **What to slice in this game:** (a) one wall chunk mesh per job, (b) one `BatchedMesh` per job, with `addGeometry`/`addInstance` loops split into batches of a few hundred instances, (c) one texture draw and `initTexture` per job.
- **Gotchas:** the `BatchedMesh` vertex and index counts are fixed at construction (`new BatchedMesh(maxInstanceCount, maxVertexCount, maxIndexCount, material)` as in `batchPlan.ts`) so slicing means computing counts first (cheap), constructing, then filling. Make the region invisible until its last job is done. [SRC `BatchedMesh.js` constructor and `addGeometry` 626]
- **Cost / risk:** medium. Needs a small job scheduler and "region ready" state. Pop-in is possible if the player outruns the queue, so prefetch ahead of the camera (the camera is fixed in orientation and moves along x/y only, so "ahead" is easy to predict from player velocity).
- **Links:** MDN `Scheduler.postTask`, MDN `requestIdleCallback`.

### 1.4 Building geometry in Web Workers with transferable buffers

- **What:** compute positions, normals, uvs and indices as typed arrays in a worker, then `postMessage(arrays, [arrays.buffer])` so the buffers move without copying. On the main thread wrap them: `new BufferAttribute(new Float32Array(buf), 3)` and `new BufferGeometry()`. The main thread only does the GPU upload.
- **Gain:** large for hitches (the meshing loop for 16x16 tile chunks and the prop merge are pure number crunching and are exactly what workers are for). Only the upload stays on the main thread. It also lets you do heavier work (face culling, greedy meshing, simplification) without hurting frame time.
- **Cost / risk:** medium. The mesher must be pure functions of plain data (no `Vector3`/`Material` objects, no DOM). `three` itself runs in workers (the loaders do it), but you do not need it there. Vite bundles workers with `new Worker(new URL('./mesher.worker.ts', import.meta.url), { type: 'module' })`.
- **Existing tools in three 0.185.1:** `examples/jsm/utils/WorkerPool.js` (generic pool; `DRACOLoader` and `KTX2Loader` use it) [SRC]. `BufferGeometryUtils.mergeGeometries`, `mergeVertices`, `estimateBytesUsed` exist in `examples/jsm/utils/BufferGeometryUtils.js` [SRC].
- **Gotcha:** destructible walls change at runtime. A damaged chunk should be re-meshed in the worker and swapped in (the old mesh stays until the new one arrives), with the stale result dropped if the chunk changed again.
- **Links:** MDN Transferable objects; three.js manual on workers/OffscreenCanvas.

### 1.5 Off-thread image decode: `ImageBitmapLoader` / `createImageBitmap`

- **What:** decode image files in the browser's background thread and hand three an `ImageBitmap`. `new ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' })`. [SRC `src/loaders/ImageBitmapLoader.js`: `flipY` and `premultiplyAlpha` texture flags are ignored; set them through `setOptions`. Default options are `{ premultiplyAlpha: 'none' }`.]
- **Gain:** medium, and only for textures that come from files (photos, atlases you ship). It removes the main-thread decode stall at first use. It does nothing for `CanvasTexture`s drawn by code.
- **For canvas textures:** draw them on an `OffscreenCanvas` inside a worker (2D context works in workers, MDN says OffscreenCanvas is Baseline widely available [DOC MDN OffscreenCanvas]), call `canvas.transferToImageBitmap()` and post it back; on the main thread `new Texture(bitmap)` with `needsUpdate = true`. That moves the drawing cost off the main thread. This is a good fit for your 90 procedural texture sites, but only after they are consolidated into atlases (1.6), otherwise you create many small bitmaps.
- **Cost / risk:** low to medium. The main thread still pays the GPU upload; pair with `initTexture` (1.2).
- **Links:** MDN `createImageBitmap`; three.js docs `ImageBitmapLoader`.

### 1.6 Texture atlases and array textures

- **What:** an atlas is one big texture holding many small images; each mesh uses a sub-rectangle through its UVs. An array texture (`DataArrayTexture` / `CompressedArrayTexture`) holds same-size layers selected by an index in the shader. [SRC `src/textures/DataArrayTexture.js`, `CompressedArrayTexture.js`]
- **Gain:** large here. 989 textures means 989 GPU objects, 989 binds, and many separate materials that cannot batch. One atlas per category (props, art, signage) lets a whole region share one material, which is also what lets `BatchedMesh` and merged meshes work with a single draw call. It also cuts program variants if the variants came from per-material texture sets.
- **Cost / risk:** medium. Mipmap bleeding at atlas borders (pad each tile by a few pixels, or use `anisotropy` carefully, or use array textures, which have no bleeding). Atlas tiles repeating (`RepeatWrapping`) do not work inside an atlas; a repeating surface needs its own texture or a shader that wraps UVs (via `onBeforeCompile`) or array textures.
- **Practical route:** write a small runtime packer (rect packing with `examples/jsm/libs/potpack.module.js` [SRC exists]) that draws each canvas into one big canvas, then one `CanvasTexture` per atlas page; remap each geometry's UVs once at build time (in the worker).
- **Links:** three.js docs `DataArrayTexture`; potpack.

### 1.7 KTX2 / Basis compressed textures

- **What:** textures stay compressed on the GPU (BC7/ASTC/ETC2 depending on hardware) and are transcoded from a universal Basis file on load. Typically 4x to 8x less GPU memory than RGBA8, and faster uploads (smaller). [SRC `examples/jsm/loaders/KTX2Loader.js`; `setTranscoderPath`, `setWorkerLimit`, `detectSupport(renderer)`; the transcoder files are in `examples/jsm/libs/basis/` in this install]
- **Gain:** medium for GPU memory and load time; small for frame rate on a desktop GPU (texture bandwidth is rarely the bottleneck at this scale). It matters most on integrated GPUs and when many large textures are resident.
- **Cost / risk:** medium. Only helps for file-based textures: bake your procedural textures to KTX2 at build time with `gltf-transform uastc` or `etc1s` (listed in the CLI [DOC glTF-Transform CLI]) or `toktx`. UASTC is high quality (good for normals and signage), ETC1S is much smaller but lossy. Transcode runs in workers, so no main-thread stall. Compressed textures cannot be drawn into after load.
- **Links:** KTX2Loader docs; KTX-Software (toktx); glTF-Transform CLI.

---

## 2. OffscreenCanvas with the whole renderer in a worker

- **What:** `canvas.transferControlToOffscreen()` hands the canvas to a worker; `new WebGLRenderer({ canvas: offscreen })` runs there. [SRC `WebGLRenderer.js` accepts `HTMLCanvasElement|OffscreenCanvas` at ~157 and 3622; there is explicit OffscreenCanvas handling at 383 and in `WebGLTextures.js` 19-39.] MDN: OffscreenCanvas is Baseline widely available [DOC]. web.dev has the standard pattern [DOC].
- **What it buys:** the main thread (input, UI, game simulation if left there) and the render thread no longer block each other, so a long render frame cannot make input laggy, and a long simulation step does not drop render frames. It also isolates shader compile and upload stalls from the main thread. It does not make the GPU work any faster.
- **What it costs:** the whole scene graph has to live in the worker, which means the game state that feeds rendering (world grid, actors, lamps) must be either simulated in the worker or sent every frame by message or `SharedArrayBuffer`. Input and the DOM HUD stay on the main thread and talk by messages. `SharedArrayBuffer` needs cross-origin isolation headers (COOP/COEP). Any code that uses `document`, `window`, `Image`, or canvas 2D via `document.createElement('canvas')` (all your `CanvasTexture` sites!) has to change to `OffscreenCanvas`. Debugging and profiling get harder.
- **Gain for this game:** small to medium on average frame rate; its main value would be hitch isolation, which items 2 and 3 of the top list reach at much lower cost.
- **Recommendation:** not now. Revisit only after the single-thread budget is fixed, and only if the profile shows the main thread is the bottleneck (simulation plus render submission together exceeding frame time) rather than the GPU.
- **Links:** MDN OffscreenCanvas; web.dev OffscreenCanvas; three.js manual "Offscreen Canvas".

---

## 3. Geometry

### 3.1 Remove faces that can never be seen

- **What:** in a tile world with a fixed camera, a lot of triangles are hidden: faces between two adjacent solid tiles, the back and sides of a wall that sit against another solid, and any face pointing away from a camera that only ever looks along -z.
- **Gain:** large. 4.85 M triangles is the single biggest number you gave me, and it affects vertex cost, the shadow pass (which redraws these triangles), and the depth prepass inside GTAO. A rule of thumb for chunked voxel/tile meshes is that culling interior faces cuts triangles several-fold [INFER].
- **How:** in the chunk mesher, emit a face only when the neighbour cell is empty (classic "hidden face removal"). Because the camera is fixed and looks down z with a perspective field of view, the back faces of walls are hidden except near screen edges; you can drop faces that point away from the camera for anything entirely behind the cut plane, if you can prove they are never seen (check at the edges of the view; the camera does have perspective so slightly oblique surfaces show). Where you must keep a surface for shadow casting only, keep a lower-detail shadow mesh instead (`castShadow` meshes can differ from visible meshes).
- **Greedy meshing:** merge coplanar neighbouring quads of the same material into one big quad. For flat tile walls this reduces triangles by a large factor; textures should then tile through shader UVs (a quad covering 8 tiles uses repeating or per-tile UV, so use `RepeatWrapping` or an atlas-aware wrap).
- **Cost / risk:** medium. Do it in the worker mesher (1.4). Damage and rubble need re-meshing; keep the per-chunk build fast.
- **Links:** 0fps "Meshing in a Minecraft game" (greedy meshing).

### 3.2 meshoptimizer simplification, quantisation, `MeshoptDecoder`, Draco

- **What:** `meshoptimizer` can reduce triangle counts (simplify), reorder for the GPU cache, and quantise positions and normals to 16 or 8 bits. `gltf-transform` wraps these: `simplify`, `quantize`, `weld`, `reorder`, `meshopt`, `draco` are all CLI commands [DOC glTF-Transform CLI list].
- **In three 0.185.1:** `examples/jsm/libs/meshopt_decoder.module.js` exports `MeshoptDecoder`; `examples/jsm/libs/meshopt_simplifier.module.js` and `meshopt_clusterizer.module.js` are also shipped [SRC]. So you can simplify at runtime in a worker without a new dependency, or at build time with the CLI. `DRACOLoader` plus `examples/jsm/libs/draco/` exist [SRC]. npm `meshoptimizer` is 1.3.0 and `@gltf-transform/cli` is 4.5.1 [DOC npm registry, 2026-11-10].
- **Gain:** medium. Simplifying small props (a mug, a keyboard) cuts vertices that cover few pixels; this matters when 3,000 props are on screen. Quantisation reduces memory and upload size but does not reduce shading cost much. Draco and Meshopt compression reduce download size and are only worth it if you load geometry files; your props are procedural, so there is nothing to compress on the wire.
- **Cost / risk:** low to medium. Simplification of procedural props is best done once per prop type (not per instance); `BatchedMesh` already shares geometry by shape (`batchPlan.ts` keys geometry by shape). Quantised attributes need `normalized: true` `BufferAttribute`s and work with standard materials; check any custom `onBeforeCompile` patches that read `position` directly.
- **Links:** meshoptimizer; glTF-Transform functions and CLI.

### 3.3 Level of detail (LOD) and impostors

- **What:** swap a model for a cheaper one by distance or by on-screen size. three has `LOD` (`src/objects/LOD.js` [SRC]) for per-object swaps. For `BatchedMesh` there is no built-in LOD; the community package `@three.ez/batched-mesh-extensions` (npm 0.0.12, peer `three >= 0.159.0` [DOC npm registry]) adds per-instance BVH culling and LOD to `BatchedMesh`. It is young and its version number is low, so treat it as experimental.
- **Your case:** the camera is fixed so on-screen size depends on the distance in z only, and every prop of the same type in the same depth band has the same size. That means you can choose the LOD per depth band at build time (cheap, no per-frame work): back-lane props get the simple mesh, foreground props the detailed one.
- **Gain:** medium.
- **Cost / risk:** low if done at build time per depth band; medium if per frame.

### 3.4 `BatchedMesh` vs `InstancedMesh` vs merged static geometry (r185.1)

| | Draw calls | Different shapes | Per-instance culling | CPU cost per frame | Good for |
|---|---|---|---|---|---|
| Merged static `Mesh` | 1 per material | n/a (baked) | whole mesh only | none | Walls, floors, anything that rarely changes |
| `InstancedMesh` | 1 per shape per material | one shape | none (whole mesh bounding sphere) | none until you change a matrix | Many copies of one shape (lamps, tiles) |
| `BatchedMesh` | 1 per material (multi-draw) or one per instance without the extension | many shapes | per instance, CPU loop | loop over every instance each frame when culling or sorting is on | Mixed props in one material |

- [SRC `BatchedMesh.js`] culling and sorting run in a CPU loop over all instances every frame the camera moves (lines ~1522-1677). With a fixed-orientation camera that scrolls, the camera moves nearly every frame, so a 3,000-instance region pays this loop each frame. Options: set `perObjectFrustumCulled = false` for regions small enough to draw whole (cull whole regions with the mesh's own bounding sphere instead); keep `sortObjects = false` for opaque materials (you already do); never use a custom sort for opaque.
- Without `WEBGL_multi_draw` the renderer falls back to one draw call per visible instance [SRC `WebGLBufferRenderer.js` ~33; behaviour of the fallback is in the same file]. Check `renderer.extensions.has('WEBGL_multi_draw')` on your target machines. If it is false anywhere you care about, `BatchedMesh` becomes the worst option.
- `BatchedMesh.optimize()` compacts vertex and index space after deletions [SRC 878]; `unusedVertexCount` tells you when it is worth calling. Prop destruction mid-game fragments the buffers.
- `SceneOptimizer` in `examples/jsm/utils/SceneOptimizer.js` has `toBatchedMesh()` and `toInstancingMesh()` [SRC] but it is a convenience for static scenes, not a streaming tool.
- **Gain for this game:** medium. The 1,500 draw calls are most likely split among wall chunks, per-material batches, shadow-pass draws (each shadow light redraws casters), actors and effects. Count them by category with `renderer.info.render.calls` before and after each pass (section 9) to find which category is large. Shadow-pass calls are included in `info.render.calls` and are the most commonly overlooked share [INFER].
- **Links:** three.js docs BatchedMesh; Khronos WEBGL_multi_draw.

### 3.5 Pre-rendered sprites and billboards (impostors) from 3D models

- **What:** render each model once from the game camera (or a few angles) into a sprite atlas at build time or at load time into a `WebGLRenderTarget`, then draw a flat textured quad. The cost per object is 2 triangles and no lighting.
- **Why it fits:** your camera never rotates, so one angle (plus a flip) is enough for static props, and for people a short set of animation frames or a few poses.
- **Gain:** medium to large for far or small things: distant props, the background skyline, neighbour buildings, small items in the back lane. Not suitable for anything that needs to receive real-time lighting from the lamp pool unless you bake a normal map and light it with a sprite shader.
- **Cost / risk:** medium. Lighting and shadows must be faked or baked; animated people need a frame set. Looks flat if the camera has strong parallax (it does have perspective), so use it for objects far from the camera or small on screen, not the foreground.
- **How in three:** `Sprite`/`SpriteMaterial` or a plain quad `InstancedMesh` with a UV-offset attribute from an atlas.
- **Links:** "Impostors" in the Real-Time Rendering book (general reference); three.js docs Sprite.

---

## 4. Shader programs and materials

### 4.1 Why 148 programs, and how to reduce them

A program is compiled for each unique combination of material type, feature flags (map, normal map, fog, skinning, instancing, batching, shadows), light counts, output settings, and `customProgramCacheKey()` [SRC `WebGLPrograms.js` 330-440]. Common causes:

1. `onBeforeCompile` patches whose source text differs per instance (a closure with the values baked into the shader string) produce a separate program each time. The default cache key is `onBeforeCompile.toString()`, so identical function text shares a program, while a function created in a loop with different baked values does not. Fix: pass values as uniforms, and override `customProgramCacheKey` to return a constant string when the patch is the same. [SRC `Material.js` 543-545]
2. Flags like `map`, `normalMap`, `roughnessMap` on or off, each combination being a program. A shared atlas material with all maps present removes many variants.
3. `MeshStandardMaterial` vs `MeshPhysicalMaterial` and per-material features (clearcoat, transmission, sheen) each add a variant.
4. Shadow-on and shadow-off variants, and `BatchedMesh` / instanced variants. These double programs.
5. Changing the number of lights. The light counts are in the cache key, so adding a light recompiles every lit material in the scene. Your fixed pool avoids this as long as the pool never changes size and lights are kept in the scene at intensity 0 when unused (do not toggle `visible`, because invisible lights are not counted and that changes the key).
- **Gain:** medium. Fewer programs mean a smaller first-load compile and fewer hitch sources. It does not directly raise frame rate, except that fewer programs mean fewer state changes.
- **How to find the culprits:** log `renderer.info.programs` entries (`cacheKey`, `name`) at level load and group them; the cache key string shows the differing flags [SRC `WebGLProgram` has `cacheKey`; `renderer.info.programs` is the list].
- **Links:** three.js docs Material.customProgramCacheKey.

---

## 5. Lights and shadows

Most of this is already covered in `docs/research/rendering.md` sections 2.1 to 2.3, including: a fixed pool, `LightProbeGrid` baking in r185 core, `light.shadow.autoUpdate` and `needsUpdate`, and the fact that clustered lighting in r185 is WebGPU-only and point-lights-only. Summary of what matters for speed:

- **Cached static shadows (large).** `light.shadow.autoUpdate = false` and set `needsUpdate = true` when the casting geometry near that light changes or the light is reassigned [SRC `WebGLShadowMap.js` ~170: skips a light when `autoUpdate === false && needsUpdate === false`]. With a pool, a map belongs to a slot, so re-assigning a slot invalidates it: limit reassignments, or reassign at most one shadowed slot per frame.
- **Shadow casters list (large).** Every shadow light redraws all casters in its frustum. Set `castShadow = false` on small props (the shadow of a mug is invisible) and on batches that do not need it. The shadow pass uses its own, usually simpler, material, but it still pays vertex cost and draw calls.
- **Shadow map size (small to medium).** Use `light.shadow.mapSize` as small as looks acceptable (512 or 1024).
- **Baked/vertex lighting for static rooms (medium to large, with art-pipeline cost).** Bake direct and bounced room light into `LightProbeGrid` (r185 core, WebGL only [SRC `examples/jsm/lighting/LightProbeGrid.js`, `bake(renderer, scene, options)`]) or into vertex colours, `lightMap` or `aoMap`. Then fewer real lights are needed and the pool can shrink.
- **Blob or contact shadows (medium).** A dark soft quad under people and small props, no shadow pass. Cheap and fits the side view.
- **Why the number of lights recompiles shaders:** three generates GLSL loops with the light counts written into the source (`numPointLights`, `numSpotLights`, shadow counts); a different count is different source, hence a different program, for every lit material [SRC `WebGLPrograms.js` 340-348, 474]. That is why a fixed pool is the right design, and why spot lights that are "off" should stay in the scene at intensity 0.
- **Lamp glow without lights (medium).** Hundreds of lamps beyond the pool can be emissive meshes plus bloom plus additive floor/wall sprites, as `docs/research/rendering.md` section 2.2 says.

---

## 6. Post-processing cost

At 1080p, each full-screen pass costs roughly a pixel shader run over 2 M pixels; on an integrated GPU a handful of heavy passes can take more than the scene itself [INFER]. Your chain is: scene (half float) then GTAO (several internal passes: AO, denoise/blur, blend) then bloom (about 10 internal passes across mips) then output then SMAA (3 internal passes) then grade.

1. **Half-resolution GTAO (medium to large).** The GTAO result is a smooth low-frequency signal and is blurred by the denoise step anyway. In 0.185.1 `GTAOPass.setSize(width, height)` sets every internal target to the full size [SRC `GTAOPass.js` 247-260] and exposes `gtaoRenderTarget`, `pdRenderTarget`, `normalRenderTarget` and the material `resolution` uniforms. A half-resolution run means calling `setSize(w/2, h/2)` on the pass's targets and uniforms after the composer's `setSize`, while still reading the full-size depth texture; the blend pass samples by UV so it should still composite. This needs a test (depth-aware denoise uses full-size texel offsets). Also reduce `samples` (12 now) to 8 and `rings`. The project's `setSceneClipBox` is already used to limit AO to the building slice, which is good.
2. **Merge passes (small to medium).** `OutputPass` and your grade `ShaderPass` could be one pass: apply tone mapping inline in the grade shader (the tone-map functions are chunks in `src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js`; `OutputPass` itself is a `ShaderPass` over a shader that includes them). That saves one full-screen read and write. In r185 there is also a native alternative: `new WebGLRenderer({ outputBufferType: HalfFloatType })` plus `renderer.setEffects([...])`, where tone mapping and colour-space conversion are applied automatically and an `OutputPass` is not needed (it warns if you add one) [SRC `WebGLRenderer.js` 84, 114, 735-760; `WebGLOutput.js` 119-210]. It is a built-in way to run the chain without `EffectComposer`; it expects the same `Pass`-style effects. I did not test it with `GTAOPass` or `UnrealBloomPass`; treat it as an option to prototype, not a drop-in.
3. **Bloom (small to medium).** `UnrealBloomPass` already runs its mip chain at half resolution of what you give it [SRC `UnrealBloomPass.js` 102-103, 151-152], and you pass a `bloomScale`. Lower mip count (fewer `nMips` is hard-coded to 5 in the source; copy and edit if you want fewer), or run bloom from a cheap threshold at quarter resolution. Because lamps are the main bloom source, an emissive-only buffer is cheaper than thresholding the whole HDR frame, but needs an extra render.
4. **Anti-aliasing (medium).** You currently use 4x MSAA on the top rung (a half-float multisampled target is costly in bandwidth and memory, and must be resolved) and SMAA otherwise. MSAA multiplies the cost of every triangle edge in a 4.85 M triangle frame; SMAA is a fixed screen-space cost that does not depend on triangle count. Options: SMAA everywhere (the simplest and most consistent), FXAA (`examples/jsm/postprocessing/FXAAPass.js` [SRC], one cheap pass, softer), or MSAA only when the frame time is far under budget. For a 2.5D side view with long straight edges, SMAA is a good fit. Add a quality rung that moves MSAA off before it removes AO.
5. **Dynamic resolution (medium; you already have it).** The ladder scales the whole chain. Add finer steps (for example 1.0, 0.9, 0.8, 0.7 rather than a few big jumps), a hysteresis delay so it does not oscillate, and render the grade/grain pass at output resolution while the scene runs lower (a free upscale with a sharpen). Because three renders everything to the composer target, only the composer size changes.
6. **`pmndrs/postprocessing` vs three's `EffectComposer` (medium, with migration cost).** The library merges compatible "effects" into one full-screen shader (`EffectPass`), so bloom composite, tone mapping, vignette, grain and colour grading can run in one pass instead of one each. Its npm version is 6.39.6 with peer `three >= 0.168.0 < 0.188.0`, which includes 0.185 [DOC npm registry]. It also has its own SSAO, SMAA and bloom implementations, and supports a depth-downsampling/normal-pass option. The cost: rewriting `post.ts`, replacing `GTAOPass` with its `SSAOEffect` or `N8AO` (a separate package, different look; `docs/research/rendering.md` section 1.2 discusses AO choices), and re-tuning the look. Gain for you is the merged-pass saving plus its efficient bloom; it is probably smaller than the saving from half-res AO plus fewer passes in the existing composer. Do the cheap changes first, then decide.
- **Links:** three.js GTAOPass docs; pmndrs/postprocessing; SMAA paper site.

---

## 7. 2.5D tricks from shipped side-view games

Games with a fixed camera exploit the fact that you only ever see one angle:

- **Pre-rendered backgrounds with depth.** Classic survival-horror and adventure games render rooms offline and draw them as a flat image plus a depth image so 3D characters can be hidden behind scenery. For you: far rooms, neighbour buildings and the skyline can be a baked image per region with a simple depth value per layer. Cost: baking pipeline and a shader that writes depth, or layering by sort order. Gain: large where it replaces many triangles with a single quad.
- **Layered parallax cards.** Several flat planes at different z with alpha, moving at different rates. Cheap, hides detail, looks deep with a perspective camera. Already how a skyline is usually done; check `src/render3d/rooms/skyline.ts` and `neighbours.ts` for how many draws these take.
- **Baked "diorama" rooms.** Each room's static contents (walls, floor, fixed furniture) baked into one merged mesh with baked lighting in the vertex colours or a lightmap, so only moving things, doors and the lamp pool remain dynamic. This is the same idea as merged static geometry plus probe grid; the win is one draw call per room and no per-pixel lights on it.
- **Cull what the cut-away hides.** Because the building is drawn cut open, anything farther back than the back wall, and everything outside the camera's x/y range plus a margin, can be skipped at the region level, before `BatchedMesh` does its per-instance loop.
- **Rooms out of view are not lit or shadowed.** Disable shadows and expensive materials for regions beyond a distance from the player; swap to a flat-shaded cheap material for far rooms.

I did not find a public technical write-up of one specific shipped side-view 3D game's renderer to cite in detail; the above is the general practice and is marked [INFER] as applied to your code.

---

## 8. WebGPU in three.js 0.185

`docs/research/rendering.md` section 1.8 already gives the full answer and I agree with it: **stay on `WebGLRenderer` for now.** Additional points from the source:

- r185 has `three/webgpu` with `WebGPURenderer` (with a WebGL2 fallback backend) and `RenderPipeline` for post-processing; `PostProcessing` is a deprecated wrapper renamed in r183 [SRC `src/renderers/common/PostProcessing.js`, `Three.WebGPU.js` line 14].
- What would break: `EffectComposer` and every pass in `examples/jsm/postprocessing/` (they are WebGL-only), every `onBeforeCompile` hook (WebGPU materials are built from TSL nodes, not GLSL strings; `rg onBeforeCompile` in `src/renderers/webgpu` finds no use), `ShaderMaterial` / `RawShaderMaterial` with GLSL, and `PMREMGenerator` usage patterns. The WebGPU equivalents are in `examples/jsm/tsl/display/` (for example `GTAONode`, `BloomNode`, `SMAANode`, `FXAANode`) [SRC].
- Expected gains: lower CPU cost per draw call through render bundles and better state management, and compute shaders for things like particles. Clustered lighting exists but is limited to non-shadow point lights in r185 [see rendering.md 0.1 item 2]. For a game whose hot spots are triangle count, shadow passes and fill rate, the GPU work is the same; the main gain is CPU draw-call overhead, which you can also reduce with batching. I would not expect twice the frame rate from the switch alone.
- Browser support, from rendering.md (caniuse): Chrome and Edge yes, Safari 26 partial, Firefox off by default at the time of reading. A game that must run for everyone still needs the WebGL path.
- **Cheap experiment:** a branch with `WebGPURenderer({ forceWebGL: true })` shows how many materials fail.

---

## 9. How to measure on a real machine

1. **`renderer.info`** (you already publish it with `?debug=1`). Fields: `render.calls`, `render.triangles`, `render.frame`, `memory.geometries`, `memory.textures`, `programs` (list). Because `info.autoReset = false` in your code, call `renderer.info.reset()` once per frame yourself (you do). Log per-pass numbers by reading before and after each pass (for example, the shadow pass is the first thing in `renderer.render`; calls from `composer.render()` include every pass). To split draw calls by category, temporarily set `visible = false` on one group at a time and record the difference.
2. **GPU time: `EXT_disjoint_timer_query_webgl2`.** `const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')`; wrap one frame in `gl.beginQuery(ext.TIME_ELAPSED_EXT, q)` / `gl.endQuery(ext.TIME_ELAPSED_EXT)`; read the result a few frames later when `gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)` is true and `gl.getParameter(ext.GPU_DISJOINT_EXT)` is false. You can use one query per pass to find which pass costs most. Caveats: not available in every browser or on every platform (Safari and Firefox disable or restrict it), and Chrome rounds timer precision unless site isolation or a flag is on. The MDN page lists the support and the API [DOC MDN EXT_disjoint_timer_query_webgl2]. Wrapping `EffectComposer` passes: subclass or wrap each `pass.render`. The `stats-gl` package (npm 4.2.3 [DOC npm registry]) does this for you and shows CPU, GPU and FPS panels for three.js; its three.js integration uses `stats.init(renderer)` and `stats.begin()` / `stats.end()`.
3. **Chrome Performance panel.** Record while walking into a new region. Look for long tasks (red corner) in the Main track, and in the Bottom-Up view which of your functions dominate (your region builders, `CanvasTexture` drawing, `texImage2D` / `uploadTexture`, `compileShader` / `linkProgram`). Enable "Web Vitals" and the GPU track. `chrome://gpu` shows what the browser actually uses (hardware vs software, ANGLE backend).
4. **Long-task observer in code.** `new PerformanceObserver(list => ...).observe({ type: 'longtask', buffered: true })` logs every main-thread block over 50 ms with a timestamp; log the world position at the same time, so hitches map to places. Add `performance.mark`/`measure` around each build job so the Performance panel shows them by name. Also record the worst frame time per second, not only the average; hitches hide in averages.
5. **Test on the slowest target.** Throttle with the Performance panel CPU slowdown, and test on an integrated GPU laptop. Use a fixed scripted camera path so numbers are comparable.
6. **Spector.js** (a browser extension) captures one frame's WebGL calls, to see exactly which draws and state changes exist, and to confirm which draws belong to the shadow pass.

---

## Suggested order of work

1. Benchmark path and instrumentation (item 1).
2. Hitches: job queue with a time budget, worker mesher, region pre-warm (items 2 and 3).
3. Triangles and shadows: hidden-face removal, greedy meshing, cached shadow maps, caster pruning (items 5 and 6). These directly cut the biggest numbers.
4. Atlases and shared materials (item 4), then half-res AO and pass merge (item 7).
5. Impostors and baked far layers (item 8), per-region culling and merged static meshes (item 9).
6. KTX2 (item 10), only after textures are files.

---

## All source links

Local source read (three.js 0.185.1):
- `/home/user/orcfall-command/node_modules/three/src/renderers/WebGLRenderer.js` (compileAsync, initTexture, setEffects, outputBufferType, OffscreenCanvas)
- `/home/user/orcfall-command/node_modules/three/src/renderers/webgl/WebGLPrograms.js`, `WebGLProgram.js`, `WebGLOutput.js`, `WebGLShadowMap.js`, `WebGLBufferRenderer.js`, `WebGLIndexedBufferRenderer.js`, `WebGLTextures.js`
- `/home/user/orcfall-command/node_modules/three/src/objects/BatchedMesh.js`, `src/materials/Material.js`, `src/loaders/ImageBitmapLoader.js`, `src/textures/DataArrayTexture.js`, `CompressedArrayTexture.js`
- `/home/user/orcfall-command/node_modules/three/examples/jsm/postprocessing/GTAOPass.js`, `UnrealBloomPass.js`, `EffectComposer.js`, `FXAAPass.js`, `SMAAPass.js`
- `/home/user/orcfall-command/node_modules/three/examples/jsm/loaders/KTX2Loader.js`, `DRACOLoader.js`; `examples/jsm/libs/meshopt_decoder.module.js`, `meshopt_simplifier.module.js`, `basis/`, `draco/`, `potpack.module.js`
- `/home/user/orcfall-command/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js`, `SceneOptimizer.js`, `WorkerPool.js`; `examples/jsm/lighting/LightProbeGrid.js`
- `/home/user/orcfall-command/node_modules/three/src/renderers/common/PostProcessing.js`, `src/Three.WebGPU.js`
- `/home/user/orcfall-command/docs/research/rendering.md` (lights, shadows, probes, WebGPU, AO)

Pages read (fetched 2026-11-10):
- https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas (Baseline, widely available)
- https://web.dev/articles/offscreen-canvas
- https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query_webgl2
- https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
- https://gltf-transform.dev/cli (command list: simplify, quantize, weld, reorder, meshopt, draco, uastc, etc1s)
- https://registry.npmjs.org/postprocessing/latest (6.39.6, peer three >=0.168.0 <0.188.0)
- https://registry.npmjs.org/stats-gl/latest (4.2.3)
- https://registry.npmjs.org/@gltf-transform/cli/latest (4.5.1)
- https://registry.npmjs.org/meshoptimizer/latest (1.3.0)
- https://registry.npmjs.org/@three.ez/batched-mesh-extensions/latest (0.0.12, peer three >=0.159.0)
- https://registry.npmjs.org/three-mesh-bvh/latest (0.9.18)
- https://caniuse.com/webgpu

Further reading (links given from memory; not fetched here because GitHub and some sites were blocked, so check them before relying on details):
- https://threejs.org/docs/#WebGLRenderer (compileAsync, initTexture, info)
- https://threejs.org/docs/#BatchedMesh
- https://threejs.org/docs/#KTX2Loader
- https://threejs.org/docs/#ImageBitmapLoader
- https://threejs.org/manual/#en/offscreencanvas
- https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
- https://registry.khronos.org/webgl/extensions/WEBGL_multi_draw/
- https://github.com/zeux/meshoptimizer
- https://github.com/donmccurdy/glTF-Transform
- https://github.com/KhronosGroup/KTX-Software
- https://github.com/pmndrs/postprocessing
- https://github.com/greggman/stats-gl
- https://github.com/agargaro/batched-mesh-extensions
- https://github.com/BabylonJS/Spector.js
- https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask
- https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming
- https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
