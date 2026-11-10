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
 * it takes a couple of minutes: `FIGHT_BENCH=1 npx vitest run src/game/fight.bench.test.ts` (add
 * `NODE_OPTIONS=--expose-gc` for steadier allocation numbers; FIGHT_RUNS and FIGHT_SECONDS change the length;
 * FIGHT_CPU=<file> writes a CPU profile of the fight). The timers live here, not in shipped code, so
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

/** What one run measured. Steps are numbered, so runs of the same scenario can be compared step by step. */
/** `cpuFrames` is the process's CPU time per step: unlike wall time, it does not grow while other jobs hold the processor. */
type Measured = { frames: number[]; cpuFrames: number[]; biggest: string[]; totals: Totals; allocations: number[]; pauses: number[]; cpu: number }

async function measure(world: World, seconds: number, each?: (second: number) => void): Promise<Measured> {
  const totals: Totals = {}
  const frames: number[] = []
  const cpuFrames: number[] = []
  const biggest: string[] = []
  const allocations: number[] = []
  const pauses: number[] = []
  const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) pauses.push(entry.duration) })
  ;(globalThis as { gc?: () => void }).gc?.()
  observer.observe({ entryTypes: ['gc'] })
  const cpuBefore = process.cpuUsage()
  for (let second = 0; second < seconds; second += 1) {
    each?.(second)
    for (let frame = 0; frame < 60; frame += 1) {
      world.player.hp = 1e9
      const input = idleInput({ x: world.player.x + 5, y: world.player.y })
      const before = { ...totals }
      const heapBefore = process.memoryUsage().heapUsed
      const cpuStarted = process.cpuUsage()
      const started = performance.now()
      step(world, input, totals)
      frames.push(performance.now() - started)
      const cpuSpent = process.cpuUsage(cpuStarted)
      cpuFrames.push((cpuSpent.user + cpuSpent.system) / 1000)
      const grown = process.memoryUsage().heapUsed - heapBefore
      biggest.push(biggestSystem(before, totals))
      // A collection during the step makes the difference meaningless, so those steps are left out.
      if (grown >= 0) allocations.push(grown)
    }
  }
  const usage = process.cpuUsage(cpuBefore)
  // The loop never yields, and collections are only reported once it does.
  await new Promise((resolve) => setTimeout(resolve, 100))
  observer.disconnect()
  return { frames, cpuFrames, biggest, totals, allocations, pauses, cpu: (usage.user + usage.system) / 1000 }
}

/** The two systems that took longest in one step, with their times, to say what a slow step was busy with. */
function biggestSystem(before: Totals, after: Totals): string {
  const spent = Object.entries(after).map(([system, total]) => [system, total - (before[system] ?? 0)] as const)
  spent.sort((a, b) => b[1] - a[1])
  return spent.slice(0, 2).map(([system, ms]) => `${system} ${ms.toFixed(1)}`).join(', ')
}

/**
 * The scenario is deterministic, so every run does the same work step for step. On a busy machine the other
 * jobs only ever add time, so the fastest of the runs for each step (and each system) is the cleanest reading.
 */
