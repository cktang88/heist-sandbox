import type { Input } from '../input'
import { bodyControl } from '../movement/control'
import { boxHitsSolid } from '../physics'
import { TOOLS, type ToolId } from '../toolDefs'
import { distance } from '../types'
import type { World } from '../world'
import { cutLine, letGoOfLine, lineIsCut, releaseHook, stepHook } from './hook'
import { carryFling, FLING_SECONDS, gripOf, MAX_LINE, pivotOf, swing, takesWeight, wrapLine } from './line'
import { onLine } from './state'
import { crashThrough, readWindowTap } from './windows'

export { fireGrapple } from './hook'
export { windowAction } from './windows'

/** Guns that need both hands; on the line one hand holds on, so only the pistol and throwables work. */
const TWO_HANDED: ReadonlySet<ToolId> = new Set(['rifle', 'shotgun', 'sniper', 'rocket', 'drill'])
const HOLD_FIRE = 0.1
/** Further than this from where the line left him and something else (an elevator, a respawn) moved him. */
const TELEPORT = 1.5

/**
 * The grappling hook and window entry, once a frame, straight after the player's own movement. While the line carries
 * him (or a jump off it is still carrying its swing) this takes over his movement: it puts him back where the line
 * left him last frame and moves him itself, so the walking and air-control rules do not damp the swing.
 */
export function stepGrapple(world: World, input: Input, dt: number): void {
  const grapple = world.grapple
  const player = world.player
  const controls = bodyControl(world, input)
  readWindowTap(world, controls)
  stepHook(world, dt)
  if (lineIsCut(world)) cutLine(world)
  if (grapple.zip) {
    // E's automatic haul up: the climb moves him. When it ends (or he lets go, or the line was cut) the hook comes back.
    if (player.mantle && grapple.phase === 'attached') return
    grapple.zip = false
    if (grapple.phase === 'attached') releaseHook(world)
  }
  stepVault(world, dt)

  const carried = onLine(grapple) || grapple.fling > 0
  // He caught a ledge, a ladder or the stairs: the line goes slack where it is and the climb takes over.
  if (carried && (player.mantle || player.onLadder || player.stairs)) {
    if (grapple.phase === 'attached') grapple.phase = 'parked'
    Object.assign(grapple, { hanging: false, fling: 0, reeling: 0 })
    return
  }
  // Not where he no longer fits: standing up from a crouch on the line keeps his feet and moves his head, so his old
  // top corner would put the taller body's legs into the floor just under him.
  if (carried && distance(player, grapple.body) < TELEPORT && !boxHitsSolid(world.grid, { ...player, x: grapple.body.x, y: grapple.body.y })) {
    Object.assign(player, { x: grapple.body.x, y: grapple.body.y })
  }

  if (crashThrough(world, grapple.lastVel)) {
    // Through the glass on the swing: let go of the line and keep flying.
    if (onLine(grapple)) grapple.phase = 'parked'
    Object.assign(grapple, { hanging: false, fling: FLING_SECONDS, vel: { ...grapple.lastVel } })
  }

  // A hook that bites while he is pulling himself over a ledge, on a ladder or on the stairs (shot mid-climb) waits
  // slack until the climb is done: the line taking his weight now would have it and the climb both moving him.
  if (grapple.phase === 'attached' && !player.mantle && !player.onLadder && !player.stairs) hangOn(world, controls, dt)
  else if (grapple.fling > 0 && !carryFling(world.grid, player, grapple, dt)) endFling(world)

  if (onLine(grapple) || grapple.fling > 0) {
    // The line, or the swing he jumped off with, carries him: no parachute until the ordinary fall takes over.
    player.chute = false
    grapple.body = { x: player.x, y: player.y }
    player.vx = grapple.vel.x
    player.vy = grapple.vel.y
    if (onLine(grapple) && TWO_HANDED.has(TOOLS[player.tool].id)) player.cooldown = Math.max(player.cooldown, HOLD_FIRE)
  } else grapple.lastVel = { x: player.vx, y: player.vy }
}

/** No shooting while climbing through a window; climbing out onto the parked line takes hold of it at the end. */
function stepVault(world: World, dt: number): void {
  const grapple = world.grapple
  const player = world.player
  if (grapple.vault > 0) {
    grapple.vault = Math.max(0, grapple.vault - dt)
    player.cooldown = Math.max(player.cooldown, grapple.vault)
  }
  if (!grapple.vaultToLine || player.mantle) return
  grapple.vaultToLine = false
  if (grapple.phase !== 'parked') return
  Object.assign(grapple, { phase: 'attached', hanging: true, vel: { x: 0, y: 0 }, body: { x: player.x, y: player.y } })
  grapple.length = Math.max(grapple.length, distance(gripOf(player), pivotOf(grapple)))
}

function hangOn(world: World, input: Input, dt: number): void {
  const grapple = world.grapple
  const player = world.player
  wrapLine(world.grid, grapple, gripOf(player))
  const wasHanging = grapple.hanging
  grapple.hanging = takesWeight(player, grapple, input)
  if (!grapple.hanging) {
    if (wasHanging) letGoOfLine(world)
    payOutWhileWalking(world)
    return
  }
  if (!wasHanging) Object.assign(grapple, { vel: { x: player.vx, y: player.vy }, body: { x: player.x, y: player.y } })
  const result = swing(world.grid, player, grapple, input, dt)
  if (result === 'climbed') Object.assign(grapple, { phase: 'parked', hanging: false, reeling: 0 })
  else if (result === 'jumped') {
    const vel = { ...grapple.vel }
    releaseHook(world)
    Object.assign(grapple, { fling: FLING_SECONDS, vel })
    player.airJumps = 1
  }
}

/** Walking away on the ground draws out more line, up to the whole reel; past that the hook pulls free. */
function payOutWhileWalking(world: World): void {
  const grapple = world.grapple
  const reach = distance(gripOf(world.player), pivotOf(grapple)) + (grapple.bend ? distance(grapple.hook, grapple.bend) : 0)
  if (reach <= grapple.length) return
  if (reach > MAX_LINE) releaseHook(world)
  else grapple.length = reach
}

function endFling(world: World): void {
  const grapple = world.grapple
  grapple.fling = 0
  world.player.vx = grapple.vel.x
  world.player.vy = grapple.vel.y
}
