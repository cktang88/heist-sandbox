export type StressStream = {
  remaining: number
  rate: number
  liveCap: number
  budget: number
}

export function createStressStream(total: number, rate: number, liveCap: number): StressStream {
  return {
    remaining: Math.max(0, Math.floor(total)),
    rate: Math.max(0, rate),
    liveCap: Math.max(0, Math.floor(liveCap)),
    budget: 0,
  }
}

/** Advances one diagnostic stream frame and reserves the returned spawn count. */
export function scheduleStressSpawns(stream: StressStream, delta: number, liveEnemies: number): number {
  stream.budget += stream.rate * Math.max(0, Math.min(delta, 0.1))
  const count = Math.min(
    Math.floor(stream.budget),
    stream.remaining,
    Math.max(0, stream.liveCap - Math.max(0, liveEnemies)),
  )
  stream.budget -= count
  stream.remaining -= count
  return count
}
