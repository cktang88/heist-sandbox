import type { Input } from './input'
import { trackLanding, trackStride, type Footfall } from './movement/footsteps'
import { findLedge, letGo, startMantle, stepMantle, type Mantle } from './movement/ledge'
import { slideVelocity, STAND_HEIGHT, updatePosture } from './movement/posture'
import { GRAVITY, moveBody, slipPastCorner } from './physics'
import type { Stairwell } from './site'
import { climbStairs, findLanding, type OnStairs } from './stairs'
import { tileAt, type Grid } from './tiles'
import { BLOOM_RECOVERY_PER_SECOND, GUNS } from './guns'
import { TOOLS } from './toolDefs'
import { centerOf, type Body, type Vec } from './types'

const RUN_SPEED = 9
const AIR_SPEED = 7.5
const JUMP_SPEED = 15.5
const CLIMB_SPEED = 6.5
const CHUTE_FALL_SPEED = 3.5
const CHUTE_GLIDE_SPEED = 9
const CHUTE_OPENS_AT_SPEED = 7
const KICK_RECOVERY = 16
const SAFE_FALL_SPEED = 24
const FALL_DAMAGE_PER_SPEED = 6
const WATER_SLOWDOWN = 0.6
const CROUCH_SPEED = RUN_SPEED * 0.45
/** A jump still works this long after running off an edge... */
const COYOTE_SECONDS = 0.1
/** ...and a press this long before landing is kept and used on touchdown. */
const JUMP_BUFFER_SECONDS = 0.1
export const MAX_FOCUS_SECONDS = 4

export type Player = Body & {
  facing: 1 | -1
  hp: number
  chute: boolean
  onLadder: boolean
  tool: number
  ammo: number[]
  /** Rounds in the magazine of each gun. Unused for non-gun tools. */
  mags: number[]
  /** Seconds left on the current reload, or 0. */
  reload: number
  cooldown: number
  focus: number
  hasLoot: boolean
  /** Lockpicking progress from 0 to 1. */
  pick: number
  /** Recoil shove, 0..1, straight after firing. */
  kick: number
  /** Extra spread from sustained fire, in radians. */
  bloom: number
  airJumps: number
  /** Set while climbing a staircase in the back of a stair lobby. */
  stairs: OnStairs | null
  stairsHeading: number
  /** Low and quiet. Set while crouch is held on the ground, while sliding, and wherever there is no room to stand. */
  crouching: boolean
  crouchWasHeld: boolean
  /** Seconds left of a slide, or 0. */
  slide: number
  /** Set while pulling up over a ledge. */
  mantle: Mantle | null
  /** Seconds left in which a jump counts as from the ground. */
  coyote: number
  /** Seconds left on a jump press waiting for the feet to touch down. */
  jumpBuffer: number
  /** Distance run since the last footfall. */
  stride: number
  /** Footfalls not yet heard by the guards; see `emitMovementNoise`. */
  footfalls: Footfall[]
  /** Seconds of flash blindness and deafness left. */
  blindSeconds: number
  deafSeconds: number
  /** Inside a locker or under a desk (see stealth/hide.ts): still, unseen, and unable to shoot. */
  hidden: boolean
}

export function createPlayer(start: Vec): Player {
  return {
    x: start.x, y: start.y, w: 0.7, h: STAND_HEIGHT, vx: 0, vy: 0, onGround: false,
    facing: 1, hp: 100, chute: false, onLadder: false, tool: 0,
    ammo: TOOLS.map((tool) => tool.ammo), mags: TOOLS.map((tool) => GUNS[tool.id]?.magSize ?? 0), reload: 0, cooldown: 0, focus: MAX_FOCUS_SECONDS, hasLoot: false, pick: 0, kick: 0, bloom: 0, airJumps: 1, stairs: null, stairsHeading: 1, crouching: false, blindSeconds: 0, deafSeconds: 0, hidden: false,
    crouchWasHeld: false, slide: 0, mantle: null, coyote: 0, jumpBuffer: 0, stride: 0, footfalls: [],
  }
}

/**
 * Running, crouching, sliding, jumping, ledge climbing, ladders and the parachute. Tap jump in mid-air to double jump;
 * hold it while falling to open the chute. Jump at a wall while pushing toward it to catch its top edge and climb up.
 */
