import { bodyAt } from '../stealth/bodies'
import type { World } from '../world'
import { bark } from './barks'
import { alreadyCalling, startRadio } from './comms'
import type { Guard } from './model'
import { log } from './report'
import { wakeColleague } from './wakeUp'

/**
 * A guard standing over a colleague's body. A dead man is radioed in; one out cold is shaken awake and says what
 * happened. Either way he checks what is missing: a stripped uniform means someone is walking about in one of
 * theirs, a missing keycard or radio is noted too.
 */
export function examineBody(world: World, guard: Guard, body: number): void {
  const other = world.guards[body]
  noteWhatIsMissing(world, guard, body)
  if (other.out && other.mode !== 'dead') {
    other.restrained = false
    wakeColleague(world, other, guard)
    return
  }
  if (world.security.reportedBodies.has(body)) return
  const at = bodyAt(other)
  if (!alreadyCalling(world, 'body', at)) startRadio(world, guard, { kind: 'body', at, by: world.guards.indexOf(guard) })
}

function noteWhatIsMissing(world: World, guard: Guard, body: number): void {
  const stealth = world.stealth
  if (stealth.uniforms.has(body) && stealth.uniformKnownAt < 0) {
    stealth.uniformKnownAt = world.clock
    bark(world, guard, "His uniform's gone. He's wearing one of ours!", true)
    log(world, 'Control: All units, intruder may be in our uniform. Check faces.')
  } else if (stealth.keycards.has(body)) {
    bark(world, guard, "His keycard's missing.", true)
  }
  // Control will not believe that man's voice on the radio again.
  if (stealth.radios.has(body)) stealth.bluffs = Number.POSITIVE_INFINITY
}
