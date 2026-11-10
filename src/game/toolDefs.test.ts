import { describe, expect, it } from 'vitest'
import { actionIndex, HOTKEYS, toolForKey, toolForSelection, toolIndex, TOOLS, wheelSelection } from './toolDefs'

describe('tool keys', () => {
  it('keeps the first ten tools on keys 1-9 and 0', () => {
    expect(TOOLS.slice(0, HOTKEYS).map((tool) => tool.id)).toEqual(['pistol', 'rifle', 'shotgun', 'sniper', 'rocket', 'c4', 'drill', 'drone', 'smoke', 'flash'])
    expect(toolIndex('flash')).toBe(9)
    expect(toolIndex('c4')).toBe(5)
    for (let key = 0; key < HOTKEYS; key += 1) expect(toolForKey(key, 0 === key ? 1 : 0)).toBe(key)
  })

  it('swaps to the second tool on a key when that key is pressed again', () => {
    const frag = actionIndex('frag')
    const rope = actionIndex('rope')
    expect(toolForKey(8, 8)).toBe(frag)
    expect(toolForKey(8, frag)).toBe(8)
    expect(toolForKey(6, 6)).toBe(rope)
    expect(toolForKey(6, rope)).toBe(actionIndex('grapple'))
    expect(toolForKey(6, actionIndex('grapple'))).toBe(6)
    expect(toolForKey(2, 2)).toBe(2)
  })

  it('steps the wheel through every tool, second page included, and wraps round', () => {
    expect(toolForSelection(wheelSelection(1), 9)).toBe(actionIndex('frag'))
    expect(toolForSelection(wheelSelection(1), actionIndex('frag'))).toBe(actionIndex('rope'))
    expect(toolForSelection(wheelSelection(1), actionIndex('rope'))).toBe(actionIndex('grapple'))
    expect(toolForSelection(wheelSelection(1), actionIndex('grapple'))).toBe(0)
    expect(toolForSelection(wheelSelection(-1), 0)).toBe(TOOLS.length - 1)
    expect(toolForSelection(wheelSelection(2), 3)).toBe(5)
  })

  it('never reads a wheel step as a hotkey', () => {
    for (let steps = -TOOLS.length; steps <= TOOLS.length; steps += 1) expect(wheelSelection(steps)).toBeGreaterThanOrEqual(HOTKEYS)
    expect(toolForSelection(4, 0)).toBe(4)
  })
})
