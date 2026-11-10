import { deviceState } from '../../game/devices/state'
import { onLine } from '../../game/grapple/state'
import { guardMood, type Guard } from '../../game/guards'
import { propBox, propById } from '../../game/hazards/props'
import { UNDER_FIRE } from '../../game/security/tuning'
import { TOOLS, type ToolId } from '../../game/toolDefs'
import { handOf } from '../../game/tools'
import type { Body, Vec } from '../../game/types'
import type { World } from '../../game/world'
import { captiveNeck, draggedCollar, KICK_SECONDS, PUNCH_SECONDS, stackShoulder, type Act } from './acts'
import type { Motion } from './pose'

/**
 * Reads the world into the `Motion` a person is posed from. Both renderers use this, so a state the game adds only
 * needs teaching here once to show in the 3D and the flat view alike.
 */
export type Posed = { motion: Motion; held: ToolId | null }

/** Tools that leave the hand: the moment after one goes, the arm is still following through. */
const THROWN: ReadonlySet<ToolId> = new Set(['c4', 'smoke', 'flash', 'frag'])
const THROW_SECONDS = 0.34
const PLANT_SECONDS = 0.4
/** A charge that lands this close to the hand was pressed on, not thrown. */
const PLANT_REACH = 1.7
const LOCK_HEIGHT = 0.95

const feetOf = (body: Body): Vec => ({ x: body.x + body.w / 2, y: body.y + body.h })

export function playerMotion(world: World, aim: Vec): Posed {
  const hero = world.player
  const feet = feetOf(hero)
  const hand = handOf(world)
  const motion: Motion = {
    x: feet.x, feetY: feet.y, facing: hero.facing, vx: hero.vx, vy: hero.vy, onGround: hero.onGround,
    mode: hero.chute ? 'chute' : hero.stairs ? 'stairs' : hero.onLadder ? 'ladder' : hero.crouching ? 'crouch' : 'normal',
    aim: Math.atan2(aim.y - hand.y, aim.x - hand.x), kick: hero.kick, clock: world.clock,
  }
  const held: ToolId = world.drone ? 'drone' : TOOLS[hero.tool].id
  const act = playerAct(world, feet, hand, held)
  if (act?.kind === 'hang') Object.assign(motion, { mode: 'normal', onGround: false })
  if (act?.kind === 'vault' && hero.mantle) motion.facing = hero.mantle.side
  return { motion: { ...motion, act }, held }
}

function playerAct(world: World, feet: Vec, hand: Vec, held: ToolId): Act | undefined {
  const hero = world.player
  const grapple = world.grapple
  if (hero.mantle) return { kind: 'vault', t: hero.mantle.t / hero.mantle.duration, edge: mantleEdge(world) }
  if (onLine(grapple)) return { kind: 'hang', line: grapple.bend ?? grapple.hook, reel: grapple.reeling }
  if (hero.onLadder) {
    const column = Math.floor(feet.x)
    const rope = world.ropes.find((line) => line.x === column && feet.y - 1 >= line.top && feet.y - 1 <= line.bottom + 1)
    return rope ? { kind: 'rope', x: rope.x + 0.5 } : undefined
  }
  const captive = world.melee.shield ?? chokedMan(world)
  if (captive) return { kind: 'hostage', neck: captiveNeck(feetOf(captive), captive.facing) }
  if (world.stealth.carried !== null) return { kind: 'carry' }
  const grabbed = world.physProps.grabbed && propById(world, world.physProps.grabbed.id)
  if (grabbed) return { kind: 'drag', grip: dragGrip(propBox(grabbed), feet) }
  const strike = world.melee.strike
  const since = strike ? world.clock - strike.at : Infinity
  const lasts = strike?.kind === 'punch' ? PUNCH_SECONDS : strike?.kind === 'kick' ? KICK_SECONDS : THROW_SECONDS
  if (strike && since >= 0 && since < lasts) return { kind: strike.kind, t: since }
  if (hero.pick > 0 || world.terminal) {
    const work = workAct(world, feet)
    if (work) return work
  }
  if (hero.slide > 0) return { kind: 'slide' }
  return THROWN.has(held) && hero.cooldown > 0 ? throwAct(world, hand, held) : undefined
}

/** The man in the player's chokehold, if any: held like a shield while he struggles. */
function chokedMan(world: World): Guard | null {
  const choke = world.stealth.choke
  return choke ? world.guards[choke.guard] : null
}

/** The corner of the ledge or sill the hands are on, worked out from where the climb started. */
function mantleEdge(world: World): Vec {
  const hero = world.player
  const mantle = hero.mantle!
  const x = mantle.side > 0 ? Math.floor(mantle.from.x + hero.w + 0.15) : Math.floor(mantle.from.x - 0.15) + 1
  return { x, y: mantle.to.y + hero.h }
}

/** Hands on the near side of the piece, at waist height or its top if it is lower. */
function dragGrip(box: { x: number; y: number; w: number; h: number }, feet: Vec): Vec {
  const x = box.x + box.w / 2 > feet.x ? box.x : box.x + box.w
  const y = Math.min(box.y + box.h - 0.05, Math.max(box.y + 0.1, feet.y - 1))
  return { x, y }
}

