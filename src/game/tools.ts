import { throwCharge } from './charges'
import { hurtTile } from './destruction'
import { launchDrone } from './drone'
import { burst, ejectShell } from './effects'
import { GUNS, MAX_BLOOM } from './guns'
import type { Input } from './input'
import { emitNoise } from './noise'
import { fireShot } from './projectiles'
import { isSolidAt } from './tiles'
import { TOOLS } from './toolDefs'
import type { Vec } from './types'
import { castRay, normalize } from './vision'
import type { World } from './world'

const MUZZLE_REACH = 0.8
const DRILL_REACH = 2.4
const DRILL_DAMAGE_PER_SECOND = 130
const DRILL_NOISE = 6
const DRILL_NOISE_EVERY = 0.35

export function handOf(world: World): Vec {
  return { x: world.player.x + world.player.w / 2, y: world.player.y + 0.55 }
}

/** Uses the tool in the player's hands when the trigger is pulled. Guns fire from a magazine and must reload. */
export function useTool(world: World, input: Input, dt: number): void {
  const player = world.player
  if (input.selectTool !== null && input.selectTool >= 0 && input.selectTool < TOOLS.length && input.selectTool !== player.tool) {
    player.tool = input.selectTool
    player.reload = 0
  }
  player.cooldown = Math.max(0, player.cooldown - dt)

  const tool = TOOLS[player.tool]
  const gun = GUNS[tool.id]
  const pulled = tool.auto ? input.fire : input.firePressed
  const hand = handOf(world)
  const aim = normalize(input.aim.x - hand.x, input.aim.y - hand.y)

  if (!gun) {
    if (!pulled || player.cooldown > 0 || player.ammo[player.tool] <= 0) return
    player.ammo[player.tool] -= 1
    player.cooldown = tool.cooldown
    if (tool.id === 'c4') throwCharge(world, hand, aim)
    else if (tool.id === 'drill') drill(world, hand, aim, dt)
    else if (tool.id === 'drone') launchDrone(world)
    return
  }

  if (player.reload > 0) {
    player.reload -= dt
    if (player.reload > 0) return
    const loaded = Math.min(gun.magSize - player.mags[player.tool], player.ammo[player.tool])
    player.mags[player.tool] += loaded
    player.ammo[player.tool] -= loaded
    return
  }
  const empty = player.mags[player.tool] <= 0
  const wantsReload = input.reloadPressed && player.mags[player.tool] < gun.magSize
  if ((wantsReload || (empty && pulled)) && player.ammo[player.tool] > 0) {
    player.reload = gun.reloadSeconds
    return
  }
  if (!pulled || player.cooldown > 0 || empty) return
  player.mags[player.tool] -= 1
  player.cooldown = tool.cooldown

  // Shots leave from the barrel, unless the barrel is poking into a wall.
  const barrel = { x: hand.x + aim.x * MUZZLE_REACH, y: hand.y + aim.y * MUZZLE_REACH }
  const muzzle = isSolidAt(world.grid, barrel.x, barrel.y) ? hand : barrel
  for (let pellet = 0; pellet < gun.pellets; pellet += 1) {
    fireShot(world, muzzle, aim, { ...gun.shot, spread: gun.shot.spread + player.bloom })
  }
  if (gun.ejectsShell) ejectShell(world.effects, world.rng, hand, player.facing)
  emitNoise(world, hand, gun.noise)
  player.bloom = Math.min(MAX_BLOOM, player.bloom + gun.bloomPerShot)
  player.kick = Math.min(1, player.kick + gun.kick)
  world.shake = Math.min(1, world.shake + gun.shake)
}

/** Chews quietly through whatever is in front of the player: slow, but far less noisy than explosives. */
function drill(world: World, hand: Vec, aim: Vec, dt: number): void {
  const hit = castRay(world.grid, hand, aim, DRILL_REACH, (kind) => kind !== 'air' && kind !== 'water')
  if (!hit) return
  hurtTile(world, hit.tileX, hit.tileY, DRILL_DAMAGE_PER_SECOND * dt)
  burst(world.effects, world.rng, { x: hit.tileX + 0.5, y: hit.tileY + 0.5 }, 1, '#ffd27a', 3)
  world.player.kick = Math.max(world.player.kick, 0.15 + world.rng() * 0.15)
  if (world.clock % DRILL_NOISE_EVERY < dt) emitNoise(world, hand, DRILL_NOISE)
}
