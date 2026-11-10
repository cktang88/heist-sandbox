import { closeTerminal, chooseOption, openTerminal, switchOff } from './devices/terminal'
import { lockSeconds, keypadFor } from './devices/locks'
import { deviceCenter, flipPower } from './devices/power'
import { deviceState } from './devices/state'
import { callElevator, carUnderPlayer, elevatorRefuses, shaftDoorAt, shaftOf } from './elevators'
import { hurtGuard, restrainGuard } from './guards'
import type { Input } from './input'
import { emitNoise } from './noise'
import { playSound } from './sounds'
import { setTile, tileAt, type Grid } from './tiles'
import { TOOLS } from './toolDefs'
import { centerOf, distance, overlaps, type Vec } from './types'
import type { Device, World } from './world'

const PICK_REACH = 2
const TAKEDOWN_REACH = 1.6
const MAX_DOOR_TILES = 8
const MEDKIT_HEAL = 50
const AMMO_REFILL_SHARE = 0.5
/** Most devices are worked at arm's length; cameras hang near the ceiling, so their cable is reached by stretching up. */
const DEVICE_REACH = 1.8
const CAMERA_REACH = 3.6
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
type Action = { prompt: string; key: string; run: () => void; hold?: number; typing?: boolean }

/**
 * The hands-on actions. Loot and supplies are picked up by walking over them; everything else
 * goes through one E key: each frame the best thing in reach is chosen, its hint goes in `world.prompt`,
 * and pressing or holding E does it.
 */
export function interact(world: World, input: Input, dt: number): void {
  collect(world)
  if (!takedownAction(world) && world.terminal) return useTerminal(world, input)
  const action = bestAction(world)
  const acted = perform(world, input, dt, action)
  // The hint shows what E does next, so it is chosen again after anything changed.
  const next = acted ? bestAction(world) : action
  world.prompt = world.terminal ? terminalPrompt(world) : next?.prompt ?? null
}

function bestAction(world: World): Action | null {
  // Nothing is in reach through the walls of a moving car.
  if (world.elevatorCars.some((car) => car.moving && car.riders.includes(world.player))) return null
  return takedownAction(world) ?? deviceAction(world) ?? elevatorAction(world) ?? deviceAction(world, true) ?? doorAction(world)
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
  if (!action || action.hold === undefined || !input.interact || state.holding !== action.key) player.pick = 0
  state.holding = action?.key ?? null
  if (!action) return false
  if (action.hold === undefined) {
    if (input.interactPressed) action.run()
    return input.interactPressed
  }
  if (!input.interact) return false
  player.pick += dt / action.hold
  if (action.typing) typeAway(world, dt)
  if (player.pick < 1) return false
  player.pick = 0
  action.run()
  return true
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
  if (!device || input.interactPressed || distance(centerOf(world.player), deviceCenter(device)) > TERMINAL_REACH) {
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

function takedownAction(world: World): Action | null {
  const center = centerOf(world.player)
  const guard = world.guards.find((other) => other.state !== 'dead' && other.state !== 'alert' && !other.restrained && distance(centerOf(other), center) < TAKEDOWN_REACH)
  if (!guard) return null
  // A guard with his hands up is tied, not killed.
  if (guard.mode === 'surrendered') return { prompt: 'E: tie up', key: 'tieUp', run: () => restrainGuard(world, guard) }
  return { prompt: 'E: take down', key: 'takedown', run: () => hurtGuard(world, guard, 1000, center) }
}

/**
 * The nearest device in reach that has something to do. Light switches are everywhere, so they only win
 * when nothing more important (a terminal, a keypad, an elevator) is in reach: pass `switches` to pick them.
 */
function deviceAction(world: World, switches = false): Action | null {
  const center = centerOf(world.player)
  let best: Action | null = null
  let bestGap = Number.POSITIVE_INFINITY
  for (const device of world.devices) {
    if ((device.kind === 'lightSwitch') !== switches) continue
    const gap = distance(center, deviceCenter(device))
    if (gap > (device.kind === 'camera' ? CAMERA_REACH : DEVICE_REACH) || gap >= bestGap) continue
    const action = actionFor(world, device)
    if (!action) continue
    best = action
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
      const prompt = device.kind === 'fusebox' ? (dark ? 'E: restore power' : 'E: cut power') : dark ? 'E: lights on' : 'E: lights off'
      return { prompt, key, run: () => flipPower(world, device) }
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
  if (inCar) return { prompt: elevatorRefuses(world, inCar) ? 'Elevator locked down' : 'W/S: ride elevator', key: 'ride', run: () => {} }
  const door = shaftDoorAt(world, world.player)
  if (!door) return null
  const { car, stop } = door
  if (!car.moving && car.stop === stop && car.doorsOpen) return null
  // During a lockdown the button is dead, so the hint falls through to prying the doors.
  if (elevatorRefuses(world, car)) return null
  return { prompt: 'E: call elevator', key: 'call', run: () => callElevator(world, car, stop) }
}

function doorAction(world: World): Action | null {
  const center = centerOf(world.player)
  const door = nearestDoor(world.grid, center)
  if (!door) return null
  const seconds = lockSeconds(world, door)
  const run = () => {
    openDoor(world.grid, door)
    world.structureChanged = true
    emitNoise(world, center, 2)
    playSound(world, 'door', center)
  }
  const key = `door:${door.x}`
  if (seconds === 0) return { prompt: 'E: open door', key, run }
  return { prompt: keypadFor(world, door) ? 'Hold E: pick secure lock' : 'Hold E: pick lock', key, hold: seconds, run }
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

/** Opens the whole door, not just the tile that was picked. */
export function openDoor(grid: Grid, start: Vec): void {
  const queue: Vec[] = [start]
  for (let opened = 0; queue.length > 0 && opened < MAX_DOOR_TILES; opened += 1) {
    const { x, y } = queue.pop()!
    if (tileAt(grid, x, y) !== 'door') continue
    setTile(grid, x, y, 'air')
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }
}
