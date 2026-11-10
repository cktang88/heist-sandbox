# Making the simulation and loading smoother

Research note, 10 November 2026. The question: the owner sees long freezes and suggested "background workers or rust wasm or a ton of other techniques". Which of those are worth it for this game? This note answers from measurements of the real code on the big site (`createWorld(n, 'complex')`: 300x204 tiles, 79 guards, 3,076 props, 187 rooms), plus reading the code and the web.

## 1. What I measured

How: a throwaway instrumented copy of `stepWorld` that times each system with `performance.now()`, run for 60 simulated seconds at 60 steps a second (3,600 steps) in Node 22 (same V8 engine as Chrome) on a shared 4-core machine. "Calm" is the site idle with every guard patrolling. "Big fight" is the alarm raised, then once a second: C4 along a whole room, 40 fires, a smoke grenade, a frag, 20 bullets and a rocket, with the player jumping to a new room each second. At the end 76 of 86 guards were dead, about 4,000 tiles destroyed, up to 373 fires, 5,000 smoke cells and 342 falling tiles. I ran each scenario twice; the table shows both runs ("a / b").

The throwaway scripts live in the session scratchpad, not in the project.

**Caveat on the machine.** The box was busy with other jobs, so the worst single frames below are inflated by noise (random unrelated systems show 30 to 60 ms spikes in the calm run). Trust the means, the medians and the profiles. Treat "max" as "at least this bad on a bad day". The real answer for freezes comes from measuring on the owner's machine (section 14).

### Milliseconds per simulation step

| System | Calm (ms per step) | Big fight (ms per step) |
|---|---|---|
| **Whole step, mean** | **0.7 / 1.1** | **8.6 / 12.3** |
| Whole step, median (p50) | 0.25 | 2.8 / 4.2 |
| Whole step, 95th percentile | 1.6 / 4.4 | 28 / 40 |
| Whole step, 99th percentile | 13 / 21 | 86 / 137 |
| Whole step, worst frame (noisy) | 62 / 173 | 527 / 890 |
| Guards thinking (79 guards) | 0.33 / 0.53 | 2.7 / 4.4 |
| Hazards: fire, smoke, gas, water | 0.001 | 2.5 / 3.2 |
| Projectiles (bullets, rockets, blasts) | 0.005 | 1.2 / 1.5 |
| Player, interaction prompt, tools | 0.26 / 0.36 | 0.6 / 1.0 |
| Security control room | 0.05 / 0.08 | 0.4 / 0.5 |
| Frags, aftermath, ropes, falling props | 0.02 / 0.07 | 0.4 / 0.7 |
| Collapse (support check and falling tiles) | 0.015 | 0.3 / 0.5 |
| Floor gaps | 0.001 | 0.15 |
| Particle effects | 0.002 | 0.1 / 0.13 |
| Everything else (devices, elevators, intel, melee, props, rope, hook) | under 0.05 | under 0.1 |

A frame is 16.7 ms at 60 fps, and the browser also has to draw. So a calm step is nothing. A big-fight step is half a frame on average, but one frame in twenty is two to three times the budget and one in a hundred is five to eight times. **The problem is the tail (bursts), not the average.**

### Isolated costs (best of many rounds, so noise-free)

| Thing | Cost |
|---|---|
| `stepHazards` with the 600-fire cap and about 1,800 smoke cells | 0.25 ms per frame |
| One smoke tick alone (it runs 30 times a second) | 0.58 ms at 1,800 cells; roughly 1.5 ms at the 5,000 cap |
| `findUnsupported` (the collapse check), whole intact complex, warm | 0.6 ms (5.4 ms on the first, cold call) |
| 79 guards thinking, calm | 0.23 ms per frame |
| One dead guard's ragdoll, lying still, one step | 16 microseconds; with 76 dead, 0.6 ms per frame, every frame, for ever |
| `structuredClone` of the grid's two typed arrays (306 KB) | 0.5 ms |
| `structuredClone` of `world.guards` | 2.5 ms |
| `structuredClone` of `world.props` (3,076 props) | 9 ms |
| `structuredClone` of a 79-guard "positions only" snapshot | 0.09 ms |
| `structuredClone` of `world.hazards` | **throws** (`WeakSet could not be cloned`) |

### Loading

| Thing | Cost |
|---|---|
| `createWorld(seed, 'complex')` (generation, furnishing, guard spawn) | 100 to 200 ms (163 ms the first time) |
| `createLevelMesh` for the whole grid (249 chunks of 16x16 tiles) | 290 to 310 ms |
| First two `stepWorld` calls after creating the world | about 43 ms each (lazy caches build), then 1.5, 9.5, 8.5, 2.3 ms |
| Total synchronous JavaScript before the first good frame, from these three | about 0.5 s |
| Not measured here (needs a real GPU and browser) | shader compile, texture upload, the 38 MB of models in `dist/models`, a 7.6 MB character GLB, an HDR sky |

So generation and level meshing are not enormous. Half a second of blocked main thread is enough for the tab to look frozen, but if the owner's freezes at load are several seconds, the likely cause is the part I could not measure: GLTF decode and parse, texture upload and shader compile in three.js. Check that first with the marks in section 14.

### Where the time goes in the fight (CPU profile, self time)

| Share of all CPU | What |
|---|---|
| 12.9% | Garbage collector. 378 young-generation collections in the run, about 5.4 GB of short-lived objects freed in 25 s (includes building about nine worlds, so this is an upper bound; the average is roughly 0.7 MB allocated per frame). Mean pause 8 ms, a handful of 80 to 300 ms pauses (some of that is machine noise) |
| about 9% | Ragdoll physics of dead guards (`stepRagdoll`, `subStep`). They never go to sleep, and each sub-step allocates a fresh array of point copies |
| about 10% | Smoke spreading (`settle`, `spreadFrom`, `openNeighbour`, `moveSmoke`). Already typed arrays; temporary arrays per cell and per tick |
| 3.6% | `propIndex`: builds a Map of 3,000 props to tiles once per world, probably part of the 43 ms first-frame hitch |
| 1.7% | `propsOnLostTiles`: scans all 61,200 tiles every time any tile changed |
| 1.7% | `readAction` (the "E: do something" prompt scan) |
| 1.1% | `findUnsupported`, which allocates a 61 KB and a 245 KB buffer on every call |
| about 1% | `nearestFire`, which walks every fire for every guard asking |
| under 1% each | `route` in `nav.ts`, `lightLevelAt`, `propSpec`, `escapeHazard`, `thinkGuard` |

