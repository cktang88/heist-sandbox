import { flash } from '../effects'
import { explode } from '../explosions'
import { playSound, type SoundKind } from '../sounds'
import { TILE_DEFS, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { MAX_FIRES, startFire } from './fire'
import { addGas, gasAt, hasGas, takeGas } from './smoke'

/** Below this a tile's gas is too thin to light. */
const LIGHTS_AT = 0.08
/** Gas still burns along with a lit cloud down to this. */
const BURNS_AT = 0.03
/** Gas a leak gives off per second. A stove left leaking for ten seconds fills a kitchen corner. */
const LEAK_PER_SECOND = 0.7
/** A lit cloud holding more than this goes bang; less just flashes into fire. */
const BLAST_GAS = 2.5
const MAX_CLOUD_TILES = 500
const SHOT_SOUNDS: ReadonlySet<SoundKind> = new Set(['pistol', 'rifle', 'shotgun', 'sniper', 'guardShot', 'spark'])
const SHOT_REACH = 1.5

export function startLeak(world: World, at: Vec, seconds: number): void {
  world.hazards.leaks.push({ x: at.x, y: at.y, life: seconds })
}

export function stepLeaks(world: World, dt: number): void {
  const hazards = world.hazards
  if (hazards.leaks.length === 0) return
  for (const leak of hazards.leaks) {
    addGas(world, Math.floor(leak.x), Math.floor(leak.y), LEAK_PER_SECOND * dt)
    leak.life -= dt
  }
  hazards.leaks = hazards.leaks.filter((leak) => leak.life > 0)
}

/** Is there enough gas on or beside this tile for a flame to light it? */
export function gasNear(world: World, x: number, y: number): boolean {
  if (!hasGas(world)) return false
  return gasAt(world, x, y) >= LIGHTS_AT || gasAt(world, x, y - 1) >= LIGHTS_AT || gasAt(world, x - 1, y) >= LIGHTS_AT
    || gasAt(world, x + 1, y) >= LIGHTS_AT || gasAt(world, x, y + 1) >= LIGHTS_AT
}

/** Lights any gas within `radius` of a spot: a spark, a muzzle flash, an explosion. */
export function igniteGasNear(world: World, at: Vec, radius: number): void {
  if (!hasGas(world)) return
  const reach = Math.ceil(radius)
  for (let y = Math.floor(at.y) - reach; y <= Math.floor(at.y) + reach; y += 1) {
    for (let x = Math.floor(at.x) - reach; x <= Math.floor(at.x) + reach; x += 1) {
      if (Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y) > radius + 0.5 || gasAt(world, x, y) < LIGHTS_AT) continue
      igniteGas(world, x, y)
      return
    }
  }
}

/**
 * Lights a gas cloud from one tile. The whole connected cloud burns at once: every tile of it flashes into
 * fire, and a big enough cloud explodes from its middle.
 */
export function igniteGas(world: World, x: number, y: number): void {
  const cloud = collectCloud(world, x, y)
  if (cloud.length === 0) return
  let total = 0
  let middleX = 0
  let middleY = 0
  for (const tile of cloud) {
    total += tile.gas
    middleX += (tile.x + 0.5) * tile.gas
    middleY += (tile.y + 0.5) * tile.gas
  }
  for (const tile of cloud) {
    if (world.hazards.fires.size >= MAX_FIRES) break
    startFire(world, tile.x, tile.y, Math.min(1, 0.5 + tile.gas), 0.5 + world.rng() * 0.4)
  }
  const middle = { x: middleX / total, y: middleY / total }
  if (total >= BLAST_GAS) {
    explode(world, middle, {
      radius: Math.min(5, 2 + total * 0.25), tileDamage: Math.min(320, 100 + total * 30), bodyDamage: Math.min(200, 70 + total * 20),
    })
    return
  }
  flash(world.effects, middle, 2 + total, 0.3, 'explosion')
  playSound(world, 'fire', middle)
}

/** Takes the gas out of every tile connected to the start, so a cloud only ever lights once. */
function collectCloud(world: World, x: number, y: number): (Vec & { gas: number })[] {
  const cloud: (Vec & { gas: number })[] = []
  const queue: Vec[] = [{ x, y }]
  while (queue.length > 0 && cloud.length < MAX_CLOUD_TILES) {
    const tile = queue.pop()!
    if (gasAt(world, tile.x, tile.y) < BURNS_AT || TILE_DEFS[tileAt(world.grid, tile.x, tile.y)].solid) continue
    cloud.push({ ...tile, gas: takeGas(world, tile.x, tile.y) })
    queue.push({ x: tile.x + 1, y: tile.y }, { x: tile.x - 1, y: tile.y }, { x: tile.x, y: tile.y + 1 }, { x: tile.x, y: tile.y - 1 })
  }
  return cloud
}

/** Gunshots and sparks near gas light it. Each sound is checked once. */
export function listenForShots(world: World): void {
  if (!hasGas(world)) return
  const heard = world.hazards.heardShots
  for (const sound of world.sounds) {
    if (heard.has(sound)) continue
    heard.add(sound)
    if (SHOT_SOUNDS.has(sound.kind)) igniteGasNear(world, sound, SHOT_REACH)
  }
}
