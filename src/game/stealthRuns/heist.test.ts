import { describe, expect, it } from 'vitest'
import { quietHeist, type Entry } from './heist'
import { startRun } from './kit'

/**
 * LONG (a few seconds each): whole quiet heists played by script on the big complex, with every guard on duty.
 * In by the sewer hatch or dropped on the roof; the case found from papers and computers alone; out by the sewer to
 * the van. Nobody may ever be sure he saw the player, and the site alert may never pass level 1 ("stay sharp").
 * The only guard touched is one posted in the case's own room, if any.
 */

/**
 * A few of the seed/route pairs the script gets through, to keep this quick. The full table (seeds 1-8 on every
 * route) is table.test.ts, run with STEALTH_TABLE=1.
 */
const RUNS: [number, Entry][] = [
  [1, 'roof'],
  [5, 'roof'],
  [4, 'sewer'],
]

describe('a quiet heist from start to van (long)', () => {
  it.each(RUNS)('seed %i, in by the %s: case found by quiet intel, taken, and out without the alert passing level 1', (seed, entry) => {
    const run = startRun(seed)
    const result = quietHeist(run, entry)
    const notes = `${result.stage}; ${run.log.notes.join('; ')}; log: ${run.world.security.log.join(' / ')}`
    expect(result.won, notes).toBe(true)
    expect(run.log.spotted, notes).toBe(0)
    expect(run.log.peakAlert, notes).toBeLessThanOrEqual(1)
    // Quiet intel alone: papers and computers, no guard questioned.
    expect(run.world.intel.questioned.size).toBe(0)
    expect(run.world.intel.clues.every((clue) => clue.source === 'document' || clue.source === 'terminal')).toBe(true)
  }, 60_000)
})
