import { useState } from 'react'
import { BUILD, getCombatPowerLabel } from '../game/config'
import { DIFFICULTIES } from '../game/difficulty'
import { COMMANDER_DOCTRINES, isCommanderDoctrineUnlocked, type CommanderDoctrine, type Loadout } from '../game/loadout'
import { CAMPAIGN_MISSIONS, CHALLENGES, findChallenge, isMissionUnlocked, missionForMap } from '../game/runs'
import type { CombatPower, DifficultyTier, GameMode, MapDefinition, TowerKind } from '../game/types'
import type { TowerVariantId } from '../game/types'
import type { TowerVariantSelections } from '../game/variantSelection'
import type { UpgradeRanks } from '../game/upgrades'
import { MapLibraryPanel } from './MapLibraryPanel'
import { ModalFrame } from './ModalFrame'
import { TowerVariantPicker } from './TowerVariantPicker'

type BriefingPanelProps = {
  mode: GameMode
  difficulty: DifficultyTier
  challengeId: string
  map: MapDefinition
  availableMaps: readonly MapDefinition[]
  completedMissionIds: readonly string[]
  completedChallengeIds: readonly string[]
  fixedArsenal: boolean
  powersDisabled: boolean
  emptyDeploymentAllowed: boolean
  selectedLoadout: Loadout
  resolvedLoadout: Loadout
  towerOptions: readonly TowerKind[]
  powerOptions: readonly CombatPower[]
  towerSlotLimit: number
  powerSlotLimit: number
  variantSelections: TowerVariantSelections
  upgradeRanks: UpgradeRanks
  onSelectMode: (mode: GameMode) => void
  onSelectDifficulty: (difficulty: DifficultyTier) => void
  onSelectChallenge: (id: string) => void
  onSelectMap: (map: MapDefinition) => void
  onToggleTower: (tower: TowerKind) => void
  onTogglePower: (power: CombatPower) => void
  onSelectTowerVariant: (tower: TowerKind, variantId: TowerVariantId | undefined) => void
  onSelectDoctrine: (doctrine: CommanderDoctrine | null) => void
  onNewMap: () => void
  onDuplicateMap: () => void
  onRenameMap: (name: string) => void
  onDeleteMap: () => void
  onEditMap: () => void
  onOpenMap: () => void
  onOpenArmory: () => void
  onOpenSettings: () => void
  onOpenHelp: () => void
}

type BriefingTab = 'operation' | 'battlefield' | 'arsenal'

