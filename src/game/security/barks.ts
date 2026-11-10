import type { Rng } from '../rng'
import { distance, type Vec } from '../types'
import type { World } from '../world'
import type { Guard } from './model'
import { BARKS } from './tuning'

/**
 * Short spoken lines. Every change in what a guard is about to do is said out loud first
 * ("if the AI didn't say it, it didn't happen"), so the player can read and answer it.
 */
export const LINES = {
  huh: ['Huh?', 'What was that?', 'Hm?', 'Hello?'],
  checking: ['Checking it out.', 'Going to take a look.', 'Better check that.'],
  nothing: ['Nothing here.', 'Must have been nothing.', 'Hm. Nothing.', 'Just the building settling.'],
  contact: ['Contact!', 'There he is!', 'Intruder!', 'Got eyes on him!'],
  lost: ['Lost him!', 'Where did he go?', 'Lost visual!'],
  searching: ['Spread out, check the rooms.', 'Sweeping the floor.', 'He can\'t have gone far.', 'Checking every room.'],
  allClear: ['All clear.', 'Area clear.', 'Nothing. Standing down.'],
  manDown: ['Man down!', 'Oh no... man down!', 'Got a body here!'],
  gunfire: ['Shots fired!', 'Gunfire!', 'Was that a shot?'],
  orderAck: ['Copy, on my way.', 'Moving.', 'Copy that.'],
  radioDead: ['Radio\'s dead! Going for the alarm!', 'Control? Static. Hitting the alarm!', 'No signal! To the alarm!'],
  alarmPressed: ['Alarm\'s up!', 'Alarm raised!'],
  flashOut: ['Flash out!', 'Flashbang!', 'Flash, flash!'],
  flashed: ['My eyes!', 'I can\'t see!', 'Argh!'],
  cough: ['*cough*', 'Can\'t see in this smoke!', '*cough* *cough*'],
  fire: ['Fire!', 'It\'s burning, move!'],
  fallback: ['I\'m hit! Falling back!', 'Falling back!', 'Need cover!'],
  stairs: ['He\'s on the stairs!', 'Stairwell!', 'He\'s going up the stairs!'],
  flank: ['Flanking!', 'Going around!', 'I\'ll cut him off!'],
  hold: ['Holding here.', 'Covering the door.', 'I\'ve got this exit.'],
  suppress: ['Covering fire!', 'Keep his head down!'],
  takingFire: ['Taking fire!', 'I\'m hit!'],
  lightsOut: ['Lights are out?', 'Who turned the lights off?'],
  station: ['On station.', 'Holding the stairs.', 'In position.'],
  checkIn: ['All quiet.', 'Nothing to report.', 'Post secure.', 'Quiet here.'],
  standDown: ['Back to it.', 'Returning to post.'],
} as const

export type LineKind = keyof typeof LINES

export function pickLine(rng: Rng, kind: LineKind): string {
  const options = LINES[kind]
  return options[Math.floor(rng() * options.length)]
}

/**
 * Shows a line above a guard. Routine lines respect a short cooldown so a guard does not chatter;
 * `force` is for lines that announce something about to happen, which must always be shown.
 */
export function bark(world: World, guard: Guard, text: string, force = false): void {
  if (!force && guard.barkCooldown > 0) return
  guard.barkCooldown = BARKS.cooldown
  sayAt(world, { x: guard.x + guard.w / 2, y: guard.y - 0.5 }, text)
}

export function barkLine(world: World, guard: Guard, kind: LineKind, force = false): void {
  bark(world, guard, pickLine(world.rng, kind), force)
}

export function sayAt(world: World, at: Vec, text: string): void {
  const barks = world.security.barks
  if (barks.length >= BARKS.maxShown) barks.shift()
  barks.push({ x: at.x, y: at.y, text, life: BARKS.life })
}

/** Routine chatter (check-ins) is only worth showing where the player can see it. */
export function nearPlayer(world: World, at: Vec): boolean {
  return distance(at, world.player) < BARKS.chatterRange
}

export function expireBarks(world: World, dt: number): void {
  const barks = world.security.barks
  for (const line of barks) line.life -= dt
  world.security.barks = barks.filter((line) => line.life > 0)
}
