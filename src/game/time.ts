/** Slow motion: brief automatic bursts on big moments, plus a held "focus" the player controls. */
export type TimeState = { scale: number; burstLeft: number; burstScale: number; burstCooldown: number }

const FOCUS_STILL = 0.12
const FOCUS_MOVING = 0.45
const EASE_PER_SECOND = 10
const BURST_GAP_SECONDS = 4

export function createTime(): TimeState {
  return { scale: 1, burstLeft: 0, burstScale: 1, burstCooldown: 0 }
}

/** Asks for a short slow-motion burst. Ignored if one happened very recently, so it stays occasional. */
export function triggerSlowmo(time: TimeState, seconds: number, scale: number): void {
  if (time.burstCooldown > 0) return
  time.burstLeft = seconds
  time.burstScale = scale
  time.burstCooldown = BURST_GAP_SECONDS
}

/**
 * Advances the clock by real seconds and returns the current time scale.
 * While focusing, time crawls when the player holds still and speeds up when they act.
 */
export function stepTime(time: TimeState, realDt: number, focusing: boolean, acting: boolean): number {
  time.burstLeft = Math.max(0, time.burstLeft - realDt)
  time.burstCooldown = Math.max(0, time.burstCooldown - realDt)
  const focusScale = focusing ? (acting ? FOCUS_MOVING : FOCUS_STILL) : 1
  const target = Math.min(focusScale, time.burstLeft > 0 ? time.burstScale : 1)
  time.scale += (target - time.scale) * Math.min(1, realDt * EASE_PER_SECOND)
  return time.scale
}
