import { TOOLS } from '../game/toolDefs'
import { morePressesLine } from './controls'

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
  Grapple: 'Fire a hook at a wall or roof edge, reel up with W, swing with A and D. E at a window breaks in.',
  Drone: 'Quiet scout. Fly it with the move keys; click to blow it up, E to bring it back.',
  Smoke: 'Quiet. A cloud nobody can see through, you included.',
  Frag: 'Loud. Roll it down the stairs or round a corner.',
  Flash: 'Blinds and deafens anyone looking at it for a few seconds.',
  'Dart gun': 'Near silent. The man staggers for a few seconds, then sleeps for minutes. Armour stops it.',
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
        { term: 'Find it', text: 'Nobody tells you where it is: the vault, an executive safe, a lab, a store room or the armoury. Make guards talk, read notes, hack computers, listen in. The Intel panel keeps what you learn and an arrow points at the search area.' },
        { term: 'Grab it', text: 'Walk over it to pick it up.' },
        { term: 'Get out', text: 'Reach the van to win. Go down and the heist is over: press Enter for a new one.' },
      ] },
      { kind: 'heading', text: 'Quiet or loud' },
      { kind: 'list', items: [
        { term: 'Quiet', text: 'Pistol, darts, takedowns and chokes from behind (E), hiding bodies, lockpicks, the drill, smoke. Nobody hears, nobody calls it in.', tone: 'quiet' },
        { term: 'Loud', text: 'Rifles, rockets, C4, frags. Fast, but the whole block hears it and the site locks down.', tone: 'loud' },
      ] },
      { kind: 'example', text: 'Pick the front door lock, slip through the dark, drill down into the vault. Or blow the wall with a rocket and run.' },
      { kind: 'text', text: 'Either works. The end screen says which you were: GHOST, SILENT or LOUD.' },
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
    title: 'Stealth',
    blocks: [
      { kind: 'text', text: 'Many quiet ways through. The tags under your health say why you are or are not being seen: IN DARKNESS, IN COVER, DISGUISED, NOISY.' },
      { kind: 'list', items: [
        { term: 'Takedowns', text: 'Behind an unaware guard, E is a quick kill (a small sound and blood). Crouch and hold E to choke him out silently; he wakes in a few minutes unless you tie him up. From the front it is a loud wrestle; armoured heavies cannot be grabbed from the front.', tone: 'quiet' },
        { term: 'The surprise window', text: 'A lone guard who walks into you at arm\'s length freezes for a beat (a ring shrinks over his head). Choke, punch or grab him before it runs out and nobody hears of it. Veterans and officers recover faster; a second guard watching means no window.' },
        { term: 'Bodies', text: 'G picks a body up and puts it down; T throws it. Carrying, you walk slowly with only the pistol. Bodies lying in sight are found, by the same rules of light and cover that hide you.' },
        { term: 'Hiding bodies', text: 'E stuffs a carried body into a locker, wardrobe, stall, dumpster, fridge, car boot, under a desk or bed, or behind tall shelves in the dark. Calm patrols walk past; searchers on a raised alert open hiding places near where they search. Blood leads them there too.' },
        { term: 'Hiding yourself', text: 'E to get into a locker, wardrobe or stall, or crawl under a desk. A guard who saw you get in comes to open it. E again to get out, or to grab a guard walking past.' },
        { term: 'Hands up', text: 'Aim a gun at a guard within seven tiles and press X to shout. A lone guard caught off guard or a frightened guard drops his weapon and raises his hands. Confident guards with backup may fight. Tie him up with E before leaving him.' },
        { term: 'Interrogation', text: 'Get close to an awake guard you have tied up or are holding as a shield, then hold E until he answers. On a surrendered guard, press E to tie him first, then hold E. Unconscious guards cannot talk. Each guard gives one clue.' },
        { term: 'Radios', text: 'Take a downed guard\'s radio (hold E). When control calls him, answer for him. A couple of bluffs work; then control sends someone.' },
        { term: 'Disguise', text: 'Put on a downed guard\'s uniform. You pass as one of them, even up close and to officers. Hostile actions, jumping, sliding, climbing, carrying a body, a big gun out or entering a restricted room without officer rank expose you.' },
        { term: 'Keycards', text: 'Officers and operators carry one. Crouch behind one and hold E to lift it, or take it from his body. Swipe it at keypad doors.' },
        { term: 'Lures', text: 'X whistles; a TV or vending machine switched on (E) pulls a guard over to switch it off. Lure the same area twice and they come in pairs.' },
        { term: 'Sabotage', text: 'Crouch at a fuse box and hold E to rig the breaker: the lights die on a timer while you are elsewhere. Loop the camera feeds from a terminal: unlike a cut cable, nobody notices until the loop runs out.' },
        { term: 'Quiet moves', text: 'Crouch to move silently, ease doors open crouched (E), crawl through ducts. The dart gun (press 1 twice) puts a man to sleep after a few seconds.' },
      ] },
      { kind: 'example', text: 'Whistle from inside a locker; when the guard walks past the door, burst out and choke him, then stuff him in the locker and take his uniform.' },
      { kind: 'text', text: 'The end screen rates the run: GHOST (never seen, nobody dead, nothing found), SILENT (the alarm never rang) or LOUD.' },
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
      { kind: 'text', text: `Number keys pick a tool; press a key again for the tool it shares (${morePressesLine()}). Green slots are quiet, red are loud.` },
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
