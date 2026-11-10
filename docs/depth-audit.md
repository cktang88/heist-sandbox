# Depth audit: where the simulation treats the side view as flat

The world has depth (walls and slabs run z -2.4 to +0.5, people walk at z = 0, furniture stands at z -2.2 to -0.6,
stairs at z -1.5). Ordered by how much a player would notice. "Ruled out" lines were checked and are fine.

## Should change

1. `security/movement.ts` `goTo` + `ledgeAhead`: guards stop dead ('blocked') at the edge of every blast hole in their floor. Rule: a hole where `canWalkAcross(world, x, feetY)` (gaps/gaps.ts) is not a ledge; walk on, and drop only when `guardWantsToDrop`.
2. `collapse.ts` `dropTile`: every falling tile lands as a full-depth solid tile. A pile two rows high (or one tile under a low ceiling or in a doorway) seals the whole room, which a person could clamber over or step round. Rule: rubble landing on a floor where the tile below it is already landed rubble stays solid only up to one row; anything more breaks up into dust (it already "shatters" when the cell is taken), or landed rubble becomes a non-solid, slowing "rubble" tile kind.
3. `collapse.ts` `findUnsupported`: a slab strip between two blast holes falls although its back is still joined to the rest of the slab in depth (being fixed by the collapse agent). Rule: slab tiles in a walk-past hole row count as carrying their neighbours.
4. `vehicles/fallingProps.ts` `isSupported`: furniture standing over a walk-past hole falls through, but furniture stands at z -2.2 to -0.6, which is exactly the back strip that survives. Rule: count `canWalkAcross` hole tiles as support for floor props (big vehicles excepted).
5. `physics.ts` `moveX`: the step-up is one tile, so two stacked fallen tiles stop a run across the whole room width. Rule: let people (not props) step up two tiles when there is headroom, as a person would climb a heap.
6. `player.ts` `movePlayer` (ladder catch) and `security/movement.ts` `walk`: a ladder hatch is a one-tile hole in the front of the slab, yet the player walking over it is caught onto the ladder and a guard walking over it falls down the shaft. Rule: treat a hatch like a walk-past hole (gaps decides walk-past vs drop; only the hatch columns would need adding to its slab map), and use the ladder only when up/down is held or a guard's route goes that way.
7. `elevators.ts` + `complex/block.ts` `layOutStorey`: the shaft and its reinforced wall run full depth and full height, so any storey with a shaft in the middle is cut in two on the lane; in a real tower the corridor passes in front of the shaft. Verify shafts only sit at building ends; if not, rule: the shaft wall should stop at z -1.0 (a door into the shaft from the lane) rather than block it.
8. `hazards/smoke.ts` `spreadFrom`: smoke flows through a walk-past hole as freely as through an open shaft, though two-thirds of the slab's depth is still there. Rule: halve the flow through a walk-past hole tile (minor; noticeable only when filling a room from below).
9. `projectiles.ts` `guardHit`: a player round stops at the first guard it touches, then pierces by `BODY_RESISTANCE`, as if guards stood in single file. Two guards side by side in depth both stand on the lane, so this is right for people in a corridor; fine for now, noted in case crowds get bigger.

## Ruled out (checked, already respects depth)

- People pass each other: `physics.ts` has no body-to-body collision (player, guards, ragdolls).
- Props never block walking (propCatalog contract); `physprops/stand.ts` makes tops one-way only once disturbed.
- `physprops/doors.ts`: only heavy dragged furniture holds a door shut, which is a deliberate barricade.
- Ragdolls (`ragdoll.ts`) and thrown guards (`melee/throw.ts`) collide with tiles only; they never block the lane.
- Guard shots never hit other guards (`projectiles.ts` hits guards only with player rounds).
- `interact.ts`: reach to devices is by distance and walls only; furniture in front of a back-wall switch does not block it.
- Door frames: the wall above a door is a real lintel in a full-depth partition, so bumping it on a jump is correct.
- Pillars: `reinforced` columns are only the outer walls and slab beams (`BEAM_EVERY` = 14 in slab rows), never free-standing in a room.
- Light, fire and grenades pass through holes as through any opening, which is right for the open front part.
- Stairs are a lane at z -1.5 and are not tiles, so a stair flight never blocks the walking lane.
