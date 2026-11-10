import { TOOLS } from '../game/toolDefs'

/**
 * What the help screen says, as data: short tabs of plain sentences with small examples.
 * The tools tab is built from the kit, so a new tool without a line here fails its test.
 */
export type HelpItem = { term: string; text: string; tone?: string }
export type HelpBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: readonly HelpItem[] }
  | { kind: 'example'; text: string }
  | { kind: 'heading'; text: string }
export type HelpTab = { title: string; blocks: readonly HelpBlock[] }

/** One line per tool, by the name the kit gives it. */
export const TOOL_NOTES: Readonly<Record<string, string>> = {
  Pistol: 'Quiet. One shot drops a guard who has not noticed you.',
  Rifle: 'Loud and fast. Goes through doors.',
  Shotgun: 'Loud. Nine pellets: huge up close, useless far away.',
  Sniper: 'Loud. One heavy shot through doors, brick and people.',
  Rockets: 'Loud. Blasts a hole in anything that is not reinforced.',
  C4: 'Throw it, then press Q or right-click. Even breaks the steel vault.',
  Drill: 'Mostly quiet. Tunnels slowly through walls and floors.',
  Rope: 'Tie it at an edge and climb the outside of the building.',
  Drone: 'Quiet scout. Fly it with the move keys; click to blow it up, E to bring it back.',
  Smoke: 'Quiet. A cloud nobody can see through, you included.',
  Frag: 'Loud. Roll it down the stairs or round a corner.',
  Flash: 'Blinds and deafens anyone looking at it for a few seconds.',
}

function toolItems(): HelpItem[] {
  return TOOLS.map((tool) => ({ term: tool.name, text: TOOL_NOTES[tool.name] ?? '', tone: tool.quiet ? 'quiet' : 'loud' }))
}

/** The five site alert levels, worded as the HUD shows them, with what each one brings. */
export const ALERT_HELP: readonly HelpItem[] = [
  { term: '0  CALM', text: 'Normal patrols and routine radio check-ins.', tone: 'level0' },
  { term: '1  UNEASE', text: 'Something odd was noticed. Guards are jumpier and slower to relax.', tone: 'level1' },
  { term: '2  SEARCHING', text: 'An intruder is suspected. Squads search, guards hold stairs and posts, cameras sweep faster, elevators are called down and held.', tone: 'level2' },
  { term: '3  CONFIRMED', text: 'You were seen. The alarm rings, everyone hunts you and three armoured responders drive in.', tone: 'level3' },
  { term: '4  LOCKDOWN', text: 'The fight dragged on, you were seen with the case, or a blast went off. Elevators freeze where they are.', tone: 'level4' },
]

export const HELP_TABS: readonly HelpTab[] = [
  {
    title: 'The job',
    blocks: [
      { kind: 'text', text: 'Find the gold case, grab it, and get back to the van. The panel at the top right always says what to do next and where you are.' },
      { kind: 'list', items: [
        { term: 'Find it', text: 'The case is in the vault, deep in the building or below ground.' },
        { term: 'Grab it', text: 'Walk over it to pick it up.' },
        { term: 'Get out', text: 'Reach the van to win. Go down and the heist is over: press Enter for a new one.' },
      ] },
      { kind: 'heading', text: 'Quiet or loud' },
      { kind: 'list', items: [
        { term: 'Quiet', text: 'Pistol, takedowns from behind (E), lockpicks, the drill, smoke. Nobody hears, nobody calls it in.', tone: 'quiet' },
        { term: 'Loud', text: 'Rifles, rockets, C4, frags. Fast, but the whole block hears it and the site locks down.', tone: 'loud' },
      ] },
      { kind: 'example', text: 'Pick the front door lock, slip through the dark, drill down into the vault. Or blow the wall with a rocket and run.' },
      { kind: 'text', text: 'Either works. The end screen says which you were: GHOST, QUIET or LOUD.' },
    ],
  },
  {
    title: 'Being seen',
    blocks: [
      { kind: 'list', items: [
        { term: 'Sight', text: 'Each guard\'s torch beam shows what he can see. Walls, smoke and tall furniture block it.' },
        { term: 'Light', text: 'The HIDDEN / DIM / EXPOSED bar (top left) shows how lit you are. In the dark a guard only spots you up close. Crouch to be smaller.' },
        { term: 'Noise', text: 'Footsteps, doors, shots and blasts carry. Guards walk over to look. Crouch-walking is quieter.' },
        { term: 'Bodies', text: 'A guard who finds a body calls it in, and others get wary of that room.' },
        { term: 'Cameras', text: 'They sweep a room and report you to the control room. Shoot them out.' },
        { term: 'Radio', text: 'Guards check in by radio. One who misses his check-in gets noticed and someone comes to look.' },
      ] },
      { kind: 'example', text: 'Shoot out the lamp over a corridor, then crouch through the dark patch while the guard faces away.' },
      { kind: 'example', text: 'Take a guard down quietly, then keep moving: control will soon notice he has gone silent.' },
    ],
  },
  {
    title: 'Alert',
    blocks: [
      { kind: 'text', text: 'A guard who spots you radios the control room, and the site alert (top right) goes up a step. After a quiet spell it steps back down, but never all the way to calm.' },
      { kind: 'list', items: ALERT_HELP },
      { kind: 'example', text: 'Cut the radio relay and guards must run to an alarm button to raise it. Cut the power and they go to the fuse box first.' },
    ],
  },
  {
    title: 'Tools',
    blocks: [
      { kind: 'text', text: 'Number keys pick a tool; press 9 again for the frag and 7 again for the rope. Green slots are quiet, red are loud.' },
      { kind: 'list', items: toolItems() },
    ],
  },
  {
    title: 'The world',
    blocks: [
      { kind: 'text', text: 'Almost everything can be broken, moved or switched off. Things to try:' },
      { kind: 'list', items: [
        { term: 'Lights', text: 'Shoot out lamps to make dark places to hide in.' },
        { term: 'Doors', text: 'Drag a desk (hold G) against a door to block it, or under a hole to climb up.' },
        { term: 'Power', text: 'Cut the power at the fuse box: lights, cameras and alarms go dark.' },
        { term: 'Terminals', text: 'Hack a terminal (E), then pick with the number keys: kill cameras or lights on a floor, unlock doors, jam radios, call or hold elevators, find the vault.' },
        { term: 'Stairs', text: 'Blow a stair flight to stop guards following you up.' },
        { term: 'Elevators', text: 'Cut an elevator cable and the car drops, with whoever is in it.' },
        { term: 'Shields', text: 'Grab a guard from behind (hold G): his friends hold their fire.' },
        { term: 'Questions', text: 'Grab or corner someone and make them talk: people on site may know where the case is.' },
        { term: 'Floors', text: 'Blow out what holds a floor up and it comes down, with whoever stands on it.' },
        { term: 'Fire', text: 'Fuel drums and gas cylinders burn and explode. Sprinklers answer, and smoke hides you.' },
      ] },
    ],
  },
]
