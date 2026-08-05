import { BUILD, getCombatPowerLabel } from './config'
import type { Loadout } from './loadout'
import type { GamePhase } from './types'

export type Guidance = {
  eyebrow: string
  title: string
  steps: string[]
}

export function getGuidance(phase: GamePhase, loadout: Loadout): Guidance {
  const towerNames = loadout.towers.map((tower) => BUILD.items[tower].label)
  const powerNames = loadout.powers.map(getCombatPowerLabel)
  const hasWall = loadout.powers.includes('wall')
  const activePowerNames = loadout.powers.filter((power) => power !== 'wall').map(getCombatPowerLabel)

  if (phase === 'setup') {
    return {
      eyebrow: 'DEPLOYMENT HELP',
      title: 'PREPARE THE LINE',
      steps: towerNames.length ? [
        `Your starting supply is shown above the tower list. Choose an equipped tower (${towerNames.join(', ')}), pay its listed supply cost, then click open ground to place it.`,
        'Select a placed tower to move it for free, sell it for a 100% refund, or change its targeting. Undo and Clear also restore all setup costs.',
        'Tower buying and selling ends when the battle starts; your layout is locked for the horde.',
        'Press Space or use Start Battle when the defense is ready.',
      ] : [
        'This operation starts with an empty field. Review the route, then begin the battle.',
        'Press Space or use Start Battle when you are ready.',
      ],
    }
  }

  if (phase === 'battle') {
    const steps = ['Press Space to pause or resume. Use 1× or 2× to control battle speed.']
    if (activePowerNames.length) steps.push(`Press 1–3 or use the command bar, then click the battlefield to deploy ${activePowerNames.join(', ')}.`)
    if (hasWall) steps.push('Temporary Wall is placed during battle. Use it to divert or delay the horde before it reaches the fortress.')
    if (!powerNames.length) steps.push('This operation has no battlefield commands, so the deployed line must hold on its own.')
    return { eyebrow: 'BATTLE HELP', title: 'HOLD THE FORTRESS', steps }
  }

  if (phase === 'victory' || phase === 'defeat') {
    return {
      eyebrow: 'REPORT HELP',
      title: 'LEARN FROM THE RUN',
      steps: [
        'Review leaks, fortress health, and tower damage to see where the defense succeeded or failed.',
        'Spend earned medals in Field Research, then adjust the next deployment.',
      ],
    }
  }

  const steps = ['Choose a mode, battlefield, and difficulty. Campaign missions unlock in order.', 'On the battle map, spend starting supply to buy towers. During preparation, moving is free and selling refunds the full tower price.']
  if (towerNames.length) steps.push(`Your equipped towers are ${towerNames.join(', ')}. Change the selection here before opening the map.`)
  else steps.push('This operation deploys without towers; the briefing will tell you what is loaned for the run.')
  if (powerNames.length) steps.push(`Your equipped battlefield commands are ${powerNames.join(', ')}. They are used after the battle begins.`)
  return { eyebrow: 'FIELD MANUAL', title: 'WELCOME, COMMANDER', steps }
}