function fastestOf(runs: Measured[]): Measured {
  const fastest = runs[0].frames.map((_, index) => runs.reduce((best, run) => (run.frames[index] < best.frames[index] ? run : best)))
  const frames = fastest.map((run, index) => run.frames[index])
  const biggest = fastest.map((run, index) => run.biggest[index])
  const cpuFrames = runs[0].cpuFrames.map((_, index) => Math.min(...runs.map((run) => run.cpuFrames[index])))
  const totals: Totals = {}
  for (const name of Object.keys(runs[0].totals)) totals[name] = Math.min(...runs.map((run) => run.totals[name]))
  const quietest = runs.reduce((best, run) => (sum(run.pauses) < sum(best.pauses) ? run : best))
  return { frames, cpuFrames, biggest, totals, allocations: runs[0].allocations, pauses: quietest.pauses, cpu: Math.min(...runs.map((run) => run.cpu)) }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function summary(measured: Measured): string[] {
  const frames = [...measured.frames].sort((a, b) => a - b)
  const allocations = [...measured.allocations].sort((a, b) => a - b)
  const count = frames.length
  const at = (fraction: number) => frames[Math.min(count - 1, Math.floor(count * fraction))].toFixed(2)
  const kilobytes = (bytes: number) => (bytes / 1024).toFixed(0)
  const cpuFrames = [...measured.cpuFrames].sort((a, b) => a - b)
  const cpuAt = (fraction: number) => cpuFrames[Math.min(count - 1, Math.floor(count * fraction))].toFixed(2)
  const lines = [
    `mean ${(sum(frames) / count).toFixed(2)} ms  p50 ${at(0.5)}  p95 ${at(0.95)}  p99 ${at(0.99)}  max ${at(1)}  cpu/step ${(measured.cpu / count).toFixed(2)} ms`,
    `cpu time per step: mean ${(sum(cpuFrames) / count).toFixed(2)} ms  p95 ${cpuAt(0.95)}  p99 ${cpuAt(0.99)}  max ${cpuAt(1)}`,
    `allocated per step: mean ${kilobytes(sum(allocations) / Math.max(1, allocations.length))} KB, median ${kilobytes(allocations[allocations.length >> 1])} KB  (${allocations.length} clean samples)`,
    `gc: ${measured.pauses.length} pauses, ${sum(measured.pauses).toFixed(0)} ms total, worst ${Math.max(0, ...measured.pauses).toFixed(1)} ms`,
  ]
  for (const [name, total] of Object.entries(measured.totals).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${name.padEnd(24)} ${(total / count).toFixed(3)} ms`)
  }
  const slowest = measured.frames.map((ms, index) => ({ ms, index })).sort((a, b) => b.ms - a.ms).slice(0, 8)
  lines.push(`slowest steps: ${slowest.map(({ ms, index }) => `#${index} ${ms.toFixed(1)} ms (${measured.biggest[index]})`).join(', ')}`)
  const busiest = measured.cpuFrames.map((ms, index) => ({ ms, index })).sort((a, b) => b.ms - a.ms).slice(0, 8)
  lines.push(`most cpu: ${busiest.map(({ ms, index }) => `#${index} ${ms.toFixed(1)} ms (${measured.biggest[index]})`).join(', ')}`)
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
  if (!file) return profileCpu(work)
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

/**
 * With FIGHT_CPU=<file>, records a CPU profile of `work` and writes a .cpuprofile DevTools can open. Done through the
 * inspector because the test runner ends its workers before Node's own --cpu-prof gets to write.
 */
async function profileCpu(work: () => Promise<void>): Promise<void> {
  const file = process.env.FIGHT_CPU
  if (!file) return work()
  const { Session } = process.getBuiltinModule('node:inspector/promises') as { Session: new () => InspectorSession }
  const { writeFileSync } = process.getBuiltinModule('node:fs') as { writeFileSync(path: string, data: string): void }
  const session = new Session()
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 200 })
  await session.post('Profiler.start')
  await work()
  const { profile } = await session.post('Profiler.stop') as { profile: object }
  writeFileSync(file, JSON.stringify(profile))
  session.disconnect()
}

/** How many times each scenario is run; see `fastestOf`. */
const RUNS = Number(process.env.FIGHT_RUNS ?? 2)

function bigFight(): World {
  const fight = createWorld(1, 'complex')
  raiseAlarm(fight)
  return fight
}

describe.skipIf(!process.env.FIGHT_BENCH)('big-site step cost', () => {
  it('times a calm minute and a big fight', async () => {
    await measure(createWorld(3, 'complex'), 3)
    const calm: Measured[] = []
    for (let run = 0; run < RUNS; run += 1) calm.push(await measure(createWorld(1, 'complex'), Math.min(SECONDS, 20)))
    print(['== CALM', ...summary(fastestOf(calm))])
    const fights: Measured[] = []
    const ends: string[] = []
    for (let run = 0; run < RUNS; run += 1) {
      const fight = bigFight()
      await sampleAllocations(async () => { fights.push(await measure(fight, SECONDS, (second) => mayhem(fight, second))) })
      const dead = fight.guards.filter((guard) => guard.mode === 'dead').length
      ends.push(`dead ${dead}/${fight.guards.length}, tiles destroyed ${fight.stats.tilesDestroyed}, fires ${fight.hazards.fires.size}, smoke ${fight.hazards.smoke?.active.length ?? 0}`)
    }
    print(['== BIG FIGHT', ...summary(fastestOf(fights)), ...ends])
  }, 1_800_000)
})
