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
- Tower models/previews are half their former dimensions, and placement uses matching compact spacing with small road, terrain, platform-edge, and map-edge tolerance.
- Weapon towers use 30–60° combat sectors, Support Beacon uses a 360° aura, and firing angle is adjustable through tuning and selected research.
- One persistent defense layout per map, with challenges stored separately. Tower/power loadout, positions, facing, targeting, starting walls, and selected variants survive restart, map switching, and reload. Over-budget layouts remain editable but cannot start until supply is brought back under the limit.
- No normal tower placement after the battle starts.
- Seven battlefield tools: Strafe, Barrage, Cryo Beam, Nuke, Orbital Laser, Repair, and temporary walls.
- Drag-oriented Strafe and Cryo lines, guided Orbital Laser, Nuke falloff, knockback, finite power charges, and wall recharge.
- A branching 83-node persistent research graph. Stat, tower, variant, power, wall, and doctrine cards have distinct shapes/labels; right-angle arrows show real dependencies, and special profiles require their relevant stat path at maximum rank.
- Four distinct Commander Doctrines, each unlocked by Command research, with one passive slot per run.
- Persistent Command Medals, best runs, campaign progress, selected difficulty/loadout/doctrine, per-level layouts and variants, maps, tuning, and settings. Campaign medals equal the eliminated percentage, first clears add 50, and completed-map replays pay half rate; a full result is sized to buy at least two common upgrades.
- Fortress shields, leak tracking, supply-cache objectives, boss/reward wave metadata, and results with damage by source.
- Reward-first after-action reports: earned Command Medals and their breakdown lead the report, losses show progress, unranked runs explain why no medals were saved, and secondary damage statistics are collapsible.
- Pause/resume, confirmed surrender, 1×/2× speed, keyboard controls, settings, contextual help, reduced flashes, screen shake, corpse density, volume controls, and narrow-screen layouts.
- Generated combat/UI audio plus bounded instanced projectiles, impact particles, wall debris, and separate persistent corpse history.
- Tower recoil and muzzle flashes, shared barrel-tip tracer origins, bright weapon-colored shot lines, weapon-specific projectile arcs, stride/bob locomotion, staged fortress cracks/rubble/smoke, and boss rings with world-space health bars.
- Camera fit plus bounded wheel/button zoom and right/middle-button field dragging. FIT recenters the view; camera shake remains layered onto the rig while simulation stays independent of the viewport.
- Data-driven weapon force with Ogre/heavy-unit resistance. High Explosive and Concussion profiles increase force; small collision-tested substeps stop even extreme impulses at terrain and temporary walls.
- A forged field-command UI language with iron frames, parchment/brass typography, red order ribbons, stronger selected states, and original code-native CSS ornament.
- Road-width horde ranks instead of single-file spawning: two to four abreast on corridor roads and a 24-position entrance front across Shattered Expanse.
- Green March is a 107-enemy teaching operation rather than a 636-enemy endurance map. Four legal, well-aimed starter Rivet Guns pass its deterministic balance scenario.
- Corridor navigation stays inside the visible road during normal travel, while temporary-wall detours open only a local shoulder; crowd separation cannot push orcs through that boundary.
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

The live tuning overlay supports tower cost, damage, range, rate, firing angle, and knockback force plus enemy, wall, and power metrics; quick restart; per-enemy spawning; 2,000/5,000-enemy stress hordes; a 50,000-total continuous stream held inside a 5,000-live envelope; live frame/simulation telemetry; unlock-all; and fortress invulnerability. Cheat-assisted runs are clearly unranked and runtime cheats are not saved.

## Validation at this commit

- `npm test`: 313 deterministic rules tests pass; three optional performance cases are skipped in the normal suite. Coverage includes combat, barrel-tip definitions, research dependency ordering/max-rank gates, save migration, first-map balance, compact placement tolerances, rank spawning, painted-road confinement, force/wall collision, projectile arcs, corpse budgets, camera zoom/pan bounds, fortress states, facing sectors, doctrines, rewards, surrender, variant behavior, setup economy, layouts, maps, and progression.
- `npm run build` is the required production-build gate.
- `npm run benchmark:combat`:
  - 2,000 live enemies: approximately 1.08 ms average fixed simulation step.
  - 5,000 live enemies: approximately 2.46 ms average fixed simulation step.
  - 50,000 enemies streamed through ten bounded 5,000-enemy cohorts: approximately 1.77 ms per measured step.
- Browser acceptance verified the briefing profile picker, starting/remaining supply, two-click placement, visible directional sectors, reload persistence, and switching to another map and back. The broader release checklist remains in `PR_DESCRIPTION.md`.
- Green March is a short teaching clear with 107 enemies. Later campaign operations escalate to 780–2,244 enemies and longer endurance pacing.

### Why the crowd index stays dependency-free

Moving orcs use a reusable typed-array uniform grid. Every fixed step clears its bucket heads and relinks each live orc once; nearby collision and targeting queries then visit only overlapping buckets. Crowd separation writes directly into one result vector instead of allocating and sorting a neighbor list for every orc.

We evaluated general spatial-tree libraries but did not add one. Flatbush is explicitly a static packed R-tree, so all moving orcs would require a new index and finalization every step. RBush supports mutation, but its general rectangle-tree bookkeeping is unnecessary for thousands of similarly sized agents in a bounded arena. The measured uniform grid remains comfortably inside the 16.67 ms 60 FPS simulation budget at 5,000 live orcs, while adding no download size or maintenance dependency. Reconsider a tree, worker, or WASM broadphase only if representative integrated browser profiling—not a synthetic entity count alone—shows the grid is the bottleneck.

## Known limitations

- Progress, custom maps, tuning, settings, and defense layouts use browser `localStorage`; there is no account system, cloud synchronization, or server backend.
- Visuals remain code-native low-poly prototypes. Procedural locomotion and event animation are present, but there is no skeletal rigging, cinematic, localization, or external production-art pipeline yet.
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

1. Add secondary-objective types, challenge modifiers, and map decorations; tune doctrine balance after broader playtesting.
2. Refine the implemented firing/locomotion/effect timing and newly shape-coded tower, enemy, power, and status language with wider human playtesting and final art/audio assets.
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
