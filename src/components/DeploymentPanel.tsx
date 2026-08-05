import { BUILD, getBuildCost } from '../game/config'
import { getPlacementTargeting } from '../game/setupEditing'
import type { BuildTool, GameTuning, Placement, TargetingRule } from '../game/types'

const TARGETING_RULES: readonly { value: TargetingRule; label: string }[] = [
  { value: 'first', label: 'First' }, { value: 'closest', label: 'Closest' },
  { value: 'strongest', label: 'Strongest' }, { value: 'weakest', label: 'Weakest' },
  { value: 'densest', label: 'Densest' },
]

type DeploymentPanelProps = {
  remaining: number
  tuning: GameTuning
  tools: readonly BuildTool[]
  selectedTool: BuildTool
  placementCount: number
  selectedPlacement?: Placement
  movingPlacement: Placement | null
  canStart: boolean
  ranked: boolean
  unrankedReason: string | null
  canRestoreRanked: boolean
  onSelectTool: (tool: BuildTool) => void
  onSellSelected: () => void
  onMoveSelected: () => void
  onTargetingRule: (rule: TargetingRule) => void
  onUndo: () => void
  onClear: () => void
  onStart: () => void
  onRestoreRanked: () => void
}

export function DeploymentPanel(props: DeploymentPanelProps) {
  return (
    <aside className="build-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">PREPARATION</p><h2>DEPLOYMENT</h2></div>
        <div className="budget"><small>SUPPLY LEFT / START</small><strong>{props.remaining}</strong><span>/{props.tuning.budget}</span></div>
      </div>
      <p className="deployment-economy-note">Buy towers from your starting supply. During preparation, moving is free and every sale refunds the full price.</p>
      {(props.selectedPlacement || props.movingPlacement) && <section className="placement-editor">
        <div>
          <small>{props.movingPlacement ? 'MOVING' : 'SELECTED'}</small>
          <strong>{BUILD.items[(props.movingPlacement ?? props.selectedPlacement)!.kind].label}</strong>
        </div>
        {props.selectedPlacement && props.selectedPlacement.kind !== 'wall' && <label>
          TARGET
          <select value={getPlacementTargeting(props.selectedPlacement)} onChange={(event) => props.onTargetingRule(event.target.value as TargetingRule)}>
            {TARGETING_RULES.map((rule) => <option key={rule.value} value={rule.value}>{rule.label}</option>)}
          </select>
        </label>}
        {props.selectedPlacement && <button className="secondary-button" onClick={props.onMoveSelected}>MOVE · FREE</button>}
        {props.selectedPlacement && <button className="secondary-button danger-button" onClick={props.onSellSelected}>SELL · +{getBuildCost(props.selectedPlacement.kind, props.tuning)}</button>}
        {props.movingPlacement?.kind === 'wall' && <small>R · ROTATE 90°</small>}
      </section>}
      <div className="tool-list">
        {props.tools.map((tool, index) => (
          <button key={tool} className={`tool-card ${props.selectedTool === tool ? 'selected' : ''}`} onClick={() => props.onSelectTool(tool)} disabled={getBuildCost(tool, props.tuning) > props.remaining}>
            <span className="tool-number">0{index + 1}</span>
            <span><strong>{BUILD.items[tool].label}</strong><small>{BUILD.items[tool].hint}</small></span>
            <span className="tool-cost"><small>SUPPLY</small><b>{getBuildCost(tool, props.tuning)}</b></span>
          </button>
        ))}
      </div>
      <div className="build-actions">
        <button className="secondary-button" onClick={props.onUndo} disabled={!props.placementCount}>UNDO</button>
        <button className="secondary-button" onClick={props.onClear} disabled={!props.placementCount}>CLEAR</button>
        <button className="primary-button" onClick={props.onStart} disabled={!props.canStart}>START HORDE <kbd>SPACE</kbd></button>
      </div>
      {!props.canStart && <p className="panel-note">Place at least one weapon tower within the supply limit.</p>}
      {props.placementCount > 0 && <p className="panel-note">UNDO, CLEAR, and SELL restore 100% of setup costs.</p>}
      {!props.ranked && <section className="progression-lock-notice">
        <strong>NO COMMAND MEDALS THIS RUN</strong>
        <span>{props.unrankedReason}</span>
        {props.canRestoreRanked && <button className="secondary-button" onClick={props.onRestoreRanked}>RESTORE RANKED SETTINGS</button>}
      </section>}
    </aside>
  )
}
