import { describe, expect, it } from 'vitest'
import { actionIndex, HOTKEYS, toolForKey, toolIndex, TOOLS } from './toolDefs'

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
    expect(toolForKey(6, rope)).toBe(6)
    expect(toolForKey(2, 2)).toBe(2)
  })

  it('reads a number past the hotkeys as the key it wraps onto', () => {
    expect(toolForKey(10, 4)).toBe(0)
    expect(toolForKey(11, 4)).toBe(1)
  })
})
