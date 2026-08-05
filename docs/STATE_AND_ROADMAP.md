# State of the game and roadmap

## Current milestone

Orcfall Command is a complete, locally playable React and Three.js horde-defense prototype. It follows the broad planning, tower-defense, active-power, and progression ideas of *Sir, We Have an Orc Problem* while using original names, maps, code-native models, generated audio, and interface styling.

The implementation was built in playable layers. Each layer was reviewed, tested, built, and browser-played before the next major system was added.

## Playable now

- Six sequential campaign missions with authored maps, waves, lane/open-field layouts, objectives, and late-game flood pressure.
- Deterministic endless mode and six challenge modes.
- Ten tower types with distinct costs, ranges, targeting roles, and combat behavior.
- Ten orc types, including directional shields, wall-seeking Sappers, aura carriers, Berserkers, and knockback-resistant Ogres.
- Pre-battle deployment with supply limits, starting walls, selection, targeting rules, move, sell, undo, clear, and wall rotation.
- No normal tower placement after the battle starts.
- Seven battlefield tools: Strafe, Barrage, Cryo Beam, Nuke, Orbital Laser, Repair, and temporary walls.
- Drag-oriented Strafe and Cryo lines, guided Orbital Laser, Nuke falloff, knockback, finite power charges, and wall recharge.
- A 60-node persistent research tree with unlocks and real stat/behavior changes.
- A Commander Doctrine passive slot.
- Persistent medals, best runs, campaign progress, selected difficulty/loadout/doctrine, maps, tuning, and settings.
- Fortress shields, leak tracking, supply-cache objectives, boss/reward wave metadata, and results with damage by source.
- Pause/resume, 1×/2× speed, keyboard controls, settings, contextual help, reduced flashes, screen shake, corpse density, volume controls, and narrow-screen layouts.
- Generated combat/UI audio plus pooled impact, corpse, tracer, and wall-break effects.
- Shattered Expanse, a three-spawn open-field campaign map with nine buildable polygon platforms, one solid blocker, and 2,244 streamed enemies.

## Creator and prototyping tools

Map Forge can create and persist multiple custom battlefields using the same `MapDefinition` consumed by the game. It supports:

- Multiple paths and lanes.
- Corridor or open-field navigation, with editable platform and blocker polygons.
- Width, depth, and path-width controls.
- Build zones, boulders, supply-cache objectives, and decoration stamps.
- Terrain palettes.
- Wave groups, lane assignment, delays, intervals, health/speed/damage multipliers, reward multipliers, and boss markers.
- JSON import/export and direct Sandbox play.

The live tuning overlay supports tower, enemy, wall, and power metrics, quick restart, per-enemy spawning, 2,000/5,000-enemy stress hordes, a 50,000-total continuous stream held inside a 5,000-live envelope, live frame/simulation telemetry, unlock-all, and fortress invulnerability. Cheat-assisted runs are clearly unranked and runtime cheats are not saved.

## Validation at this commit

- `npm test`: 217 passing tests; three optional benchmark tests skipped during the normal suite.
- `npm run build`: passing production build.
- `npm run benchmark:combat`:
  - 2,000 live enemies: approximately 1.01 ms average fixed simulation step.
  - 5,000 live enemies: approximately 2.26 ms average fixed simulation step.
  - 50,000 enemies streamed through ten bounded 5,000-enemy cohorts: approximately 1.61 ms per measured step.
- Desktop and 720×900 browser acceptance QA completed with zero application console errors.
- Campaign pacing is estimated at roughly 8–10 minutes per successful run, with 636–2,244 authored enemies depending on the mission.

### Why the crowd index stays dependency-free

Moving orcs use a reusable typed-array uniform grid. Every fixed step clears its bucket heads and relinks each live orc once; nearby collision and targeting queries then visit only overlapping buckets. Crowd separation writes directly into one result vector instead of allocating and sorting a neighbor list for every orc.

We evaluated general spatial-tree libraries but did not add one. Flatbush is explicitly a static packed R-tree, so all moving orcs would require a new index and finalization every step. RBush supports mutation, but its general rectangle-tree bookkeeping is unnecessary for thousands of similarly sized agents in a bounded arena. The measured uniform grid remains comfortably inside the 16.67 ms 60 FPS simulation budget at 5,000 live orcs, while adding no download size or maintenance dependency. Reconsider a tree, worker, or WASM broadphase only if representative integrated browser profiling—not a synthetic entity count alone—shows the grid is the bottleneck.

## Known limitations

- Progress and custom maps use browser `localStorage`; there is no account system, cloud synchronization, or server backend.
- Visuals are deliberately code-native low-poly prototypes. There is no production animation, rigging, cinematic, localization, or external art pipeline yet.
- Audio is procedurally generated rather than a final mastered soundtrack/effects package.
- The main Three.js bundle is large and Vite reports a chunk-size warning. Runtime performance is good in current stress tests, but route-level code splitting is still worthwhile.
- Balance numbers are designed for fast iteration and need broader human playtesting across all difficulties and research combinations.
- The game is a mechanics-focused original interpretation, not a copy of the reference game's protected art, maps, writing, audio, or UI assets.

## Recommended next work

### High priority

1. Add CI for tests, production builds, and a small deterministic browser smoke test.
2. Run full campaign balance sessions on Cadet, Standard, and Veteran; record win rates and common failure points.
3. Add cloud/exportable save profiles and a visible reset/import/export flow.
4. Split editor/research routes from the initial Three.js bundle.
5. Add a deterministic end-to-end test that protects a custom supply cache through the results/reward screen.

### Content and feel

1. Add more Commander Doctrines, secondary-objective types, challenge modifiers, and map decorations.
2. Improve tower firing animation, projectile arcs, orc locomotion, fortress damage states, and boss presentation.
3. Add touch controls, remappable keys, and controller support.
4. Add production sound design, music, mixing, and more complete accessibility options.
5. Continue tuning upgrade costs, tower variants, wave pacing, and endless scaling.

### Production readiness

1. Add error reporting and opt-in analytics around mission completion and performance.
2. Add localization infrastructure and text overflow testing.
3. Define a licensed production asset pipeline if the project moves beyond code-native visuals.
4. Add deployment configuration and a release checklist.

## Important documents

- [`README.md`](../README.md): setup, controls, and feature overview.
- [`GAME_SPEC.md`](GAME_SPEC.md): complete gameplay and technical specification.
- [`PR_DESCRIPTION.md`](PR_DESCRIPTION.md): reviewer-facing impact and manual QA checklist.
- [`CONVERSATION.md`](CONVERSATION.md): user-visible conversation that produced this repository.
