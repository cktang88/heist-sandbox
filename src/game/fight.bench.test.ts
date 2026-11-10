import { describe, it } from 'vitest'
import { stepCharges } from './charges'
import { stepCollapse } from './collapse'
import { stepDevices } from './devices/devices'
import { aimAtCables, stepElevators } from './elevators'
import { C4_BLAST, explode } from './explosions'
import { stepAftermath } from './frag/aftermath'
import { stepFrags, throwFrag } from './frag/frag'
import { stepRopes } from './rope/rope'
import { stepGrapple } from './grapple/grapple'
import { stepFallingProps } from './vehicles/fallingProps'
import { igniteAt, stepHazards, throwGrenade } from './hazards/hazards'
import { stepSecurity } from './security/dispatch'
import { stepEffects } from './effects'
import { raiseAlarm, updateGuard } from './guards'
import { idleInput, type Input } from './input'
import { interact } from './interact'
import { GRAVITY, moveBody } from './physics'
import { emitMovementNoise } from './movement/footsteps'
import { movePlayer } from './player'
import { fireShot, stepProjectiles } from './projectiles'
import { stepTime } from './time'
import { stepMelee } from './melee/melee'
import { stepIntel } from './intel/intel'
import { stepPhysProps } from './physprops/physprops'
import { stepGaps } from './gaps/gaps'
import { useTool } from './tools'
import { createWorld, type World } from './world'

/**
 * The research note's "big fight" on the big site, timed system by system. Skipped unless asked for, because
 * it takes about a minute: `FIGHT_BENCH=1 npx vitest run src/game/fight.bench.test.ts` (add
 * `NODE_OPTIONS=--expose-gc` for steadier allocation numbers). The timers live here, not in shipped code, so
 * the system list below mirrors `stepWorld` and must follow it when a system is added.
 */
const FRAME = 1 / 60

/** The few Node facilities the benchmark needs, typed here because the project has no Node type definitions. */
type NodeProcess = {
  env: Record<string, string | undefined>
  memoryUsage(): { heapUsed: number }
  cpuUsage(since?: { user: number; system: number }): { user: number; system: number }
  stdout: { write(text: string): boolean }
  getBuiltinModule(id: string): unknown
}
type InspectorSession = { connect(): void; disconnect(): void; post(method: string, params?: object): Promise<unknown> }
const process = (globalThis as unknown as { process: NodeProcess }).process
const SECONDS = Number(process.env.FIGHT_SECONDS ?? 60)

type Totals = Record<string, number>

function timed(totals: Totals, name: string, run: () => void): void {
  const started = performance.now()
  run()
  totals[name] = (totals[name] ?? 0) + performance.now() - started
}

function step(world: World, input: Input, totals: Totals): void {
  const dt = stepTime(world.time, FRAME, false, false) * FRAME
  timed(totals, 'effects', () => stepEffects(world.effects, dt))
  world.clock += dt
  const alarmBefore = world.alarm
  timed(totals, 'player+interact+tools', () => {
    movePlayer(world.grid, world.player, input, dt, world.stairwells)
    emitMovementNoise(world)
    interact(world, input, dt)
    useTool(world, input, dt)
  })
  timed(totals, 'grapple+cables', () => { stepGrapple(world, input, dt); aimAtCables(world) })
  timed(totals, 'melee', () => stepMelee(world, input, dt))
  timed(totals, 'physprops', () => stepPhysProps(world, input, dt))
  timed(totals, 'projectiles', () => stepProjectiles(world, dt))
  timed(totals, 'charges', () => stepCharges(world, false, dt))
  timed(totals, 'collapse', () => stepCollapse(world, dt))
  timed(totals, 'hazards', () => stepHazards(world, dt))
  timed(totals, 'devices+elevators', () => { stepDevices(world, input, dt); stepElevators(world, input, dt) })
  timed(totals, 'security', () => stepSecurity(world, dt))
  timed(totals, 'guards (living)', () => { for (const guard of world.guards) if (!guard.ragdoll) updateGuard(world, guard, dt) })
  timed(totals, 'guards (ragdolls)', () => { for (const guard of world.guards) if (guard.ragdoll) updateGuard(world, guard, dt) })
  timed(totals, 'gaps', () => stepGaps(world, input))
  if (!alarmBefore && world.alarm) raiseAlarm(world)
  timed(totals, 'frags', () => stepFrags(world, dt))
  timed(totals, 'aftermath', () => stepAftermath(world))
  timed(totals, 'ropes', () => stepRopes(world))
  timed(totals, 'fallingProps', () => stepFallingProps(world, dt))
  timed(totals, 'intel', () => stepIntel(world, dt))
  for (const pickup of world.pickups) {
    if (pickup.taken) continue
    pickup.vy += GRAVITY * dt
    moveBody(world.grid, pickup, dt)
  }
  world.sounds.length = 0
}

