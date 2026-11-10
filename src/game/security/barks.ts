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
  moved: ['Who moved this?', 'This was not here before.', 'Somebody shifted this...'],
  blood: ['Is that... blood?', 'Blood on the floor. Fresh.', 'What the hell is this blood?'],
  gunfire: ['Shots fired!', 'Gunfire!', 'Was that a shot?'],
  orderAck: ['Copy, on my way.', 'Moving.', 'Copy that.'],
  radioDead: ['Radio\'s dead! Going for the alarm!', 'Control? Static. Hitting the alarm!', 'No signal! To the alarm!'],
  alarmPressed: ['Alarm\'s up!', 'Alarm raised!'],
  flashOut: ['Flash out!', 'Flashbang!', 'Flash, flash!'],
  smokeOut: ['Smoke out!', 'Popping smoke!', 'Smoke, then we go!'],
  killZone: ['Don\'t go through there, he\'s got it covered!', 'That door\'s a death trap.', 'Stay out of that doorway!'],
  shieldTeam: ['Control: Shield team, move up.', 'Control: Sending in the shield team.'],
  shieldUp: ['Shield up! Stack on me!', 'Shield\'s up, move!', 'Stack up behind the shield!'],
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
  lightsOn: ['There, lights back on.', 'Breaker\'s back on.'],
  seeFire: ['Is that smoke?', 'Something\'s burning!'],
  station: ['On station.', 'Holding the stairs.', 'In position.'],
  checkIn: ['All quiet.', 'Nothing to report.', 'Post secure.', 'Quiet here.'],
  standDown: ['Back to it.', 'Returning to post.'],
  colleagueDown: ['He\'s got {name}!', '{name}\'s down!', 'They got {name}!', 'No! {name}!'],
  hesitate: ['I\'m not liking this.', 'That\'s where they got him...', 'Careful. He could still be in there.', 'Easy... easy...'],
  alone: ['I\'m not going in there alone.', 'Need a second man here.', 'Waiting for backup.', 'Somebody get over here. Not doing this solo.'],
  partnerHere: ['About time. Stay on me.', 'Okay, with me.', 'Right. Let\'s go.'],
  blindFire: ['Blind firing!', 'Spraying the doorway!', 'Covering fire, can\'t see him!', 'Keep your head down, bastard!'],
  backup: ['Need backup here!', 'Pinned down, send help!', 'I need support!'],
  panic: ['I\'m out of here!', 'Screw this!', 'Not dying for this job!', 'Run! Run!'],
  cower: ['Please, please...', 'Oh god, oh god.', 'Stay quiet... stay quiet...'],
  surrender: ['I give up, don\'t shoot!', 'Okay, okay! I\'m unarmed!', 'Don\'t shoot! I\'m done!', 'Hands up, see? Hands up!'],
  rearm: ['He\'s gone... where\'s my gun?', 'Not today, pal.', 'Got it. Back in this.'],
  recovered: ['Okay... okay. Pull it together.', 'Breathe. Back to it.', 'Right. I\'m good.'],
  grenade: ['Grenade!', 'Get down!', 'Grenade, move!'],
  reloading: ['Reloading!', 'Changing mag!', 'Cover me, reloading!'],
  moving: ['Moving!', 'Cover me, moving!', 'Going up!'],
  covering: ['Covering!', 'Got you covered.', 'Go, go!'],
  holdFire: ['Hold fire, he\'s got a hostage!', 'No clear shot!', 'Don\'t shoot, you\'ll hit him!'],
  drag: ['I\'ve got you, {name}!', 'Hang on, {name}!', 'Pulling you out!'],
  pinned: ['I\'m pinned!', 'Can\'t get my head up!', 'Rounds everywhere!'],
  rocket: ['RPG!', 'He\'s got a launcher!', 'Rocket! Take cover!'],
  doorOpen: ['This door was shut...', 'Who left this open?', 'Door\'s open. That\'s not right.'],
  lockPicked: ['Lock\'s been picked.', 'Someone forced this lock.', 'Scratches on the lock... we\'ve got company.'],
  smokeGrenade: ['That\'s a smoke canister!', 'Smoke grenade! Someone\'s here!'],
  flashCover: ['Ahh! My face!', 'I\'m blind, I\'m blind!', 'Don\'t hurt me!'],
  flashWild: ['Firing blind!', 'Somewhere over there!', 'Eat this!'],
  vaultOpen: ['The vault\'s been hit!', 'The gold\'s gone!', 'Vault breach!'],
  chute: ['Parachute! Someone\'s coming in!', 'Is that a chute?!', 'Something in the sky!'],
  scrape: ['Someone moving furniture?', 'What\'s that scraping?', 'Who\'s dragging stuff around?'],
  dark: ['Torch on.', 'Can\'t see a thing.', 'Damn lights...'],
  rope: ['There\'s a rope on the wall!', 'Climbing rope! He came in this way.', 'Who tied that off?'],
  cutRope: ['Cutting it down.', 'Not coming back up this way.', 'Rope\'s gone.'],
  trick: ['Nice try.', 'Old trick. Not falling for it.', 'Throwing things now? I know you\'re there.'],
  shotLamp: ['Somebody shot the light out!', 'Light\'s been shot out.', 'Who took out that lamp?'],
  grappleLine: ['There\'s a line hanging outside!', 'Grappling hook on the wall!', 'Someone came up on a line.'],
  windowOpen: ['This window\'s been cut.', 'Pane\'s missing. He came in here.', 'Window\'s open... that\'s not right.'],
  charge: ['Explosives! Get back!', 'That\'s C4! Clear the area!', 'Charge on the wall! Back off!'],
  tiedUp: ['Hang on, I\'ll cut you loose!', 'Who did this to you?', 'Man tied up here!'],
  goRound: ['Door\'s barricaded. Going round.', 'Blocked. I\'ll take the other stairs.', 'Can\'t get through, going around.'],
  breaching: ['Breaching!', 'Shooting through!', 'Through the door!'],
  callBreach: ['Door\'s barricaded, need a breach!', 'Get a heavy up here, it\'s blocked!', 'Blocked door! Bring the shield!'],
  fragOut: ['Frag out!', 'Frag, frag!', 'Fire in the hole!'],
  holeDown: ['He\'s right under us!', 'Through the floor, fire!', 'Clearing the hole!'],
  dropping: ['Going down the hole!', 'Dropping through!', 'Down we go!'],
  camera: ['Camera\'s feed just died.', 'Lost a camera. Somebody check it.', 'Camera\'s gone dark.'],
} as const

