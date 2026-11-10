import type { Vec } from '../types'

/**
 * The grappling hook. One hook, so one state:
 * - 'stowed': in the launcher.
 * - 'flying': shot out along `heading`, `travelled` tiles so far.
 * - 'retracting': reeling back to the hand after a miss or a release.
 * - 'attached': bitten into `anchor` with the player on the line.
 * - 'parked': still bitten, but the player has let go of the line to climb in a window, onto a ledge or a ladder.
 *   The line hangs there; climbing back out of a window beside it takes hold of it again.
 */
export type HookPhase = 'stowed' | 'flying' | 'retracting' | 'attached' | 'parked'

export type GrappleState = {
  phase: HookPhase
  /** Where the hook is: in flight, on its way back, or the point where it bit. */
  hook: Vec
  heading: Vec
  travelled: number
  /** The tile the hook bit into. */
  anchor: Vec | null
  /** The corner the line is bent around when a wall gets between the player and the hook, if any. */
  bend: Vec | null
  /** Line paid out, hook to hands, along the bend if there is one. */
  length: number
  /** True while the line carries the player's weight; false while it is slack and he walks or falls freely. */
  hanging: boolean
  /** -1 paying out, 1 reeling in, 0 neither; the renderer poses the arms from it. */
  reeling: -1 | 0 | 1
  /** The player's velocity while the line (or a jump off it) moves him, and where it left him last frame. */
  vel: Vec
  body: Vec
  /** His velocity just before he last moved, before any wall or pane stopped him: what a crash through glass reads. */
  lastVel: Vec
  /** Seconds left of a jump off the line in which he keeps his swing instead of the usual air control. */
  fling: number
  /** Seconds left of climbing through a window, during which he cannot shoot. */
  vault: number
  /** Set while climbing out of a window toward the parked line: he takes hold of it when the climb ends. */
  vaultToLine: boolean
  /** The window E was pressed at, and when: a quick tap smashes it, holding cuts it (see `windows.ts`). */
  tap: { key: string; at: number } | null
  /** The window action last offered, so a tap is only read as one when it was the action on offer. */
  offer: { key: string; prompt: string } | null
}

export function createGrapple(): GrappleState {
  return {
    phase: 'stowed', hook: { x: 0, y: 0 }, heading: { x: 1, y: 0 }, travelled: 0, anchor: null, bend: null, length: 0,
    hanging: false, reeling: 0, vel: { x: 0, y: 0 }, body: { x: 0, y: 0 }, lastVel: { x: 0, y: 0 }, fling: 0, vault: 0, vaultToLine: false, tap: null, offer: null,
  }
}

/** True while the line holds the player: the renderer draws him hanging, and the security code sees him on it. */
export function onLine(grapple: GrappleState): boolean {
  return grapple.phase === 'attached' && grapple.hanging
}
