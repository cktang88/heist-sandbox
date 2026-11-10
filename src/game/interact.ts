import { closeTerminal, chooseOption, openTerminal, switchOff } from './devices/terminal'
import { lockSeconds, keypadFor } from './devices/locks'
import { deviceCenter, flipPower } from './devices/power'
import { deviceState } from './devices/state'
import { callElevator, carUnderPlayer, doorColumn, elevatorRefuses, shaftDoorAt, shaftOf } from './elevators'
import { canClose, closeDoor, doorCentre, openDoor as openDoorTiles, openDoorBy, openedDoors, type DoorHow } from './doors/doors'
import { onLine } from './grapple/state'
import { windowAction } from './grapple/windows'
import type { Input } from './input'
import { interrogateAction, readAction } from './intel/intel'
import { emitNoise } from './noise'
import { playSound } from './sounds'
import { tileAt, type Grid } from './tiles'
import { TOOLS } from './toolDefs'
import { centerOf, distance, overlaps, type Vec } from './types'
import type { Device, World } from './world'
import { bodyAction, hideAction, noisemakerAction, stashAction, takedownAction, tieUpAction } from './stealth/actions'
import { hidingPrompt, stealthControls } from './stealth/controls'
import { leaveSpot } from './stealth/hide'
import { spotProp } from './stealth/spots'
import { rigBreaker, rigSecondsLeft } from './stealth/sabotage'
import { SABOTAGE } from './stealth/tuning'
import { doorTooHot, systemsAction, touchHotDoor } from './systems/systems'

const PICK_REACH = 2

const MEDKIT_HEAL = 50
const AMMO_REFILL_SHARE = 0.5
/**
 * Most devices are worked at arm's length; cameras hang near the ceiling, so their cable is reached by stretching up,
 * even from under one on the top row of a room.
 */
const DEVICE_REACH = 1.8
const CAMERA_REACH = 3.8
/** Walk further than this from an open terminal and it closes. */
const TERMINAL_REACH = 2.5
const HACK_COMPUTER_SECONDS = 1.5
const HACK_KEYPAD_SECONDS = 3
const CUT_SECONDS = 1
const TYPING_GAP = 0.3

/**
 * One thing the player can do right now. `hold` is how many seconds E must be held;
 * without it a single press does it. `key` names the target so changing target restarts the progress.
 */
export type Action = { prompt: string; key: string; run: () => void; hold?: number; typing?: boolean; hint?: string; at?: Vec; lastResort?: boolean; onPerson?: boolean }

/**
 * The hands-on actions. Loot and supplies are picked up by walking over them; everything else
 * goes through one E key: each frame the best thing in reach is chosen, its hint goes in `world.prompt`,
 * and pressing or holding E does it.
 */
export function interact(world: World, input: Input, dt: number): void {
  handsOn(world, input, dt)
  // Knocked down or jolted, E does nothing for the moment, so nothing is offered.
  if (world.player.stunSeconds > 0) {
    world.prompt = null
    world.stealth.hint = null
  }
}

function handsOn(world: World, input: Input, dt: number): void {
  collect(world)
  world.stealth.hint = null
  leaveLostHidingPlace(world)
  // A choke, hiding, a radio to answer: the stealth code has the hands (and E) for now.
  const busy = stealthControls(world, input, dt)
  if (busy !== undefined) {
    world.player.pick = 0
    world.prompt = busy || null
    return
  }
  // A man walking up within reach takes the player's eyes off the screen: the menu shuts and E is for him.
  if (world.terminal && takedownAction(world)) closeTerminal(world)
  if (world.terminal) return useTerminal(world, input)
  const action = bestAction(world)
  const acted = perform(world, input, dt, action)
  // The hint shows what E does next, so it is chosen again after anything changed.
  const next = acted ? bestAction(world) : action
  world.prompt = world.terminal ? terminalPrompt(world) : world.player.hidden ? hidingPrompt(world) : next?.prompt ?? null
  world.stealth.hint = world.terminal ? null : next?.hint ?? null
}