/** Once a second: C4 along a room, 40 fires, a smoke grenade, a frag, 20 bullets and a rocket. */
function mayhem(world: World, second: number): void {
  const rng = world.rng
  const room = world.rooms[(second * 7) % world.rooms.length]
  Object.assign(world.player, { x: room.x + room.w / 2, y: room.floorY - world.player.h - 0.01, vx: 0, vy: 0 })
  const hand = { x: world.player.x + 0.4, y: world.player.y + 0.5 }
  for (let x = room.x; x < room.x + room.w; x += 3) explode(world, { x: x + 0.5, y: room.floorY + 0.5 }, C4_BLAST)
  for (let i = 0; i < 40; i += 1) igniteAt(world, { x: room.x + rng() * room.w, y: room.floorY - rng() * 3 }, 1)
  throwGrenade(world, 'smoke', hand, { x: rng() - 0.5, y: -0.3 })
  throwFrag(world, hand, { x: rng() - 0.5, y: -0.3 })
  for (let i = 0; i < 20; i += 1) {
    fireShot(world, hand, { x: rng() - 0.5, y: rng() - 0.5 }, { kind: 'bullet', fromPlayer: i % 2 === 0, speed: 60, damage: 30, tileDamage: 20, spread: 0.1, push: 2, penetration: 2 })
  }
  fireShot(world, hand, { x: rng() - 0.5, y: rng() - 0.5 }, { kind: 'rocket', fromPlayer: true, speed: 25, damage: 100, tileDamage: 100, spread: 0, push: 5 })
}

type Pause = { duration: number }

async function run(world: World, seconds: number, each?: (second: number) => void): Promise<string[]> {
  const totals: Totals = {}
  const frames: number[] = []
  const allocations: number[] = []
  const pauses: Pause[] = []
  const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) pauses.push({ duration: entry.duration }) })
  ;(globalThis as { gc?: () => void }).gc?.()
  observer.observe({ entryTypes: ['gc'] })
  const cpuBefore = process.cpuUsage()
  for (let second = 0; second < seconds; second += 1) {
    each?.(second)
    for (let frame = 0; frame < 60; frame += 1) {
      world.player.hp = 1e9
      const input = idleInput({ x: world.player.x + 5, y: world.player.y })
      const heapBefore = process.memoryUsage().heapUsed
      const started = performance.now()
      step(world, input, totals)
      frames.push(performance.now() - started)
      const grown = process.memoryUsage().heapUsed - heapBefore
      // A collection during the step makes the difference meaningless, so those steps are left out.
      if (grown >= 0) allocations.push(grown)
    }
  }
  const cpu = process.cpuUsage(cpuBefore)
  // The loop never yields, and collections are only reported once it does.
  await new Promise((resolve) => setTimeout(resolve, 100))
  observer.disconnect()
  frames.sort((a, b) => a - b)
  allocations.sort((a, b) => a - b)
  const count = frames.length
  const mean = frames.reduce((sum, value) => sum + value, 0) / count
  const at = (fraction: number) => frames[Math.min(count - 1, Math.floor(count * fraction))].toFixed(2)
  const allocMean = allocations.reduce((sum, value) => sum + value, 0) / Math.max(1, allocations.length)
  const gcTotal = pauses.reduce((sum, pause) => sum + pause.duration, 0)
  const lines = [
    `mean ${mean.toFixed(2)} ms  p50 ${at(0.5)}  p95 ${at(0.95)}  p99 ${at(0.99)}  max ${at(1)}  cpu/step ${((cpu.user + cpu.system) / 1000 / count).toFixed(2)} ms`,
    `allocated per step: mean ${(allocMean / 1024).toFixed(0)} KB, median ${(allocations[allocations.length >> 1] / 1024).toFixed(0)} KB  (${allocations.length} clean samples)`,
    `gc: ${pauses.length} pauses, ${gcTotal.toFixed(0)} ms total, worst ${Math.max(0, ...pauses.map((pause) => pause.duration)).toFixed(1)} ms`,
  ]
  for (const [name, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${name.padEnd(24)} ${(total / count).toFixed(3)} ms`)
  }
  return lines
}

/** Straight to the terminal: the test runner swallows console output. */
function print(lines: string[]): void {
  process.stdout.write(`${lines.join('\n')}\n`)
}

/**
 * With FIGHT_HEAP=<file>, samples every allocation during `work`, including short-lived objects the collector
 * already freed (Node's own --heap-prof keeps only survivors), and writes a .heapprofile DevTools can open.
 */
async function sampleAllocations(work: () => Promise<void>): Promise<void> {
  const file = process.env.FIGHT_HEAP
  if (!file) return work()
  const { Session } = process.getBuiltinModule('node:inspector/promises') as { Session: new () => InspectorSession }
  const { writeFileSync } = process.getBuiltinModule('node:fs') as { writeFileSync(path: string, data: string): void }
  const session = new Session()
  session.connect()
  await session.post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
  await work()
  const { profile } = await session.post('HeapProfiler.stopSampling') as { profile: object }
  writeFileSync(file, JSON.stringify(profile))
  session.disconnect()
}

describe.skipIf(!process.env.FIGHT_BENCH)('big-site step cost', () => {
  it('times a calm minute and a big fight', async () => {
    await run(createWorld(3, 'complex'), 3)
    const calm = await run(createWorld(1, 'complex'), Math.min(SECONDS, 20))
    print(['== CALM', ...calm])
    const fight = createWorld(1, 'complex')
    raiseAlarm(fight)
    let report: string[] = []
    await sampleAllocations(async () => { report = await run(fight, SECONDS, (second) => mayhem(fight, second)) })
    const dead = fight.guards.filter((guard) => guard.mode === 'dead').length
    const peaks = `dead ${dead}/${fight.guards.length}, tiles destroyed ${fight.stats.tilesDestroyed}, fires ${fight.hazards.fires.size}, smoke ${fight.hazards.smoke?.active.length ?? 0}`
    print(['== BIG FIGHT', ...report, peaks])
  }, 900_000)
})
