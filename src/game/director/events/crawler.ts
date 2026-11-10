import { pressAlarmButton } from '../../devices/devices'
import { feetOf, isActive, type Guard } from '../../security/model'
import { deviceFeet, sameFloor } from '../../security/places'
import type { Device, World } from '../../world'
import { nearestTo } from '../crew'
import { startErrand, stepErrand } from '../errand'
import { say } from '../say'
import type { EventDef } from '../types'

/**
 * A guard knocked out and left untied comes round and staggers for the nearest alarm button on his floor. Catch him
 * before he gets there, or the site goes up.
 */

const REACH = 40

export const crawler: EventDef = {
  id: 'crawler', kind: 'reactive', mood: 'raise', cooldown: 20, repeats: 3, chance: 0.7,
  ready: (world) => world.director.signals.woke.some((guard) => groggy(guard) && buttonFor(world, guard) !== null),
  start(world) {
    const guard = world.director.signals.woke.find((candidate) => groggy(candidate) && buttonFor(world, candidate) !== null)
    const button = guard ? buttonFor(world, guard) : null
    if (!guard || !button) return null
    let pressed = false
    say(world, guard, 'Ugh... my head... the alarm... got to...')
    const errand = startErrand(world, guard, deviceFeet(world, button))
    const plan = {
      linger: 1, limit: 60,
      onArrive: (stepWorld: World) => {
        pressed = pressAlarmButton(stepWorld, button, feetOf(guard))
      },
    }
    return {
      id: 'crawler',
      step: (stepWorld, dt) => stepErrand(stepWorld, errand, plan, dt),
      outcome: () => (pressed ? 'he hit the alarm' : 'he never reached the alarm'),
    }
  },
}

function groggy(guard: Guard): boolean {
  return isActive(guard) && (guard.mode === 'calm' || guard.mode === 'caution') && guard.station === null
}

function buttonFor(world: World, guard: Guard): Device | null {
  const feet = feetOf(guard)
  const buttons = world.devices.filter((device) => device.kind === 'alarmButton' && !device.disabled && sameFloor(deviceFeet(world, device), feet) && Math.abs(device.x - feet.x) < REACH)
  return nearestTo(buttons, feet, (device) => deviceFeet(world, device))
}
