import { describe, expect, it } from 'vitest'
import { TOOLS } from '../game/toolDefs'
import { CONTROLS } from './controls'

const rows = CONTROLS.flatMap((group) => group.rows)
const keyFor = (action: string) => rows.find((row) => row.action.startsWith(action))?.keys

describe('the controls table', () => {
  it('has the six groups in reading order', () => {
    expect(CONTROLS.map((group) => group.title)).toEqual(['Move', 'Combat', 'Tools', 'Close combat', 'Interact', 'System'])
  })

  it('lists every tool in the kit exactly once', () => {
    for (const tool of TOOLS) expect(rows.filter((row) => row.action.startsWith(tool.name)).length, tool.name).toBe(1)
  })

  it('puts the second-page tools on a double press of the key they share', () => {
    expect(keyFor('Frag')).toEqual(['9 9'])
    expect(keyFor('Rope')).toEqual(['7 7'])
    expect(keyFor('Flash')).toEqual(['0'])
    expect(keyFor('Pistol')).toEqual(['1'])
  })

  it('names the close combat, detonation, crouch, focus and menu keys', () => {
    expect(keyFor('Punch')).toEqual(['F'])
    expect(keyFor('Kick')).toEqual(['V'])
    expect(keyFor('Drag furniture')).toEqual(['Hold G'])
    expect(keyFor('Throw')).toEqual(['T'])
    expect(keyFor('Set off all planted C4')).toEqual(['Q', 'Right click'])
    expect(keyFor('Crouch')).toEqual(['C', 'Ctrl'])
    expect(keyFor('Focus')).toEqual(['Shift'])
    expect(keyFor('Pause')).toEqual(['Esc', 'P'])
    expect(keyFor('Help')).toEqual(['H'])
  })
})
