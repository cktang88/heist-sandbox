import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ALL_UPGRADES, applyUpgrades, canPurchaseUpgrade, getNextRankCost, getPurchaseRequirements, getRank, isMaxRank, isUpgradeRequirementMet, ownsUpgrade, purchaseUpgrade, respecUpgrades, UPGRADE_BRANCHES, type UpgradeBranchId, type UpgradeId, type UpgradeNode, type UpgradeNodeKind, type UpgradeRequirement } from '../game/upgrades'
import type { SaveData } from '../game/save'
import type { GameTuning } from '../game/types'
import { ModalFrame } from './ModalFrame'

type UpgradeConnector = { childId: UpgradeId; requirement: UpgradeRequirement; path: string; tipX: number; tipY: number }

const NODE_KIND_LABELS: Record<UpgradeNodeKind, string> = {
  stat: '↑ STAT RANKS', tower: '▣ TOWER UNLOCK', variant: '◇ VARIANT UNLOCK',
  power: '⚡ POWER UNLOCK', wall: '▦ FORTIFICATION', doctrine: '◆ DOCTRINE UNLOCK',
}

export function orthogonalConnectorPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const bendX = Math.min(toX - 16, fromX + Math.max(24, (toX - fromX) * 0.45))
  return `M ${fromX} ${fromY} H ${bendX} V ${toY} H ${toX - 8}`
}

