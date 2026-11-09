import type { Input } from './input'
import { GRAVITY, moveBody } from './physics'
import { tileAt, type Grid } from './tiles'
import { TOOLS } from './toolDefs'
import { centerOf, type Body, type Vec } from './types'

const RUN_SPEED = 9
const AIR_SPEED = 7.5
const JUMP_SPEED = 15.5
const CLIMB_SPEED = 6.5
const CHUTE_FALL_SPEED = 3.5
const CHUTE_GLIDE_SPEED = 9
const SAFE_FALL_SPEED = 24
const FALL_DAMAGE_PER_SPEED = 6
const WATER_SLOWDOWN = 0.6
export const MAX_FOCUS_SECONDS = 4

export type Player = Body & {
  facing: 1 | -1
  hp: number
  chute: boolean
  onLadder: boolean
  tool: number
  ammo: number[]
  cooldown: number
  focus: number
  hasLoot: boolean
  /** Lockpicking progress from 0 to 1. */
  pick: number
}

export function createPlayer(start: Vec): Player {
  return {
    x: start.x, y: start.y, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: false,
    facing: 1, hp: 100, chute: false, onLadder: false, tool: 0,
    ammo: TOOLS.map((tool) => tool.ammo), cooldown: 0, focus: MAX_FOCUS_SECONDS, hasLoot: false, pick: 0,
  }
}

/** Running, jumping, ladders and the parachute. Jump in mid-air opens or closes the chute. */
export function movePlayer(grid: Grid, player: Player, input: Input, dt: number): void {
  const center = centerOf(player)
  const bodyTile = tileAt(grid, Math.floor(center.x), Math.floor(center.y))
  const feetTile = tileAt(grid, Math.floor(center.x), Math.floor(player.y + player.h - 0.1))
  const touchingLadder = bodyTile === 'ladder' || feetTile === 'ladder'
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  player.facing = input.aim.x >= center.x ? 1 : -1

  if (!touchingLadder) player.onLadder = false
  else if (input.up || input.down || (!player.onGround && player.vy >= 0 && !player.chute)) player.onLadder = true

  if (player.onLadder) {
    player.chute = false
    player.vx = move * RUN_SPEED * 0.5
    player.vy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * CLIMB_SPEED
    if (input.jumpPressed) {
      player.onLadder = false
      player.vy = -JUMP_SPEED * 0.8
    }
  } else {
    const inWater = bodyTile === 'water' || feetTile === 'water'
    const speed = (player.chute ? CHUTE_GLIDE_SPEED : player.onGround ? RUN_SPEED : AIR_SPEED) * (inWater ? WATER_SLOWDOWN : 1)
    player.vx += (move * speed - player.vx) * Math.min(1, dt * 14)
    player.vy += GRAVITY * dt
    if (input.jumpPressed) {
      if (player.onGround) player.vy = -JUMP_SPEED
      else player.chute = !player.chute
    }
    if (player.chute) player.vy = Math.min(player.vy, CHUTE_FALL_SPEED)
  }

  const fallSpeed = player.vy
  moveBody(grid, player, dt)
  if (player.onGround) {
    if (fallSpeed > SAFE_FALL_SPEED) player.hp -= (fallSpeed - SAFE_FALL_SPEED) * FALL_DAMAGE_PER_SPEED
    player.chute = false
  }
}

/** Focus drains in real time while held and refills when released. */
export function updateFocus(player: Player, held: boolean, realDt: number): boolean {
  const active = held && player.focus > 0
  player.focus = active ? Math.max(0, player.focus - realDt) : Math.min(MAX_FOCUS_SECONDS, player.focus + realDt * 0.4)
  return active
}