export type LineKind = keyof typeof LINES

export function pickLine(rng: Rng, kind: LineKind): string {
  const options = LINES[kind]
  return options[Math.floor(rng() * options.length)]
}

const RECENT_LINES = 8

/** A line of this kind that nobody has said lately, if there is one, with `{name}` filled in. */
export function freshLine(world: World, kind: LineKind, name = 'him'): string {
  const recent = world.security.recentLines
  const options = LINES[kind].map((line) => line.replace('{name}', name))
  const unused = options.filter((line) => !recent.includes(line))
  const pool = unused.length > 0 ? unused : options
  const line = pool[Math.floor(world.rng() * pool.length)]
  recent.push(line)
  if (recent.length > RECENT_LINES) recent.shift()
  return line
}

/** What colleagues call a guard (by his index in `world.guards`). */
const NAMES = ['Reyes', 'Kowalski', 'Okafor', 'Brandt', 'Mendez', 'Sato', 'Novak', 'Haddad', 'Price', 'Lindqvist', 'Moreau', 'Chen', 'Duarte', 'Ivanov', 'Walsh', 'Abara', 'Ferro', 'Gruber', 'Tanaka', 'Quinn', 'Adeyemi', 'Rossi', 'Kaur', 'Varga']

export function nameOf(index: number): string {
  return NAMES[index % NAMES.length]
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

export function barkLine(world: World, guard: Guard, kind: LineKind, force = false, name?: string): void {
  if (!force && guard.barkCooldown > 0) return
  bark(world, guard, freshLine(world, kind, name), force)
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
