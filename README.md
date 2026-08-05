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
3. Ten towers, ten enemy roles, status effects, support buffs, and damage statistics.
4. Drag-aimed Strafe/Cryo, barrage, nuke, guideable orbital laser, finite emergency repair, and temporary combat walls.
5. A persistent 60-node armory whose implemented unlocks and stat research affect the next run.
6. Map Forge with a reload-safe custom library, corridor/open-field navigation, editable polygon platforms and blockers, multiple lanes, build zones, supply-cache objectives, terrain palettes, decoration stamps, authored Sandbox waves, validation, and JSON import/export.
7. Live tuning for every tower, enemy, and battlefield power, plus unranked per-type spawning, fortress invulnerability, stress hordes, and quick restart.
8. Versioned saves, campaign/challenge progress, medals, a Commander Doctrine passive slot, pause, 1×/2× speed, and persistent accessibility settings including screen shake.
9. Flow-field wall detours, overlapping horde streams, and unranked 2,000/5,000-enemy plus 50,000-total stream stress controls.
10. Spatially indexed combat queries, interpolated instanced crowds, and pooled tracer rendering.

## Controls

- Setup: choose a tower or starting wall, click terrain to place, click a defense to move/sell/change targeting, `R` rotates walls, and Space starts.
- On corridor maps, towers belong off the road and walls belong on it. On open-field maps, towers sit on raised platforms while orcs flood around them.
- Battle: Space pauses, 1×/2× changes speed, drag Strafe/Cryo lanes, point other ready powers, and guide an active Orbital with the pointer. `REPAIR` fires immediately and has finite charges.
- Backtick opens live tuning.
- `MAP FORGE` opens the lane, polygon, terrain, wave, and JSON editor during setup.
- `SETTINGS` controls UI scale, screen shake, reduced flashes, focus-loss pause, and saved volume levels.

The complete design, 60-node upgrade plan, content roster, technical plan, and staged acceptance criteria are in [docs/GAME_SPEC.md](docs/GAME_SPEC.md). The exact current milestone, known limitations, and recommended future work are recorded in [docs/STATE_AND_ROADMAP.md](docs/STATE_AND_ROADMAP.md).

For the opt-in 2,000/5,000-enemy and 50,000-total streamed throughput report, run `npm run benchmark:combat`. During a battle, live frame, rendering, fixed-tick, stream, and spatial-query metrics are also available in the tuning panel and browser console as `globalThis.__ORCFALL_TELEMETRY__`.
