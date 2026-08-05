import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from './config'
import { addPower, addStrafe, applyFortressDamage, barrageImpactPoint, calculateDamage, createSimulation, findTowerTarget, guideActivePower, isAttackInFront, isRunWon, nextTowerEngagement, spawnStressEnemies, stepSimulation, toSnapshot, towerEngagementBonuses, type Enemy } from './combat'
import { GREEN_MARCH, TWIN_FORK } from './maps'
import { buildPathInfo } from './path'
import { DEFAULT_RUN, runForMap } from './runs'
import { deriveGameRules } from './upgrades'
import type { Placement, RunRules, TowerKind } from './types'

const rules = createBaseGameRules(DEFAULT_TUNING)
const context = {
  map: GREEN_MARCH,
  pathInfos: GREEN_MARCH.paths.map(buildPathInfo),
  rules,
  towers: [] as Placement[],
  run: DEFAULT_RUN,
}

describe('combat simulation', () => {
  it('ramps Heavy Gun fire rate and Laser damage while they hold one target', () => {
    const first = nextTowerEngagement(undefined, 7, 0.5)
    const focused = nextTowerEngagement(first, 7, 1.5)
    expect(focused.seconds).toBe(1.5)
    expect(towerEngagementBonuses('heavyGun', focused.seconds).fireRate).toBeCloseTo(1.8)
    expect(towerEngagementBonuses('laser', 2).damage).toBeCloseTo(2.2)
    expect(nextTowerEngagement(focused, 8, 1).seconds).toBe(0)
  })

  it('gives rockets a close-range dead zone', () => {
    const rocket: Placement = { id: 700, kind: 'rocket', x: 0, z: 0 }
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 701, 1, 0))
    state.enemies[0].status.freezeRemaining = 10
    stepSimulation(state, { ...context, towers: [rocket] }, 0.01)
    expect(state.enemies[0].health).toBe(DEFAULT_TUNING.enemies.brute.health)
    const farState = createSimulation([], rules)
    farState.spawnTimer = 999
    farState.enemies.push(makeEnemy('brute', 702, 3, 0))
    farState.enemies[0].status.freezeRemaining = 10
    stepSimulation(farState, { ...context, towers: [rocket] }, 0.01)
    expect(farState.enemies[0].health).toBe(DEFAULT_TUNING.enemies.brute.health)
    stepSimulation(farState, { ...context, towers: [] }, 0.6)
    expect(farState.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.brute.health)
  })

  it('lets a Heavy Gun cover a narrow forward cone', () => {
    const heavy: Placement = { id: 706, kind: 'heavyGun', x: 0, z: 0 }
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 703, 2, 0), makeEnemy('brute', 704, 2.2, 0.1), makeEnemy('brute', 705, 2, 1))
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    stepSimulation(state, { ...context, towers: [heavy] }, 0.01)
    expect(state.enemies.slice(0, 2).every((enemy) => enemy.health < DEFAULT_TUNING.enemies.brute.health)).toBe(true)
    expect(state.enemies[2].health).toBe(DEFAULT_TUNING.enemies.brute.health)
  })

  it('resolves a strafe once and counts each kill once', () => {
    const state = createSimulation([], rules)
    state.enemies.push({
      id: 999, kind: 'grunt', pathIndex: 0, x: 0, z: 2, progress: 0.5, health: 20, healthMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1,
      status: { burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1, freezeCharge: 0, freezeRemaining: 0, stunRemaining: 0, brittleRemaining: 0, armorBreakRemaining: 0, armorBreakAmount: 0 },
    })
    expect(addStrafe(state, 10, 2, rules)).toBe(true)
    expect(addStrafe(state, 11, 2, rules)).toBe(false)
    stepSimulation(state, context, 0.8)
    expect(state.defeated).toBe(1)
    expect(state.enemies.some((enemy) => enemy.id === 999)).toBe(false)
  })

  it('retires temporary walls without making them reappear', () => {
    const wall: Placement = { id: 4, kind: 'wall', temporary: true, x: 0, z: 2 }
    const state = createSimulation([wall], rules)
    state.wallById.get(wall.id)!.life = 0.05
    stepSimulation(state, context, 0.1)
    expect(state.wallById.has(wall.id)).toBe(false)
    expect(state.removedWallIds.has(wall.id)).toBe(true)
  })

  it('creates temporary walls from the derived wall rules', () => {
    const shortWallRules = createBaseGameRules(DEFAULT_TUNING)
    shortWallRules.wall.lifetimeSeconds = 0.25
    const wall: Placement = { id: 5, kind: 'wall', temporary: true, x: 0, z: 2 }
    const state = createSimulation([wall], shortWallRules)
    expect(state.wallById.get(wall.id)?.life).toBe(0.25)
    stepSimulation(state, { ...context, rules: shortWallRules }, 0.3)
    expect(state.wallById.has(wall.id)).toBe(false)
  })

  it('preserves an authored wall rotation in combat', () => {
    const wall: Placement = { id: 6, kind: 'wall', x: 0, z: 2, rotation: Math.PI / 2 }
    const state = createSimulation([wall], rules, 100, GREEN_MARCH)
    expect(state.wallById.get(wall.id)?.rotation).toBe(Math.PI / 2)
  })

  it('spawns the configured enemy kind', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 0
    stepSimulation(state, context, 0.01)
    expect(state.enemies[0]?.kind).toBe('grunt')
  })

  it('lets enemies attack an authored supply cache without ending the run', () => {
    const objective = TWIN_FORK.secondaryObjective!
    const state = createSimulation([], rules, 100, TWIN_FORK)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('grunt', 808, objective.x, objective.z))
    stepSimulation(state, { ...context, map: TWIN_FORK, pathInfos: TWIN_FORK.paths.map(buildPathInfo) }, 0.5)
    expect(state.secondaryObjectiveHealth).toBeLessThan(objective.health)
    expect(state.baseHealth).toBe(100)
    expect(toSnapshot(state, DEFAULT_RUN).secondaryObjectiveBonusMedals).toBe(objective.bonusMedals)
  })

  it('spawns a custom map authored Sandbox group', () => {
    const map = { ...GREEN_MARCH, id: 'custom-spawn', waves: [{ groups: [{ enemy: 'runner' as const, count: 2, interval: 0.2, lane: 0 }], intermission: 1 }] }
    const run = runForMap('sandbox', map)
    const state = createSimulation([], rules)
    state.spawnTimer = 0
    stepSimulation(state, { ...context, map, run }, 0.01)
    expect(state.enemies[0]).toMatchObject({ kind: 'runner', pathIndex: 0 })
  })

  it('ends finite runs but never declares an endless victory', () => {
    const state = createSimulation([], rules)
    state.spawned = 9999
    expect(isRunWon(state, DEFAULT_RUN)).toBe(true)
    expect(isRunWon(state, { mode: 'endless' })).toBe(false)
  })

  it('counts the final fixed wave in the victory snapshot', () => {
    const run: RunRules = { mode: 'sandbox', waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], intermission: 1 }] }
    const state = createSimulation([], rules)
    state.spawned = 1
    state.defeated = 1
    expect(isRunWon(state, run)).toBe(true)
    expect(toSnapshot(state, run).wavesCleared).toBe(1)
  })

  it('stores the multipliers from an endless enemy spawn', () => {
    const state = createSimulation([], rules)
    state.waveIndex = 10
    state.spawnTimer = 0
    stepSimulation(state, { ...context, run: { mode: 'endless' } }, 0.01)
    expect(state.enemies[0].healthMultiplier).toBeGreaterThan(2)
    expect(state.enemies[0].speedMultiplier).toBeGreaterThan(1)
    expect(state.enemies[0].damageMultiplier).toBeGreaterThan(1)
  })

  it('alternates road-width spawn ranks across a multi-lane map', () => {
    const state = createSimulation([], rules)
    const forkContext = { ...context, map: TWIN_FORK, pathInfos: TWIN_FORK.paths.map(buildPathInfo) }
    state.spawnTimer = 0
    stepSimulation(state, forkContext, 0.01)
    state.spawnTimer = 0
    stepSimulation(state, forkContext, 0.01)
    expect(state.enemies.map((enemy) => enemy.pathIndex)).toEqual([0, 1, 0, 1])
  })

  it('spawns delayed groups independently on their authored lanes', () => {
    const run: RunRules = { mode: 'sandbox', waves: [{
      groups: [
        { enemy: 'grunt', count: 3, interval: 0.5, startDelay: 0, lane: 0 },
        { enemy: 'runner', count: 2, interval: 0.5, startDelay: 0.25, lane: 1 },
      ],
      intermission: 1,
    }] }
    const state = createSimulation([], rules)
    const forkContext = { ...context, map: TWIN_FORK, pathInfos: TWIN_FORK.paths.map(buildPathInfo), run }
    state.spawnTimer = 0

    stepSimulation(state, forkContext, 0.25)
    expect(state.enemies.map(({ kind, pathIndex }) => [kind, pathIndex])).toEqual([
      ['grunt', 0], ['grunt', 0], ['runner', 1], ['runner', 1],
    ])
    stepSimulation(state, forkContext, 0.5)
    expect(state.enemies.filter((enemy) => enemy.kind === 'grunt')).toHaveLength(3)
    expect(state.enemies.filter((enemy) => enemy.kind === 'runner')).toHaveLength(2)
  })

  it('keeps legacy groups sequential until the current group is cleared', () => {
    const run: RunRules = { mode: 'sandbox', waves: [{
      groups: [
        { enemy: 'grunt', count: 1, interval: 0.1 },
        { enemy: 'runner', count: 1, interval: 0.1 },
      ],
      intermission: 0.5,
    }] }
    const state = createSimulation([], rules)
    const legacyContext = { ...context, run }
    state.spawnTimer = 0

    stepSimulation(state, legacyContext, 0.1)
    stepSimulation(state, legacyContext, 1)
    expect(state.enemies.map((enemy) => enemy.kind)).toEqual(['grunt'])
    expect(state.groupIndex).toBe(0)
  })

  it('advances a scheduled wave only after every group spawned and all survivors cleared', () => {
    const run: RunRules = { mode: 'sandbox', waves: [{
      groups: [
        { enemy: 'grunt', count: 1, interval: 1, startDelay: 0 },
        { enemy: 'runner', count: 1, interval: 1, startDelay: 0.2 },
      ],
      intermission: 1,
    }] }
    const state = createSimulation([], rules)
    state.spawnTimer = 0
    const scheduledContext = { ...context, run }

    stepSimulation(state, scheduledContext, 0.3)
    expect(state.enemies).toHaveLength(2)
    expect(state.waveIndex).toBe(0)
    state.enemies.forEach((enemy) => { enemy.health = 0 })
    stepSimulation(state, scheduledContext, 0.01)
    stepSimulation(state, scheduledContext, 0.01)
    expect(state.waveIndex).toBe(1)
  })

  it('preserves and updates 1,500 diagnostic enemies outside authored wave totals', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    expect(spawnStressEnemies(state, TWIN_FORK, rules, 1_500)).toBe(1_500)
    expect(state.enemies).toHaveLength(1_500)
    expect(state.spawned).toBe(0)
    expect(state.enemies.filter((enemy) => enemy.pathIndex === 0)).toHaveLength(750)
    expect(state.enemies.filter((enemy) => enemy.pathIndex === 1)).toHaveLength(750)

    stepSimulation(state, { ...context, map: TWIN_FORK, pathInfos: TWIN_FORK.paths.map(buildPathInfo) }, 1 / 30)
    expect(state.enemies).toHaveLength(1_500)
    expect(state.enemies.every((enemy) => enemy.progress > 0)).toBe(true)
  })

  it('does not truncate simulation entities at the renderer capacity', () => {
    const state = createSimulation([], rules)
    spawnStressEnemies(state, GREEN_MARCH, rules, 3_000)
    expect(state.enemies).toHaveLength(3_000)
  })

  it('moves runners faster than brutes using shared movement rules', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('runner', 20), makeEnemy('brute', 21))
    stepSimulation(state, context, 0.5)
    expect(state.enemies[0].progress).toBeGreaterThan(state.enemies[1].progress)
  })

  it('applies only nearby shaman auras through the crowd lookup', () => {
    const plain = createSimulation([], rules)
    const nearby = createSimulation([], rules)
    const distant = createSimulation([], rules)
    plain.spawnTimer = nearby.spawnTimer = distant.spawnTimer = 999
    plain.enemies.push(makeEnemy('runner', 22))
    nearby.enemies.push(makeEnemy('runner', 23), makeEnemy('shaman', 24, -7, -4))
    distant.enemies.push(makeEnemy('runner', 25), makeEnemy('shaman', 26, 0, 0))

    stepSimulation(plain, context, 0.1)
    stepSimulation(nearby, context, 0.1)
    stepSimulation(distant, context, 0.1)

    expect(nearby.enemies[0].progress).toBeGreaterThan(plain.enemies[0].progress)
    expect(distant.enemies[0].progress).toBeCloseTo(plain.enemies[0].progress)
  })

  it('applies cannon splash to nearby enemies', () => {
    const cannon: Placement = { id: 30, kind: 'cannon', x: 0, z: 0 }
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('grunt', 31, 1, 0), makeEnemy('grunt', 32, 1.6, 0))
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    stepSimulation(state, { ...context, towers: [cannon] }, 0.01)
    expect(state.effects.some((effect) => effect.kind === 'impact')).toBe(true)
    stepSimulation(state, { ...context, towers: [] }, 0.2)
    expect(state.enemies.every((enemy) => enemy.health < DEFAULT_TUNING.enemies.grunt.health)).toBe(true)
    expect(state.damageByTower.cannon).toBeGreaterThan(0)
    expect(state.damageBySource.cannon).toBe(state.damageByTower.cannon)
  })

  it('lets projectile-speed research deliver cannon impacts sooner', () => {
    const fastRules = deriveGameRules(DEFAULT_TUNING, { 'explosives-04': 3 })
    const cannon: Placement = { id: 33, kind: 'cannon', x: 0, z: 0 }
    const slow = createSimulation([], rules)
    const fast = createSimulation([], fastRules)
    slow.spawnTimer = fast.spawnTimer = 999
    slow.enemies.push(makeEnemy('brute', 34, 4, 0))
    fast.enemies.push(makeEnemy('brute', 35, 4, 0))
    slow.enemies[0].status.freezeRemaining = fast.enemies[0].status.freezeRemaining = 10
    stepSimulation(slow, { ...context, towers: [cannon] }, 0.01)
    stepSimulation(fast, { ...context, rules: fastRules, towers: [cannon] }, 0.01)
    const slowDelay = slow.effects.find((effect) => effect.kind === 'impact')!.delay
    const fastDelay = fast.effects.find((effect) => effect.kind === 'impact')!.delay
    expect(fastDelay).toBeLessThan(slowDelay)
    stepSimulation(slow, { ...context, towers: [] }, fastDelay + 0.01)
    stepSimulation(fast, { ...context, rules: fastRules, towers: [] }, fastDelay + 0.01)
    expect(slow.enemies[0].health).toBe(DEFAULT_TUNING.enemies.brute.health)
    expect(fast.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.brute.health)
  })

  it('releases delayed secondary bomblets from Cannon and Mortar clusters', () => {
    const cases: readonly [TowerKind, 'explosives-05' | 'artillery-06'][] = [
      ['cannon', 'explosives-05'], ['mortar', 'artillery-06'],
    ]
    for (const [kind, upgrade] of cases) {
      const clusterRules = deriveGameRules(DEFAULT_TUNING, { [upgrade]: 1 })
      const tower: Placement = { id: kind === 'cannon' ? 36 : 37, kind, x: 0, z: 0 }
      const state = createSimulation([], clusterRules)
      state.spawnTimer = 999
      state.enemies.push(makeEnemy('brute', kind === 'cannon' ? 38 : 39, 3, 0))
      state.enemies[0].status.freezeRemaining = 10
      stepSimulation(state, { ...context, rules: clusterRules, towers: [tower] }, 0.01)
      const primary = state.effects.find((effect) => effect.kind === 'impact')!
      stepSimulation(state, { ...context, rules: clusterRules, towers: [] }, primary.delay + 0.01)
      expect(state.effects.filter((effect) => effect.kind === 'impact')).toHaveLength(3)
      const afterPrimary = state.enemies[0].health
      stepSimulation(state, { ...context, rules: clusterRules, towers: [] }, 0.3)
      expect(state.enemies[0].health).toBeLessThan(afterPrimary)
    }
  })

  it('uses Close Support to lower Mortar minimum range', () => {
    const closeRules = deriveGameRules(DEFAULT_TUNING, { 'artillery-04': 3 })
    const mortar: Placement = { id: 43, kind: 'mortar', x: 0, z: 0 }
    const near = makeEnemy('brute', 44, 1.5, 0)
    const far = makeEnemy('brute', 45, 3, 0)
    expect(findTowerTarget(mortar, [near, far], rules.tuning.towers.mortar.range, rules.tuning.towers.mortar.minRange)).toBe(far)
    expect(findTowerTarget(mortar, [near, far], closeRules.tuning.towers.mortar.range, closeRules.tuning.towers.mortar.minRange)).toBe(near)
  })

  it('honors every setup targeting rule with deterministic ties', () => {
    const tower: Placement = { id: 46, kind: 'cannon', x: 0, z: 0 }
    const closest = makeEnemy('brute', 47, 1, 0)
    closest.progress = 0.2
    closest.health = 80
    const first = makeEnemy('brute', 48, 3, 0)
    first.progress = 0.9
    const weakest = makeEnemy('brute', 49, 4, 0.2)
    weakest.health = 20
    const neighbor = makeEnemy('brute', 50, 4, 0.4)
    neighbor.health = 30
    const enemies = [closest, first, weakest, neighbor]

    expect(findTowerTarget({ ...tower, targetingRule: 'closest' }, enemies, 10)).toBe(closest)
    expect(findTowerTarget({ ...tower, targetingRule: 'first' }, enemies, 10)).toBe(first)
    expect(findTowerTarget({ ...tower, targetingRule: 'strongest' }, enemies, 10)).toBe(first)
    expect(findTowerTarget({ ...tower, targetingRule: 'weakest' }, enemies, 10)).toBe(weakest)
    expect(findTowerTarget({ ...tower, targetingRule: 'densest' }, enemies, 10)).toBe(first)
  })

  it('only acquires targets inside the tower firing sector', () => {
    const tower: Placement = { id: 55, kind: 'gunner', x: 0, z: 0, rotation: 0 }
    const ahead = makeEnemy('grunt', 56, 4, 0.2)
    const behind = makeEnemy('grunt', 57, -1, 0)
    expect(findTowerTarget(tower, [behind, ahead], 10, 0, undefined, 30)).toBe(ahead)
    expect(findTowerTarget({ ...tower, rotation: Math.PI }, [behind, ahead], 10, 0, undefined, 30)).toBe(behind)
  })

  it('reduces ballistic damage against shieldbearers', () => {
    const gunner: Placement = { id: 40, kind: 'gunner', x: 2, z: 0 }
    const gruntState = createSimulation([], rules)
    const shieldState = createSimulation([], rules)
    gruntState.spawnTimer = shieldState.spawnTimer = 999
    gruntState.enemies.push(makeEnemy('grunt', 41, 1, 0))
    shieldState.enemies.push(makeEnemy('shieldbearer', 42, 1, 0))
    shieldState.enemies[0].facingX = 1
    shieldState.enemies[0].facingZ = 0
    gruntState.enemies[0].status.freezeRemaining = 10
    shieldState.enemies[0].status.freezeRemaining = 10
    stepSimulation(gruntState, { ...context, towers: [gunner] }, 0.01)
    stepSimulation(shieldState, { ...context, towers: [gunner] }, 0.01)
    const gruntDamage = DEFAULT_TUNING.enemies.grunt.health - gruntState.enemies[0].health
    const shieldDamage = DEFAULT_TUNING.enemies.shieldbearer.health - shieldState.enemies[0].health
    expect(shieldDamage).toBeLessThan(gruntDamage)
  })

  it('uses the tuned ballistic reduction', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    tuning.enemies.shieldbearer.ballisticReduction = 0.9
    const tunedRules = createBaseGameRules(tuning)
    const gunner: Placement = { id: 45, kind: 'gunner', x: 2, z: 0 }
    const state = createSimulation([], tunedRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('shieldbearer', 46, 1, 0))
    state.enemies[0].facingX = 1
    state.enemies[0].facingZ = 0
    state.enemies[0].status.freezeRemaining = 10
    stepSimulation(state, { ...context, rules: tunedRules, towers: [gunner] }, 0.01)
    expect(tuning.enemies.shieldbearer.health - state.enemies[0].health).toBeCloseTo(tuning.towers.gunner.damage * 0.1)
  })

  it('lets Piercing Rivets bypass ballistic armor without adding raw damage', () => {
    const piercingRules = deriveGameRules(DEFAULT_TUNING, { 'gunner-05': 1 })
    const gunner: Placement = { id: 47, kind: 'gunner', x: 2, z: 0 }
    const plain = createSimulation([], rules)
    const piercing = createSimulation([], piercingRules)
    plain.spawnTimer = piercing.spawnTimer = 999
    plain.enemies.push(makeEnemy('shieldbearer', 48, 1, 0))
    piercing.enemies.push(makeEnemy('shieldbearer', 49, 1, 0))
    plain.enemies[0].facingX = piercing.enemies[0].facingX = 1
    plain.enemies[0].facingZ = piercing.enemies[0].facingZ = 0
    plain.enemies[0].status.freezeRemaining = piercing.enemies[0].status.freezeRemaining = 10
    stepSimulation(plain, { ...context, towers: [gunner] }, 0.01)
    stepSimulation(piercing, { ...context, rules: piercingRules, towers: [gunner] }, 0.01)
    const piercingDamage = DEFAULT_TUNING.enemies.shieldbearer.health - piercing.enemies[0].health
    expect(piercingDamage).toBeCloseTo(DEFAULT_TUNING.towers.gunner.damage)
    expect(piercingDamage).toBeGreaterThan(DEFAULT_TUNING.enemies.shieldbearer.health - plain.enemies[0].health)
  })

  it('only lets a Shieldbearer block ballistic shots arriving from the front', () => {
    const shield = makeEnemy('shieldbearer', 491, 0, 0)
    shield.facingX = 1
    shield.facingZ = 0
    const front = { x: 2, z: 0 }
    const rear = { x: -2, z: 0 }
    const flank = { x: 0, z: 2 }

    expect(isAttackInFront(shield, front)).toBe(true)
    expect(isAttackInFront(shield, rear)).toBe(false)
    expect(isAttackInFront(shield, flank)).toBe(false)
    expect(calculateDamage(shield, 10, 'ballistic', rules, false, front)).toBeLessThan(10)
    expect(calculateDamage(shield, 10, 'ballistic', rules, false, rear)).toBe(10)
    expect(calculateDamage(shield, 10, 'ballistic', rules, false, flank)).toBe(10)
  })

  it('keeps applying flamethrower burn after the initial hit', () => {
    const flame: Placement = { id: 50, kind: 'flamethrower', x: 0, z: 0 }
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 51, 1, 0))
    state.enemies[0].status.freezeRemaining = 10
    stepSimulation(state, { ...context, towers: [flame] }, 0.01)
    const afterHit = state.enemies[0].health
    expect(state.enemies[0].status.burnRemaining).toBeGreaterThan(0)
    stepSimulation(state, { ...context, towers: [] }, 0.5)
    expect(state.enemies[0].health).toBeLessThan(afterHit)
  })

  it('spreads a burning enemy death once without double-counting the kill', () => {
    const pyreRules = deriveGameRules(DEFAULT_TUNING, { 'fire-06': 1 })
    const gunner: Placement = { id: 52, kind: 'gunner', x: 0, z: 0 }
    const state = createSimulation([], pyreRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('grunt', 53, 1, 0), makeEnemy('brute', 54, 1.8, 0))
    state.enemies[0].health = 1
    state.enemies[0].status.burnRemaining = 2
    state.enemies[0].status.burnDamagePerSecond = 1
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    stepSimulation(state, { ...context, rules: pyreRules, towers: [gunner] }, 0.01)
    expect(state.defeated).toBe(1)
    expect(state.effects.filter((effect) => effect.kind === 'impact')).toHaveLength(1)
    stepSimulation(state, { ...context, rules: pyreRules, towers: [] }, 0.01)
    expect(state.enemies[0].status.burnRemaining).toBeGreaterThan(0)
    expect(state.defeated).toBe(1)
  })

  it('limits flamethrower damage to its forward cone and range', () => {
    const flame: Placement = { id: 55, kind: 'flamethrower', x: 0, z: 0 }
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(
      makeEnemy('brute', 56, 1, 0),
      makeEnemy('brute', 57, -2.5, 0),
      makeEnemy('brute', 58, 3.1, 0),
      makeEnemy('brute', 59, 2, 1),
    )
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    stepSimulation(state, { ...context, towers: [flame] }, 0.01)
    expect(state.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.brute.health)
    expect(state.enemies.slice(1).every((enemy) => enemy.health === DEFAULT_TUNING.enemies.brute.health)).toBe(true)
  })

  it('builds cryo charge into a temporary freeze', () => {
    const cryo: Placement = { id: 60, kind: 'cryo', x: -8.5, z: -2.8 }
    const fastCryo = structuredClone(DEFAULT_TUNING)
    fastCryo.towers.cryo.shotsPerSecond = 100
    const fastCryoRules = createBaseGameRules(fastCryo)
    const frozenContext = { ...context, rules: fastCryoRules, towers: [cryo] }
    const state = createSimulation([], fastCryoRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 61, -8.5, -2.8))
    for (let shot = 0; shot < 4; shot += 1) stepSimulation(state, frozenContext, 0.02)
    expect(state.enemies[0].status.freezeRemaining).toBeGreaterThan(0)
  })

  it('makes Cryo-frozen targets brittle to explosive damage', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    if (tuning.towers.cryo.attack.kind !== 'cryo') throw new Error('Expected Cryo attack')
    tuning.towers.cryo.attack.freezePerHit = 1
    tuning.towers.cryo.attack.freezeThreshold = 1
    tuning.towers.cryo.damage = 0
    const plainRules = createBaseGameRules(tuning)
    const brittleRules = deriveGameRules(tuning, { 'cryo-05': 1 })
    const cryo: Placement = { id: 62, kind: 'cryo', x: -8, z: -4 }
    const cannon: Placement = { id: 63, kind: 'cannon', x: -8, z: -4 }
    const plain = createSimulation([], plainRules)
    const brittle = createSimulation([], brittleRules)
    plain.spawnTimer = brittle.spawnTimer = 999
    plain.enemies.push(makeEnemy('brute', 64))
    brittle.enemies.push(makeEnemy('brute', 65))
    plain.enemies[0].status.freezeRemaining = brittle.enemies[0].status.freezeRemaining = 10
    stepSimulation(plain, { ...context, rules: plainRules, towers: [cryo, cannon] }, 0.01)
    stepSimulation(brittle, { ...context, rules: brittleRules, towers: [cryo, cannon] }, 0.01)
    const plainDamage = tuning.enemies.brute.health - plain.enemies[0].health
    const brittleDamage = tuning.enemies.brute.health - brittle.enemies[0].health
    expect(brittle.enemies[0].status.brittleRemaining).toBeGreaterThan(0)
    expect(brittleDamage).toBeCloseTo(plainDamage * 1.35)
  })

  it('chains a completed Cryo freeze to one nearby target', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    if (tuning.towers.cryo.attack.kind !== 'cryo') throw new Error('Expected Cryo attack')
    tuning.towers.cryo.attack.freezeThreshold = 1
    const chainRules = deriveGameRules(tuning, { 'cryo-06': 1 })
    const cryo: Placement = { id: 66, kind: 'cryo', x: 0, z: 0 }
    const state = createSimulation([], chainRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 67, 1, 0), makeEnemy('brute', 68, 1.8, 0), makeEnemy('brute', 69, 4, 0))
    state.enemies.forEach((enemy) => { enemy.status.stunRemaining = 10 })
    stepSimulation(state, { ...context, rules: chainRules, towers: [cryo] }, 0.01)
    expect(state.enemies.map((enemy) => enemy.status.freezeRemaining > 0)).toEqual([true, true, false])
  })

  it('limits barrage damage to its target radius', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 70, 0, 0), makeEnemy('brute', 71, 5, 0))
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    expect(addPower(state, 72, 'barrage', { x: 0, z: 0 }, rules)).toBe(true)
    stepSimulation(state, context, 0.8)
    expect(state.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.brute.health)
    expect(state.enemies[1].health).toBe(DEFAULT_TUNING.enemies.brute.health)
  })

  it('uses derived power damage and cooldown rules', () => {
    const customRules = createBaseGameRules(DEFAULT_TUNING)
    customRules.powers.barrage.damage = 11
    customRules.powers.barrage.cooldown = 3
    const state = createSimulation([], customRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 73, 0, 0))
    state.enemies[0].status.freezeRemaining = 10
    expect(addPower(state, 74, 'barrage', { x: 0, z: 0 }, customRules)).toBe(true)
    expect(state.powerCooldowns.barrage).toBe(3)
    stepSimulation(state, { ...context, rules: customRules }, 0.8)
    expect(state.enemies[0].health).toBe(DEFAULT_TUNING.enemies.brute.health - 11)
  })

  it('fires deterministic barrage impacts across the active duration', () => {
    const salvoRules = createBaseGameRules(DEFAULT_TUNING)
    salvoRules.powers.barrage.warningTime = 0
    salvoRules.powers.barrage.duration = 1
    salvoRules.powers.barrage.impactCount = 5
    const state = createSimulation([], salvoRules)
    state.spawnTimer = 999
    addPower(state, 75, 'barrage', { x: 2, z: -1 }, salvoRules)
    stepSimulation(state, { ...context, rules: salvoRules }, 0.21)
    expect(state.powers[0].impactsFired).toBe(2)
    stepSimulation(state, { ...context, rules: salvoRules }, 0.39)
    expect(state.powers[0].impactsFired).toBe(3)
    expect(barrageImpactPoint({ x: 2, z: -1 }, 2.2, 0)).toEqual({ x: 2, z: -1 })
    expect(barrageImpactPoint({ x: 2, z: -1 }, 2.2, 4)).toEqual(barrageImpactPoint({ x: 2, z: -1 }, 2.2, 4))
  })

  it('spreads Strafe damage across repeated impacts and catches late arrivals', () => {
    const strafeRules = createBaseGameRules(DEFAULT_TUNING)
    strafeRules.powers.strafe.warningTime = 0
    strafeRules.powers.strafe.duration = 1
    strafeRules.powers.strafe.damage = 50
    strafeRules.powers.strafe.impactCount = 5
    const state = createSimulation([], strafeRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 751, 0, 0))
    state.enemies[0].status.freezeRemaining = 10
    addStrafe(state, 752, 0, strafeRules)

    stepSimulation(state, { ...context, rules: strafeRules }, 0.21)
    expect(state.powers[0].impactsFired).toBe(2)
    expect(state.enemies[0].health).toBe(DEFAULT_TUNING.enemies.brute.health - 20)

    state.enemies.push(makeEnemy('brute', 753, 0, 0))
    state.enemies[1].status.freezeRemaining = 10
    stepSimulation(state, { ...context, rules: strafeRules }, 0.79)
    expect(state.enemies[0].health).toBe(DEFAULT_TUNING.enemies.brute.health - 50)
    expect(state.enemies[1].health).toBe(DEFAULT_TUNING.enemies.brute.health - 30)
  })

  it('makes a Nuke strongest at its center and knocks surviving orcs outward', () => {
    const nukeRules = createBaseGameRules(DEFAULT_TUNING)
    nukeRules.powers.nuke.warningTime = 0
    nukeRules.powers.nuke.damage = 100
    nukeRules.powers.nuke.size = 4
    const state = createSimulation([], nukeRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 754, 0.93, 2.55), makeEnemy('brute', 755, 3.27, -0.18))
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    addPower(state, 756, 'nuke', { x: 0.8, z: 2.7 }, nukeRules)

    stepSimulation(state, { ...context, rules: nukeRules }, 0.01)
    expect(state.enemies[0].health).toBeLessThan(state.enemies[1].health)
    expect(state.enemies[0].x).toBeGreaterThan(0.93)
    expect(state.enemies[1].x).toBeGreaterThan(3.27)
    expect(state.damageBySource.nuke).toBeGreaterThan(0)
  })

  it('uses upgraded wall length for blocking', () => {
    const longWallRules = createBaseGameRules(DEFAULT_TUNING)
    longWallRules.wall.length = 2
    const wall: Placement = { id: 76, kind: 'wall', x: 0, z: 0 }
    const state = createSimulation([wall], longWallRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('grunt', 77, 0, 1.2))
    stepSimulation(state, { ...context, rules: longWallRules }, 0.1)
    expect(state.wallById.get(wall.id)!.health).toBeLessThan(DEFAULT_TUNING.wall.health)
  })

  it('damages orcs touching an upgraded spiked wall', () => {
    const spikeRules = deriveGameRules(DEFAULT_TUNING, { 'fortification-05': 1 })
    const wall: Placement = { id: 78, kind: 'wall', x: -8, z: -4 }
    const state = createSimulation([wall], spikeRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('grunt', 79))
    stepSimulation(state, { ...context, rules: spikeRules }, 0.1)
    expect(state.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.grunt.health)
    expect(state.damageBySource.wallSpikes).toBeGreaterThan(0)
  })

  it('explodes a destroyed upgraded wall exactly once', () => {
    const blastRules = deriveGameRules(DEFAULT_TUNING, { 'fortification-06': 1 })
    const wall: Placement = { id: 80, kind: 'wall', x: -8, z: -4 }
    const state = createSimulation([wall], blastRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 81))
    state.enemies[0].status.freezeRemaining = 10
    state.wallById.get(wall.id)!.health = 0

    stepSimulation(state, { ...context, rules: blastRules }, 0.01)
    expect(state.effects.filter((effect) => effect.kind === 'impact')).toHaveLength(1)
    stepSimulation(state, { ...context, rules: blastRules }, 0.01)
    const healthAfterBlast = state.enemies[0].health
    expect(healthAfterBlast).toBe(DEFAULT_TUNING.enemies.brute.health - 70)
    expect(state.damageBySource.wallExplosion).toBe(70)
    expect(toSnapshot(state, context.run).damageBySource.wallExplosion).toBe(70)
    stepSimulation(state, { ...context, rules: blastRules }, 0.01)
    expect(state.enemies[0].health).toBe(healthAfterBlast)
  })

  it('freezes survivors caught in the cryo beam lane', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 80, 0, 1))
    state.enemies[0].status.freezeRemaining = 0.6
    addPower(state, 81, 'cryoBeam', { x: 0, z: 1 }, rules)
    stepSimulation(state, context, 0.6)
    expect(state.enemies[0].status.freezeRemaining).toBeGreaterThan(2)
  })

  it('leaves slowing frozen ground after an upgraded cryo beam', () => {
    const frozenGroundRules = deriveGameRules(DEFAULT_TUNING, { 'strategic-04': 1 })
    frozenGroundRules.powers.cryoBeam.warningTime = 0
    const state = createSimulation([], frozenGroundRules)
    state.spawnTimer = 999
    addPower(state, 82, 'cryoBeam', { x: 0, z: 1 }, frozenGroundRules)
    stepSimulation(state, { ...context, rules: frozenGroundRules }, 0.01)
    expect(state.effects.some((effect) => effect.kind === 'zone' && effect.shape === 'lane')).toBe(true)

    state.enemies.push(makeEnemy('brute', 83, 0, 1))
    state.enemies[0].status.freezeRemaining = 10
    stepSimulation(state, { ...context, rules: frozenGroundRules }, 0.5)
    expect(state.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.brute.health)
    expect(state.enemies[0].status.slowMultiplier).toBe(0.55)
  })

  it('leaves damaging fallout after an upgraded nuke', () => {
    const falloutRules = deriveGameRules(DEFAULT_TUNING, { 'strategic-06': 1 })
    falloutRules.powers.nuke.warningTime = 0
    const state = createSimulation([], falloutRules)
    state.spawnTimer = 999
    addPower(state, 84, 'nuke', { x: 0, z: 0 }, falloutRules)
    stepSimulation(state, { ...context, rules: falloutRules }, 0.01)
    expect(state.effects.some((effect) => effect.kind === 'zone' && effect.shape === 'circle')).toBe(true)

    state.enemies.push(makeEnemy('brute', 85, 0, 0))
    state.enemies[0].status.freezeRemaining = 10
    stepSimulation(state, { ...context, rules: falloutRules }, 0.5)
    expect(state.enemies[0].health).toBeCloseTo(DEFAULT_TUNING.enemies.brute.health - 6)
  })

  it('repairs fortress health without exceeding full health', () => {
    const shieldRules = deriveGameRules(DEFAULT_TUNING, { 'command-06': 1 })
    const state = createSimulation([], shieldRules)
    state.baseHealth = 80
    expect(addPower(state, 85, 'repair', { x: 11, z: -1.5 }, shieldRules)).toBe(true)
    stepSimulation(state, { ...context, rules: shieldRules }, 0.2)
    expect(state.baseHealth).toBe(100)
    expect(state.fortressShield).toBe(25)
  })

  it('routes fortress damage through shield before health', () => {
    const fortress = { baseHealth: 100, fortressShield: 25 }
    applyFortressDamage(fortress, 10)
    expect(fortress).toEqual({ baseHealth: 100, fortressShield: 15 })
    applyFortressDamage(fortress, 20)
    expect(fortress).toEqual({ baseHealth: 95, fortressShield: 0 })
  })

  it('spends run shield before health when an orc reaches the fortress', () => {
    const shieldRules = deriveGameRules(DEFAULT_TUNING, { 'command-06': 1 })
    const state = createSimulation([], shieldRules)
    state.spawnTimer = 999
    const fortress = GREEN_MARCH.paths[0].at(-1)!
    const leaking = makeEnemy('grunt', 89, fortress.x, fortress.z)
    leaking.damageMultiplier = 10
    state.enemies.push(leaking)
    stepSimulation(state, { ...context, rules: shieldRules }, 0.01)
    expect(state.fortressShield).toBe(0)
    expect(state.baseHealth).toBe(85)
    expect(state.leaks).toBe(1)
    expect(state.fortressHitFlash).toBeGreaterThan(0)
    expect(state.fortressHitWasShielded).toBe(true)
    expect(toSnapshot(state, context.run).leaks).toBe(1)
  })

  it('deals sustained orbital laser damage inside its target circle', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 86, 0, 0), makeEnemy('brute', 87, 3, 0))
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    addPower(state, 88, 'orbitalLaser', { x: 0, z: 0 }, rules)
    stepSimulation(state, context, 0.5)
    expect(state.enemies[0].health).toBeLessThan(DEFAULT_TUNING.enemies.brute.health)
    expect(state.enemies[1].health).toBe(DEFAULT_TUNING.enemies.brute.health)
  })

  it('guides only an active orbital laser without resetting its cooldown', () => {
    const guidedRules = createBaseGameRules(DEFAULT_TUNING)
    guidedRules.powers.orbitalLaser.warningTime = 0
    const state = createSimulation([], guidedRules)
    addPower(state, 880, 'orbitalLaser', { x: 0, z: 0 }, guidedRules)
    expect(guideActivePower(state, 'orbitalLaser', { x: 3, z: 2 })).toBe(false)
    stepSimulation(state, { ...context, rules: guidedRules }, 0.01)
    const cooldown = state.powerCooldowns.orbitalLaser
    expect(guideActivePower(state, 'orbitalLaser', { x: 3, z: 2 })).toBe(true)
    expect(state.powers[0].point).toEqual({ x: 3, z: 2 })
    expect(state.powerCooldowns.orbitalLaser).toBe(cooldown)
  })

  it('chains Tesla damage through nearby enemies', () => {
    const tesla: Placement = { id: 90, kind: 'tesla', x: 0, z: 0 }
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 91, 1, 0), makeEnemy('brute', 92, 1.8, 0), makeEnemy('brute', 93, 2.6, 0))
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    stepSimulation(state, { ...context, towers: [tesla] }, 0.01)
    expect(state.enemies.filter((enemy) => enemy.health < DEFAULT_TUNING.enemies.brute.health)).toHaveLength(3)
  })

  it('briefly stops movement for Tesla-shocked targets', () => {
    const shockRules = deriveGameRules(DEFAULT_TUNING, { 'energy-04': 1 })
    const tesla: Placement = { id: 94, kind: 'tesla', x: -8, z: -4 }
    const state = createSimulation([], shockRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('runner', 95))
    stepSimulation(state, { ...context, rules: shockRules, towers: [tesla] }, 0.01)
    const shockedProgress = state.enemies[0].progress
    expect(state.enemies[0].status.stunRemaining).toBeGreaterThan(0)
    stepSimulation(state, { ...context, rules: shockRules, towers: [] }, 0.2)
    expect(state.enemies[0].progress).toBe(shockedProgress)
    stepSimulation(state, { ...context, rules: shockRules, towers: [] }, 0.2)
    expect(state.enemies[0].progress).toBeGreaterThan(shockedProgress)
  })

  it('pierces aligned enemies behind the Laser target', () => {
    const piercingRules = deriveGameRules(DEFAULT_TUNING, { 'energy-06': 1 })
    const laser: Placement = { id: 96, kind: 'laser', x: 0, z: 0 }
    const state = createSimulation([], piercingRules)
    state.spawnTimer = 999
    state.enemies.push(
      makeEnemy('brute', 97, 1, 0), makeEnemy('brute', 98, 2, 0.15),
      makeEnemy('brute', 99, 3, 0), makeEnemy('brute', 100, 2, 0.8),
    )
    state.enemies.forEach((enemy) => { enemy.status.freezeRemaining = 10 })
    stepSimulation(state, { ...context, rules: piercingRules, towers: [laser] }, 0.01)
    expect(state.enemies.slice(0, 3).every((enemy) => enemy.health < DEFAULT_TUNING.enemies.brute.health)).toBe(true)
    expect(state.enemies[3].health).toBe(DEFAULT_TUNING.enemies.brute.health)
  })

  it('stuns survivors inside a Concussion Shell blast', () => {
    const stunRules = deriveGameRules(DEFAULT_TUNING, { 'artillery-05': 1 })
    const mortar: Placement = { id: 104, kind: 'mortar', x: -5, z: -4 }
    const state = createSimulation([], stunRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('brute', 105))
    state.enemies[0].status.freezeRemaining = 0.8
    stepSimulation(state, { ...context, rules: stunRules, towers: [mortar] }, 0.01)
    stepSimulation(state, { ...context, rules: stunRules, towers: [] }, 0.7)
    stepSimulation(state, { ...context, rules: stunRules, towers: [] }, 0.1)
    const stunnedProgress = state.enemies[0].progress
    expect(state.enemies[0].status.stunRemaining).toBeGreaterThan(0)
    stepSimulation(state, { ...context, rules: stunRules, towers: [] }, 0.3)
    expect(state.enemies[0].progress).toBe(stunnedProgress)
  })

  it('applies and expires Strafe armor break in central damage math', () => {
    const breakRules = deriveGameRules(DEFAULT_TUNING, { 'air-06': 1 })
    const state = createSimulation([], breakRules)
    state.spawnTimer = 999
    state.enemies.push(makeEnemy('armored', 106, 0, 1))
    state.enemies[0].status.freezeRemaining = 10
    addStrafe(state, 107, 1, breakRules)
    stepSimulation(state, { ...context, rules: breakRules }, 0.8)
    expect(state.enemies[0].status.armorBreakRemaining).toBeGreaterThan(0)
    const brokenDamage = calculateDamage(state.enemies[0], 12, 'ballistic', breakRules)
    expect(brokenDamage).toBeGreaterThan(12 * (1 - DEFAULT_TUNING.enemies.armored.ballisticReduction!))
    stepSimulation(state, { ...context, rules: breakRules }, 0.4)
    stepSimulation(state, { ...context, rules: breakRules }, 4)
    expect(state.enemies[0].status.armorBreakRemaining).toBe(0)
    expect(calculateDamage(state.enemies[0], 12, 'ballistic', breakRules)).toBeCloseTo(12 * (1 - DEFAULT_TUNING.enemies.armored.ballisticReduction!))
  })

  it('applies nearby support-beacon multipliers', () => {
    const gunner: Placement = { id: 100, kind: 'gunner', x: 0, z: 0 }
    const support: Placement = { id: 101, kind: 'support', x: 1, z: 0 }
    const baseState = createSimulation([], rules)
    const buffedState = createSimulation([], rules)
    baseState.spawnTimer = buffedState.spawnTimer = 999
    baseState.enemies.push(makeEnemy('brute', 102, 2, 0))
    buffedState.enemies.push(makeEnemy('brute', 103, 2, 0))
    baseState.enemies[0].status.freezeRemaining = buffedState.enemies[0].status.freezeRemaining = 10
    stepSimulation(baseState, { ...context, towers: [gunner] }, 0.01)
    stepSimulation(buffedState, { ...context, towers: [gunner, support] }, 0.01)
    expect(buffedState.damageByTower.gunner).toBeGreaterThan(baseState.damageByTower.gunner)
  })

  it('accelerates wounded berserkers', () => {
    const full = createSimulation([], rules)
    const wounded = createSimulation([], rules)
    full.spawnTimer = wounded.spawnTimer = 999
    full.enemies.push(makeEnemy('berserker', 110))
    wounded.enemies.push(makeEnemy('berserker', 111))
    wounded.enemies[0].health = DEFAULT_TUNING.enemies.berserker.health * 0.4
    stepSimulation(full, context, 0.5)
    stepSimulation(wounded, context, 0.5)
    expect(wounded.enemies[0].progress).toBeGreaterThan(full.enemies[0].progress)
  })

  it('uses the tuned shaman speed aura', () => {
    const normalTuning = structuredClone(DEFAULT_TUNING)
    const strongTuning = structuredClone(DEFAULT_TUNING)
    normalTuning.enemies.shaman.speedAura = 1
    strongTuning.enemies.shaman.speedAura = 2
    const normalRules = createBaseGameRules(normalTuning)
    const strongRules = createBaseGameRules(strongTuning)
    const normal = createSimulation([], normalRules)
    const strong = createSimulation([], strongRules)
    normal.spawnTimer = strong.spawnTimer = 999
    normal.enemies.push(makeEnemy('grunt', 120), makeEnemy('shaman', 121))
    strong.enemies.push(makeEnemy('grunt', 122), makeEnemy('shaman', 123))
    stepSimulation(normal, { ...context, rules: normalRules }, 0.25)
    stepSimulation(strong, { ...context, rules: strongRules }, 0.25)
    expect(strong.enemies[0].progress).toBeGreaterThan(normal.enemies[0].progress)
  })

  it('uses the tuned banner wall-damage aura', () => {
    const normalTuning = structuredClone(DEFAULT_TUNING)
    const strongTuning = structuredClone(DEFAULT_TUNING)
    normalTuning.enemies.banner.wallDamageAura = 1
    strongTuning.enemies.banner.wallDamageAura = 2
    const wall: Placement = { id: 130, kind: 'wall', x: -8, z: -4 }
    const normalRules = createBaseGameRules(normalTuning)
    const strongRules = createBaseGameRules(strongTuning)
    const normal = createSimulation([wall], normalRules)
    const strong = createSimulation([wall], strongRules)
    normal.spawnTimer = strong.spawnTimer = 999
    normal.enemies.push(makeEnemy('grunt', 131), makeEnemy('banner', 132))
    strong.enemies.push(makeEnemy('grunt', 133), makeEnemy('banner', 134))
    stepSimulation(normal, { ...context, rules: normalRules }, 0.1)
    stepSimulation(strong, { ...context, rules: strongRules }, 0.1)
    expect(strong.wallById.get(wall.id)!.health).toBeLessThan(normal.wallById.get(wall.id)!.health)
  })

  it('lets nearby banners also increase damage dealt to the fortress', () => {
    const normalTuning = structuredClone(DEFAULT_TUNING)
    const strongTuning = structuredClone(DEFAULT_TUNING)
    normalTuning.enemies.banner.wallDamageAura = 1
    strongTuning.enemies.banner.wallDamageAura = 2
    const normalRules = createBaseGameRules(normalTuning)
    const strongRules = createBaseGameRules(strongTuning)
    const normal = createSimulation([], normalRules)
    const strong = createSimulation([], strongRules)
    normal.spawnTimer = strong.spawnTimer = 999
    const fortress = GREEN_MARCH.paths[0].at(-1)!
    normal.enemies.push(makeEnemy('grunt', 140, fortress.x - 0.05, fortress.z), makeEnemy('banner', 141, fortress.x - 1, fortress.z))
    strong.enemies.push(makeEnemy('grunt', 142, fortress.x - 0.05, fortress.z), makeEnemy('banner', 143, fortress.x - 1, fortress.z))
    normal.enemies[1].status.freezeRemaining = strong.enemies[1].status.freezeRemaining = 10

    stepSimulation(normal, { ...context, rules: normalRules }, 0.1)
    stepSimulation(strong, { ...context, rules: strongRules }, 0.1)

    expect(strong.baseHealth).toBeLessThan(normal.baseHealth)
  })

  it('lets Sappers leave the lane to seek a nearby wall', () => {
    const wall: Placement = { id: 150, kind: 'wall', x: -8, z: 0 }
    const sapperState = createSimulation([wall], rules, 100, GREEN_MARCH)
    const gruntState = createSimulation([wall], rules, 100, GREEN_MARCH)
    sapperState.spawnTimer = gruntState.spawnTimer = 999
    sapperState.enemies.push(makeEnemy('sapper', 151, -8, -2.8))
    gruntState.enemies.push(makeEnemy('grunt', 152, -8, -2.8))

    stepSimulation(sapperState, context, 0.5)
    stepSimulation(gruntState, context, 0.5)

    expect(sapperState.enemies[0].z).toBeGreaterThan(gruntState.enemies[0].z)
  })
})

function makeEnemy(kind: Enemy['kind'], id: number, x = -8, z = -4): Enemy {
  return {
    id, kind, pathIndex: 0, x, z, progress: 0.1, health: DEFAULT_TUNING.enemies[kind].health,
    healthMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1,
    status: { burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1, freezeCharge: 0, freezeRemaining: 0, stunRemaining: 0, brittleRemaining: 0, armorBreakRemaining: 0, armorBreakAmount: 0 },
  }
}
