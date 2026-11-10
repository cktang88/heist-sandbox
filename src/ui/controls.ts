/**
 * Every control in the game, in one table, so the controls screen cannot drift from what the keys do.
 * Each row lists alternative keys; a key written with a space ("9 9") means press it twice.
 */
import { TOOLS } from '../game/toolDefs'

export type ControlRow = { keys: readonly string[]; action: string }
export type ControlGroup = { title: string; rows: readonly ControlRow[] }

/**
 * The tool keys, read from the kit itself: first-page tools sit on 1-9 then 0, and a second-page tool shares
 * the key of its `slot`, reached by pressing that key again.
 */
function toolRows(): ControlRow[] {
  const keyOf = (index: number) => String((index + 1) % 10)
  const rows = TOOLS.map((tool, index) => {
    const slot = tool.slot ?? index
    const key = keyOf(slot)
    const row = tool.slot === undefined ? { keys: [key], action: tool.name } : { keys: [`${key} ${key}`], action: `${tool.name} (press ${key} again)` }
    return { row, order: slot * 2 + (tool.slot === undefined ? 0 : 1) }
  })
  return rows.sort((a, b) => a.order - b.order).map(({ row }) => row)
}

export const CONTROLS: readonly ControlGroup[] = [
  {
    title: 'Move',
    rows: [
      { keys: ['A', 'D'], action: 'Walk left / right (arrow keys work too)' },
      { keys: ['W', 'S'], action: 'Climb ladders, stairs and ropes; ride elevators' },
      { keys: ['Space'], action: 'Jump; tap again in the air to double jump; grabs ledges' },
      { keys: ['Hold Space'], action: 'Open the parachute while falling' },
      { keys: ['C', 'Ctrl'], action: 'Crouch: quieter, hides behind low cover; slide when running' },
    ],
  },
  {
    title: 'Combat',
    rows: [
      { keys: ['Mouse'], action: 'Aim' },
      { keys: ['Left click'], action: 'Fire or use the tool in hand' },
      { keys: ['R'], action: 'Reload' },
      { keys: ['Q', 'Right click'], action: 'Set off all planted C4' },
      { keys: ['Shift'], action: 'Focus: slow motion, slowest when you hold still' },
    ],
  },
  {
    title: 'Tools',
    rows: [
      ...toolRows(),
      { keys: ['Wheel'], action: 'Step through the tools' },
    ],
  },
  {
    title: 'Close combat',
    rows: [
      { keys: ['F'], action: 'Punch' },
      { keys: ['V'], action: 'Kick: also tips tables and bursts doors' },
      { keys: ['Hold G'], action: 'Drag furniture, or hold a guard from behind as a shield' },
      { keys: ['T'], action: 'Throw the nearest small object where you aim' },
    ],
  },
  {
    title: 'Stealth',
    rows: [
      { keys: ['E'], action: 'Behind an unaware guard (or in the dark): quick kill. Small sound, leaves blood' },
      { keys: ['C + hold E'], action: 'Crouched behind him: choke him out silently (wakes in a few minutes unless tied up)' },
      { keys: ['Hold E'], action: 'From the front: wrestle him down (loud). A startled guard: choke him NOW, before he reports' },
      { keys: ['G'], action: 'Pick up a body (dead, out cold or tied); G again puts it down' },
      { keys: ['T'], action: 'While carrying: throw the body (off a ledge, down a shaft)' },
      { keys: ['E'], action: 'While carrying: hide the body in a locker, wardrobe, stall, dumpster, fridge, car boot or under a desk' },
      { keys: ['E'], action: 'Hide in a locker, wardrobe or stall, or crawl under a desk or bed; E again to get out or grab a passer-by' },
      { keys: ['E', 'Hold E'], action: 'On a body: tie him up, take his keycard, his radio, his uniform (a disguise)' },
      { keys: ['E'], action: 'When a pocketed radio is called: answer for its owner (a couple of times)' },
      { keys: ['C + E'], action: 'At a door: ease it open silently. At a fuse box: rig the breaker to trip later' },
      { keys: ['X'], action: 'Whistle or knock: pulls the nearest guard over (guards lured too often get wary)' },
      { keys: ['E'], action: 'At a TV, screen, vending or arcade machine: switch it on to pull a guard over' },
    ],
  },
  {
    title: 'Interact',
    rows: [
      { keys: ['E'], action: 'Use what is in reach: pick locks, take down, hack, cut wires, switches, call elevators' },
      { keys: ['E'], action: 'While flying the drone: bring it back' },
      { keys: ['1-9'], action: 'Choose an option on a hacked terminal' },
    ],
  },
  {
    title: 'System',
    rows: [
      { keys: ['Esc', 'P'], action: 'Pause menu' },
      { keys: ['H'], action: 'Help' },
      { keys: ['K', 'F1'], action: 'This controls list' },
      { keys: ['Enter'], action: 'New heist after winning or losing' },
    ],
  },
]
