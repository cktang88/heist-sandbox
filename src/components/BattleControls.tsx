import { useEffect, useState } from 'react'
import type { ActivePowerKind, BattleSnapshot, CombatPower } from '../game/types'

type PowerOption = { kind: ActivePowerKind; label: string }

type BattleControlsProps = {
  speed: 1 | 2
  speedLocked: boolean
  snapshot: BattleSnapshot
  powers: readonly PowerOption[]
  selectedPower: CombatPower | null
  powerCharges: Readonly<Record<ActivePowerKind, number | null>>
  wallAvailable: boolean
  wallCharges: number
  wallCooldown: number
  paused: boolean
  pauseDisabled: boolean
  onSpeed: (speed: 1 | 2) => void
  onPower: (power: ActivePowerKind) => void
  onWall: () => void
  onPause: () => void
  onSurrender: () => void
}

export function BattleControls(props: BattleControlsProps) {
  const [confirmingSurrender, setConfirmingSurrender] = useState(false)
  useEffect(() => {
    if (props.paused) setConfirmingSurrender(false)
  }, [props.paused])
  return (
    <div className="battle-controls">
      <button className={props.speed === 1 ? 'active' : ''} onClick={() => props.onSpeed(1)} disabled={props.speedLocked}>1×</button>
      <button className={props.speed === 2 ? 'active' : ''} onClick={() => props.onSpeed(2)} disabled={props.speedLocked}>2×</button>
      <span>{props.snapshot.enemiesDefeated}{props.snapshot.totalEnemies === null ? '' : ` / ${props.snapshot.totalEnemies}`} ELIMINATED</span>
      {props.powers.map((power) => {
        const cooldown = props.snapshot.powerCooldowns[power.kind]
        const charges = props.powerCharges[power.kind]
        const unavailable = charges !== null && charges <= 0
        return <button
          key={power.kind}
          className={props.selectedPower === power.kind ? 'active power-button' : 'power-button'}
          onClick={() => props.onPower(power.kind)}
          disabled={cooldown > 0 || props.paused || unavailable}
        >{powerButtonLabel(power.label, cooldown, charges)}</button>
      })}
      {props.wallAvailable && <button
        className={props.selectedPower === 'wall' ? 'active wall-power' : 'wall-power'}
        onClick={props.onWall}
        disabled={props.wallCharges <= 0 || props.wallCooldown > 0 || props.paused}
        title="Arm a 15-second destructible wall, then click directly on the road"
      >{props.wallCooldown > 0 ? `WALL ${Math.ceil(props.wallCooldown)}s · ×${props.wallCharges}` : `WALL ×${props.wallCharges}`}</button>}
      <button onClick={props.onPause} disabled={props.pauseDisabled}>{props.paused ? '▶ RESUME' : 'Ⅱ PAUSE'} <kbd>SPACE</kbd></button>
      {confirmingSurrender ? <span className="surrender-confirmation">
        <button className="surrender-button confirm" onClick={props.onSurrender}>CONFIRM RETREAT</button>
        <button onClick={() => setConfirmingSurrender(false)}>KEEP FIGHTING</button>
      </span> : <button className="surrender-button" onClick={() => setConfirmingSurrender(true)}>SURRENDER</button>}
    </div>
  )
}

function powerButtonLabel(label: string, cooldown: number, charges: number | null): string {
  if (charges !== null && charges <= 0) return `${label} SPENT`
  if (cooldown > 0) return `${label} ${Math.ceil(cooldown)}s`
  return charges === null ? `${label} READY` : `${label} ×${charges}`
}
