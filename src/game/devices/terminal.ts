import { callElevator, carsOf, elevatorRefuses, holdElevators, releaseElevators, shaftOf } from '../elevators'
import { terminalClue, terminalLine } from '../intel/intel'
import { emitNoise } from '../noise'
import { sayAt } from '../security/barks'
import { reportEvent } from '../security/dispatch'
import type { RoomKind } from '../site'
import { playSound } from '../sounds'
import type { Device, World } from '../world'
import { floorOf, onFloor, roomOf, type Floor } from './floor'
import { unlockFloorDoors } from './locks'
import { deviceCenter, floorCircuits } from './power'
import { deviceState } from './state'
import { ventilationOption } from './ventilation'
import { loopFeeds, loopSecondsLeft } from '../stealth/cameraLoop'
import { CAMERA_LOOP } from '../stealth/tuning'

/** A hacking menu the player has open on a computer: pick an option with the number keys. */
export type Terminal = { device: number; title: string; options: string[] }

/** `speaks` marks an option that reports its own result, so no "done" line is added. */
type Option = { label: string; run: () => void; speaks?: boolean }

/** A floor's cameras stay dark this long after an ordinary terminal shuts them off; the security room's console does it for good. */
const CAMERAS_OFF_SECONDS = 120
const RADIOS_JAMMED_SECONDS = 90
/** How far the fake alarm carries on the floor it is set off on. */
const FALSE_ALARM_RADIUS = 14

/** Which rooms' computers can reach which systems. Every terminal can do cameras, lights and the elevator call. */
const CAN_UNLOCK: readonly RoomKind[] = ['security', 'server', 'lab']
const CAN_JAM: readonly RoomKind[] = ['security', 'server']
const CAN_LOCATE_VAULT: readonly RoomKind[] = ['security', 'executive', 'archive']
const CAN_FAKE_ALARM: readonly RoomKind[] = ['security', 'office']
const CAN_HOLD_ELEVATORS: readonly RoomKind[] = ['security', 'server']

const ROOM_NAMES: Partial<Record<RoomKind, string>> = {
  security: 'Security console', server: 'Server rack', lab: 'Lab workstation', executive: 'Executive desk', archive: 'Records terminal', office: 'Office PC',
}

/** True while a terminal is open: the number keys pick menu options instead of switching weapon. */
export function terminalConsumesInput(world: World): boolean {
  return world.terminal !== null
}

export function openTerminal(world: World, device: Device): void {
  const room = roomOf(world, device)
  const floor = floorOf(world, device)
  const name = (room && ROOM_NAMES[room.kind]) ?? 'Workstation'
  const where = floor ? `, ${floor.building} floor ${floor.storey}` : ''
  world.terminal = { device: device.id, title: `${name}${where}`, options: terminalOptions(world, device).map((option) => option.label) }
}

export function closeTerminal(world: World): void {
  world.terminal = null
}

/** Runs the option shown at `index` in the open menu. */
export function chooseOption(world: World, index: number): void {
  const terminal = world.terminal
  const device = terminal && world.devices.find((candidate) => candidate.id === terminal.device)
  if (!terminal || !device) return
  const label = terminal.options[index]
  const option = terminalOptions(world, device).find((candidate) => candidate.label === label)
  if (!option) return
  option.run()
  const at = deviceCenter(device)
  if (!option.speaks) sayAt(world, at, `Done: ${label.toLowerCase()}`)
  playSound(world, 'keyboard', at)
  playSound(world, 'beep', at)
  terminal.options = terminalOptions(world, device).map((candidate) => candidate.label)
}

function terminalOptions(world: World, device: Device): Option[] {
  const floor = floorOf(world, device)
  const kind = roomOf(world, device)?.kind
  if (!floor || !kind) return []
  const has = (kinds: readonly RoomKind[]) => kinds.includes(kind)
  // A floor with no cameras or no lighting circuit does not offer to switch them.
  const options: Option[] = [loopOption(world, floor), camerasOption(world, floor, kind === 'security'), lightsOption(world, floor)].filter((option): option is Option => option !== null)
  if (has(CAN_UNLOCK)) options.push({ label: 'Unlock doors on this floor', run: () => unlockFloorDoors(world, floor) })
  if (has(CAN_JAM)) options.push({ label: 'Jam radios', run: () => switchOff(world, inBuilding(world, floor, 'radioRelay'), RADIOS_JAMMED_SECONDS) })
  if (has(CAN_LOCATE_VAULT)) options.push({ label: 'Show vault location', run: () => revealVaults(world) })
  if (!world.intel.used.has(`device:${device.id}`)) {
    options.push({ label: 'Search files for the case', speaks: true, run: () => {
      const clue = terminalClue(world, device)
      if (clue) sayAt(world, deviceCenter(device), terminalLine(clue))
    } })
  }
  if (has(CAN_FAKE_ALARM)) options.push({ label: 'Trigger false alarm on another floor', run: () => falseAlarm(world, floor) })
  options.push(...elevatorOptions(world, floor, has(CAN_HOLD_ELEVATORS)))
  const fans = ventilationOption(world, device)
  if (fans) options.push(fans)
  return options
}

