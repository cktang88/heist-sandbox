import { describe, it } from 'vitest'
import { idleInput, type Input } from '../input'
import { boxHitsSolid } from '../physics'
import { C4_BLAST, explode } from '../explosions'
import { stepWorld } from '../step'
import { actionIndex, toolIndex, TOOLS } from '../toolDefs'
import { createWorld, type SiteKind, type World } from '../world'
import { CROUCH_HEIGHT, STAND_HEIGHT } from './posture'

/**
 * A player mashing keys for minutes, in every movement state the site offers, with uneven frame times. Checked every
 * simulated second for what a player would notice: bad numbers, being inside a wall, a state that never ends.
 */

function problems(world: World, airborneStill: number): string[] {
  const found: string[] = []
  const p = world.player
  const g = world.grapple
  const nums = [p.x, p.y, p.vx, p.vy, p.hp, p.pick, p.reload, p.cooldown, p.focus, g.length, g.vel.x, g.vel.y, g.hook.x, g.hook.y]
  if (!nums.every(Number.isFinite)) found.push(`not finite: ${nums}`)
  if (!p.stairs && !p.mantle && boxHitsSolid(world.grid, p)) found.push(`player inside a wall at ${p.x},${p.y}`)
  if (p.h !== STAND_HEIGHT && p.h !== CROUCH_HEIGHT) found.push(`player height ${p.h}`)
  if (p.pick < 0 || p.pick >= 1) found.push(`pick ${p.pick}`)
  if (p.mantle && p.mantle.t > p.mantle.duration) found.push('mantle overran')
  if (g.phase === 'attached' && !g.anchor) found.push('attached without an anchor')
  if ((g.phase === 'stowed' || g.phase === 'retracting') && g.hanging) found.push(`hanging on a ${g.phase} hook`)
  if (p.stairs && !world.stairwells.some((well) => well.id === p.stairs!.well)) found.push('on a staircase that is gone')
  if (airborneStill > 2) found.push(`hovering still in the air at ${p.x},${p.y}`)
  if (p.ammo.some((n, i) => n < 0 || (Number.isFinite(TOOLS[i].ammo) && !Number.isInteger(n)))) found.push(`ammo ${p.ammo}`)
  if (p.mags.some((n) => n < 0)) found.push(`mags ${p.mags}`)
  if (p.hidden !== (world.stealth.hiding !== null)) found.push(`hidden ${p.hidden} but hiding ${JSON.stringify(world.stealth.hiding)}`)
  if (p.hidden && world.drone) found.push('hidden while flying the drone')
  if (p.pick > 0 && !/hold/i.test(world.prompt ?? '')) found.push(`progress ${p.pick} under prompt ${world.prompt}`)
  if (world.stealth.carried !== null && TOOLS[p.tool].id !== 'pistol') found.push(`carrying with ${TOOLS[p.tool].name}`)
  if (p.stairs && (p.hidden || p.mantle || p.onLadder)) found.push(`on the stairs and hidden ${p.hidden} mantle ${!!p.mantle} ladder ${p.onLadder}`)
  if (g.phase === 'attached' && g.hanging && (p.onLadder || p.stairs || p.mantle)) found.push('hanging on the line while climbing something else')
  if (world.terminal) {
    const device = world.devices.find((d) => d.id === world.terminal!.device)
    if (!device || device.disabled) found.push('terminal open on a dead computer')
  }
  return found
}

type Held = Partial<Input>

function randomHeld(world: World): Held {
  const r = world.rng
  return {
    left: r() < 0.35, right: r() < 0.35, up: r() < 0.25, down: r() < 0.2, jumpHeld: r() < 0.25, crouch: r() < 0.15,
    fire: r() < 0.2, interact: r() < 0.2, focus: r() < 0.1, grab: r() < 0.05,
  }
}

