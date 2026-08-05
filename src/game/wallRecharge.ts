export function advanceWallRecharge(remaining: number, elapsedSeconds: number, speed: number, paused: boolean): number {
  if (paused) return Math.max(0, remaining)
  return Math.max(0, remaining - Math.max(0, elapsedSeconds) * Math.max(0, speed))
}
