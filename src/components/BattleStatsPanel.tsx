import { DAMAGE_SOURCE_LABELS } from '../game/damageSources'
import type { BattleSnapshot } from '../game/types'

export function BattleStatsPanel({ snapshot, onClose }: { snapshot: BattleSnapshot; onClose: () => void }) {
  const damage = (Object.entries(snapshot.damageBySource) as [keyof typeof snapshot.damageBySource, number][]) 
    .filter(([, amount]) => amount > 0)
    .sort((left, right) => right[1] - left[1])
  return (
    <aside className="battle-stats" aria-label="Live battle statistics">
      <header><div><p className="eyebrow">LIVE TELEMETRY</p><h2>BATTLE STATS</h2></div><button onClick={onClose} aria-label="Close statistics">×</button></header>
      <div className="battle-stats-grid">
        <span><small>ELIMINATED</small><b>{snapshot.enemiesDefeated}</b></span>
        <span><small>ACTIVE</small><b>{snapshot.enemiesAlive}</b></span>
        <span><small>WAVES</small><b>{snapshot.wavesCleared}</b></span>
        <span><small>LEAKS</small><b>{snapshot.leaks}</b></span>
        <span><small>FORTRESS</small><b>{snapshot.baseHealth}%</b></span>
      </div>
      <div className="battle-stats-damage">
        {damage.map(([source, amount]) => <span key={source}><b>{DAMAGE_SOURCE_LABELS[source]}</b><strong>{Math.round(amount)}</strong></span>)}
        {!damage.length && <small>Damage telemetry appears after the first hit.</small>}
      </div>
      <small className="battle-stats-hint">TAB closes · 1–3 powers · +/− speed</small>
    </aside>
  )
}
