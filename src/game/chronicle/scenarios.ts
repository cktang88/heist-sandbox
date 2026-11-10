import { C4_BLAST, explode } from '../explosions'
import { idleInput, type Input } from '../input'
import { hideCaseIn } from '../intel/intel'
import { feetOf } from '../security/model'
import { stepWorld } from '../step'
import { createWorld, type World } from '../world'

/**
 * Scripted heists on the big complex for the chronicle's tests: a quiet one (a silent takedown, a camera cut, the case
 * and out) and a loud one (charges among the guards, then the case and out). Test support only.
 */

const FRAME = 1 / 60

export function play(world: World, seconds: number, input: Partial<Input> = {}, until?: () => boolean): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
    if (until?.()) return
  }
}

export function placePlayer(world: World, x: number, feetY: number): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: feetY - world.player.h - 0.01, vx: 0, vy: 0, chute: false })
}

/** Lands the player on the street, walks him to the van from beside it. */
export function walkToVan(world: World): void {
  const zone = world.extraction
  const fromRight = zone.x < world.grid.width / 2
  placePlayer(world, fromRight ? zone.x + zone.w + 1.5 : zone.x - 1.5, world.groundY)
  play(world, 4, fromRight ? { left: true } : { right: true }, () => world.status !== 'playing')
}

export function takeCase(world: World): void {
  const loot = world.loot
  placePlayer(world, loot.x + loot.w / 2 + (loot.x > world.grid.width / 2 ? -2.5 : 2.5), Math.round(loot.y + loot.h))
  const toward = world.loot.x > world.player.x ? { right: true } : { left: true }
  play(world, 6, toward, () => world.player.hasLoot)
}

/** The drop: falls with the chute open until the feet touch something. */
export function parachuteIn(world: World): void {
  play(world, 60, { jumpHeld: true }, () => world.player.onGround)
}

export function quietRun(seed = 1): World {
  const world = createWorld(seed, 'complex')
  hideCaseIn(world, 'vault')
  world.player.hp = 1e6
  parachuteIn(world)
  const vault = world.rooms.find((room) => room.kind === 'vault')!
  const heavy = world.guards.find((guard) => guard.role === 'heavy' && guard.roomId === vault.id)!
  placePlayer(world, feetOf(heavy).x - heavy.facing * 0.9, vault.floorY)
  play(world, 1 / 60)
  play(world, 1 / 60, { interact: true, interactPressed: true })
  const camera = world.devices.find((device) => device.kind === 'camera' && device.roomId === vault.id)!
  placePlayer(world, camera.x + 0.5, vault.floorY)
  play(world, 1.3, { interact: true })
  takeCase(world)
  walkToVan(world)
  return world
}

export function loudRun(seed = 1): World {
  const world = createWorld(seed, 'complex')
  hideCaseIn(world, 'vault')
  world.player.hp = 1e6
  parachuteIn(world)
  const room = world.rooms.filter((candidate) => candidate.building === 'tower' && candidate.storey === 4 && candidate.kind !== 'stairwell').sort((a, b) => b.w - a.w)[0]
  placePlayer(world, room.x + 2, room.floorY)
  play(world, 1)
  // One guard is standing in the room when it goes up, whatever tonight's patrols are doing.
  const unlucky = world.guards.find((guard) => guard.role !== 'heavy')!
  Object.assign(unlucky, { x: room.x + room.w / 2 - 4 - unlucky.w / 2, y: room.floorY - unlucky.h - 0.01, vx: 0, vy: 0 })
  for (let blast = 0; blast < 4; blast += 1) {
    explode(world, { x: room.x + room.w / 2 + blast * 3 - 4, y: room.floorY - 2 }, C4_BLAST)
    play(world, 3)
  }
  play(world, 10)
  takeCase(world)
  walkToVan(world)
  return world
}