export function movePlayer(grid: Grid, player: Player, input: Input, dt: number, stairwells: readonly Stairwell[] = []): void {
  if (player.hidden) {
    player.vx = 0
    player.vy = 0
    return
  }
  if (takeStairs(player, input, dt, stairwells)) return
  const center = centerOf(player)
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  player.facing = input.aim.x >= center.x ? 1 : -1
  player.kick *= Math.exp(-KICK_RECOVERY * dt)
  player.bloom = Math.max(0, player.bloom - BLOOM_RECOVERY_PER_SECOND * dt)
  if (climbLedge(player, input, dt)) return

  updatePosture(grid, player, input.crouch, RUN_SPEED, dt)
  const bodyTile = tileAt(grid, Math.floor(center.x), Math.floor(player.y + player.h / 2))
  const feetTile = tileAt(grid, Math.floor(center.x), Math.floor(player.y + player.h - 0.1))
  // The tile just under the feet counts too, so the top of a ladder can be stood on and stepped off.
  const belowTile = tileAt(grid, Math.floor(center.x), Math.floor(player.y + player.h + 0.2))
  const touchingLadder = bodyTile === 'ladder' || feetTile === 'ladder' || belowTile === 'ladder'

  if (!touchingLadder) player.onLadder = false
  else if (input.up || input.down || (!player.onGround && player.vy >= 0 && !player.chute)) player.onLadder = true

  if (player.onLadder) {
    player.chute = false
    player.airJumps = 1
    player.jumpBuffer = 0
    player.vx = move * RUN_SPEED * 0.5
    player.vy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * CLIMB_SPEED
    if (input.jumpPressed) {
      player.onLadder = false
      player.vy = -JUMP_SPEED * 0.8
    }
  } else {
    const inWater = bodyTile === 'water' || feetTile === 'water'
    if (player.slide > 0) player.vx = slideVelocity(player.vx, CROUCH_SPEED, dt)
    else {
      const ground = player.crouching ? CROUCH_SPEED : RUN_SPEED
      const speed = (player.chute ? CHUTE_GLIDE_SPEED : player.onGround ? ground : AIR_SPEED) * (inWater ? WATER_SLOWDOWN : 1)
      player.vx += (move * speed - player.vx) * Math.min(1, dt * 14)
    }
    player.vy += GRAVITY * dt
    jump(player, input, dt)
    player.chute = input.jumpHeld && !player.onGround && (player.chute || player.vy > CHUTE_OPENS_AT_SPEED)
    if (player.chute) player.vy = Math.min(player.vy, CHUTE_FALL_SPEED)
    slipPastCorner(grid, player, move)
  }

  const fallSpeed = player.vy
  const wasAirborne = !player.onGround
  const startX = player.x
  moveBody(grid, player, dt)
  if (player.onGround) {
    if (fallSpeed > SAFE_FALL_SPEED) player.hp -= (fallSpeed - SAFE_FALL_SPEED) * FALL_DAMAGE_PER_SPEED
    if (wasAirborne) trackLanding(player, fallSpeed)
    player.chute = false
    player.airJumps = 1
  }
  trackStride(player, player.x - startX)
  if (move !== 0 && !player.onGround && !player.onLadder && !input.down && !input.crouch) catchLedge(grid, player, move > 0 ? 1 : -1)
}

/** Ground jumps (with coyote time and a buffered press) and the one extra jump in mid-air. */
function jump(player: Player, input: Input, dt: number): void {
  player.coyote = player.onGround ? COYOTE_SECONDS : Math.max(0, player.coyote - dt)
  player.jumpBuffer = input.jumpPressed ? JUMP_BUFFER_SECONDS : Math.max(0, player.jumpBuffer - dt)
  if (player.jumpBuffer <= 0) return
  if (player.coyote > 0) {
    player.vy = -JUMP_SPEED
    player.slide = 0
  } else if (input.jumpPressed && player.airJumps > 0) {
    player.airJumps -= 1
    player.vy = -JUMP_SPEED * 0.9
  } else return
  player.coyote = 0
  player.jumpBuffer = 0
}

function catchLedge(grid: Grid, player: Player, side: 1 | -1): void {
  const ledge = findLedge(grid, player, side)
  if (!ledge) return
  player.mantle = startMantle(player, ledge, side)
  player.crouching = player.h < STAND_HEIGHT
  player.chute = false
  player.slide = 0
}

/** Carries on a climb over a ledge; down or crouch lets go. Returns true while climbing. */
function climbLedge(player: Player, input: Input, dt: number): boolean {
  if (!player.mantle) return false
  if (input.down || input.crouch) {
    letGo(player, player.mantle)
    player.mantle = null
    return false
  }
  if (stepMantle(player, player.mantle, dt)) {
    player.mantle = null
    player.airJumps = 1
    player.coyote = COYOTE_SECONDS
  }
  return true
}

/**
 * Stairs: stand at a landing and hold up or down to climb. Keep holding to carry on past each floor;
 * let go to step off at the next landing, or jump to leave mid-flight. Returns true while on the stairs.
 */
function takeStairs(player: Player, input: Input, dt: number, stairwells: readonly Stairwell[]): boolean {
  const climb = (input.up ? 1 : 0) - (input.down ? 1 : 0)
  if (!player.stairs) {
    if (climb === 0 || !player.onGround) return false
    const landing = findLanding(stairwells, player.x + player.w / 2, player.y + player.h)
    if (!landing) return false
    const next = landing.stop + climb
    if (next < 0 || next >= landing.well.stops.length) return false
    player.stairs = { well: landing.well.id, u: landing.stop }
  }
  const well = stairwells.find((candidate) => candidate.id === player.stairs!.well)
  if (!well || input.jumpPressed) {
    player.stairs = null
    player.vy = -JUMP_SPEED * 0.6
    return false
  }
  player.chute = false
  player.facing = input.aim.x >= player.x + player.w / 2 ? 1 : -1
  const midFlight = !Number.isInteger(player.stairs.u)
  // Letting go mid-flight keeps you walking to the nearest landing in the direction you were heading.
  const direction = climb !== 0 ? climb : midFlight ? player.stairsHeading : 0
  if (direction === 0) {
    player.stairs = null
    return false
  }
  player.stairsHeading = direction
  if (!climbStairs(player, player.stairs, well, direction, climb !== 0, dt)) player.stairs = null
  return true
}

/** Focus drains in real time while held and refills when released. */
export function updateFocus(player: Player, held: boolean, realDt: number): boolean {
  const active = held && player.focus > 0
  player.focus = active ? Math.max(0, player.focus - realDt) : Math.min(MAX_FOCUS_SECONDS, player.focus + realDt * 0.4)
  return active
}