/** The hiding place was smashed, or the floor dropped away under it: he is out in the open. */
function leaveLostHidingPlace(world: World): void {
  const hiding = world.stealth.hiding
  if (!hiding) return
  const prop = spotProp(world, hiding.prop)
  if (!prop || prop.broken || !world.player.onGround) leaveSpot(world)
}

function bestAction(world: World): Action | null {
  // Nothing is in reach through the walls of a moving car.
  if (world.elevatorCars.some((car) => car.moving && car.riders.includes(world.player))) return null
  if (world.stealth.carried !== null) return carryingAction(world)
  if (world.player.hidden) return null
  return tieUpAction(world) ?? onPerson(takedownAction(world)) ?? bodyAction(world) ?? onPerson(interrogateAction(world))
    ?? nearestAtHand(world, [deviceAction(world, 'near'), elevatorAction(world), windowAction(world), doorAction(world), closeDoorAction(world)])
    ?? deviceAction(world, 'camera') ?? readAction(world) ?? hideAction(world) ?? noisemakerAction(world) ?? deviceAction(world, 'lightSwitch')
    ?? systemsAction(world)
}

/**
 * With a body on the shoulder: stuff it in a hiding place in reach; otherwise the free hand still opens and shuts
 * doors. With neither, the hint says what G and T do.
 */
function carryingAction(world: World): Action | null {
  const stash = stashAction(world)
  if (stash && stash.key !== CARRY_HINT_KEY) return stash
  return nearestAtHand(world, [doorAction(world), closeDoorAction(world)]) ?? stash
}

/** The key of the plain carrying hint from `stashAction`, which does nothing on E. */
const CARRY_HINT_KEY = 'carry'

/** Done to a man on his feet, who may be walking: lifting his keycard or questioning him goes on while following him. */
function onPerson(action: Action | null): Action | null {
  return action && { ...action, onPerson: true }
}

/** Something behind the player counts this much further away than it is: E goes to what he faces first. */
const BEHIND_PENALTY = 0.6
/** Prying an elevator open counts this much further away: it is what E does only when nothing else is at hand. */
const LAST_RESORT = 1.5

/**
 * Of the things at arm's length (a device, an elevator call, a window, a door to open or shut), the nearest wins,
 * favouring what the player faces, so a fuse box beside a door never hides the door from someone standing at it.
 * An action with no position (a window) counts as right there, as it always won before.
 */
function nearestAtHand(world: World, actions: (Action | null)[]): Action | null {
  const center = centerOf(world.player)
  let best: Action | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const action of actions) {
    if (!action) continue
    const behind = action.at !== undefined && (action.at.x - center.x) * world.player.facing < -0.3
    const score = action.at ? distance(center, action.at) + (behind ? BEHIND_PENALTY : 0) + (action.lastResort ? LAST_RESORT : 0) : 0
    if (score >= bestScore) continue
    best = action
    bestScore = score
  }
  return best
}

function collect(world: World): void {
  const player = world.player
  const center = centerOf(player)
  if (!world.loot.taken && overlaps(player, world.loot)) {
    world.loot.taken = true
    playSound(world, 'pickup', center)
    player.hasLoot = true
  }
  for (const pickup of world.pickups) {
    if (pickup.taken || !overlaps(player, pickup)) continue
    pickup.taken = true
    playSound(world, 'pickup', center)
    if (pickup.kind === 'medkit') player.hp = Math.min(100, player.hp + MEDKIT_HEAL)
    else TOOLS.forEach((tool, index) => {
      if (Number.isFinite(tool.ammo)) player.ammo[index] += Math.ceil(tool.ammo * AMMO_REFILL_SHARE)
    })
  }
}

/** Returns true when the action was carried out this frame. */
function perform(world: World, input: Input, dt: number, action: Action | null): boolean {
  const state = deviceState(world)
  const player = world.player
  const steady = steadyHands(world, input) || action?.onPerson === true
  if (!action || action.hold === undefined || !input.interact || state.holding !== action.key || !steady) player.pick = 0
  state.holding = action?.key ?? null
  if (!action) return false
  if (action.hold === undefined) {
    if (input.interactPressed) action.run()
    return input.interactPressed
  }
  if (!input.interact || !steady) return false
  player.pick += dt / action.hold
  if (action.typing) typeAway(world, dt)
  if (player.pick < 1) return false
  player.pick = 0
  action.run()
  return true
}

