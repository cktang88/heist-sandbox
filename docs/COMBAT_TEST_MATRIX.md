# Combat unit-test matrix

This matrix records the deterministic unit coverage for the combat rules. It tests behavior through the public simulation step instead of duplicating private attack logic in the tests.

## Towers

| Tower | Covered contract |
|---|---|
| Rivet Gun | Single-target damage and damage credit |
| Heavy Gun | Narrow cone, on-axis hits, off-axis rejection |
| Blast Cannon | Delayed projectile and clustered splash damage |
| Rocket Battery | Minimum-range dead zone and splash damage |
| Flame Thrower | Direct fire damage and continuing burn damage |
| Cryo Projector | Slow, freeze charge, threshold, and freeze duration |
| Tesla Coil | Chained targets and chain-gap termination |
| Laser Lance | Same-target focus damage ramp |
| Field Mortar | Minimum-range dead zone, delay, and wide splash |
| Support Beacon | No direct attack, nearby buff, and out-of-range rejection |

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
| Walls | Health, damage, break/removal, rerouting, Sapper targeting, spikes, and break explosion |

## Main test files

- `src/game/towerCombat.test.ts`
- `src/game/combatLifecycle.test.ts`
- `src/game/combat.test.ts`
- `src/game/navigation-combat.test.ts`
- `src/game/spatialIndex.test.ts`

The React phase callbacks remain browser/integration behavior. Browser QA covers starting a battle immediately, multiple enemy deaths and compactions, continued tower targeting, wave advancement, and absence of application console errors.
