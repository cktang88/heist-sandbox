import { throwCharge } from './charges'
import { hurtTile } from './destruction'
import { launchDrone } from './drone'
import { burst } from './effects'
import type { Input } from './input'
import { emitNoise } from './noise'
import { fireShot } from './projectiles'
import { TOOLS } from './toolDefs'
import type { Vec } from './types'
import { castRay, normalize } from './vision'
import type { World } from './world'

const PISTOL = { kind: 'bullet', fromPlayer: true, speed: 70, damage: 40, tileDamage: 3, spread: 0.01 } as const
const RIFLE = { kind: 'bullet', fromPlayer: true, speed: 70, damage: 24, tileDamage: 12, spread: 0.05 } as const
const ROCKET = { kind: 'rocket', fromPlayer: true, speed: 30, damage: 0, tileDamage: 0, spread: 0.02 } as const
const PISTOL_NOISE = 4
const RIFLE_NOISE = 30
const ROCKET_NOISE = 22
const DRILL_REACH = 2.4
const DRILL_DAMAGE_PER_SECOND = 130
const DRILL_NOISE = 6
const DRILL_NOISE_EVERY = 0.35

export function handOf(world: World): Vec {
  return { x: world.player.x + world.player.w / 2, y: world.player.y + 0.6 }
}

/** Uses the tool in the player's hands when the trigger is pulled. */
export function useTool(world: World, input: Input, dt: number): void {
  const player = world.player
  if (input.selectTool !== null && input.selectTool >= 0 && input.selectTool < TOOLS.length) player.tool = input.selectTool
  player.cooldown = Math.max(0, player.cooldown - dt)

  const tool = TOOLS[player.tool]
  const pulled = tool.auto ? input.fire : input.firePressed
  if (!pulled || player.cooldown > 0 || player.ammo[player.tool] <= 0) return
  player.ammo[player.tool] -= 1
  player.cooldown = tool.cooldown

  const hand = handOf(world)
  const aim = normalize(input.aim.x - hand.x, input.aim.y - hand.y)
  switch (tool.id) {
    case 'pistol':
      fireShot(world, hand, aim, PISTOL)
      emitNoise(world, hand, PISTOL_NOISE)
      break
    case 'rifle':
      fireShot(world, hand, aim, RIFLE)
      emitNoise(world, hand, RIFLE_NOISE)
      world.shake = Math.min(1, world.shake + 0.05)
      break
    case 'rocket':
      fireShot(world, hand, aim, ROCKET)
      emitNoise(world, hand, ROCKET_NOISE)
      break
    case 'c4':
      throwCharge(world, hand, aim)
      break
    case 'drill':
      drill(world, hand, aim, dt)
      break
    case 'drone':
      launchDrone(world)
      break
  }
}

/** Chews quietly through whatever is in front of the player: slow, but far less noisy than explosives. */
function drill(world: World, hand: Vec, aim: Vec, dt: number): void {
  const hit = castRay(world.grid, hand, aim, DRILL_REACH, (kind) => kind !== 'air' && kind !== 'water')
  if (!hit) return
  hurtTile(world, hit.tileX, hit.tileY, DRILL_DAMAGE_PER_SECOND * dt)
  burst(world.effects, world.rng, { x: hit.tileX + 0.5, y: hit.tileY + 0.5 }, 1, '#ffd27a', 3)
  if (world.clock % DRILL_NOISE_EVERY < dt) emitNoise(world, hand, DRILL_NOISE)
}