function fuzz(seed: number, site: SiteKind, seconds: number, guards: boolean): void {
  const world = createWorld(seed, site)
  if (!guards) world.guards = []
  const r = world.rng
  let held: Held = {}
  let heldFor = 0
  let airborneStill = 0
  let chuteOnGround = 0
  let aim = { x: 0, y: 0 }
  for (let second = 0; second < seconds; second += 1) {
    if (r() < 0.2) {
      // A blast in the floor or ceiling near him: holes to walk past, fall through, hang over.
      const at = { x: world.player.x + (r() - 0.5) * 8, y: world.player.y + world.player.h + (r() < 0.7 ? 0.5 : -5.5) }
      explode(world, at, C4_BLAST)
    }
    if (r() < 0.15 && world.rooms.length > 0) {
      const room = world.rooms[Math.floor(r() * world.rooms.length)]
      Object.assign(world.player, { x: room.x + 1 + r() * (room.w - 2), y: room.floorY - world.player.h - 0.01, vx: 0, vy: 0, stairs: null, mantle: null, onLadder: false })
    }
    let elapsed = 0
    while (elapsed < 1) {
      world.player.hp = 1e6
      if (heldFor <= 0) {
        held = randomHeld(world)
        heldFor = r() * 1.5
        // The movement tools come up often: the grapple, the rope, C4 and the drone.
        if (r() < 0.25) world.player.tool = [actionIndex('grapple'), actionIndex('rope'), toolIndex('c4'), toolIndex('drone')][Math.floor(r() * 4)]
        aim = { x: world.player.x + (r() - 0.5) * 20, y: world.player.y + (r() - 0.5) * 14 }
      }
      const roll = r()
      const dt = roll < 0.05 ? 0.05 : roll < 0.1 ? 1e-4 : roll < 0.2 ? 1 / 30 : 1 / 60
      const input: Input = {
        ...idleInput(aim), ...held,
        jumpPressed: r() < 0.04, firePressed: r() < 0.06, interactPressed: r() < 0.05, reloadPressed: r() < 0.02,
        detonatePressed: r() < 0.01, punchPressed: r() < 0.01, kickPressed: r() < 0.01, throwPressed: r() < 0.01,
        selectTool: r() < 0.03 ? Math.floor(r() * 10) : r() < 0.005 ? 10 + Math.floor(r() * TOOLS.length) : null,
      }
      if (input.jumpPressed) input.jumpHeld = true
      if (input.firePressed) input.fire = true
      if (input.interactPressed) input.interact = true
      stepWorld(world, input, dt)
      world.sounds.length = 0
      const p = world.player
      const free = !p.onGround && !p.onLadder && !p.stairs && !p.mantle && !p.hidden && world.grapple.phase !== 'attached'
      airborneStill = free && Math.abs(p.vy) < 1e-6 && Math.abs(p.vx) < 1e-6 ? airborneStill + dt : 0
      chuteOnGround = p.chute && p.onGround ? chuteOnGround + 1 : 0
      if (chuteOnGround > 2) throw new Error(`chute open on the ground: grapple ${world.grapple.phase} fling ${world.grapple.fling} hanging ${world.grapple.hanging} ladder ${p.onLadder} stairs ${!!p.stairs} mantle ${!!p.mantle} hidden ${p.hidden} vy ${p.vy} jump ${input.jumpHeld} drone ${!!world.drone} at ${p.x},${p.y}`)
      if (world.status !== 'playing') world.status = 'playing'
      elapsed += dt
      heldFor -= dt
    }
    const found = problems(world, airborneStill)
    if (found.length > 0) throw new Error(`seed ${seed} ${site}, second ${second}: ${found.slice(0, 6).join('; ')}`)
  }
}

describe('a player mashing every key', () => {
  it.each([2])('stays sound on the outpost (seed %i)', (seed) => {
    fuzz(seed, 'outpost', 60, true)
  }, 300_000)
  it.each([[1, false], [2, true]])('stays sound in the complex (seed %i, guards %s)', (seed, guards) => {
    fuzz(seed, 'complex', 40, guards)
  }, 300_000)
})