/** The player's health at the last E check, to tell when a hit lands in the middle of a held action. */
const healthBefore = new WeakMap<World, number>()

/**
 * A held action (a lock, a hack, a cable, cutting a window) needs him to stay put, standing or hanging on a ladder,
 * rope or the grapple line: walking off, jumping, falling or taking a hit starts it over.
 */
function steadyHands(world: World, input: Input): boolean {
  const player = world.player
  const hit = player.hp < (healthBefore.get(world) ?? player.hp)
  healthBefore.set(world, player.hp)
  return !hit && !input.left && !input.right && !input.jumpPressed && (player.onGround || player.onLadder || onLine(world.grapple))
}

function typeAway(world: World, dt: number): void {
  const state = deviceState(world)
  state.typing -= dt
  if (state.typing > 0) return
  state.typing = TYPING_GAP
  playSound(world, 'keyboard', centerOf(world.player))
}

/** While a terminal is open, the number keys pick its options; E or walking away closes it. */
function useTerminal(world: World, input: Input): void {
  const terminal = world.terminal!
  const device = world.devices.find((candidate) => candidate.id === terminal.device)
  world.player.pick = 0
  // Shot or shorted out while open, the screen goes dead with the menu on it.
  if (!device || device.disabled || input.interactPressed || distance(centerOf(world.player), deviceCenter(device)) > TERMINAL_REACH) {
    closeTerminal(world)
    world.prompt = null
    return
  }
  if (input.selectTool !== null && input.selectTool >= 0 && input.selectTool < terminal.options.length) chooseOption(world, input.selectTool)
  world.prompt = terminalPrompt(world)
}

function terminalPrompt(world: World): string {
  const count = world.terminal?.options.length ?? 0
  return count > 0 ? `1-${count}: choose, E: close` : 'Access denied. E: close'
}

/**
 * Which devices compete for the E key, from most to least important. Cameras are reached from further away (they
 * hang near the ceiling), so they only win when nothing at arm's length (a door, an elevator call) is in reach.
 * Light switches are everywhere, so they come last of all.
 */
type DeviceRank = 'near' | 'camera' | 'lightSwitch'

function rankOf(device: Device): DeviceRank {
  return device.kind === 'camera' || device.kind === 'lightSwitch' ? device.kind : 'near'
}

/** The nearest device of this rank in reach that has something to do. */
function deviceAction(world: World, rank: DeviceRank): Action | null {
  const center = centerOf(world.player)
  let best: Action | null = null
  let bestGap = Number.POSITIVE_INFINITY
  for (const device of world.devices) {
    if (rankOf(device) !== rank) continue
    // Ruled out on each axis first: a site has hundreds of devices and only a handful are ever near.
    const reach = device.kind === 'camera' ? CAMERA_REACH : DEVICE_REACH
    const dx = device.x + 0.5 - center.x
    const dy = device.y + 0.5 - center.y
    if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue
    const gap = Math.hypot(dx, dy)
    if (gap > reach || gap >= bestGap) continue
    const action = actionFor(world, device)
    if (!action) continue
    best = { ...action, at: deviceCenter(device) }
    bestGap = gap
  }
  return best
}