export function BriefingPanel(props: BriefingPanelProps) {
  const [activeTab, setActiveTab] = useState<BriefingTab>('operation')
  const title = props.mode === 'challenge' ? findChallenge(props.challengeId)?.title : props.map.name
  const mission = missionForMap(props.map.id)
  const reportNumber = Math.max(1, CAMPAIGN_MISSIONS.findIndex((candidate) => candidate.mapId === props.map.id) + 1)
  const primaryOrder = props.mode === 'endless' ? 'HOLD UNTIL OVERRUN' : `HOLD ${mission?.waves.length ?? 5} WAVES`
  const difficultyLabel = DIFFICULTIES.find((candidate) => candidate.id === props.difficulty)?.label ?? props.difficulty
  const operationSummary = props.mode === 'campaign' || props.mode === 'endless' ? `${props.mode} · ${difficultyLabel}` : props.mode
  const arsenalSummary = `${props.resolvedLoadout.towers.length}/${props.towerSlotLimit} towers · ${props.resolvedLoadout.powers.length}/${props.powerSlotLimit} commands`
  return (
    <ModalFrame label="Mission briefing" backdropClass="modal-backdrop" panelClass="briefing-card">
        <header className="briefing-identity">
          <div><p className="eyebrow">FIELD REPORT // {String(reportNumber).padStart(3, '0')}</p><h1>{title?.toUpperCase()}</h1></div>
          <div className="briefing-order"><small>PRIMARY ORDER</small><strong>{primaryOrder}</strong></div>
        </header>
        <p className="briefing-summary">{props.emptyDeploymentAllowed
          ? 'A horde is crossing the valley. This operation begins with an empty field; use the loaned battlefield powers to hold it.'
          : 'A horde is crossing the valley. Buy towers with your starting supply before they arrive. Once the horn sounds, every emplacement is locked.'}</p>
        <nav className="briefing-tabs" role="tablist" aria-label="Mission briefing sections">
          {([
            ['operation', 'OPERATION', operationSummary],
            ['battlefield', 'BATTLEFIELD', props.map.name],
            ['arsenal', 'ARSENAL', arsenalSummary],
          ] as const).map(([id, label, summary]) => <button
            key={id}
            id={`briefing-tab-${id}`}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`briefing-panel-${id}`}
            className={activeTab === id ? 'selected' : ''}
            onClick={() => setActiveTab(id)}
          ><b>{label}</b><small>{summary}</small></button>)}
        </nav>
        {activeTab === 'operation' && <section id="briefing-panel-operation" role="tabpanel" aria-labelledby="briefing-tab-operation" className="briefing-tab-panel operation-section">
          <div className="operation-grid">
            <div className="operation-choice-group"><small>MODE</small><div className="mode-choices" aria-label="Choose game mode">
              {(['campaign', 'endless', 'challenge', 'sandbox'] as const).map((mode) => <button key={mode} className={props.mode === mode ? 'selected' : ''} aria-pressed={props.mode === mode} onClick={() => props.onSelectMode(mode)}>{mode === 'challenge' ? 'CHALLENGES' : mode.toUpperCase()}</button>)}
            </div></div>
            {(props.mode === 'campaign' || props.mode === 'endless') && (
              <div className="operation-choice-group"><small>THREAT</small><div className="difficulty-choices" aria-label="Choose difficulty">
                {DIFFICULTIES.map((difficulty) => (
                  <button key={difficulty.id} className={props.difficulty === difficulty.id ? 'selected' : ''} aria-pressed={props.difficulty === difficulty.id} onClick={() => props.onSelectDifficulty(difficulty.id)}>
                    <b>{difficulty.label}</b><small>{difficulty.description}</small>
                  </button>
                ))}
              </div></div>
            )}
          </div>
        </section>}
        {activeTab === 'battlefield' && <section id="briefing-panel-battlefield" role="tabpanel" aria-labelledby="briefing-tab-battlefield" className="briefing-tab-panel battlefield-section">
          {props.mode === 'sandbox' ? (
            <MapLibraryPanel
              maps={props.availableMaps}
              selectedMap={props.map}
              onSelect={props.onSelectMap}
              onNew={props.onNewMap}
              onDuplicate={props.onDuplicateMap}
              onRename={props.onRenameMap}
              onDelete={props.onDeleteMap}
              onEdit={props.onEditMap}
              onPlay={props.onOpenMap}
            />
          ) : <BattlefieldChoices {...props} />}
        </section>}
        {activeTab === 'arsenal' && <section id="briefing-panel-arsenal" role="tabpanel" aria-labelledby="briefing-tab-arsenal" className="briefing-tab-panel arsenal-section"><LoadoutChoices {...props} /></section>}
        <footer className="briefing-actions">
          <button className="primary-button" onClick={props.onOpenMap}>DEPLOY TO BATTLE MAP <span aria-hidden="true">→</span></button>
          <nav aria-label="Command support"><button className="secondary-button" onClick={props.onOpenArmory}>FIELD RESEARCH</button><button className="secondary-button" onClick={props.onOpenSettings}>SETTINGS</button><button className="secondary-button" onClick={props.onOpenHelp}>HELP</button></nav>
        </footer>
    </ModalFrame>
  )
}

