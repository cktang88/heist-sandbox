import { describe, expect, it } from 'vitest'
import { TOOLS } from '../game/toolDefs'
import { HELP_TABS, TOOL_NOTES } from './helpContent'

describe('the help screen', () => {
  it('has a line for every tool in the kit', () => {
    for (const tool of TOOLS) expect(TOOL_NOTES[tool.name], tool.name).toBeTruthy()
  })

  it('covers the goal, being seen, the alert levels, the tools and the world, in short tabs', () => {
    expect(HELP_TABS.map((tab) => tab.title)).toEqual(['The job', 'Being seen', 'Alert', 'Tools', 'The world'])
    for (const tab of HELP_TABS) expect(tab.blocks.length, tab.title).toBeLessThanOrEqual(8)
  })

  it('describes all five alert levels in order', () => {
    const alert = HELP_TABS.find((tab) => tab.title === 'Alert')!
    const list = alert.blocks.find((block) => block.kind === 'list')
    expect(list?.kind === 'list' && list.items.map((item) => item.term.split(/\s+/)[0])).toEqual(['0', '1', '2', '3', '4'])
  })
})