function actionFor(world: World, device: Device): Action | null {
  const key = `device:${device.id}`
  const at = deviceCenter(device)
  const timedOff = deviceState(world).offTimers.has(device.id)
  switch (device.kind) {
    case 'fusebox':
    case 'lightSwitch': {
      if (device.circuit === undefined || device.disabled) return null
      const dark = world.deadCircuits.has(device.circuit)
      // Crouched at a live fuse box: rig the breaker to trip later, while the player is somewhere else.
      if (device.kind === 'fusebox' && !dark && world.player.crouching) return rigAction(world, device, key)
      const prompt = device.kind === 'fusebox' ? (dark ? 'E: restore power' : 'E: cut power') : dark ? 'E: lights on' : 'E: lights off'
      const hint = device.kind === 'fusebox' && !dark ? 'Crouch to rig it on a timer instead' : undefined
      return { prompt, key, run: () => flipPower(world, device), hint }
    }
    case 'computer':
      if (device.disabled) return null
      if (device.hacked) return { prompt: 'E: use terminal', key, run: () => openTerminal(world, device) }
      return {
        prompt: 'Hold E: hack terminal', key, hold: HACK_COMPUTER_SECONDS, typing: true,
        run: () => {
          device.hacked = true
          playSound(world, 'beep', at)
          openTerminal(world, device)
        },
      }
    case 'keypad':
      if (device.hacked || device.disabled) return null
      if (world.stealth.keycards.size > 0) return { prompt: 'E: swipe the keycard', key, run: () => hackKeypad(world, device) }
      return { prompt: 'Hold E: hack keypad', key, hold: HACK_KEYPAD_SECONDS, typing: true, run: () => hackKeypad(world, device) }
    case 'alarmButton':
      if (device.disabled) return null
      return { prompt: 'Hold E: disable alarm button', key, hold: CUT_SECONDS, run: () => cutWire(world, device) }
    case 'camera':
      if (device.disabled && !timedOff) return null
      return { prompt: 'Hold E: cut camera cable', key, hold: CUT_SECONDS, run: () => cutWire(world, device) }
    case 'radioRelay':
      if (device.disabled && !timedOff) return null
      return { prompt: 'Hold E: cut radio relay', key, hold: CUT_SECONDS, run: () => cutWire(world, device) }
    case 'elevatorPanel':
      return panelAction(world, device, key)
  }
}

function rigAction(world: World, device: Device, key: string): Action {
  const left = rigSecondsLeft(world, device)
  if (left !== null) return { prompt: `Breaker rigged: trips in ${Math.ceil(left)}s`, key, run: () => {} }
  return { prompt: `Hold E: rig the breaker to trip in ${SABOTAGE.delay}s`, key: `${key}:rig`, hold: SABOTAGE.rigSeconds, run: () => rigBreaker(world, device) }
}

function hackKeypad(world: World, device: Device): void {
  device.hacked = true
  playSound(world, 'beep', deviceCenter(device))
}

/** Cutting a wire switches a device off for good. */
function cutWire(world: World, device: Device): void {
  switchOff(world, [device], Number.POSITIVE_INFINITY)
  playSound(world, 'spark', deviceCenter(device))
}

function panelAction(world: World, device: Device, key: string): Action | null {
  const car = world.elevatorCars.find((candidate) => candidate.shaft === device.target)
  if (!car || device.disabled || elevatorRefuses(world, car)) return null
  const stops = shaftOf(world, car).stops
  const stop = stops.reduce((best, y, index) => (Math.abs(y - device.y) < Math.abs(stops[best] - device.y) ? index : best), 0)
  return { prompt: 'E: call elevator', key, run: () => callElevator(world, car, stop) }
}

function elevatorAction(world: World): Action | null {
  const inCar = carUnderPlayer(world)
  if (inCar) return { prompt: elevatorRefuses(world, inCar) ? 'Elevator held. Climb out by the shaft ladder' : 'W/S: ride elevator', key: 'ride', run: () => {} }
  const door = shaftDoorAt(world, world.player)
  if (!door) return null
  const { car, stop } = door
  if (!car.moving && car.stop === stop && car.doorsOpen) return null
  // During a lockdown the button is dead, so the hint falls through to prying the doors.
  if (elevatorRefuses(world, car)) return null
  const shaft = shaftOf(world, car)
  const at = { x: doorColumn(shaft) + 0.5, y: shaft.stops[stop] - 1.5 }
  return { prompt: 'E: call elevator', key: 'call', at, run: () => callElevator(world, car, stop) }
}

