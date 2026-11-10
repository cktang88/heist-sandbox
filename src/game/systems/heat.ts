import { hurtTile } from '../destruction'
import { tileKey } from '../hazards/state'
import { propById, propBox, propCenter } from '../hazards/props'
import { startSpray } from '../hazards/sprays'
import { playSound } from '../sounds'
import { tileAt, type TileKind } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'

/**
 * What a long fire does to the building around it. Heat soaks into the slab under it until the slab gives way (a
 * floor burnt through drops whatever stood on it), cracks the glass beside it, leaves doors too hot to touch for a
 * while, and makes pressurised kit hiss a warning before it cooks off.
 */
const HOT = 0.5
/** Seconds of fire a slab takes before it starts to fail, then damage per second while it keeps burning. */
const SLAB_SOAK = 20
const SLAB_DAMAGE: Partial<Record<TileKind, number>> = { concrete: 4, brick: 4, steel: 6, wood: 6, duct: 6 }
const GLASS_SOAK = 4
const DOOR_HOT_SECONDS = 25
/** Heat a tile loses per second once the fire beside it is gone. */
const COOL = 0.5
const NEIGHBOURS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

export function stepHeat(world: World, tick: number): void {
  const systems = world.systems
  coolDown(world, tick)
  if (world.hazards.fires.size === 0) return
  for (const fire of world.hazards.fires.values()) {
    if (fire.heat < HOT) continue
    soakSlab(world, fire.x, fire.y + 1, fire.heat, tick)
    for (const [dx, dy] of NEIGHBOURS) {
      const x = fire.x + dx
      const y = fire.y + dy
      const kind = tileAt(world.grid, x, y)
      if (kind === 'glass') crackGlass(world, x, y, fire.heat, tick)
      else if (kind === 'door') systems.hotDoors.set(tileKey(world, x, y), DOOR_HOT_SECONDS)
    }
  }
  hissCookingProps(world)
}

/** Adds a tick of fire at `strength` (0..1) to a tile's soaked-up heat, making up for this tick's cooling. */
function warm(world: World, key: number, strength: number, tick: number): number {
  const heat = (world.systems.heat.get(key) ?? 0) + (strength + COOL) * tick
  world.systems.heat.set(key, heat)
  return heat
}

function soakSlab(world: World, x: number, y: number, strength: number, tick: number): void {
  const damage = SLAB_DAMAGE[tileAt(world.grid, x, y)]
  if (damage === undefined) return
  if (warm(world, tileKey(world, x, y), strength, tick) > SLAB_SOAK) hurtTile(world, x, y, damage * strength * tick)
}

function crackGlass(world: World, x: number, y: number, strength: number, tick: number): void {
  if (warm(world, tileKey(world, x, y), strength, tick) < GLASS_SOAK) return
  if (hurtTile(world, x, y, 100)) playSound(world, 'glass', { x: x + 0.5, y: y + 0.5 })
}

function coolDown(world: World, tick: number): void {
  const { heat, hotDoors } = world.systems
  heat.forEach((value, key) => {
    if (value <= COOL * tick) heat.delete(key)
    else heat.set(key, value - COOL * tick)
  })
  hotDoors.forEach((value, key) => {
    if (value <= tick) hotDoors.delete(key)
    else hotDoors.set(key, value - tick)
  })
}

/** Gas cylinders, boilers and ammunition sitting in fire hiss and vent before they go, a warning to clear out. */
function hissCookingProps(world: World): void {
  for (const id of world.hazards.cooking.keys()) {
    if (world.systems.hissed.has(id)) continue
    const prop = propById(world, id)
    if (!prop) continue
    world.systems.hissed.add(id)
    const top = { x: propCenter(prop).x, y: propBox(prop).y + 0.1 }
    startSpray(world, { ...top, angle: -Math.PI / 2, spread: 0.3, reach: 2, kind: 'steam', life: 2.5 })
    playSound(world, 'spray', top)
  }
}

/** Is this door tile too hot to touch? For the interact code: it should refuse to open it, or burn the hand that tries. */
export function doorTooHot(world: World, door: Vec): boolean {
  return world.systems.hotDoors.has(tileKey(world, Math.floor(door.x), Math.floor(door.y)))
}

const HOT_DOOR_BURN = 8

/** The player grabs a hot handle: it burns, and he lets go. */
export function touchHotDoor(world: World): void {
  world.player.hp -= HOT_DOOR_BURN
  playSound(world, 'fire', world.player)
}
