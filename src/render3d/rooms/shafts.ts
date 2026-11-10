import type { ElevatorShaft } from '../../game/site'
import { BACK } from '../levelMesh'
import { tintOf } from './batch'
import { letters, storeyLabel, type FinishContext } from './interior'

const STOREY = 6

/** Bare concrete, guide rails and painted stop numbers down the back of each elevator shaft. */
export function shaftLinings(ctx: FinishContext, shafts: readonly ElevatorShaft[], groundRow: number): void {
  const concrete = ctx.kit.photo({ set: 'old/concrete', rough: 0.95 })
  for (const shaft of shafts) {
    for (const stop of shaft.stops) {
      const [bottom, top] = [-stop, -(stop - STOREY)]
      const row = stop - 3
      ctx.scene.batch(shaft.x, row, concrete).facing(shaft.x, bottom, shaft.x + shaft.w, top, BACK + 0.006, 4, tintOf(0x7a7c80))
      const metal = ctx.scene.batch(shaft.x, row, ctx.kit.metal)
      for (const x of [shaft.x + 0.7, shaft.x + shaft.w - 0.85]) metal.box(x, bottom, BACK, x + 0.15, top, BACK + 0.12, 1, tintOf(0x5a5e62))
      const label = storeyLabel(Math.round((groundRow - stop) / STOREY), false)
      letters(ctx.scene.batch(shaft.x, row, ctx.kit.letters), label, shaft.x + shaft.w / 2 - 0.5, bottom + 3.6, 0.8, tintOf(0xe0d8c0, 0.8))
    }
  }
}