function BattlefieldChoices(props: BriefingPanelProps) {
  return <div className="map-choices" aria-label="Choose battlefield">
    {props.mode === 'challenge' ? CHALLENGES.map((challenge, index) => (
      <button key={challenge.id} className={challenge.id === props.challengeId ? 'selected' : ''} onClick={() => props.onSelectChallenge(challenge.id)}>
        <b className="map-order">{String(index + 1).padStart(2, '0')}</b><span><strong>{challenge.title}</strong><small>{challenge.description}</small></span>{props.completedChallengeIds.includes(challenge.id) && <i aria-label="Completed">✓</i>}
      </button>
    )) : props.availableMaps.filter((choice) => {
      const mission = missionForMap(choice.id)
      return Boolean(mission && (props.mode === 'campaign' || isMissionUnlocked(props.completedMissionIds, mission.id)))
    }).map((choice, index) => {
      const mission = missionForMap(choice.id)!
      const locked = props.mode === 'campaign' && !isMissionUnlocked(props.completedMissionIds, mission.id)
      const segments = choice.paths.reduce((sum, lane) => sum + lane.length - 1, 0)
      return <button key={choice.id} className={choice.id === props.map.id ? 'selected' : ''} onClick={() => props.onSelectMap(choice)} disabled={locked}>
        <b className="map-order">{String(index + 1).padStart(2, '0')}</b><span><strong>{choice.name}</strong><small>{locked ? 'Complete the prior mission' : choice.navigationMode === 'open'
          ? `${choice.paths.length} spawn regions · open field`
          : `${choice.paths.length} ${choice.paths.length === 1 ? 'lane' : 'lanes'} · ${segments} segments`}</small></span>{locked && <i aria-hidden="true">▧</i>}
      </button>
    })}
  </div>
}

function LoadoutChoices(props: BriefingPanelProps) {
  return <div className="loadout-picker" aria-label="Choose run loadout">
    <section>
      <header><b>TOWERS</b><small>{props.fixedArsenal ? 'FIXED' : `${props.selectedLoadout.towers.length}/${props.towerSlotLimit}`}</small></header>
      <div className="loadout-options">
        {props.towerOptions.map((tower) => {
          const selected = props.resolvedLoadout.towers.includes(tower)
          return <button key={tower} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={props.fixedArsenal || (!selected && props.selectedLoadout.towers.length >= props.towerSlotLimit)} onClick={() => props.onToggleTower(tower)}>{BUILD.items[tower].label}{selected && <span className="selection-seal" aria-hidden="true">✓</span>}</button>
        })}
        {!props.towerOptions.length && <p className="loadout-empty">This operation deploys without towers.</p>}
      </div>
      {!!props.resolvedLoadout.towers.length && <div className="loadout-variants">
        <p>FIRING PROFILES <small>Saved separately for this operation</small></p>
        {props.resolvedLoadout.towers.map((tower) => <TowerVariantPicker
          key={tower}
          tower={tower}
          ranks={props.upgradeRanks}
          selectedVariantId={props.variantSelections[tower]}
          onChange={props.onSelectTowerVariant}
        />)}
      </div>}
    </section>
    <section>
      <header><b>COMBAT POWERS</b><small>{props.powersDisabled ? 'DISABLED' : props.fixedArsenal ? 'FIXED' : `${props.selectedLoadout.powers.length}/${props.powerSlotLimit}`}</small></header>
      {props.powersDisabled ? <p className="loadout-empty">This operation forbids battlefield powers.</p> : <div className="loadout-options">
        {props.powerOptions.map((power) => {
          const selected = props.resolvedLoadout.powers.includes(power)
          return <button key={power} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={props.fixedArsenal || (!selected && props.selectedLoadout.powers.length >= props.powerSlotLimit)} onClick={() => props.onTogglePower(power)}>{getCombatPowerLabel(power)}</button>
        })}
        {!props.powerOptions.length && <p className="loadout-empty">Research battlefield powers in the Armory.</p>}
      </div>}
    </section>
    <section className="doctrine-slot">
      <header><b>COMMANDER DOCTRINE</b></header>
      <div className="loadout-options">
        {COMMANDER_DOCTRINES.map((doctrine) => {
          const selected = props.selectedLoadout.doctrine === doctrine.id
          const unlocked = isCommanderDoctrineUnlocked(props.upgradeRanks, doctrine.id)
          return <button
            key={doctrine.id}
            className={selected ? 'selected' : ''}
            aria-pressed={selected}
            disabled={!unlocked}
            onClick={() => props.onSelectDoctrine(selected ? null : doctrine.id)}
            aria-label={`${doctrine.name}${unlocked ? '' : ', locked'}`}
          ><span className="doctrine-name">{!unlocked && <span className="lock-seal" aria-hidden="true">▧</span>}{doctrine.name.toUpperCase()}</span><small>{unlocked ? doctrine.effect : `Research ${doctrine.researchName}`}</small></button>
        })}
      </div>
    </section>
  </div>
}
