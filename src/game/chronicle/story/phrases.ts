import type { ConditionId, EventId } from '../../director/types'

/** The words the story uses for the game's own terms. */

export const CONDITION_WORDS: Record<ConditionId, string> = {
  rain: 'heavy rain', storm: 'a thunderstorm', backupPower: 'flickering backup power', skeletonCrew: 'a skeleton crew',
  vipVisit: 'a VIP visit', shiftChange: 'a shift change', delivery: 'a late delivery', scaffolding: 'maintenance scaffolding',
  fireDrill: 'a fire drill', party: 'an off-duty party', inspection: 'a surprise inspection', rivalCrew: 'a rival crew at work',
}

/** How the intruder got in, as what they did: "{verb} the 4th-floor office of the tower". */
export const ENTRY_WORDS: Record<string, readonly string[]> = {
  window: ['climbed in through a window into', 'came in by a window on'],
  door: ['opened a door into', 'came through a door into'],
  blast: ['blew a hole into', 'blasted a way into'],
  drill: ['drilled straight through the wall into', 'drilled a way into'],
  sewer: ['came up out of the sewer into', 'surfaced from the tunnels into'],
  grapple: ['rode a grappling line up into', 'swung in on a grappling line to'],
  rope: ['climbed a rope up into', 'went hand over hand up a rope into'],
  open: ['walked unchallenged into', 'slipped through an open doorway into'],
}

/** How a guard went down, as what was done to him. */
export function downWords(detail: string): string {
  if (detail === 'knocked out') return 'knocked out cold'
  if (detail === 'takedown') return 'taken down from behind'
  if (detail === 'beaten') return 'beaten to the floor'
  if (detail === 'blast') return 'caught in a blast'
  if (detail === 'fire') return 'lost in the flames'
  if (detail === 'accident') return 'killed in the chaos'
  if (detail.startsWith('shot:')) return `shot with the ${detail.slice(5).toLowerCase()}`
  return 'taken down'
}

/** Why the alarm rose, as the end of "the alarm went up ...". */
export const CAUSE_WORDS: Record<string, string> = {
  explosion: 'after an explosion', body: 'when a body was found', sighting: 'when a guard got a look at the intruder',
  camera: 'when a camera caught movement', 'alarm button': 'when someone hit an alarm button', gunfire: 'at the sound of gunfire',
  'missed check-in': 'when a guard missed his radio check-in', fire: 'over a fire', radio: 'when a radio relay went dead',
  power: 'over a power fault', parachute: 'when a parachute was seen', noise: 'over a noise in the dark', tampering: 'over signs of a break-in',
  unknown: 'for reasons nobody wrote down',
}

export const LEVEL_WORDS = ['all clear', 'uneasy', 'on alert for an intruder', 'at full alarm', 'in lockdown']

/** A director event told as a clause; its outcome follows after a semicolon. */
export const EVENT_WORDS: Record<EventId | 'lightning' | 'shiftChange' | 'delivery' | 'fireDrill' | 'rivalCrew', string> = {
  smokeBreak: 'a guard slipped up to the roof for a cigarette',
  blackout: 'the grid dropped out',
  phoneCall: 'the control room operator was called away to the phone',
  patrolSwap: 'the control room swapped two patrols around',
  wanderer: 'a bored guard wandered off his round',
  chatter: 'two guards stopped for a chat nearby',
  sweep: 'the control room ordered a room-by-room sweep',
  courier: 'a courier was sent running with the case',
  evacuation: 'the fire alarm emptied the building floor by floor',
  engineer: 'the site engineer came with a torch to fix the breakers',
  crawler: 'a guard came round from a knockout and staggered for the alarm',
  deal: 'a guard who had given up offered a deal for his life',
  spotCheck: 'the control room sent a pair on a routine check',
  lightning: 'lightning struck the site',
  shiftChange: 'the shift changed',
  delivery: 'a delivery truck rolled in',
  fireDrill: 'a fire drill emptied a building',
  rivalCrew: 'a rival crew struck elsewhere on the site',
}

/** Vehicle prop kinds in plain words. */
export const VEHICLE_WORDS: Record<string, string> = { van: 'van', car: 'car', forklift: 'forklift' }

/** Where a clue came from, as a reader would say it: "a whiteboard", "Reyes", "Reyes, overheard,". */
export function sourceWords(origin: string): string {
  const overheard = origin.match(/^(.+) \(overheard\)$/)
  if (overheard) return `${overheard[1]}, overheard,`
  return /^[a-z]/.test(origin) ? `a ${origin}` : origin
}

/**
 * A clue's claim in prose. The intel log writes it as "the tower · floors 18-22 · east wing · a lab"; the story says
 * "a lab in the tower's east wing, floors 18-22".
 */
export function claimWords(detail: string): string {
  const [building, ...parts] = detail.split(' · ')
  const side = parts.find((part) => part.endsWith(' wing'))
  const storeys = parts.find((part) => /floor|basement/.test(part))
  const kind = parts.find((part) => part !== side && part !== storeys)
  const where = side ? `${building}'s ${side}` : building
  return `${kind ?? 'somewhere'} in ${where}${storeys ? `, ${storeys}` : ''}`
}