And in the render side, in the same fight: 108 of 1,800 frames had changed tiles; **up to 26 chunk meshes were rebuilt in a single frame, taking 21 ms at the 95th percentile and 70 ms at worst** (CPU only, before the GPU upload).

### What the numbers say

1. The simulation is already cheap. It is pure, typed-array-heavy where it matters, and idle systems cost nothing (hazards 0.001 ms when quiet). There is no big average cost for a faster language or another thread to win.
2. The freezes come from bursts: garbage collection, a big explosion rebuilding two dozen chunk meshes in one frame, the first-time lazy setup, and 76 never-sleeping ragdolls piling up in a long fight.
3. Pathfinding is not a grid A*. `nav.ts` is a small Dijkstra over staircase landings (a few dozen nodes per building). Hierarchical pathfinding and flow fields would solve a problem this game does not have.

## 2. Do these first (ranked)

Gain is the expected effect on felt smoothness for this game. Cost is rough developer effort. Risk is the chance of breaking behaviour or determinism.

| # | Item | Gain | Cost | Risk |
|---|---|---|---|---|
| 1 | **Measure on a real machine first.** User Timing marks around each system and each load stage, a long-animation-frame logger, an optional on-screen frame graph. Nothing in the code has a mark today. | Large (it decides everything else) | Small (an hour or two) | None |
| 2 | **Spread burst work across frames.** Rebuild at most 3 to 4 dirty chunks a frame, nearest to the camera first (a far chunk can lag a few frames). Batch collapse checks (run at most every 100 ms, not every frame a tile changes). | Large for explosion hitches | Small | Low |
| 3 | **Cut allocation churn.** Reuse the two big buffers in `findUnsupported`, the `before` array in ragdoll sub-steps, the temp arrays in smoke `settle` and `spreadFrom`, the `[...fires]` copy in `stepFires`, the spread arrays in `collapse.ts`. Check with `--trace-gc` and the Memory panel. | Medium to large (13% of fight CPU, scavenge pauses) | Small to medium | Low |
| 4 | **Load in stages with a progress bar, and warm the lazy caches during load.** Yield between stages (`scheduler.yield` or a timeout), build the level mesh a few chunks per slice, force the first-use caches (prop index, door index, stair plans, falling-props grid copy) before play, compile shaders with `compileAsync`. | Large for perceived load | Small to medium | Low |
| 5 | **Let resting ragdolls and dead guards sleep.** Stop stepping a body once every joint has moved less than a tiny amount for about a second; wake it on a blast or tile change underneath. | Medium (grows with kills; about 9% of fight CPU) | Small | Low |
| 6 | **Think less often for guards that do not matter right now** (far from the player, off screen, not alerted): 5 to 10 times a second with accumulated time, and spread across frames by guard index. Guards in combat or near the player stay at full rate. | Medium (guards are the biggest system in a fight) | Medium | Medium (tuning, timers that assume every-frame calls) |
| 7 | **Fix the whole-grid scans.** `propsOnLostTiles` should use the list of changed chunks (`grid.dirtyChunks` already exists) rather than diff 61,200 tiles; `nearestFire` should look in a small window around the guard rather than loop all fires. | Small to medium | Small | Low |
| 8 | **Fixed timestep with render interpolation.** Step the game at a steady 60 Hz from an accumulator (at most 3 to 4 catch-up steps), and have the renderer blend between the last two states. Today there is one variable-length step per frame (up to 1/30 s). | Medium (even motion on 120/144 Hz screens, no big-dt surprises, a clean base for later threading) | Medium to large (renderer reads positions directly) | Medium |
| 9 | **Generate the level in a Web Worker at load.** `createComplex` is pure; the loading screen can then keep animating. Do this only after item 4; it is a polish step. | Medium for load feel | Medium | Medium (see section 3 on what clones) |
| 10 | **Typed-array rewrites of the few hot kernels in TypeScript** (smoke field with a precomputed solid mask and neighbour offsets; fires as arrays instead of a `Map` of objects). | Small to medium | Medium | Medium |

Not on the list, on purpose: moving the whole simulation to a worker (section 3), Rust/WebAssembly (section 5), hierarchical pathfinding and flow fields (section 9), `SharedArrayBuffer` (section 3). Reasons below.

## 3. The whole simulation in a Web Worker

**What it is.** The game loop runs in a second thread. The main thread only reads input, draws, plays sound and shows the UI. Input goes to the worker as small messages; state comes back as snapshots.

**When it pays off.** When simulation time is the main reason frames are late and the renderer is cheap. Here the average simulation cost is under 1 ms calm and about 10 ms in a heavy fight, and the freezes are bursts (GC, mesh rebuilds, load) that a worker mostly would not fix: mesh building and drawing stay on the main thread, and GC happens per thread anyway. A worker would take the guards-and-fire cost off the main thread, which is real in the worst fights, but at a very high price.

