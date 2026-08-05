import type { Loadout } from '../game/loadout'
import type { GamePhase } from '../game/types'
import { getGuidance } from '../game/guidance'
import { ModalFrame } from './ModalFrame'

export function HelpPanel({ phase, loadout, onClose }: { phase: GamePhase; loadout: Loadout; onClose: () => void }) {
  const guidance = getGuidance(phase, loadout)
  return (
    <ModalFrame label={guidance.title} backdropClass="help-backdrop" panelClass="help-panel" onClose={onClose}>
      <p className="eyebrow">{guidance.eyebrow}</p>
      <h1>{guidance.title}</h1>
      <ol>{guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <p className="help-hint">Keyboard: <kbd>Space</kbd> start/pause · <kbd>Esc</kbd> cancel/close · <kbd>`</kbd> tuning</p>
      <button className="primary-button" data-autofocus onClick={onClose}>RETURN TO COMMAND</button>
    </ModalFrame>
  )
}
