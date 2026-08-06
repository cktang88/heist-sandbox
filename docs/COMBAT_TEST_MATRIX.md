# Combat unit-test matrix

This matrix records the deterministic unit coverage for the combat rules. It tests behavior through the public simulation step instead of duplicating private attack logic in the tests.

## Towers

| Tower | Covered contract |
|---|---|
| Rivet Gun | Single-target damage, damage credit, firing-sector acceptance/rejection, armor-piercing behavior |
| Heavy Gun | Sustained damage and firing-sector acceptance/rejection |
| Blast Cannon | Delayed arcing projectile, clustered splash damage, and force |
| Rocket Battery | Minimum-range dead zone, delayed arcing splash damage, and force |
| Flame Thrower | Direct fire damage and continuing burn damage |
| Cryo Projector | Slow, freeze charge, threshold, and freeze duration |
| Tesla Coil | Chained targets and chain-gap termination |
| Laser Lance | Same-target focus damage ramp |
| Field Mortar | Minimum-range dead zone, high arc, wide splash, stun profile, and increased Concussion force |
| Support Beacon | No direct attack, nearby buff, out-of-range rejection, and 360° aura |

## Facing, variants, and setup

| System | Covered contract |
|---|---|
| Two-click aim | First click records the base; second click records pointer-facing rotation |
| Angle math | Normalization across 0°/360° and acceptance within ± half the configured arc |
| Legacy layout facing | Missing rotation receives a deterministic direction toward the nearest fortress |
| Default sectors | All nine weapon towers are below 360°; Support Beacon remains 360° |
| Research arc | Relevant ranks widen the configured firing sector |
| Variant catalog | Stable 20 IDs, exactly two special profiles per tower, and no mutation of Standard stats |
| Variant safety | Unknown, locked, or wrong-family IDs resolve to Standard |
| Variant behavior | Armor piercing, piercing beam, stun, burn spread, support-profile effects, and distinct stat transforms |
| Variant selection | Standard is always present; at most one unlocked profile is selected per tower family |
| Research separation | Every runtime variant has one dedicated unlock card; max-rank and multiple-parent requirements gate purchases without changing Standard behavior |
| Muzzle/tracer alignment | Every tower has a typed barrel-tip height/offset and weapon color; Rivet direction rotates the origin toward its live target |
| Saved deployments | Per-map and per-challenge isolation, reload round-trip, facing/targeting/profile preservation, malformed-data repair |
| Setup economy | Placement costs, budget enforcement, move, sell, undo, clear, and full-price refunds |
| Teaching balance | Four legal, well-aimed starter Rivet Guns clear the 107-enemy Green March with fortress health remaining |
| Compact placement | Half-size tower spacing accepts 0.56-unit centers and modest road/platform-edge overlap while rejecting true intersections |

The prototype does not currently give ordinary towers health; they are locked and invulnerable after deployment. Temporary and starting walls do have health, and existing navigation/combat tests cover wall contact damage, destruction, removal, rerouting, and break effects.

## Health and lifecycle

| System | Covered contract |
|---|---|
| Enemy health | Every offensive tower reduces health and receives damage credit |
| Enemy death | Counted once, one death visual, removed without replacing the enemy array |
| Spatial index | Remains a valid fixed snapshot when the live enemy array is compacted |
| Status damage | Burn ticks health; slow, freeze, stun, brittle, and armor-break timers clamp at zero |
| Fortress | Shield absorbs damage first, overflow reaches health, health clamps at zero |
| Leaks | Orc removed and leak/event counters increment exactly once |
| Waves | Spawn count, survivor wait, wave advance, victory predicate, and result snapshot |
| Horde fronts | Corridor rank size from road width, lateral offsets, multi-lane distribution, and full-width open-map entrances |
| Surrender | Earned kill/wave progress remains, while zero-progress and objective bonuses cannot be farmed |
| Campaign rewards | Exact eliminated percentage, one-time 50-medal first clear, 50% completed-map replay rate, objective scaling, and post-scaling difficulty bonus |
| Corridor bounds | Navigation cells and dense-pack separation remain inside the painted road while baseline walls stop and absorb a queued horde |
| Walls | Health, damage, break/removal, lane-blocking queues, on-lane Sapper targeting, spikes, and break explosion |
| Knockback | Caliber/profile force, shared heavy-unit resistance, decay, map bounds, wall tunnelling rejection, and blocked-corner sliding |
| Visual budgets | Independent corpse/transient caps, newest-projectile retention, corpse density, and weapon-specific arc ordering |
| Visual identity | All ten enemy roles have unique silhouette signatures, all six powers have unique target marks, every special tower profile has its own geometry attachment, and every active status maps to a visible shape |
| Camera and fortress | Bounded zoom/pan math, drag direction, larger-map fit, and intact/worn/critical/ruined presentation thresholds |

## Main test files

- `src/game/towerCombat.test.ts`
- `src/game/combatLifecycle.test.ts`
- `src/game/combat.test.ts`
- `src/game/hordeSpawning.test.ts`
- `src/game/navigation-combat.test.ts`
- `src/game/spatialIndex.test.ts`
- `src/game/towerFacing.test.ts`
- `src/game/towerVariants.test.ts`
- `src/game/variantSelection.test.ts`
- `src/game/layoutStore.test.ts`
- `src/game/setupEditing.test.ts`
- `src/game/upgrades.test.ts`
- `src/game/knockback.test.ts`
- `src/game/combatEffects.test.ts`
- `src/components/CameraRig.test.ts`
- `src/components/CombatEffects.test.ts`
- `src/components/FortressDamageEffects.test.ts`

The React pointer flow, drawn sector, reload behavior, and phase callbacks remain browser/integration behavior. Manual browser QA covers two-click anchor/aim, cancel and move flows, range/dead-zone readability, per-level restoration, starting a battle immediately, multiple enemy deaths and compactions, continued tower targeting, wave advancement, and absence of application console errors.