**What blocks it today (verified against the code).**
- The renderer (`src/render3d`, `src/render`, HUD, audio) reads the live `World` object every frame: guards, props, hazards, falling tiles, interiors. There is no snapshot layer. Moving the simulation means writing that layer first.
- `World` cannot be cloned as it stands. `structuredClone(world.hazards)` throws because of a `WeakSet` (`heardShots`). `world.rng` is a closure (a function; functions cannot be cloned), and cloning it would lose its state anyway. There are `Set`s and `Map`s (`deadCircuits`, `hazards.fires`, `physProps.loose`, the prop index). Clone does handle Map and Set, but not functions or WeakSet.
- Module-level caches keyed by object identity (`WeakMap<World,...>` in `lampState.ts`, `WeakMap<readonly PropState[],...>` in `cover.ts` and `tileIndex.ts`, the stair plan in `nav.ts`, `slabCache` in `collapse.ts`, `WeakSet`s in `elevators.ts` and `grapple/hook.ts`). Anything cloned across the thread boundary loses these and rebuilds them, silently, every time.
- Full clone is too heavy per frame anyway: the grid's typed arrays alone cost 0.5 ms, guards 2.5 ms, props 9 ms, and the whole thing would be tens of ms. Surma's measurements put the safe range for `postMessage` at about 100 KiB for a 100 ms response budget and about 10 KiB when you also have per-frame animation to protect.

