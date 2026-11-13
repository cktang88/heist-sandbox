import { describe, expect, it } from 'vitest'
import { applyLoadout, carriedTools, DEFAULT_LOADOUT, GADGET_SLOTS, GADGETS, loadoutToolIndex, normalizeLoadout, parseLoadout, PRIMARIES, serializeLoadout, toggleGadget, type Loadout } from './loadout'
import { createPlayer } from './player'
import { actionIndex, toolForSelection, toolIndex, TOOLS, wheelSelection } from './toolDefs'

const SNIPER_KIT: Loadout = { primary: 'sniper', gadgets: ['dart', 'rope'] }

describe('loadout', () => {
  it('maps every pickable item to its own tool', () => {
    const indices = ['pistol' as const, ...PRIMARIES, ...GADGETS].map(loadoutToolIndex)
    expect(new Set(indices).size).toBe(indices.length)
    expect(indices.length).toBe(TOOLS.length)
    expect(loadoutToolIndex('dart')).toBe(actionIndex('dart'))
    expect(loadoutToolIndex('c4')).toBe(toolIndex('c4'))
  })

  it('has a valid default within the gadget limit', () => {
    expect(normalizeLoadout(DEFAULT_LOADOUT)).toEqual(DEFAULT_LOADOUT)
    expect(DEFAULT_LOADOUT.gadgets.length).toBeLessThanOrEqual(GADGET_SLOTS)
  })

  it('repairs a bad stored loadout and round-trips a good one', () => {
    expect(parseLoadout(null)).toEqual(DEFAULT_LOADOUT)
    expect(parseLoadout('not json')).toEqual(DEFAULT_LOADOUT)
    expect(parseLoadout('{"primary":"bazooka"}')).toEqual(DEFAULT_LOADOUT)
    expect(parseLoadout('{"primary":"shotgun","gadgets":["c4","c4","laser","smoke","flash","frag","rope"]}'))
      .toEqual({ primary: 'shotgun', gadgets: ['c4', 'smoke', 'flash', 'frag'] })
    expect(parseLoadout(serializeLoadout(SNIPER_KIT))).toEqual(SNIPER_KIT)
    expect(parseLoadout('{"primary":"rifle","gadgets":[]}')).toEqual({ primary: 'rifle', gadgets: [] })
  })

  it('adds gadgets up to the limit and removes them again', () => {
    let loadout: Loadout = { primary: 'rifle', gadgets: [] }
    for (const gadget of GADGETS) loadout = toggleGadget(loadout, gadget)
    expect(loadout.gadgets).toEqual(GADGETS.slice(0, GADGET_SLOTS))
    loadout = toggleGadget(loadout, GADGETS[0])
    expect(loadout.gadgets).not.toContain(GADGETS[0])
  })

  it('always carries the pistol, the primary and the gadgets, and nothing else', () => {
    const carried = carriedTools(SNIPER_KIT)
    const expected = [toolIndex('pistol'), toolIndex('sniper'), actionIndex('dart'), actionIndex('rope')]
    expect(carried.flatMap((has, index) => (has ? [index] : [])).sort()).toEqual(expected.sort())
  })

  it('carries the whole kit until a loadout is applied', () => {
    expect(createPlayer({ x: 0, y: 0 }).carried.every(Boolean)).toBe(true)
  })

  it('empties tools left behind and puts the pistol in hand', () => {
    const player = createPlayer({ x: 0, y: 0 })
    player.tool = toolIndex('c4')
    applyLoadout(player, SNIPER_KIT)
    expect(player.tool).toBe(toolIndex('pistol'))
    expect(player.ammo[toolIndex('c4')]).toBe(0)
    expect(player.ammo[toolIndex('rifle')]).toBe(0)
    expect(player.mags[toolIndex('rifle')]).toBe(0)
    expect(player.ammo[toolIndex('sniper')]).toBe(TOOLS[toolIndex('sniper')].ammo)
  })

  it('makes number keys and the wheel skip tools left behind', () => {
    const player = createPlayer({ x: 0, y: 0 })
    applyLoadout(player, SNIPER_KIT)
    const pistol = toolIndex('pistol')
    // Key 2 is the rifle: not carried, so nothing changes. Key 4 is the sniper.
    expect(toolForSelection(1, pistol, player.carried)).toBe(pistol)
    expect(toolForSelection(3, pistol, player.carried)).toBe(toolIndex('sniper'))
    // Key 1 swaps pistol and dart gun; key 7 holds only the rope.
    expect(toolForSelection(0, pistol, player.carried)).toBe(actionIndex('dart'))
    expect(toolForSelection(0, actionIndex('dart'), player.carried)).toBe(pistol)
    expect(toolForSelection(6, pistol, player.carried)).toBe(actionIndex('rope'))
    expect(toolForSelection(6, actionIndex('rope'), player.carried)).toBe(actionIndex('rope'))
    // Pistol, sniper, rope, dart, round again; and back the other way.
    expect(toolForSelection(wheelSelection(1), pistol, player.carried)).toBe(toolIndex('sniper'))
    expect(toolForSelection(wheelSelection(1), toolIndex('sniper'), player.carried)).toBe(actionIndex('rope'))
    expect(toolForSelection(wheelSelection(2), toolIndex('sniper'), player.carried)).toBe(actionIndex('dart'))
    expect(toolForSelection(wheelSelection(1), actionIndex('dart'), player.carried)).toBe(pistol)
    expect(toolForSelection(wheelSelection(-1), pistol, player.carried)).toBe(actionIndex('dart'))
  })
})
