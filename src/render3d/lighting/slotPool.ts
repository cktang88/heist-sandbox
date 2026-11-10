/** How much more a lamp must matter than one already holding a light before it takes that light. */
export const HOLD_BONUS = 1.35
/** Seconds for a light to fade in on a newly chosen lamp, and out of a dropped one. */
export const FADE_IN = 0.35
export const FADE_OUT = 0.2

/**
 * A fixed number of real lights shared among many lamps. Each frame the caller offers the lamps that could use
 * one, with a score; the pool keeps the best, favours lamps that already hold a light (so near-ties do not flap),
 * and fades lights in and out instead of switching them, so a reassignment never pops.
 * Nothing is allocated after construction.
 */
export class SlotPool {
  /** Lamp index held by each slot, or -1 when free. */
  readonly lamp: Int32Array
  /** How far each slot's light is faded in, 0..1. */
  readonly weight: Float32Array
  /** Set when a slot took a new lamp this frame, so its shadow map knows it must be redrawn. */
  readonly moved: Uint8Array
  private readonly score: Float32Array
  /** Frame stamps: a lamp is chosen this frame when its stamp equals the frame, and placed when it is minus. */
  private readonly stamp: Int32Array
  private readonly offers: Int32Array
  private offerCount = 0
  private readonly chosen: Int32Array
  private chosenCount = 0
  private frame = 1

  constructor(readonly size: number, lampCount: number) {
    this.lamp = new Int32Array(size).fill(-1)
    this.weight = new Float32Array(size)
    this.moved = new Uint8Array(size)
    this.score = new Float32Array(lampCount)
    this.stamp = new Int32Array(lampCount)
    this.offers = new Int32Array(lampCount)
    this.chosen = new Int32Array(size)
  }

  /** Starts a frame's offers. */
  begin(): void {
    this.frame += 1
    this.offerCount = 0
  }

  /** Offers a lamp for this frame. A score of 0 or less is ignored. */
  offer(lamp: number, score: number): void {
    if (score <= 0 || this.offerCount >= this.offers.length) return
    this.score[lamp] = score
    this.offers[this.offerCount] = lamp
    this.offerCount += 1
  }

  /** Is this lamp holding a light (even one still fading)? */
  holds(lamp: number): boolean {
    return this.lamp.indexOf(lamp) >= 0
  }

  /** Chooses this frame's lamps and advances the fades by `dt` seconds. */
  settle(dt: number): void {
    this.choose()
    this.moved.fill(0)
    for (let slot = 0; slot < this.size; slot += 1) {
      const lamp = this.lamp[slot]
      if (lamp < 0) continue
      if (this.stamp[lamp] === this.frame) {
        this.weight[slot] = Math.min(1, this.weight[slot] + dt / FADE_IN)
        this.stamp[lamp] = -this.frame
        continue
      }
      this.weight[slot] -= dt / FADE_OUT
      if (this.weight[slot] <= 0) {
        this.weight[slot] = 0
        this.lamp[slot] = -1
      }
    }
    // Chosen lamps without a light take the free slots, best first. Slots still fading out stay busy until dark.
    let next = 0
    for (let slot = 0; slot < this.size; slot += 1) {
      if (this.lamp[slot] >= 0) continue
      while (next < this.chosenCount && this.stamp[this.chosen[next]] !== this.frame) next += 1
      if (next >= this.chosenCount) break
      const lamp = this.chosen[next]
      this.lamp[slot] = lamp
      this.weight[slot] = 0
      this.moved[slot] = 1
      this.stamp[lamp] = -this.frame
    }
  }

  /** Picks the `size` best offers, counting the hold bonus for lamps that already have a light. */
  private choose(): void {
    this.chosenCount = 0
    for (let pick = 0; pick < this.size; pick += 1) {
      let best = -1
      let bestScore = 0
      for (let index = 0; index < this.offerCount; index += 1) {
        const lamp = this.offers[index]
        if (this.stamp[lamp] === this.frame) continue
        const score = this.score[lamp] * (this.holds(lamp) ? HOLD_BONUS : 1)
        if (score > bestScore) {
          best = lamp
          bestScore = score
        }
      }
      if (best < 0) return
      this.stamp[best] = this.frame
      this.chosen[this.chosenCount] = best
      this.chosenCount += 1
    }
  }
}
