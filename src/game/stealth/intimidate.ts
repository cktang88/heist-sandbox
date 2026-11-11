import { emitNoise } from '../noise'
import { bark, sayAt } from '../security/barks'
import { enterCombat } from '../security/combat'
import { surrender } from '../security/fear'
import { isActive } from '../security/model'
import { clearView, isAlerted } from '../security/perception'
import { witnessesOf } from '../security/startle'
import { TOOLS } from '../toolDefs'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'

const lastShout = new WeakMap<World, number>()
const GUNS = new Set(['pistol', 'rifle', 'shotgun', 'sniper', 'rocket'])

/** X commands the guard under the gun to surrender; without a target it remains a whistle. */
export function intimidate(world: World, aim: Vec): boolean {
  if (world.status !== 'playing' || world.player.hidden || world.drone || world.stealth.choke || world.stealth.carried !== null || world.melee.shield) return false
  if (!GUNS.has(TOOLS[world.player.tool].id)) return false
  const at = centerOf(world.player)
  const dx = aim.x - at.x
  const dy = aim.y - at.y
  const length = Math.hypot(dx, dy)
  if (length < 0.1) return false
  const target = world.guards.filter((guard) => {
    if (!isActive(guard) || guard.restrained || guard.blindSeconds > 0) return false
    const body = centerOf(guard)
    const forward = ((body.x - at.x) * dx + (body.y - at.y) * dy) / length
    const off = Math.abs((body.x - at.x) * dy - (body.y - at.y) * dx) / length
    return forward > 0 && distance(at, body) <= 7 && off <= 0.7 && clearView(world, at, body)
  }).sort((a, b) => distance(at, centerOf(a)) - distance(at, centerOf(b)))[0]
  if (!target) return false
  if (world.clock - (lastShout.get(world) ?? -Infinity) < 1.5) return true
  lastShout.set(world, world.clock)
  world.stealth.suspiciousUntil = world.clock + 3
  sayAt(world, { x: at.x, y: world.player.y - 0.5 }, 'Hands in the air! Drop your weapon!')
  emitNoise(world, at, 12)
  const surprised = !isAlerted(target) && witnessesOf(world, target).length === 0
  target.startle = null
  if (surprised || target.nerve < 0.4 || target.mode === 'panic') surrender(world, target)
  else {
    bark(world, target, 'No chance! Contact!', true)
    enterCombat(world, target, at)
  }
  return true
}
