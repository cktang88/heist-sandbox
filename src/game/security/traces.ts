import { lightLevelAt } from '../light'
import { bodyAt, bodyInOpen } from '../stealth/bodies'
import type { World } from '../world'
import type { Finding } from './discoveries'
import { eyeOf, feetOf, type Guard } from './model'
import { clearView, hasTorchOut, lightFactor } from './perception'
import { VISION } from './tuning'

/**
 * Traces of the intruder's quiet work: blood on the floor where a man was killed or dragged. Noticed the way an open
 * door is, by the first guard to see it in decent light (or by torchlight), once. He goes over, calls it in, and
 * looks in every hiding place around it.
 */

const BLOOD_SIGHT = 10
/** Drops this close together are one trail: seeing one counts as seeing them all. */
const SAME_TRAIL = 3

export function bloodSeen(world: World, guard: Guard): Finding | null {
  const blood = world.stealth.blood
  if (blood.length === 0) return null
  const feet = feetOf(guard)
  const eye = eyeOf(guard)
  const darkRange = hasTorchOut(guard) ? VISION.torchDarkRange : VISION.darkRange
  for (const drop of blood) {
    if (drop.noticed || Math.abs(drop.y - feet.y) > 1.5) continue
    const ahead = (drop.x - feet.x) * guard.facing
    if (ahead < -0.5 || ahead > BLOOD_SIGHT) continue
    // Blood under a body in plain view is part of the body, not a trail to follow.
    if (world.guards.some((other) => bodyInOpen(world, other) && Math.abs(bodyAt(other).x - drop.x) < 2 && Math.abs(bodyAt(other).y - drop.y) < 1.5)) continue
    const at = { x: drop.x, y: drop.y - 0.2 }
    if (lightFactor(lightLevelAt(world, at), Math.abs(ahead), darkRange) <= 0 || !clearView(world, eye, at)) continue
    for (const other of blood) if (Math.abs(other.x - drop.x) < SAME_TRAIL && Math.abs(other.y - drop.y) < 1.5) other.noticed = true
    // The far end of the trail is where it leads.
    const trail = blood.filter((other) => Math.abs(other.y - drop.y) < 1.5 && Math.abs(other.x - drop.x) < BLOOD_SIGHT)
    const end = trail.reduce((best, other) => (Math.abs(other.x - feet.x) > Math.abs(best.x - feet.x) ? other : best), drop)
    for (const other of trail) other.noticed = true
    const lead = { x: end.x, y: end.y }
    return { at: lead, kind: 'tamper', priority: 4, line: 'blood', tamper: 'blood', report: { kind: 'tamper', at: lead, what: 'blood' } }
  }
  return null
}