/** What the hands are on during a held E (or an open terminal): a man being questioned, a lock, a panel, a pane. */
function workAct(world: World, feet: Vec): Act | null {
  const key = world.terminal ? `device:${world.terminal.device}` : deviceState(world).holding
  if (!key) return null
  const [what, first, second] = key.split(':')
  if (what === 'intel' && first === 'ask') {
    // Kneeling over a man who is tied and kneeling; a hand in the collar of one who stands with his hands up.
    const guard = world.guards[Number(second)]
    if (!guard) return null
    const his = feetOf(guard)
    return guard.restrained ? { kind: 'work', how: 'kneel', at: { x: his.x, y: his.y - 0.9 } } : { kind: 'work', how: 'reach', at: { x: his.x, y: his.y - 1.25 } }
  }
  if (what === 'intel' && first === 'read') {
    const prop = propById(world, Number(second))
    return prop ? { kind: 'work', how: 'hunch', at: { x: prop.x + 0.5, y: Math.max(prop.y - 0.6, feet.y - 1.2) } } : null
  }
  if (what === 'door') {
    const x = Number(first)
    return { kind: 'work', how: 'hunch', at: { x: x + (x + 0.5 > feet.x ? 0 : 1), y: feet.y - LOCK_HEIGHT } }
  }
  if (what === 'window') {
    const x = Number(first)
    return { kind: 'work', how: 'reach', at: { x: x + (x + 0.5 > feet.x ? 0 : 1), y: feet.y - 1.1 } }
  }
  if (what === 'device') {
    const device = world.devices.find((item) => item.id === Number(first))
    return device ? { kind: 'work', how: 'reach', at: { x: device.x, y: device.y } } : null
  }
  return null
}

function throwAct(world: World, hand: Vec, held: ToolId): Act | undefined {
  const since = TOOLS[world.player.tool].cooldown - world.player.cooldown
  if (held === 'c4' && since < PLANT_SECONDS) {
    const charge = world.charges[world.charges.length - 1]
    const at = charge && { x: charge.x + charge.w / 2, y: charge.y + charge.h / 2 }
    if (at && Math.hypot(at.x - hand.x, at.y - hand.y) < PLANT_REACH) return { kind: 'plant', t: since, at }
  }
  return since < THROW_SECONDS ? { kind: 'throw', t: since } : undefined
}

/** `weapon` is what his role carries; he lets go of it when he gives up or is tied. */
export function guardMotion(world: World, guard: Guard, weapon: ToolId | null): Posed {
  const feet = feetOf(guard)
  const alert = guard.state !== 'patrol'
  const relaxed = guard.facing > 0 ? 0.35 : Math.PI - 0.35
  // A fighting guard's weapon points where the game says, which may be straight up or down through a hole.
  const aim = guardMood(guard) === 'alert' && (guard.aim.x !== 0 || guard.aim.y !== 0) ? Math.atan2(guard.aim.y, guard.aim.x) : relaxed
  const act = guardAct(world, guard)
  const unarmed = guard.restrained || guard.droppedWeapon !== null || guard.mode === 'surrendered'
  const formed = act?.kind === 'shield' || act?.kind === 'stack'
  const motion: Motion = {
    x: feet.x, feetY: feet.y, facing: guard.facing, vx: guard.vx, vy: guard.vy, onGround: guard.onGround,
    mode: guard.stairs ? 'stairs' : guard.climbing ? 'ladder' : guard.crouching || formed ? 'crouch' : 'normal',
    aim, kick: guard.kick, clock: world.clock, alert: alert || formed, cower: guard.suppression, act,
  }
  return { motion, held: unarmed ? null : weapon }
}

function guardAct(world: World, guard: Guard): Act | undefined {
  if (guard.restrained) return { kind: 'restrained' }
  const dragger = guard.draggedBy !== null ? world.guards[guard.draggedBy] : undefined
  if (dragger) return { kind: 'dragged', byX: feetOf(dragger).x }
  if (guard.diveSeconds > 0) return { kind: 'dive', t: 1 - guard.diveSeconds / UNDER_FIRE.diveSeconds }
  if (world.melee.shield === guard || chokedMan(world) === guard) return { kind: 'captive' }
  if (guard.startle) return { kind: 'startled', t: 1 - guard.startle.seconds / guard.startle.total }
  if (guard.mode === 'surrendered') return { kind: 'surrender' }
  if (guard.blindSeconds > 0 && guard.blindReaction) return { kind: 'blinded', how: guard.blindReaction }
  if (guard.mode === 'panic') return { kind: 'cower' }
  const index = world.guards.indexOf(guard)
  const casualty = world.guards.find((other) => other.draggedBy === index)
  if (casualty) return { kind: 'dragging', at: draggedCollar(feetOf(casualty), feetOf(guard).x) }
  if (guard.shield) return { kind: 'shield' }
  if (guard.reloadSeconds > 0) return { kind: 'reload', t: 1 - guard.reloadSeconds / UNDER_FIRE.reloadSeconds }
  if (guard.blindFiring) return { kind: 'blindFire' }
  if (guard.shelter && !guard.peeking && guard.state === 'alert') return { kind: 'duck' }
  const ahead = guard.stackLeader !== null && guard.stackSlot > 0
    ? world.guards.find((other) => other.stackLeader === guard.stackLeader && other.stackSlot === guard.stackSlot - 1) : undefined
  if (ahead) return { kind: 'stack', at: stackShoulder(feetOf(ahead), ahead.facing) }
  if (guard.radio) return { kind: 'radio' }
  if (guard.mode === 'searching') return { kind: 'torch' }
  if ((guard.mode === 'noticed' || guard.mode === 'investigating') && Math.abs(guard.vx) < 0.3) return { kind: 'scan' }
  return undefined
}
