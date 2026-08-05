# State of the game and roadmap

## Current milestone

Orcfall Command is a complete, locally playable React and Three.js horde-defense prototype. It follows the broad planning, tower-defense, active-power, and progression ideas of *Sir, We Have an Orc Problem* while using original names, maps, code-native models, generated audio, and interface styling.

The implementation was built in playable layers. Each layer was reviewed, tested, built, and browser-played before the next major system was added.

## Playable now

- Six sequential campaign missions with authored maps, waves, lane/open-field layouts, objectives, and late-game flood pressure.
- Deterministic endless mode and six challenge modes.
- Ten tower types with distinct costs, ranges, firing sectors, targeting roles, and combat behavior. Every tower offers Standard plus two materially different research-unlocked profiles.
- Ten orc types, including directional shields, wall-seeking Sappers, aura carriers, Berserkers, and knockback-resistant Ogres.
- Pre-battle deployment with visible starting/remaining supply and tower prices; move is free and sell, undo, and clear refund 100% of setup cost.
- Two-click tower deployment: anchor the base, aim the visible sector, then lock facing. All setup towers show their sectors; Rocket and Mortar also show minimum-range dead zones.
- Weapon towers use 30–60° combat sectors, Support Beacon uses a 360° aura, and firing angle is adjustable through tuning and selected research.
- One persistent defense layout per map, with challenges stored separately. Tower/power loadout, positions, facing, targeting, starting walls, and selected variants survive restart, map switching, and reload. Over-budget layouts remain editable but cannot start until supply is brought back under the limit.
- No normal tower placement after the battle starts.
- Seven battlefield tools: Strafe, Barrage, Cryo Beam, Nuke, Orbital Laser, Repair, and temporary walls.
- Drag-oriented Strafe and Cryo lines, guided Orbital Laser, Nuke falloff, knockback, finite power charges, and wall recharge.
- A branching 60-node persistent research graph with visible tower, power, wall, and variant unlock badges. Related stat and profile choices fan out from their root unlock.
- A Commander Doctrine passive slot.
- Persistent medals, best runs, campaign progress, selected difficulty/loadout/doctrine, per-level layouts and variants, maps, tuning, and settings.
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

The live tuning overlay supports tower cost, damage, range, rate, and firing angle plus enemy, wall, and power metrics; quick restart; per-enemy spawning; 2,000/5,000-enemy stress hordes; a 50,000-total continuous stream held inside a 5,000-live envelope; live frame/simulation telemetry; unlock-all; and fortress invulnerability. Cheat-assisted runs are clearly unranked and runtime cheats are not saved.

## Validation at this commit

- `npm test`: 283 deterministic rules tests pass; three optional performance cases are skipped in the normal suite. Coverage includes combat, facing sectors, variant selection and behavior, setup economy, layout isolation/sanitizing, saves, maps, and progression.
- `npm run build` is the required production-build gate.
- `npm run benchmark:combat`:
  - 2,000 live enemies: approximately 1.49 ms average fixed simulation step.
  - 5,000 live enemies: approximately 2.64 ms average fixed simulation step.
  - 50,000 enemies streamed through ten bounded 5,000-enemy cohorts: approximately 1.99 ms per measured step.
- Browser acceptance verified the briefing profile picker, starting/remaining supply, two-click placement, visible directional sectors, reload persistence, and switching to another map and back. The broader release checklist remains in `PR_DESCRIPTION.md`.
- Campaign pacing is estimated at roughly 8–10 minutes per successful run, with 636–2,244 authored enemies depending on the mission.

### Why the crowd index stays dependency-free

Moving orcs use a reusable typed-array uniform grid. Every fixed step clears its bucket heads and relinks each live orc once; nearby collision and targeting queries then visit only overlapping buckets. Crowd separation writes directly into one result vector instead of allocating and sorting a neighbor list for every orc.

We evaluated general spatial-tree libraries but did not add one. Flatbush is explicitly a static packed R-tree, so all moving orcs would require a new index and finalization every step. RBush supports mutation, but its general rectangle-tree bookkeeping is unnecessary for thousands of similarly sized agents in a bounded arena. The measured uniform grid remains comfortably inside the 16.67 ms 60 FPS simulation budget at 5,000 live orcs, while adding no download size or maintenance dependency. Reconsider a tree, worker, or WASM broadphase only if representative integrated browser profiling—not a synthetic entity count alone—shows the grid is the bottleneck.

## Known limitations

- Progress, custom maps, tuning, settings, and defense layouts use browser `localStorage`; there is no account system, cloud synchronization, or server backend.
- Visuals are deliberately code-native low-poly prototypes. There is no production animation, rigging, cinematic, localization, or external art pipeline yet.
- Audio is procedurally generated rather than a final mastered soundtrack/effects package.
- The main Three.js bundle is large and Vite reports a chunk-size warning. Runtime performance is good in current stress tests, but route-level code splitting is still worthwhile.
- Balance numbers are designed for fast iteration and need broader human playtesting across all difficulties and research combinations.
- The game is a mechanics-focused original interpretation, not a copy of the reference game's protected art, maps, writing, audio, or UI assets.

## Recommended next work

### High priority

1. Extend the existing main-branch test workflow with the production build and a small deterministic browser smoke test.
2. Run full campaign balance sessions on Cadet, Standard, and Veteran; record win rates and common failure points.
3. Add cloud/exportable save profiles and a visible reset/import/export flow.
4. Split editor/research routes from the initial Three.js bundle.
5. Add a deterministic end-to-end test that protects a custom supply cache through the results/reward screen.

### Content and feel

1. Add more Commander Doctrines, secondary-objective types, challenge modifiers, and map decorations.
2. Improve tower firing animation, projectile arcs, orc locomotion, fortress damage states, and boss presentation.
3. Add touch controls, remappable keys, and controller support.
4. Add production sound design, music, mixing, and more complete accessibility options.
5. Continue tuning upgrade costs, firing sectors, tower profile tradeoffs, wave pacing, and endless scaling.

### Production readiness

1. Add error reporting and opt-in analytics around mission completion and performance.
2. Add localization infrastructure and text overflow testing.
3. Define a licensed production asset pipeline if the project moves beyond code-native visuals.
4. Add deployment configuration and a release checklist.

## Important documents

- [`README.md`](../README.md): setup, controls, and feature overview.
- [`GAME_SPEC.md`](GAME_SPEC.md): complete gameplay and technical specification.
- [`PR_DESCRIPTION.md`](PR_DESCRIPTION.md): reviewer-facing impact and manual QA checklist.
- [`TOWER_VARIANTS.md`](TOWER_VARIANTS.md): exact tower profiles and their research ownership.
- [`COMBAT_TEST_MATRIX.md`](COMBAT_TEST_MATRIX.md): deterministic combat and lifecycle coverage.
- [`CONVERSATION.md`](CONVERSATION.md): user-visible conversation that produced this repository.
