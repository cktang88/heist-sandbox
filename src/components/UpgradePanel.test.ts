import { describe, expect, it } from 'vitest'
import { ALL_UPGRADES, STARTER_UPGRADES, UPGRADE_BRANCHES } from '../game/upgrades'
import { getUpgradeNodeVisualState, orderBranchNodes, orthogonalConnectorPath, UPGRADE_KIND_SYMBOLS } from './UpgradePanel'

describe('upgrade tree connectors', () => {
  it('draws a right-angle parent-to-child path that stops before the arrowhead', () => {
    expect(orthogonalConnectorPath(100, 50, 300, 150)).toBe('M 100 50 H 190 V 150 H 292')
  })

  it('keeps a usable elbow when nodes are close together', () => {
    expect(orthogonalConnectorPath(100, 50, 130, 80)).toBe('M 100 50 H 114 V 80 H 122')
  })

  it('orders dedicated unlocks after the stats that feed them', () => {
    const gunner = UPGRADE_BRANCHES.find((branch) => branch.id === 'gunner')!
    const ids = orderBranchNodes(gunner.nodes).map((node) => node.id)
    expect(ids.indexOf('gunner-03')).toBeLessThan(ids.indexOf('gunner-07'))
    expect(ids.indexOf('gunner-11')).toBeLessThan(ids.indexOf('gunner-09'))
  })

  it('separates blocked, unaffordable, available, and completed cards', () => {
    const damage = ALL_UPGRADES.find((node) => node.id === 'gunner-02')!
    const rapidFeed = ALL_UPGRADES.find((node) => node.id === 'gunner-07')!
    expect(getUpgradeNodeVisualState(STARTER_UPGRADES, 100, rapidFeed)).toBe('blocked')
    expect(getUpgradeNodeVisualState(STARTER_UPGRADES, 0, damage)).toBe('unaffordable')
    expect(getUpgradeNodeVisualState(STARTER_UPGRADES, 100, damage)).toBe('available')
    expect(getUpgradeNodeVisualState({ ...STARTER_UPGRADES, 'gunner-02': damage.rankCosts.length }, 0, damage)).toBe('maxed')
  })

  it('gives every upgrade category a distinct visual mark', () => {
    const symbols = Object.values(UPGRADE_KIND_SYMBOLS)
    expect(new Set(symbols).size).toBe(symbols.length)
  })
})
