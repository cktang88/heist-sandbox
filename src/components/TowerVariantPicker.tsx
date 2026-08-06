import { BUILD } from '../game/config'
import { getTowerVariantChoices } from '../game/variantSelection'
import type { TowerKind, TowerVariantId } from '../game/types'
import type { UpgradeRanks } from '../game/upgrades'

export function TowerVariantPicker({ tower, ranks, selectedVariantId, onChange }: {
  tower: TowerKind
  ranks: UpgradeRanks
  selectedVariantId?: TowerVariantId
  onChange: (tower: TowerKind, variantId: TowerVariantId | undefined) => void
}) {
  const choices = getTowerVariantChoices(tower, ranks)
  const selectedIsOffered = choices.some((choice) => choice.id === selectedVariantId)
  const selectedId = selectedIsOffered ? selectedVariantId : undefined

  return (
    <section className="tower-variant-picker" aria-label={`${BUILD.items[tower].label} firing profile`}>
      <header className="tower-variant-picker__header">
        <b>{BUILD.items[tower].label}</b>
      </header>
      <div className="tower-variant-picker__choices">
        {choices.map((choice) => {
          const selected = (choice.id ?? undefined) === selectedId
          return (
            <button
              key={choice.id ?? 'standard'}
              type="button"
              className={`tower-variant-picker__choice${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              aria-label={`${choice.label}: ${choice.role}`}
              onClick={() => onChange(tower, choice.id ?? undefined)}
            >
              <span className="tower-variant-picker__swatch" style={{ backgroundColor: choice.accent }} aria-hidden="true" />
              <span>
                <b>{choice.label}</b>
                <small>{choice.role}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
