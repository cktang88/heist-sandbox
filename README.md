# Orcfall Command

An original React + Three.js horde tower-defense prototype inspired by the incremental planning-and-spectacle loop of *Sir, We Have an Orc Problem*.

## Run it

```bash
npm install
npm run dev
```

Production check:

```bash
npm test
npm run build
```

## Current playable layers

1. Six campaign missions with distinct themed waves, deterministic endless mode, and six modifier challenges.
2. Six maps, including corridor battles, a three-approach boss citadel, and the open-field polygon arena Shattered Expanse, plus custom saved maps.
3. Ten compact half-scale towers with forgiving footprint-matched placement, each with Standard plus two research-unlocked special variants, ten enemy roles, status effects, support buffs, and damage statistics.
4. Drag-aimed Strafe/Cryo, barrage, nuke, guideable orbital laser, finite emergency repair, and temporary combat walls.
5. A persistent branching 83-node armory with visually distinct stat, tower, variant, power, wall, and doctrine cards. Every special profile is a separate unlock reached only after its relevant stat path is fully ranked.
6. Map Forge with a reload-safe custom library, corridor/open-field navigation, editable polygon platforms and blockers, multiple lanes, build zones, supply-cache objectives, terrain palettes, decoration stamps, authored Sandbox waves, validation, and JSON import/export.
7. Live tuning for every tower, enemy, and battlefield power, plus unranked per-type spawning, fortress invulnerability, stress hordes, and quick restart.
8. Versioned saves, a separate persistent defense layout for every map and challenge, campaign/challenge progress, percentage-based Command Medals with a large first-clear bonus and half-rate replays, four research-unlocked Commander Doctrines, pause, surrender, 1×/2× speed, and persistent accessibility settings including screen shake.
9. Flow-field wall detours, overlapping horde streams, and unranked 2,000/5,000-enemy plus 50,000-total stream stress controls.
10. Spatially indexed combat queries, interpolated instanced crowds, collision-safe force, and bounded projectile/particle/corpse pools.
11. A forged field-command interface, wheel/button camera zoom, shared barrel-tip muzzle/tracer origins, bright weapon-colored shot lines, ballistic shell arcs, marching orcs, persistent fortress damage, and marked Ogre bosses.

## Controls

- Setup: choose a tower, click once to anchor it, aim with the pointer, and click again to lock its facing. Every tower range sector remains visible while placing; Rocket and Mortar also show their inner dead zones. Starting walls place in one click.
- Each weapon only targets enemies inside its fixed facing sector, normally 30–60°. Support Beacon keeps a 360° aura. Firing angle is available in live tuning and selected research nodes widen it.
- The deployment panel shows starting supply, remaining supply, and each tower price. Move towers for free or sell, undo, and clear for a full setup refund.
- The briefing lets each equipped tower choose Standard or one unlocked special variant. Only one profile is active per tower family on a level, and each map or challenge remembers its tower/power loadout, layout, and profile choices across restarts, map switches, and reloads.
- Click a placed defense to move, sell, or change targeting; `R` rotates walls, and Space starts.
- On corridor maps, towers belong off the road and walls belong on it. On open-field maps, towers sit on raised platforms while orcs flood around them.
- Battle: Space pauses, 1×/2× changes speed, drag Strafe/Cryo lanes, point other ready powers, and guide an active Orbital with the pointer. `REPAIR` fires immediately and has finite charges. `SURRENDER` asks for confirmation and ends the run as an ordered retreat.
- Camera: use the mouse wheel or the lower-right `− / FIT / +` controls. Hold the right or middle mouse button and drag to move the field; `FIT` also recenters it. Camera changes never stop off-screen simulation.
- Backtick opens live tuning.
- `MAP FORGE` opens the lane, polygon, terrain, wave, and JSON editor during setup.
- `SETTINGS` controls UI scale, screen shake, reduced flashes, focus-loss pause, and saved volume levels.

The complete design, 83-node upgrade plan, content roster, technical plan, and staged acceptance criteria are in [docs/GAME_SPEC.md](docs/GAME_SPEC.md). The exact current milestone, known limitations, and recommended future work are recorded in [docs/STATE_AND_ROADMAP.md](docs/STATE_AND_ROADMAP.md).

Combat behavior and lifecycle coverage are listed in [docs/COMBAT_TEST_MATRIX.md](docs/COMBAT_TEST_MATRIX.md).
The exact Standard/special profile catalog and research-node mapping are in [docs/TOWER_VARIANTS.md](docs/TOWER_VARIANTS.md).

For the opt-in 2,000/5,000-enemy and 50,000-total streamed throughput report, run `npm run benchmark:combat`. During a battle, live frame, rendering, fixed-tick, stream, and spatial-query metrics are also available in the tuning panel and browser console as `globalThis.__ORCFALL_TELEMETRY__`.
