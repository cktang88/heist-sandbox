import { stepCharges } from './charges'
import { stepCollapse } from './collapse'
import { stepDevices, terminalConsumesInput } from './devices/devices'
import { aimAtCables, stepElevators } from './elevators'
import { stepAftermath } from './frag/aftermath'
import { stepFrags } from './frag/frag'
import { stepRopes } from './rope/rope'
import { stepGrapple } from './grapple/grapple'
import { stepFallingProps } from './vehicles/fallingProps'
import { stepHazards } from './hazards/hazards'
import { stepSecurity } from './security/dispatch'
import { stepDrone } from './drone'
import { stepEffects } from './effects'
import { raiseAlarm, updateGuard } from './guards'
import { idleInput, type Input } from './input'
import { interact } from './interact'
import { GRAVITY, moveBody } from './physics'
import { emitMovementNoise } from './movement/footsteps'
import { movePlayer, updateFocus } from './player'
import { stepProjectiles } from './projectiles'
import { stepTime } from './time'
import { stepMelee } from './melee/melee'
import { stepIntel } from './intel/intel'
import { stepPhysProps } from './physprops/physprops'
import { stepGaps } from './gaps/gaps'
import { useTool } from './tools'
import { beginStepTiming, endStepTiming, lapStepTiming as lap } from './stepTimings'
import { overlaps } from './types'
import type { World } from './world'

/** Advances the heist by one frame of real time. Slow motion scales how much game time that is. */
export function stepWorld(world: World, input: Input, realDt: number): void {
  beginStepTiming()
  const playing = world.status === 'playing'
  const acting = input.left || input.right || input.up || input.down || input.fire || input.interact
  const focusing = playing && updateFocus(world.player, input.focus, realDt)
  const dt = stepTime(world.time, realDt, focusing, acting) * realDt

  world.shake = Math.max(0, world.shake - realDt * 1.8)
  stepEffects(world.effects, dt)
  lap('effects')
  if (!playing) {
    endStepTiming()
    return
  }
  world.clock += dt

  const alarmBefore = world.alarm
  if (world.drone) {
    movePlayer(world.grid, world.player, idleInput(input.aim), dt, world.stairwells)
    stepDrone(world, input, dt)
    lap('drone')
  } else {
    movePlayer(world.grid, world.player, input, dt, world.stairwells)
    emitMovementNoise(world)
    lap('player')
    interact(world, input, dt)
    lap('interact')
    // While a hacking menu is open, the number keys choose its options and not a weapon.
    useTool(world, terminalConsumesInput(world) ? { ...input, selectTool: null } : input, dt)
    lap('tools')
  }
  stepGrapple(world, input, dt)
  aimAtCables(world)
  lap('grapple')
  // While the drone is flown, the keys steer it: the body does not punch, kick, grab or throw.
  const hands = world.drone ? idleInput(input.aim) : input
  stepMelee(world, hands, dt)
  lap('melee')
  stepPhysProps(world, hands, dt)
  lap('physprops')
  stepProjectiles(world, dt)
  lap('projectiles')
  stepCharges(world, input.detonatePressed, dt)
  lap('charges')
  stepCollapse(world, dt)
  lap('collapse')
  stepHazards(world, dt)
  lap('hazards')
  stepDevices(world, input, dt)
  stepElevators(world, input, dt)
  lap('devices')
  stepSecurity(world, dt)
  lap('security')
  for (const guard of world.guards) updateGuard(world, guard, dt)
  lap('guards')
  stepGaps(world, input)
  lap('gaps')
  if (!alarmBefore && world.alarm) raiseAlarm(world)
  stepFrags(world, dt)
  stepAftermath(world)
  stepRopes(world)
  lap('frags')
  stepFallingProps(world, dt)
  lap('fallingProps')
  stepIntel(world, dt)
  lap('intel')

  for (const pickup of world.pickups) {
    if (pickup.taken) continue
    pickup.vy += GRAVITY * dt
    moveBody(world.grid, pickup, dt, 0)
  }

  if (!world.loot.taken) {
    world.loot.vy += GRAVITY * dt
    moveBody(world.grid, world.loot, dt, 0)
  }

  if (world.player.hp <= 0) world.status = 'dead'
  else if (world.player.hasLoot && overlaps(world.player, world.extraction)) world.status = 'won'
  lap('bodies')
  endStepTiming()
}
