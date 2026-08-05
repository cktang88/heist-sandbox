import { BUILD, getCombatPowerLabel } from '../game/config'
import { DIFFICULTIES } from '../game/difficulty'
import type { Loadout } from '../game/loadout'
import { COMMANDER_DOCTRINE } from '../game/loadout'
import { CHALLENGES, findChallenge, isMissionUnlocked, missionForMap } from '../game/runs'
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
  onToggleDoctrine: () => void
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

export function BriefingPanel(props: BriefingPanelProps) {
  const title = props.mode === 'challenge' ? findChallenge(props.challengeId)?.title : props.map.name
  return (
    <ModalFrame label="Mission briefing" backdropClass="modal-backdrop" panelClass="briefing-card">
        <p className="eyebrow">FIELD REPORT // 001</p>
        <h1>{title?.toUpperCase()}</h1>
        <p>{props.emptyDeploymentAllowed
          ? 'A horde is crossing the valley. This operation begins with an empty field; use the loaned battlefield powers to hold it.'
          : 'A horde is crossing the valley. Buy towers with your starting supply before they arrive. Once the horn sounds, every emplacement is locked.'}</p>
        <div className="briefing-rules">
          <span><b>01</b> {props.emptyDeploymentAllowed ? 'Deploy without towers' : 'Tower prices and starting supply are shown on the battle map'}</span>
          <span><b>02</b> {props.resolvedLoadout.powers.includes('wall')
            ? 'Use temporary walls during the battle'
            : props.resolvedLoadout.powers.length ? 'Use equipped commands during the battle' : 'Rely on the deployed defense line'}</span>
          <span><b>03</b> {props.mode === 'endless' ? 'Hold until the fortress falls' : 'Hold through five waves'}</span>
        </div>
        <div className="mode-choices" aria-label="Choose game mode">
          <button className={props.mode === 'campaign' ? 'selected' : ''} onClick={() => props.onSelectMode('campaign')}>CAMPAIGN</button>
          <button className={props.mode === 'endless' ? 'selected' : ''} onClick={() => props.onSelectMode('endless')}>ENDLESS</button>
          <button className={props.mode === 'challenge' ? 'selected' : ''} onClick={() => props.onSelectMode('challenge')}>CHALLENGES</button>
          <button className={props.mode === 'sandbox' ? 'selected' : ''} onClick={() => props.onSelectMode('sandbox')}>SANDBOX</button>
        </div>
        {(props.mode === 'campaign' || props.mode === 'endless') && (
          <div className="difficulty-choices" aria-label="Choose difficulty">
            {DIFFICULTIES.map((difficulty) => (
              <button key={difficulty.id} className={props.difficulty === difficulty.id ? 'selected' : ''} aria-pressed={props.difficulty === difficulty.id} onClick={() => props.onSelectDifficulty(difficulty.id)}>
                <b>{difficulty.label}</b><small>{difficulty.description}</small>
              </button>
            ))}
          </div>
        )}
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
        <LoadoutChoices {...props} />
        <button className="primary-button" onClick={props.onOpenMap}>OPEN BATTLE MAP</button>
        <button className="secondary-button briefing-armory" onClick={props.onOpenArmory}>OPEN FIELD RESEARCH</button>
        <button className="secondary-button briefing-armory" onClick={props.onOpenSettings}>SETTINGS</button>
        <button className="secondary-button briefing-armory" onClick={props.onOpenHelp}>HELP</button>
        <small>Progress saves automatically after every run.</small>
    </ModalFrame>
  )
}

function BattlefieldChoices(props: BriefingPanelProps) {
  return <div className="map-choices" aria-label="Choose battlefield">
    {props.mode === 'challenge' ? CHALLENGES.map((challenge) => (
      <button key={challenge.id} className={challenge.id === props.challengeId ? 'selected' : ''} onClick={() => props.onSelectChallenge(challenge.id)}>
        <span>{props.completedChallengeIds.includes(challenge.id) ? '✓ ' : ''}{challenge.title}</span>
        <small>{challenge.description}</small>
      </button>
    )) : props.availableMaps.filter((choice) => {
      const mission = missionForMap(choice.id)
      return Boolean(mission && (props.mode === 'campaign' || isMissionUnlocked(props.completedMissionIds, mission.id)))
    }).map((choice) => {
      const mission = missionForMap(choice.id)!
      const locked = props.mode === 'campaign' && !isMissionUnlocked(props.completedMissionIds, mission.id)
      const segments = choice.paths.reduce((sum, lane) => sum + lane.length - 1, 0)
      return <button key={choice.id} className={choice.id === props.map.id ? 'selected' : ''} onClick={() => props.onSelectMap(choice)} disabled={locked}>
        <span>{locked ? '🔒 ' : ''}{choice.name}</span>
        <small>{locked ? 'Complete the prior mission' : choice.navigationMode === 'open'
          ? `${choice.paths.length} spawn regions · open field`
          : `${choice.paths.length} ${choice.paths.length === 1 ? 'lane' : 'lanes'} · ${segments} segments`}</small>
      </button>
    })}
  </div>
}

function LoadoutChoices(props: BriefingPanelProps) {
  return <div className="loadout-picker" aria-label="Choose run loadout">
    <section>
      <header><b>TOWER DETAIL</b><small>{props.fixedArsenal ? 'FIXED' : `${props.selectedLoadout.towers.length}/${props.towerSlotLimit}`}</small></header>
      <div className="loadout-options">
        {props.towerOptions.map((tower) => {
          const selected = props.resolvedLoadout.towers.includes(tower)
          return <button key={tower} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={props.fixedArsenal || (!selected && props.selectedLoadout.towers.length >= props.towerSlotLimit)} onClick={() => props.onToggleTower(tower)}>{BUILD.items[tower].label}<small>{selected ? 'EQUIPPED · BUY IN SETUP' : 'AVAILABLE'}</small></button>
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
      <header><b>COMMANDER DOCTRINE</b><small>1 PASSIVE SLOT</small></header>
      <div className="loadout-options">
        <button
          className={props.selectedLoadout.doctrine === COMMANDER_DOCTRINE ? 'selected' : ''}
          aria-pressed={props.selectedLoadout.doctrine === COMMANDER_DOCTRINE}
          onClick={props.onToggleDoctrine}
        >FORWARD SUPPLY <small>+30 preparation supply</small></button>
      </div>
    </section>
  </div>
}
