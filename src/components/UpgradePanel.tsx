import { useState } from 'react'
import { applyUpgrades, canPurchaseUpgrade, getNextRankCost, getPurchasePrerequisite, getRank, isMaxRank, ownsUpgrade, purchaseUpgrade, respecUpgrades, UPGRADE_BRANCHES, type UpgradeBranchId, type UpgradeId } from '../game/upgrades'
import type { SaveData } from '../game/save'
import type { GameTuning } from '../game/types'
import { ModalFrame } from './ModalFrame'

export function UpgradePanel({ save, tuning, onSave, onClose }: {
  save: SaveData
  tuning: GameTuning
  onSave: (save: SaveData) => void
  onClose: () => void
}) {
  const [branchId, setBranchId] = useState<UpgradeBranchId>('gunner')
  const branch = UPGRADE_BRANCHES.find((candidate) => candidate.id === branchId) ?? UPGRADE_BRANCHES[0]
  const effective = applyUpgrades(tuning, save.upgrades)

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
          <div><p className="eyebrow">ARMORY // 60-NODE RESEARCH TREE</p><h1>FIELD RESEARCH</h1></div>
          <div className="upgrade-wallet"><small>WAR MEDALS</small><strong>{save.medals}</strong></div>
          <button data-autofocus onClick={onClose} aria-label="Close field research">×</button>
        </header>
        <nav className="branch-tabs" aria-label="Upgrade branches">
          {UPGRADE_BRANCHES.map((candidate) => (
            <button key={candidate.id} className={candidate.id === branch.id ? 'selected' : ''} onClick={() => setBranchId(candidate.id)}>
              {candidate.name}<small>{candidate.nodes.filter((node) => ownsUpgrade(save.upgrades, node.id)).length}/6</small>
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
        <div className="upgrade-track">
          {branch.nodes.map((node, index) => {
            const rank = getRank(save.upgrades, node.id)
            const maxed = isMaxRank(save.upgrades, node)
            const available = canPurchaseUpgrade(save.upgrades, save.medals, node)
            const cost = getNextRankCost(save.upgrades, node)
            const prerequisite = getPurchasePrerequisite(node)
            const prerequisiteOwned = !prerequisite || ownsUpgrade(save.upgrades, prerequisite)
            return (
              <div className="upgrade-step" key={node.id}>
                {index > 0 && <div className={`upgrade-connector ${prerequisiteOwned ? 'owned' : ''}`} />}
                <button
                  className={`upgrade-node ${maxed ? 'owned' : available ? 'available' : 'locked'}`}
                  onClick={() => commitPurchase(node.id)}
                  disabled={!available}
                >
                  <span>{String(index + 1).padStart(2, '0')} · RANK {rank}/{node.rankCosts.length}</span>
                  <strong>{node.name}</strong>
                  <small>{node.effect}</small>
                  <b>{maxed ? 'MAXIMUM' : `${cost ?? 0} MEDALS`}</b>
                </button>
              </div>
            )
          })}
        </div>
        <footer className="upgrade-footer">
          <p>{branch.name} branch. Purchase each rank to unlock the next field improvement.</p>
          <button className="secondary-button" onClick={respec}>FREE RESPEC</button>
          <button className="primary-button" onClick={onClose}>RETURN TO COMMAND</button>
        </footer>
    </ModalFrame>
  )
}
