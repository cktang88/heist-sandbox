import { DAMAGE_SOURCE_LABELS } from '../game/damageSources'
import { getDifficulty, getRunDifficulty } from '../game/difficulty'
import { calculateEndlessScore, type SaveData } from '../game/save'
import type { BattleSnapshot, RunRules } from '../game/types'
import { Status } from './Status'
import { ModalFrame } from './ModalFrame'

type ResultsReportProps = {
  phase: 'victory' | 'defeat'
  ranked: boolean
  run: RunRules
  snapshot: BattleSnapshot
  save: SaveData
  medalsEarned: number
  difficultyBonus: number
  newlyAffordableResearch: string[]
  surrendered: boolean
  primaryLabel: string
  onPrimary: () => void
  onArmory: () => void
  onSettings: () => void
}

export function ResultsReport(props: ResultsReportProps) {
  return (
    <ModalFrame label="After action report" backdropClass="modal-backdrop" panelClass={`result-card ${props.phase}`}>
        <p className="eyebrow">AFTER ACTION REPORT{!props.ranked ? ' // UNRANKED' : ''}</p>
        <h1>{props.surrendered ? 'ORDERED RETREAT' : props.run.mode === 'endless' ? 'HORDE ENDURED' : props.phase === 'victory' ? 'VALLEY HELD' : 'FORTRESS OVERRUN'}</h1>
        <p>{props.surrendered ? 'The garrison withdrew on command. Eliminations earned before the retreat still count.' : props.phase === 'victory' ? 'The last warhorn has gone quiet.' : 'The line broke—but the next defense will be stronger.'}</p>
        <div className="result-grid">
          <Status label="Eliminated" value={String(props.snapshot.enemiesDefeated)} />
          <Status label={props.run.mode === 'endless' ? 'Best Score' : 'Best Run'} value={String(props.run.mode === 'endless' ? props.save.bestEndlessScore : props.save.bestKills)} />
          <Status label="Total Medals" value={String(props.save.medals)} />
          <Status label="Earned" value={props.ranked ? `+${props.medalsEarned}` : '—'} />
          {(props.run.mode === 'campaign' || props.run.mode === 'endless') && (
            <Status label={`${getDifficulty(getRunDifficulty(props.run)).label} Bonus`} value={props.ranked ? `+${props.difficultyBonus}` : '—'} />
          )}
          {props.run.mode === 'endless' && <Status label="Run Score" value={String(calculateEndlessScore({ kills: props.snapshot.enemiesDefeated, wavesCleared: props.snapshot.wavesCleared, elapsedSeconds: props.snapshot.elapsedSeconds, baseHealth: props.snapshot.baseHealth }))} />}
          <Status label="Time Held" value={formatTime(props.snapshot.elapsedSeconds)} />
          <Status label="Waves Cleared" value={String(props.snapshot.wavesCleared)} />
          <Status label="Leaks" value={String(props.snapshot.leaks)} />
          <Status label="Fortress" value={`${props.snapshot.baseHealth}%`} />
          {props.snapshot.fortressShield > 0 && <Status label="Shield" value={String(props.snapshot.fortressShield)} />}
          {props.snapshot.secondaryObjectiveHealth !== null && <Status label="Supply Cache" value={props.snapshot.secondaryObjectiveHealth > 0 ? `SECURED +${props.snapshot.secondaryObjectiveBonusMedals}` : 'LOST'} />}
          {props.snapshot.waveRewardMultiplier !== 1 && <Status label="Wave Reward" value={`${props.snapshot.waveRewardMultiplier.toFixed(2)}×`} />}
        </div>
        {props.newlyAffordableResearch.length > 0 && (
          <div className="damage-report">
            <small>NEWLY AVAILABLE RESEARCH</small>
            <span><b>{props.newlyAffordableResearch.join(' · ')}</b><strong>ARMORY</strong></span>
          </div>
        )}
        <div className="damage-report">
          <small>DAMAGE BY SOURCE</small>
          {(Object.entries(props.snapshot.damageBySource) as [keyof typeof props.snapshot.damageBySource, number][])
            .filter(([, damage]) => damage > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([source, damage]) => <span key={source}><b>{DAMAGE_SOURCE_LABELS[source]}</b><strong>{Math.round(damage)}</strong></span>)}
          {!Object.values(props.snapshot.damageBySource).some((damage) => damage > 0) && <span><b>No damage recorded</b><strong>—</strong></span>}
        </div>
        <button className="primary-button" data-autofocus onClick={props.onPrimary}>{props.primaryLabel}</button>
        <button className="secondary-button result-armory" onClick={props.onArmory}>SPEND MEDALS</button>
        <button className="secondary-button result-armory" onClick={props.onSettings}>SETTINGS</button>
    </ModalFrame>
  )
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
