import { stepCharges } from './charges'
import { stepCollapse } from './collapse'
import { stepDrone } from './drone'
import { stepEffects } from './effects'
import { raiseAlarm, updateGuard } from './guards'
import { idleInput, type Input } from './input'
import { interact } from './interact'
import { GRAVITY, moveBody } from './physics'
import { movePlayer, updateFocus } from './player'
import { stepProjectiles } from './projectiles'
import { stepTime } from './time'
import { useTool } from './tools'
import { overlaps } from './types'
import type { World } from './world'

/** Advances the heist by one frame of real time. Slow motion scales how much game time that is. */
export function stepWorld(world: World, input: Input, realDt: number): void {
  const playing = world.status === 'playing'
  const acting = input.left || input.right || input.up || input.down || input.fire || input.interact
  const focusing = playing && updateFocus(world.player, input.focus, realDt)
  const dt = stepTime(world.time, realDt, focusing, acting) * realDt

  world.shake = Math.max(0, world.shake - realDt * 1.8)
  stepEffects(world.effects, dt)
  if (!playing) return
  world.clock += dt

  const alarmBefore = world.alarm
  if (world.drone) {
    movePlayer(world.grid, world.player, idleInput(input.aim), dt)
    stepDrone(world, input, dt)
  } else {
    movePlayer(world.grid, world.player, input, dt)
    interact(world, input, dt)
    useTool(world, input, dt)
  }
  stepProjectiles(world, dt)
  stepCharges(world, input.detonatePressed, dt)
  stepCollapse(world, dt)
  for (const guard of world.guards) updateGuard(world, guard, dt)
  if (!alarmBefore && world.alarm) raiseAlarm(world)

  if (!world.loot.taken) {
    world.loot.vy += GRAVITY * dt
    moveBody(world.grid, world.loot, dt)
  }

  if (world.player.hp <= 0) world.status = 'dead'
  else if (world.player.hasLoot && overlaps(world.player, world.extraction)) world.status = 'won'
}