**How the renderer would get state, from simplest to heaviest.**
1. *Small snapshot messages.* Each tick the worker posts only what is drawn: player, 79 guards (x, y, facing, mode, hp, aim), projectiles, effects, changed tiles, fire and smoke cells. A positions-only guard snapshot cloned in 0.09 ms in my test. Static things (rooms, interiors, props that did not change) are sent once. This is the right design if you ever do it.
2. *Transferable typed arrays.* Pack the snapshot into a `Float32Array` and send it with the transfer list, so the buffer moves rather than copies (zero-copy). Double-buffer: the main thread hands the array back after drawing. Good for guards, particles and smoke density.
3. *`SharedArrayBuffer` + `Atomics`.* Both threads see the same memory. Lowest latency and no copy, but it needs cross-origin isolation: the page must be served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`). In Vite that means `server.headers` (and `preview.headers`) in `vite.config.ts` for development, and the same two headers on whatever hosts the built game. Everything the page loads cross-origin (fonts, CDN models) then needs CORS or CORP headers. The tile grid (`kinds`, `hp`) is already two typed arrays, so it is the easy part to share. The rest of the world is object graphs, which cannot live in shared memory without a rewrite into arrays.

**Latency and determinism.**
- Input to state to drawn picture goes one message and one frame deeper, typically adding one frame (16 ms) of input lag. For a side-view action game that is noticeable but acceptable if the worker steps right away on receiving input; interpolation (section 6) hides the jitter.
- The simulation is deterministic today: seeded `createRng`, and `Math.random` is not used inside `src/game`. A worker does not change that, provided it receives inputs with frame numbers and steps a fixed 60 Hz. With the variable `realDt` that `main.ts` passes now, two machines already diverge, so a fixed step is a prerequisite either way.
- Messages arrive between worker steps, not inside them, so no locking is needed for the clone-based designs. With shared memory you need to take care to read a consistent snapshot (a version counter read before and after, or double buffers with `Atomics`).
- Everything that today reaches into `world` from the UI (menus, prompts, the `__game` debug hook, tests) would need a message API.

**Staged path, if the owner insists.**
1. Do items 1 to 8 in the table. They are needed anyway, and may remove the freezes.
2. Introduce a render snapshot (a plain, cloneable "what to draw" structure) between `World` and the renderer, still on one thread. This is the real prerequisite and also makes interpolation easy.
3. Move pure jobs to workers with typed-array inputs and outputs, keeping everything else on the main thread: level generation at load (section 4), maybe the collapse check (input: `kinds` copy and slab rows; output: a list of loose tile indices; the sim would use last frame's answer, which suits collapse since the tiles fall slowly anyway).
4. Only then consider moving the whole `stepWorld` to a worker, behind the snapshot layer. By then you will know whether the main thread still needs it.

Do not expect a second thread to help guards or fire much by itself: those systems read and write the same shared `World` (guards read tiles, props, fires and smoke; fire writes tiles and props), so splitting them across threads needs the shared-array rewrite.

Links: [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects), [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics), [Making your website cross-origin isolated](https://web.dev/articles/coop-coep), [Cross-origin isolation guide](https://web.dev/articles/cross-origin-isolation-guide), [Is postMessage slow?](https://surma.dev/things/is-postmessage-slow/), [Use web workers to run JavaScript off the main thread](https://web.dev/articles/off-main-thread), [Vite worker and server header options](https://vite.dev/guide/features#web-workers).

## 4. Level generation and first-frame mesh building at load

**What it is.** Run `createComplex(seed)` (the generator) in a worker and send the result back; build the level mesh in slices rather than in one go; show a progress bar fed by stage messages.

**Measured.** Generation 100 to 200 ms, level mesh about 300 ms, first two game steps about 43 ms each. That is about half a second of blocked main thread; the other loading costs (models, textures, shaders) are not measured.

**What pays off, in order.**
1. *Stage it and yield.* Break loading into named stages (generate, furnish, build mesh in groups of chunks, load models, warm caches, compile shaders), and `await` a yield between them so the page can paint the progress bar. `scheduler.yield()` where available, else a `setTimeout(0)` or `MessageChannel` trick. This needs no worker, and gives most of the visible win. Mesh building is the natural slice: `createLevelMesh` already loops over chunks one at a time through `rebuild`, so it can run as "20 chunks per slice".
2. *Warm up first-use caches during the loading screen.* The 43 ms first frames are lazy setup: the prop index (3,076 props into a Map), door index, stair plan, the falling-props copy of the 61,200-tile grid, the slab-row cache. Call them once before play starts.
3. *Shaders.* three.js compiles a material's shader the first time it is drawn, which freezes the frame. `renderer.compileAsync(scene, camera)` uses the `KHR_parallel_shader_compile` extension so compilation does not block. Put it behind the progress bar.
4. *Generation in a worker.* The generator is pure and seeded, so it is a clean first worker job. What would be sent back: the grid (two typed arrays, transferred, not copied) plus rooms, props (9 ms to clone), guards, devices, stairwells and so on, as plain data. Check that no function ends up in the `Level` (the plan callbacks such as `plan: (storey) => ...` in `complex.ts` are inputs, not outputs, but I did not trace every field). Worth doing mainly so the progress bar animates smoothly during generation; with about 150 ms of generation it is not urgent.
5. *Mesh geometry in a worker.* `MeshBuilder` builds plain arrays and then a `BufferGeometry`; the array-building half is pure and could run in a worker, returning `Float32Array`s to transfer. Gain is real only for big rebuilds (explosions); the cheaper fix there is item 2 of the ranked list (cap rebuilds per frame). `addBlock` allocates dozens of small arrays per tile (`[x, y, z]` tuples, colour triples); trimming that is also a GC win.
6. *Assets.* 38 MB of GLB models, 8.5 MB of characters (a 7.6 MB `UAL1_Standard.glb`), HDR sky. These load through `GLTFLoader` promises, but parse and texture upload still happen on the main thread. Compressed textures (KTX2/Basis), meshopt or Draco, and loading only what the first view needs are standard remedies. This is outside the simulation but is a likely source of load-time freezes; measure it.

Links: [Scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield), [Optimize long tasks](https://web.dev/articles/optimize-long-tasks), [WebGLRenderer.compileAsync](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.compileAsync), [Using web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [Comlink](https://github.com/GoogleChromeLabs/comlink) (a small helper that makes worker calls look like function calls).

## 5. Rust/WebAssembly or AssemblyScript

**What it is.** Compile a hot function to WebAssembly, call it from TypeScript, pass data through shared linear memory.

**Where WebAssembly really wins.** Tight numeric loops over typed arrays with no allocation, such as image filters, physics solvers, big cellular automata, flood fills over millions of cells, and pathfinding over huge grids; especially when you can use SIMD ([V8 SIMD](https://v8.dev/features/simd)) or threads, and when the same code must also run natively. Gains over naive JavaScript depend heavily on the kernel (I did not benchmark this myself; treat any quoted multiple as indicative only). Against well-written JavaScript the gap is often much smaller, and sometimes negative: Surma's AssemblyScript port of a JavaScript kernel started about 3x slower than V8's optimised JavaScript and only overtook it after tuning compiler flags; a naive AssemblyScript bubble sort was 80 times slower ([JS to AssemblyScript](https://surma.dev/things/js-to-asc/)). Academic measurements find WebAssembly about 1.5x slower than native on average ([Not So Fast, USENIX ATC 2019](https://www.usenix.org/conference/atc19/presentation/jangda)), which is a reminder that it is not magic.

**Does it pay off here? No, not now.**
- The measured cost is not in numeric kernels. The biggest systems are guard decision-making (branching, object fields, many small lookups), projectile and blast handling, and prop and room lookups. Those are object-graph code, the kind WebAssembly is worst at, because the data would have to be rewritten into flat arrays first.
- The numeric kernels are already small: collapse check 0.6 ms warm for the whole 61,200-tile grid; hazards 0.25 ms at the 600-fire cap; smoke tick 0.6 to 1.5 ms. A 2x speed-up of all three saves about 1 ms a frame in the worst case. The frame-time bursts come from garbage and bulk rebuilds, not from arithmetic.
- The crossing cost matters for fine-grained calls: each JS-to-WASM call is cheap now, but copying a `Float32Array` of a few hundred KB into WASM memory every frame is not free, and anything that touches `World` objects (props, guards) needs marshalling. You would end up moving the grid, fire and smoke fields into WASM memory permanently, and rewriting every reader (the renderer, guards, vision, tests) to use accessor functions.
- Build complexity: Rust toolchain in CI and for every contributor, `wasm-bindgen`, a Vite plugin such as `vite-plugin-wasm` and `vite-plugin-top-level-await`, a second language and a second test setup. `wasm-pack` itself was archived with the `rustwasm` GitHub organisation in September 2025 (`wasm-bindgen` moved to its own organisation and continues), so the toolchain story is currently less settled than it was. The project's single-language, 100% TypeScript, `vitest`-tested setup is a real asset for a game with this many cross-system interactions.
- AssemblyScript keeps one language family and builds with `npm`, which removes the toolchain problem, but its output is often no faster than V8's JavaScript, per Surma's experiment above, so the only gain would be predictable timing.
- Determinism: WebAssembly floating point is deterministic (IEEE 754, with a canonical NaN rule), so it would not break replays, but you must keep both implementations identical during any migration.

**What to do instead: "WASM-style TypeScript".** Most of WebAssembly's advantage on a kernel comes from its data layout, and you can have that in plain TypeScript:
- Struct-of-arrays: `Float32Array` for x, y, heat, instead of a `Map<number, Fire>` of objects. Fire is the clearest candidate: 600 objects in a `Map` that is copied (`[...hazards.fires]`) every 100 ms.
- Precomputed neighbour tables or offsets, and a solid-tile mask as a `Uint8Array` (`smoke.ts` already does `SOLID[kinds[key]]`; `openNeighbour` recomputes `x`, `y` with `%` and `/` per neighbour per cell).
- Bitsets (`Uint32Array`) for visited flags rather than `Set<number>` or `Set<string>`: `openAreaAround` uses `new Set`, and `propsNear` builds a `Set` per call.
- No allocation inside loops: reuse module-level scratch buffers, pass indices instead of `{x, y}` objects.
- The flood fill in `collapse.ts` already follows this recipe (fixed `Int32Array` stack, `Uint8Array` flags); its only flaw is allocating the buffers on every call.

If after all of that a single kernel is still too slow on the target machines, that kernel (smoke is the candidate) can be rewritten as one self-contained AssemblyScript or Rust module with one `step(ptr, ...)` entry point. That is the point to revisit this section, with a profile in hand.

Links: [WebAssembly concepts](https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Concepts), [wasm-bindgen guide](https://rustwasm.github.io/docs/wasm-bindgen/), [Sunsetting the rustwasm GitHub org](https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org/), [AssemblyScript](https://www.assemblyscript.org/), [vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm), [JS to AssemblyScript](https://surma.dev/things/js-to-asc/), [Not So Fast (USENIX)](https://www.usenix.org/conference/atc19/presentation/jangda), [WebAssembly threads](https://web.dev/articles/webassembly-threads).

## 6. Fixed timestep with render interpolation

**What it is.** The simulation advances in equal slices (say 1/60 s), as many as real time requires; drawing happens once per display frame and blends between the last two simulated states by the leftover fraction of a slice. The classic write-up is Glenn Fiedler's "Fix Your Timestep".

**Today.** `main.ts` runs exactly one `stepWorld` per animation frame with `realDt` clamped to 1/30, then scaled by slow motion in `stepTime`. Hazard clocks (`FIRE_TICK`, `SMOKE_TICK`, up to 3 catch-up ticks) already do a local version of fixed ticks. On a 144 Hz display everything steps at 144 Hz; after a hitch the next step is as big as 1/30 s (tunnelling risk, bigger bursts). In slow motion the player moves in small steps drawn at full rate, which is fine.

**When it pays off.** Even motion on high-refresh screens, reproducible behaviour (the same input stream gives the same game, useful for tests and bug reports), a clean base for threading, and a natural place to cap catch-up work so a long frame cannot snowball (cap at 3 to 4 steps, then drop the rest rather than spiral).

**Pitfalls.**
- The renderer reads positions straight from `World`. To interpolate you need previous and current positions for the drawn things (player, guards, ragdoll joints, projectiles, falling tiles, props that move). A cheap way is to copy the handful of drawn positions into a render snapshot at each step, which is also stage 2 of the worker path.
- Do not interpolate things that jump (teleports, elevators arriving, ragdoll spawn): flag them or skip interpolation for that frame.
- Slow motion must scale the step length, not the number of steps, or the cost of fights would multiply.
- Do input sampling once per rendered frame or once per step consistently; edge flags such as `firePressed` must be consumed by exactly one step. `main.ts` builds `frameInput` once per frame, so this needs care.
- Systems with clocks derived from `world.clock` (the security `SLOW_CHECKS_PER_SECOND` check) are fine with fixed steps and become more regular.

Links: [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/), [Game Programming Patterns: Game Loop](https://gameprogrammingpatterns.com/game-loop.html).

## 7. Time-slicing and level of detail for guards, spatial hashing, sleeping, incremental collapse

**Guard AI level of detail (time-slicing).**
- *What.* Every guard calls `thinkGuard` every step (about 5 microseconds each when idle, up to 30 to 60 microseconds in a fight, which is where the 2.7 to 4.4 ms comes from). Instead, give each guard a tier: tier 0 (in combat, alerted, or within a screen-and-a-bit of the player, or visible) thinks every step; tier 1 (patrolling far away) thinks every 4th to 6th step, using the accumulated `dt`; tier 2 (very far, unseen, unalerted) can be simulated abstractly, for example advancing along the patrol route by arithmetic and only fully materialising when the player gets near.
- *Spread.* Stagger by `guard.index % k` so the expensive guards do not all think on the same frame.
- *When it pays off.* In the big fight only the guards near the player are doing anything interesting; the rest are patrolling or hunting. With 79 guards, tiering could cut the guard cost by half or more.
- *Pitfalls.* Timers inside guard code must use the accumulated `dt`; movement (walking along a route) must still integrate at the true `dt` or use the accumulated one with care at stairs and doors; do not let a far guard walk through something because it moved too far in one big step (clamp to a step length). Perception that is supposed to react to the player must not be delayed for guards that are near but off screen: use distance and alert state, not just visibility. Keep a test that proves a throttled guard still reacts within a fraction of a second to noise and sight.

**Spatial hashing.**
- *What.* A grid of buckets (say 8x8 tiles) listing which things lie in each, so "who is near this point?" looks in a few buckets instead of every thing.
- *Here.* Props already have a tile index (`propIndex`, `coverIndex`, `tileIndex`). The missing ones are `nearestFire` (loops every fire per query), per-guard checks over other guards and ragdolls, and `occupied()` in `collapse.ts`, which for each falling tile loops all guards and all their ragdoll points (342 falling tiles times 86 guards in my fight). A guard bucket grid rebuilt once per step costs about 79 inserts and removes most of those loops.
- *Pitfalls.* Rebuild or update the grid each step; use integer cell keys, not strings; never allocate a list per query (reuse a scratch array).

**Sleeping and islanding (do not simulate what nothing is touching).**
- *Ragdolls.* The clearest case: 76 dead guards were stepped every frame at 16 microseconds each, for ever, and `stepRagdoll` has no sleep. Add a rest counter: when every joint's speed is under a small threshold for about 60 steps, skip the step; wake the body on a blast, a nearby tile change or being touched. It is one of the cheapest wins and its cost grows with every kill.
- *Fire and smoke.* Already sparse (only active cells are visited) and fully free when quiet (`isQuiet`). A further step is not needed unless the smoke cap of 5,000 cells proves to be a cost on weak machines; then consider updating smoke every second or third tick for cells far from the camera.
- *Physics props and falling tiles.* Props already sit still unless loosened (`physProps.loose`). Falling tiles are sorted and filtered each frame; fine.

**Incremental collapse checks.**
- *What.* Today `findUnsupported` flood-fills from the bottom of the map through all 61,200 tiles every time `structureChanged` is set. The warm cost is 0.6 ms, so it is not the problem on its own; the issues are the allocation (about 300 KB each call) and that several explosions in successive frames each trigger a full pass.
- *Cheap fixes first.* Hold the two buffers at module level and clear them with `fill(0)`; debounce so a burst of destruction runs one check about every 100 ms; skip rows above the highest changed row's building if you track changed chunks.
- *Proper incremental version.* Only re-check connectivity near the changed tiles: from each removed tile, test its solid neighbours' support by a bounded search, which stops as soon as it reaches the supported set; only if a search is exhausted without reaching ground is the component loose. This is the usual "local search from the changed spot" approach; the Noita talk linked below covers how a destructible-world game finds and drops disconnected pieces (a different representation, so use it for ideas, not code). Be careful with the special rules here: the back-wall span (`BACK_WALL_SPAN`), duct hangers, ladders, and the reinforced frame make the local search easy to get subtly wrong. The existing `soak.test.ts` check (nothing floating after a quiet moment) is the safety net; keep it and compare the two implementations on random damage.
- *Verdict.* Do the cheap fixes now; do the incremental rewrite only if profiles on real machines still show the collapse check, which they probably will not.

Links: [Spatial Partition](https://gameprogrammingpatterns.com/spatial-partition.html), [Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html), [Exploring the Tech and Design of Noita (GDC)](https://www.gdcvault.com/play/1025695/Exploring-the-Tech-and-Design), [Game Programming Patterns: Game Loop](https://gameprogrammingpatterns.com/game-loop.html).

## 8. Burst control inside a frame

This is the cheapest class of fix for freezes and it is not a fashionable technique, so it is easy to overlook.

- *Cap chunk rebuilds.* `createLevelMesh.refresh` rebuilds every dirty chunk in one call. Measured peak: 26 chunks in a frame, 70 ms. Rebuild the nearest 3 to 4 per frame and keep the rest dirty; draw the old geometry until the new is ready. The chunk-edge marking in `markDirty` (a tile on a chunk edge dirties the neighbours too) multiplies this; a tile one step inside the edge does not need the neighbour.
- *Cap tiles damaged per explosion step*, or let big explosions carve in two or three frames.
- *Budget the frame.* Give the simulation a time budget (say 8 ms); systems that can wait (collapse check, prop index updates, cosmetic particles) check `performance.now()` and defer.
- *Cosmetic limits.* `burst()` particles and effects flashes: cap totals and drop the oldest.
- *Never let catch-up run away.* `hazards.ts` already caps catch-up ticks at 3 per frame; apply the same idea to any time-based loop.

## 9. Pathfinding: hierarchical, cached, flow fields

**What they are.** Hierarchical pathfinding plans a coarse route between regions first, then fills in detail; path caching reuses routes; a flow field is a grid of arrows toward one goal that any number of units can follow.

**Here, not needed.** This is a side-on game. Guards walk along floors and use stairs. `nav.ts` runs a small Dijkstra over staircase landings (dozens of nodes per building) and the plan is cached per stairwell list (`planFor`, rebuilt only when a flight is broken). `route` is under 1% of the fight profile. Hierarchical pathfinding is exactly what `nav.ts` already is (the building graph is the coarse level and the floor walk is the fine level). A flow field would only pay if hundreds of guards chased one target across an open grid, which is not this game. If a future feature adds grid-based pathing (a big crowd, vehicles), use a flow field from a goal ([Red Blob Games](https://www.redblobgames.com/pathfinding/tower-defense/)) and a bucket queue; until then skip it.

Cheap improvements that do apply: cache the result of `nextHop` per (guard, goal floor) for a short time; avoid `Math.min(...stops)`-style array spreads in hot functions.

Links: [Red Blob Games: A* introduction](https://www.redblobgames.com/pathfinding/a-star/introduction.html), [Red Blob Games: flow fields for tower defense](https://www.redblobgames.com/pathfinding/tower-defense/).

## 10. Garbage collection pauses

**What it is.** JavaScript frees memory in the background. Short-lived objects are collected quickly in a small "young" area (a scavenge, usually 1 to 3 ms, but longer when many objects survive), and long-lived ones in a bigger, slower collection. Mostly V8 does this concurrently, but each collection still stops the page for a moment, and if you allocate fast it happens often.

**Measured here.** About 0.7 MB allocated per frame on average, 378 scavenges in 25 s, 13% of CPU in GC, the worst pauses 80 to 300 ms (in a noisy run, so exaggerated, but the mean pause of 8 ms is real and is half a frame).

**Finding hot spots.**
1. Chrome DevTools, Memory panel, "Allocation sampling" during a fight; or "Allocation instrumentation on timeline" to see which functions allocate per frame. Look at the Performance panel's memory graph for a sawtooth (the steeper and more frequent, the more churn).
2. In Node-based benchmarks like those used here: `node --trace-gc` shows each collection and its pause.
3. Read the code for these shapes: `[...map]` or `[...array]` snapshots, `.map`, `.filter`, `.find` with closures in per-frame code, `{x, y}` literals, `new Set`, `new Map`, array literals like `[up, left, right, down]`, template-string keys.

**Allocation sites found in this code (examples, not a complete list).**
- `findUnsupported`: two big typed arrays plus a result array on every call (`collapse.ts`).
- `subStep` in `ragdoll.ts`: `ragdoll.points.map(...)` creates an array of objects per sub-step per body; `BONES.forEach` and `points.forEach` create closures per pass.
- `settle` and `spreadFrom` in `smoke.ts`: `const layers = [...]`, `const keep = [...].map(...)` per tick, `[up, left, right, down]` per gas cell.
- `stepFires`: `[...hazards.fires]` copy every 100 ms; `new Set<number>()` of rooms per tick.
- `occupied()` in `collapse.ts`: `[...hazards.grenades, ...frags, ...charges]` per falling tile; `propsAt(...).some(...)`.
- `propsNear`, `openAreaAround`: `new Set` per call.
- `markDirty` in `tiles.ts`: a literal array of five offset pairs on every tile change.
- `addBlock` in `levelMesh.ts`: dozens of tuple arrays per tile on every rebuild.
- `world.hazards.fires` as a `Map` of objects, and `.map`/`.filter` in `fallingProps.ts`.

**Fixes.**
- Object pools and reuse: [Object Pool pattern](https://gameprogrammingpatterns.com/object-pool.html). Keep module-level scratch arrays and typed buffers, reset them with `length = 0` or `fill(0)`.
- Replace small arrays and tuples inside loops with local variables or constants (hoisted tables like `const OFFSETS = new Int8Array([...])`).
- Numeric keys instead of strings for maps (the sim mostly already does this; `intel` uses template strings like `prop:${id}` but only on rare events).
- Prefer typed arrays and struct-of-arrays for anything with hundreds of entries (fires, smoke, falling tiles).
- Do not call `.sort()` or `.filter()` on a long array every frame if the array only changes occasionally (`world.falling` is sorted every frame).
- Avoid closures capturing per-frame state in hot paths (the `reach` closure in `findUnsupported`, called per tile, is a case; modern V8 handles it well but allocation of the closure per call adds up).
- Measure again after each change; GC behaviour is often surprising.

Links: [V8: Trash talk (the Orinoco collector)](https://v8.dev/blog/trash-talk), [Chrome DevTools: fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems), [Object Pool](https://gameprogrammingpatterns.com/object-pool.html).

## 11. `requestIdleCallback`, `scheduler.postTask`, `scheduler.yield`, long tasks

**What they are.**
- A long task is any main-thread task over 50 ms; while it runs, input, painting and animation wait. The Long Tasks API reports them.
- `scheduler.yield()` pauses your function, lets the browser handle input and paint, then resumes it ahead of other queued work (so it continues soon). Chromium-based browsers have it; elsewhere fall back to `setTimeout(0)` or a `MessageChannel` message.
- `scheduler.postTask(fn, { priority: 'background' })` queues work at a priority (`user-blocking`, `user-visible`, `background`) and supports cancel and delays.
- `requestIdleCallback(fn, { timeout })` runs work when the browser is idle, with a deadline object telling you how much time is left. It can be starved when the page is always busy (a game is always busy), so use a timeout and do not rely on it for anything the player is waiting for.

**What they are good for here.**
- Loading: yield between stages (section 4). This is the best use.
- Background chores during play that the player does not wait for: pre-building meshes for chunks just off screen, warming caches for a building the player is approaching, saving settings. Use `postTask` with `background` priority or `requestIdleCallback` with a timeout.
- *Not* the per-frame simulation. A game frame cannot be paused partway and resumed after paint without the world changing under it; time-slice by carrying state in the data (the "dirty chunks, rebuild N per frame" pattern in section 8), not by yielding in the middle of `stepWorld`.

**Pitfalls.** `requestIdleCallback` does not run reliably in a busy game loop and browser support has been uneven (check current support tables); always give it a timeout. `scheduler.yield` is not available everywhere, so feature-detect. Do not split work so finely that overhead dominates; aim for slices of 5 to 10 ms.

Links: [Optimize long tasks](https://web.dev/articles/optimize-long-tasks), [Scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield), [Scheduler.postTask](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask), [requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback), [PerformanceLongTaskTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming).

## 12. Interpolating and snapshotting state (if a worker or fixed step is added)

This is the same idea as section 6 seen from the renderer. What to include in a snapshot: for each drawn moving thing, its previous and current position and orientation. Static data is sent once and updated by small change lists (changed tiles by index, spawned and removed props). Typed arrays are the efficient shape. The existing `dirtyChunks` and `grid.version` already give the renderer a change list for tiles. Fire and smoke have `fireCells` and `smokeCells` view functions in `hazards/views.ts` (which already use pooled objects), a good model for the rest.

## 13. Worker pitfalls to know in advance

- Vite bundles workers with `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`. The worker cannot import code that touches `window`, `document` or three.js's DOM-bound parts; `src/game` is clean of these, which is a strength.
- Error handling: an exception in a worker does not reach the console of the main page by default; add `onerror` and log.
- Tests: `vitest` runs the sim on the main thread; keep the sim importable without the worker wrapper, so tests stay as they are.
- Debugging and profiling: DevTools shows workers as separate threads in the Performance panel. Use `performance.mark` inside workers too.
- Memory: each worker has its own heap; the 72 MB of assets in `dist` are not a worker concern unless the worker also loads them.
- Mobile and older browsers: `SharedArrayBuffer` needs cross-origin isolation, which breaks embedding and some third-party scripts and images; prefer transfer-based designs unless you control all hosting.

## 14. How to measure on a real machine

1. **User Timing marks per system.** Wrap each call in `stepWorld` (and each render layer, and each load stage) with `performance.mark('start')` and `performance.measure('collapse', 'start')`, or the shorthand `performance.measure('collapse', { start, end })`. In Chrome's Performance panel they show up in the Timings track, per frame, so you see exactly which system filled the spike. Gate it behind a `?perf` URL option so normal play pays nothing (marks cost a couple of microseconds each, so gate them).
2. **Performance panel (Chrome DevTools).** Record with CPU throttling at 4x to approximate a weak laptop; look for long tasks (red corners), the "GC" bars in the Main track, and the Frames track. Use "Bottom-Up" with "Group by Activity" to find self-time hot spots like the table above.
3. **Long-animation-frame observer.** `new PerformanceObserver(list => ...).observe({ type: 'long-animation-frame', buffered: true })` reports any frame over 50 ms with a breakdown of scripts, forced layout and render time. This is better than the older long-task observer for a game because it also says what ran. Log the entries to `localStorage` or the console, and ask the owner to play and send them. `PerformanceObserver` with `type: 'longtask'` is the fallback in browsers without it. Chromium only today.
4. **`performance.measureUserAgentSpecificMemory()`.** Gives total memory including workers, but needs cross-origin isolation (the same headers as in section 3), is Chromium only, and its results arrive on a delay. For a quick look, `performance.memory.usedJSHeapSize` (Chromium only, non-standard, coarse) is enough to see whether memory climbs over a long game (a leak looks like a staircase that never comes down).
5. **A frame-time HUD.** An optional overlay (toggle by key) showing the last 120 frame times as bars, with mean, p95 and max, plus counts of fires, smoke cells, falling tiles, dirty chunks and guards thinking. It lets the owner say "it froze when X happened" and gives you the numbers that match.
6. **Repeatable scenario.** Reuse the soak's `mayhem` approach (see `soak.test.ts`) behind a debug key, so the same fight can be replayed on any machine and compared before and after a change. Keep the existing reference-workload method (`benchmark.ts`) for tests; it already handles noisy machines well by comparing against a fixed workload.
7. **Node-based profiling for the sim alone.** `vitest` with `pool: 'forks'` and `execArgv: ['--cpu-prof', '--trace-gc']` produces a CPU profile and a GC log without a browser, which is how the tables above were produced. Good for finding algorithmic hot spots; useless for rendering, GPU or load costs, which need the browser.

Links: [User Timing](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/User_timing), [Chrome DevTools performance](https://developer.chrome.com/docs/devtools/performance), [Long animation frames](https://developer.chrome.com/docs/web-platform/long-animation-frames), [PerformanceLongAnimationFrameTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming), [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [Monitor total memory usage](https://web.dev/articles/monitor-total-page-memory-usage), [measureUserAgentSpecificMemory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory), [Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems).

## 15. Where this leaves the owner's suggestions

- **Background workers.** Useful for a few pure jobs (level generation at load, maybe batch mesh geometry) and as a progress-bar enabler. A full simulation worker is a large rewrite (a render-snapshot layer, a message protocol, shared caches keyed by object identity, a fixed step) for a simulation whose average cost is small. Do it last, if at all, and only after sections 2 to 8 and a real-machine trace say the main thread is still too busy.
- **Rust/WASM.** Not worth it now: the measured hot spots are not numeric kernels, the kernels that are numeric already cost under 1 to 2 ms, the toolchain adds a second language to a single-language project, and the Rust-for-web toolchain is mid-transition. Revisit only for one isolated kernel (smoke) with a profile that proves it is the bottleneck.
- **"A ton of other techniques".** The ones that match the evidence are cheap and local: measure, spread burst work over frames, stop allocating in hot loops, let dead bodies sleep, think less often for far guards, stage the load and warm caches. Those should remove most of the freezes without changing the architecture.

## Sources

Fetched or checked while writing this note (status 200 when checked on 10 November 2026 unless noted; GitHub pages returned 403 to the research proxy but are the projects' real addresses):

- structuredClone: https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone
- Transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- SharedArrayBuffer: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- Atomics: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics
- Cross-origin isolation (COOP/COEP): https://web.dev/articles/coop-coep
- Cross-origin isolation guide: https://web.dev/articles/cross-origin-isolation-guide
- Vite web workers: https://vite.dev/guide/features#web-workers
- Vite server options (headers): https://vite.dev/config/server-options
- Using web workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- Off the main thread: https://web.dev/articles/off-main-thread
- Is postMessage slow? (Surma): https://surma.dev/things/is-postmessage-slow/
- Comlink: https://github.com/GoogleChromeLabs/comlink
- Scheduler.yield: https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield
- Scheduler.postTask: https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask
- Optimize long tasks: https://web.dev/articles/optimize-long-tasks
- requestIdleCallback: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
- WebGLRenderer.compileAsync: https://threejs.org/docs/#api/en/renderers/WebGLRenderer.compileAsync
- WebAssembly concepts: https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Concepts
- wasm-bindgen guide: https://rustwasm.github.io/docs/wasm-bindgen/
- Sunsetting the rustwasm GitHub org (wasm-pack archived): https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org/
- AssemblyScript: https://www.assemblyscript.org/
- vite-plugin-wasm: https://github.com/Menci/vite-plugin-wasm
- From JavaScript to AssemblyScript (Surma): https://surma.dev/things/js-to-asc/
- Not So Fast: WebAssembly vs native (USENIX ATC 2019): https://www.usenix.org/conference/atc19/presentation/jangda
- V8 SIMD: https://v8.dev/features/simd
- WebAssembly threads: https://web.dev/articles/webassembly-threads
- Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/
- Game Programming Patterns, Game Loop: https://gameprogrammingpatterns.com/game-loop.html
- Game Programming Patterns, Object Pool: https://gameprogrammingpatterns.com/object-pool.html
- Game Programming Patterns, Spatial Partition: https://gameprogrammingpatterns.com/spatial-partition.html
- Game Programming Patterns, Dirty Flag: https://gameprogrammingpatterns.com/dirty-flag.html
- Red Blob Games, A* introduction: https://www.redblobgames.com/pathfinding/a-star/introduction.html
- Red Blob Games, flow fields for tower defense: https://www.redblobgames.com/pathfinding/tower-defense/
- Exploring the Tech and Design of Noita (GDC): https://www.gdcvault.com/play/1025695/Exploring-the-Tech-and-Design
- V8, Trash talk: https://v8.dev/blog/trash-talk
- Chrome DevTools, performance: https://developer.chrome.com/docs/devtools/performance
- Chrome DevTools, memory problems: https://developer.chrome.com/docs/devtools/memory-problems
- Long animation frames: https://developer.chrome.com/docs/web-platform/long-animation-frames
- PerformanceLongAnimationFrameTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming
- PerformanceLongTaskTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming
- PerformanceObserver: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
- User Timing: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/User_timing
- Monitor total page memory usage: https://web.dev/articles/monitor-total-page-memory-usage
- measureUserAgentSpecificMemory: https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory
- OffscreenCanvas (not used here, relevant only if drawing ever moves to a worker): https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
