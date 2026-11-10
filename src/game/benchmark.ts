/**
 * Timing helpers for performance tests, which run on machines that may be busy with other work.
 * Wall time alone is meaningless there, so a test compares the code it measures with a fixed reference
 * workload timed the same way at the same moment. Only tests import this.
 */

/**
 * The fastest per-call time, in milliseconds, of `rounds` batches of `batch` calls each.
 * The fastest batch is the one least disturbed by whatever else the machine was doing.
 */
export function fastestPerCall(run: () => void, batch: number, rounds: number): number {
  let best = Infinity
  for (let round = 0; round < rounds; round += 1) {
    const started = performance.now()
    for (let call = 0; call < batch; call += 1) run()
    best = Math.min(best, (performance.now() - started) / batch)
  }
  return best
}

const FIELD_SIZE = 64
const field = new Float32Array(FIELD_SIZE * FIELD_SIZE)
const cells = new Map<number, number>()

/**
 * One call of the reference workload: the same kind of work a simulation frame does (a pass over a small grid
 * of floats, map lookups and writes). About a tenth of a millisecond on an idle desktop.
 */
export function referenceWork(): void {
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = FIELD_SIZE; index < field.length - FIELD_SIZE; index += 1) {
      field[index] = (field[index - 1] + field[index + 1] + field[index - FIELD_SIZE] + field[index + FIELD_SIZE]) * 0.249 + 0.001
    }
  }
  for (let key = 0; key < 2000; key += 1) cells.set(key, (cells.get(key) ?? 0) + key * 0.5)
}

/** How many reference workloads one call of `run` costs, measured on this machine right now. */
export function costInReferenceUnits(run: () => void, batch: number, rounds = 8): number {
  const reference = fastestPerCall(referenceWork, 20, rounds)
  const measured = fastestPerCall(run, batch, rounds)
  const referenceAfter = fastestPerCall(referenceWork, 20, rounds)
  return measured / Math.min(reference, referenceAfter)
}
