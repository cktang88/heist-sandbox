import { describe, it } from 'vitest'
import { quietHeist, type Entry } from './heist'
import { startRun } from './kit'

/**
 * The full route table: every seed 1-8 on every scripted route, printed for the report. Takes minutes, so it only
 * runs when asked: `STEALTH_TABLE=1 npx vitest run src/game/stealthRuns/table.test.ts`. Narrow it with
 * `STEALTH_SEEDS=1,2` and `STEALTH_ROUTES=roof,sewer,street`.
 */

type Node = { env: Record<string, string | undefined>; stderr: { write(text: string): void } }
const node = (globalThis as { process?: Node }).process
const env = node?.env ?? {}
const ENABLED = env.STEALTH_TABLE === '1'
const SEEDS = (env.STEALTH_SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number)
const ROUTES = (env.STEALTH_ROUTES ?? 'roof,sewer').split(',') as Entry[]

/** Straight to the terminal: the test runner keeps a passing test's console to itself. */
const print = (line: string) => node?.stderr.write(`${line}\n`)

describe.skipIf(!ENABLED)('the quiet heist on every seed and route (STEALTH_TABLE=1)', () => {
  it('prints the table', () => {
    for (const entry of ROUTES) {
      let won = 0
      for (const seed of SEEDS) {
        const run = startRun(seed)
        const result = quietHeist(run, entry)
        const clean = result.won && run.log.spotted === 0 && run.log.peakAlert <= 1
        if (clean) won += 1
        const why = clean ? '' : ` | ${run.world.security.log.slice(-3).join(' / ')} | ${run.log.notes.slice(-3).join('; ')}`
        print(`${entry.padEnd(6)} seed ${seed}: ${clean ? 'WON ' : 'lost'} ${run.log.seconds.toFixed(0).padStart(4)}s peak ${run.log.peakAlert} seen ${run.log.spotted} stage ${result.stage}${why}`)
      }
      print(`${entry}: ${won}/${SEEDS.length}`)
    }
  }, 3_600_000)
})