/** Looping the feeds hides the player without the dead-feed fault a switched-off camera shows the control room. */
function loopOption(world: World, floor: Floor): Option | null {
  const cameras = world.devices.filter((device) => device.kind === 'camera' && onFloor(world, floor, device))
  if (cameras.length === 0) return null
  const left = loopSecondsLeft(world, cameras)
  const label = left > 0 ? `Loop camera feeds again (${Math.ceil(left)}s left)` : `Loop camera feeds on this floor (${CAMERA_LOOP.seconds}s, unnoticed)`
  return { label, run: () => loopFeeds(world, cameras) }
}

function camerasOption(world: World, floor: Floor, forGood: boolean): Option | null {
  const cameras = world.devices.filter((device) => device.kind === 'camera' && onFloor(world, floor, device))
  if (cameras.length === 0) return null
  return {
    label: forGood ? 'Shut down cameras on this floor' : 'Disable cameras on this floor',
    run: () => switchOff(world, cameras, forGood ? Number.POSITIVE_INFINITY : CAMERAS_OFF_SECONDS),
  }
}

function lightsOption(world: World, floor: Floor): Option | null {
  const circuits = [...floorCircuits(world, floor)]
  if (circuits.length === 0) return null
  const allDark = circuits.length > 0 && circuits.every((circuit) => world.deadCircuits.has(circuit))
  return {
    label: allDark ? 'Restore lights on this floor' : 'Cut lights on this floor',
    run: () => circuits.forEach((circuit) => (allDark ? world.deadCircuits.delete(circuit) : world.deadCircuits.add(circuit))),
  }
}

function elevatorOptions(world: World, floor: Floor, canHold: boolean): Option[] {
  const cars = carsOf(world, floor.building)
  if (cars.length === 0) return []
  const options: Option[] = []
  const servesFloor = cars.filter((car) => shaftOf(world, car).stops.includes(floor.floorY))
  if (servesFloor.length > 0) {
    options.push({ label: 'Call elevator to this floor', run: () => servesFloor.forEach((car) => callElevator(world, car, shaftOf(world, car).stops.indexOf(floor.floorY), true)) })
  }
  if (cars.some((car) => elevatorRefuses(world, car))) options.push({ label: 'Release elevators', run: () => releaseElevators(world, floor.building) })
  else if (canHold) options.push({ label: 'Hold elevators', run: () => holdElevators(world, floor.building) })
  return options
}

function inBuilding(world: World, floor: Floor, kind: Device['kind']): Device[] {
  return world.devices.filter((device) => device.kind === kind && roomOf(world, device)?.building === floor.building)
}

/**
 * Turns devices off. A timed switch-off comes back on by itself (see `stepDevices`);
 * a device that is already off for good (a cut cable) stays that way.
 */
export function switchOff(world: World, devices: readonly Device[], seconds: number): void {
  const timers = deviceState(world).offTimers
  for (const device of devices) {
    if (device.disabled && !timers.has(device.id)) continue
    device.disabled = true
    if (Number.isFinite(seconds)) timers.set(device.id, Math.max(seconds, timers.get(device.id) ?? 0))
    else timers.delete(device.id)
  }
}

function revealVaults(world: World): void {
  for (const room of world.rooms) if (room.kind === 'vault') deviceState(world).revealed.add(room.id)
}

/** Sets off an alarm bell on some other floor of the building, so the guards there go and look. */
function falseAlarm(world: World, floor: Floor): void {
  const elsewhere = world.rooms.filter((room) => room.building === floor.building && room.storey !== floor.storey && room.kind !== 'stairwell')
  if (elsewhere.length === 0) return
  const room = elsewhere[Math.floor(world.rng() * elsewhere.length)]
  const at = { x: room.x + room.w / 2, y: room.floorY - 1 }
  playSound(world, 'alarm', at)
  emitNoise(world, at, FALSE_ALARM_RADIUS)
  reportEvent(world, { kind: 'noise', at, loud: true })
}
