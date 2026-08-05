import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TUNING } from './config'
import { loadTuning } from './tuningStore'

function stored(tuning: unknown) {
  vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ version: 2, tuning }) } })
}

describe('tuning persistence', () => {
  it('loads a complete valid tuning document', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    tuning.towers.gunner.damage = 99
    stored(tuning)
    expect(loadTuning().towers.gunner.damage).toBe(99)
  })

  it('fills new projectile fields when loading an older tuning save', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    delete tuning.towers.cannon.projectileSpeed
    delete tuning.towers.mortar.projectileSpeed
    delete tuning.towers.mortar.minRange
    delete tuning.towers.gunner.firingArcDegrees
    stored(tuning)
    const loaded = loadTuning()
    expect(loaded.towers.cannon.projectileSpeed).toBe(DEFAULT_TUNING.towers.cannon.projectileSpeed)
    expect(loaded.towers.mortar.projectileSpeed).toBe(DEFAULT_TUNING.towers.mortar.projectileSpeed)
    expect(loaded.towers.mortar.minRange).toBe(DEFAULT_TUNING.towers.mortar.minRange)
    expect(loaded.towers.gunner.firingArcDegrees).toBe(DEFAULT_TUNING.towers.gunner.firingArcDegrees)
  })

  it('migrates older tuning saves to the default power metrics', () => {
    const tuning = structuredClone(DEFAULT_TUNING) as Partial<typeof DEFAULT_TUNING>
    delete tuning.powers
    stored(tuning)
    expect(loadTuning().powers).toEqual(DEFAULT_TUNING.powers)
  })

  it('persists valid power metrics and rejects malformed ones', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    tuning.powers.nuke.damage = 777
    tuning.powers.nuke.size = 4.2
    stored(tuning)
    expect(loadTuning().powers.nuke).toMatchObject({ damage: 777, size: 4.2 })

    const malformed = structuredClone(DEFAULT_TUNING)
    malformed.powers.nuke.cooldown = -1
    stored(malformed)
    expect(loadTuning()).toEqual(DEFAULT_TUNING)
  })

  it('rejects unknown attack variants instead of silently disabling a tower', () => {
    const tuning = structuredClone(DEFAULT_TUNING) as unknown as { towers: { gunner: { attack: unknown } } }
    tuning.towers.gunner.attack = { kind: 'mystery', radius: 3 }
    stored(tuning)
    expect(loadTuning()).toEqual(DEFAULT_TUNING)
  })

  it('rejects incomplete attack data and invalid damage types', () => {
    const incomplete = structuredClone(DEFAULT_TUNING) as unknown as { towers: { cannon: { attack: unknown } } }
    incomplete.towers.cannon.attack = { kind: 'splash' }
    stored(incomplete)
    expect(loadTuning()).toEqual(DEFAULT_TUNING)

    const wrongDamage = structuredClone(DEFAULT_TUNING) as unknown as { towers: { gunner: { damageType: string } } }
    wrongDamage.towers.gunner.damageType = 'psychic'
    stored(wrongDamage)
    expect(loadTuning()).toEqual(DEFAULT_TUNING)
  })
})
