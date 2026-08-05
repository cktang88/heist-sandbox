import { describe, expect, it } from 'vitest'
import { UPGRADE_BRANCHES } from '../game/upgrades'
import { orderBranchNodes, orthogonalConnectorPath } from './UpgradePanel'

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
})