function doorAction(world: World): Action | null {
  const center = centerOf(world.player)
  const door = nearestDoor(world.grid, center)
  if (!door) return null
  if (doorTooHot(world, door)) return { prompt: 'Too hot to touch', key: `door:${door.x}`, at: { x: door.x + 0.5, y: door.y + 0.5 }, run: () => touchHotDoor(world) }
  const seconds = lockSeconds(world, door)
  // Crouched, the door is eased open without a sound; standing it clunks; a kick (V) bursts it.
  const easy = world.player.crouching
  // An elevator's doors have no lock to pick: working them open by hand is prying, and it shows.
  const pried = world.elevators.some((shaft) => doorColumn(shaft) === door.x)
  // While its button works, the elevator is called, not pried.
  if (pried && elevatorAction(world)) return null
  const open = (how: DoorHow) => () => {
    openDoorBy(world, door, pried ? 'forced' : how, 'player')
    if (easy) return
    emitNoise(world, center, 2)
    playSound(world, 'door', center)
  }
  const key = `door:${door.x}`
  // Measured to the face of the door on his side: that is what his hand reaches for.
  const at = { x: Math.max(door.x, Math.min(door.x + 1, center.x)), y: door.y + 0.5 }
  const keypad = keypadFor(world, door)
  if (seconds > 0 && keypad && world.stealth.keycards.size > 0) {
    const swipe = open('keycard')
    return { prompt: 'E: swipe the keycard', key, at, run: () => {
      keypad.hacked = true
      playSound(world, 'beep', center)
      swipe()
    } }
  }
  if (seconds === 0) return easy ? { prompt: 'E: ease the door open (silent)', key, at, run: open('opened') } : { prompt: 'E: open door', key, at, run: open('opened'), hint: 'Crouch to ease it open silently' }
  // With its keypad in reach, hacking that (quicker) is what E does; the secure lock is picked only from the far side.
  if (keypad && !keypad.disabled && distance(center, deviceCenter(keypad)) <= DEVICE_REACH) return null
  if (pried) return { prompt: 'Hold E: pry the doors open', key, at, hold: seconds, run: open('forced'), lastResort: true }
  return { prompt: keypad ? 'Hold E: pick secure lock' : 'Hold E: pick lock', key, at, hold: seconds, run: open('picked') }
}

/** Beside a doorway the player opened by hand: shut it again (silently, crouched), so a patrol finds nothing amiss. */
function closeDoorAction(world: World): Action | null {
  const center = centerOf(world.player)
  let best: { key: string; at: Vec } | null = null
  let bestGap = PICK_REACH
  for (const [key, door] of openedDoors(world)) {
    if (door.by !== 'player' || door.how === 'forced') continue
    const at = doorCentre(door)
    const gap = Math.hypot(at.x - center.x, at.y - center.y)
    if (gap >= bestGap || !canClose(world, door)) continue
    best = { key, at }
    bestGap = gap
  }
  if (!best) return null
  const { key, at } = best
  const quiet = world.player.crouching
  const run = () => {
    if (!closeDoor(world, key) || quiet) return
    emitNoise(world, center, 2)
    playSound(world, 'door', center)
  }
  return quiet ? { prompt: 'E: ease the door shut (silent)', key: `close:${key}`, at, run } : { prompt: 'E: close door', key: `close:${key}`, at, run, hint: 'Crouch to shut it silently' }
}

export function nearestDoor(grid: Grid, from: Vec): Vec | null {
  let best: Vec | null = null
  let bestGap = PICK_REACH
  for (let y = Math.floor(from.y - PICK_REACH); y <= Math.floor(from.y + PICK_REACH); y += 1) {
    for (let x = Math.floor(from.x - PICK_REACH); x <= Math.floor(from.x + PICK_REACH); x += 1) {
      if (tileAt(grid, x, y) !== 'door') continue
      const gap = Math.hypot(x + 0.5 - from.x, y + 0.5 - from.y)
      if (gap >= bestGap) continue
      best = { x, y }
      bestGap = gap
    }
  }
  return best
}

/** Opens the whole door without anyone's hand on it (tests setting a scene). */
export function openDoor(grid: Grid, start: Vec): void {
  openDoorTiles(grid, start)
}