export function UpgradePanel({ save, tuning, onSave, onClose }: {
  save: SaveData
  tuning: GameTuning
  onSave: (save: SaveData) => void
  onClose: () => void
}) {
  const [branchId, setBranchId] = useState<UpgradeBranchId>('gunner')
  const branch = UPGRADE_BRANCHES.find((candidate) => candidate.id === branchId) ?? UPGRADE_BRANCHES[0]
  const effective = applyUpgrades(tuning, save.upgrades)
  const orderedNodes = useMemo(() => orderBranchNodes(branch.nodes), [branch])
  const depths = new Map<UpgradeId, number>()
  const depthOf = (node: UpgradeNode, visiting = new Set<UpgradeId>()): number => {
    const cached = depths.get(node.id)
    if (cached) return cached
    if (visiting.has(node.id)) return 1
    const nextVisiting = new Set(visiting).add(node.id)
    const parents = getPurchaseRequirements(node).map((requirement) => ALL_UPGRADES.find((candidate) => candidate.id === requirement.id)).filter((parent): parent is UpgradeNode => Boolean(parent))
    const depth = parents.length ? Math.max(...parents.map((parent) => depthOf(parent, nextVisiting))) + 1 : 1
    depths.set(node.id, depth)
    return depth
  }
  const maxDepth = Math.max(1, ...orderedNodes.map((node) => depthOf(node)))
  const treeRef = useRef<HTMLDivElement>(null)
  const [connectors, setConnectors] = useState<UpgradeConnector[]>([])

  useLayoutEffect(() => {
    const tree = treeRef.current
    if (!tree) return
    const measure = () => {
      const treeBounds = tree.getBoundingClientRect()
      const next = orderedNodes.flatMap<UpgradeConnector>((node) => getPurchaseRequirements(node).flatMap((requirement) => {
        const parent = tree.querySelector<HTMLElement>(`[data-upgrade-id="${requirement.id}"]`)
        const child = tree.querySelector<HTMLElement>(`[data-upgrade-id="${node.id}"]`)
        if (!parent || !child) return []
        const parentBounds = parent.getBoundingClientRect()
        const childBounds = child.getBoundingClientRect()
        const fromX = parentBounds.right - treeBounds.left
        const fromY = parentBounds.top + parentBounds.height / 2 - treeBounds.top
        const tipX = childBounds.left - treeBounds.left
        const tipY = childBounds.top + childBounds.height / 2 - treeBounds.top
        return [{ childId: node.id, requirement, path: orthogonalConnectorPath(fromX, fromY, tipX, tipY), tipX, tipY }]
      }))
      setConnectors(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(tree)
    for (const node of tree.querySelectorAll('.upgrade-node')) observer.observe(node)
    return () => observer.disconnect()
  }, [branch, orderedNodes])

  const commitPurchase = (id: UpgradeId) => {
    const result = purchaseUpgrade(save.upgrades, save.medals, id)
    if (result) onSave({ ...save, medals: result.medals, upgrades: result.ranks })
  }

  const respec = () => {
    const result = respecUpgrades(save.upgrades, save.medals)
    onSave({ ...save, medals: result.medals, upgrades: result.ranks })
  }

  return (
    <ModalFrame label="Field research" backdropClass="upgrade-backdrop" panelClass="upgrade-panel" onClose={onClose}>
        <header className="upgrade-header">
          <div><p className="eyebrow">ARMORY // {ALL_UPGRADES.length}-NODE RESEARCH TREE</p><h1>FIELD RESEARCH</h1></div>
          <div className="upgrade-wallet"><small>COMMAND MEDALS</small><strong>{save.medals}</strong></div>
          <button data-autofocus onClick={onClose} aria-label="Close field research">×</button>
        </header>
        <nav className="branch-tabs" aria-label="Upgrade branches">
          {UPGRADE_BRANCHES.map((candidate) => (
            <button key={candidate.id} className={candidate.id === branch.id ? 'selected' : ''} onClick={() => setBranchId(candidate.id)}>
              {candidate.name}<small>{candidate.nodes.filter((node) => ownsUpgrade(save.upgrades, node.id)).length}/{candidate.nodes.length}</small>
            </button>
          ))}
        </nav>
        {branch.id === 'gunner' && (
          <div className="effective-stats">
            <span>DAMAGE <b>{tuning.towers.gunner.damage.toFixed(1)} → {effective.towers.gunner.damage.toFixed(1)}</b></span>
            <span>FIRE RATE <b>{tuning.towers.gunner.shotsPerSecond.toFixed(2)} → {effective.towers.gunner.shotsPerSecond.toFixed(2)}</b></span>
            <span>RANGE <b>{tuning.towers.gunner.range.toFixed(1)} → {effective.towers.gunner.range.toFixed(1)}</b></span>
          </div>
        )}
        <div ref={treeRef} className="upgrade-tree" aria-label={`${branch.name} research graph`} style={{ gridTemplateColumns: `repeat(${maxDepth}, 190px)`, minWidth: maxDepth * 190 + (maxDepth - 1) * 70 + 36 }}>
          <svg className="upgrade-connectors" aria-hidden="true">
            {connectors.map((connector) => {
              const connected = isUpgradeRequirementMet(save.upgrades, connector.requirement)
              const className = connected ? 'connected' : ''
              return <g key={`${connector.requirement.id}:${connector.childId}`} className={className}>
                <path d={connector.path} />
                <polygon points={`${connector.tipX - 1},${connector.tipY} ${connector.tipX - 10},${connector.tipY - 5} ${connector.tipX - 10},${connector.tipY + 5}`} />
              </g>
            })}
          </svg>
          {orderedNodes.map((node, index) => {
            const rank = getRank(save.upgrades, node.id)
            const maxed = isMaxRank(save.upgrades, node)
            const available = canPurchaseUpgrade(save.upgrades, save.medals, node)
            const cost = getNextRankCost(save.upgrades, node)
            const requirements = getPurchaseRequirements(node)
            const requirementsMet = requirements.every((requirement) => isUpgradeRequirementMet(save.upgrades, requirement))
            return (
              <div
                className={`upgrade-step ${requirements.length ? 'has-prerequisite' : 'tree-root'} ${requirementsMet ? 'connected' : ''}`}
                key={node.id}
                style={{ gridColumn: depthOf(node), gridRow: index + 1 }}
              >
                <button
                  data-upgrade-id={node.id}
                  className={`upgrade-node node-${node.kind} ${maxed ? 'owned' : available ? 'available' : 'locked'}`}
                  onClick={() => commitPurchase(node.id)}
                  disabled={!available}
                >
                  <span>{node.id.toUpperCase()} · RANK {rank}/{node.rankCosts.length}</span>
                  <em className="upgrade-kind">{NODE_KIND_LABELS[node.kind]}</em>
                  <strong>{node.name}</strong>
                  <small>{node.effect}</small>
                  <b>{maxed ? 'MAXIMUM' : `${cost ?? 0} MEDALS`}</b>
                </button>
              </div>
            )
          })}
        </div>
        <footer className="upgrade-footer">
          <p>{branch.name} research. Arrow lines show dependencies; variant and doctrine cards open after every incoming requirement is complete.</p>
          <button className="secondary-button" onClick={respec}>FREE RESPEC</button>
          <button className="primary-button" onClick={onClose}>RETURN TO COMMAND</button>
        </footer>
    </ModalFrame>
  )
}

/** Keeps each root beside its descendants so independent chains do not visually cross. */
export function orderBranchNodes(nodes: readonly UpgradeNode[]): UpgradeNode[] {
  const children = new Map<UpgradeId, UpgradeNode[]>()
  for (const node of nodes) {
    const primaryParent = getPurchaseRequirements(node)[0]?.id
    if (!primaryParent) continue
    children.set(primaryParent, [...(children.get(primaryParent) ?? []), node])
  }
  const ordered: UpgradeNode[] = []
  const visited = new Set<UpgradeId>()
  const visit = (node: UpgradeNode) => {
    if (visited.has(node.id)) return
    visited.add(node.id)
    ordered.push(node)
    for (const child of children.get(node.id) ?? []) visit(child)
  }
  for (const root of nodes.filter((node) => getPurchaseRequirements(node).length === 0)) visit(root)
  for (const node of nodes) visit(node)
  return ordered
}
