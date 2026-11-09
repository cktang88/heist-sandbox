import { C4_BLAST, explode } from './explosions'
import { GRAVITY, moveBody } from './physics'
import { centerOf, type Body, type Vec } from './types'
import type { World } from './world'

/** A thrown C4 block. It sits where it lands until the player sets it off. */
export type Charge = Body & { fuse: number | null }

const THROW_SPEED = 13
const STAGGER_SECONDS = 0.12

export function throwCharge(world: World, from: Vec, direction: Vec): void {
  world.charges.push({
    x: from.x - 0.2, y: from.y - 0.2, w: 0.4, h: 0.4, vx: direction.x * THROW_SPEED, vy: direction.y * THROW_SPEED - 2,
    onGround: false, fuse: null,
  })
}

export function stepCharges(world: World, detonate: boolean, dt: number): void {
  if (detonate) {
    let order = 0
    for (const charge of world.charges) if (charge.fuse === null) charge.fuse = 0.05 + STAGGER_SECONDS * order++
  }

  const exploding: Charge[] = []
  for (const charge of world.charges) {
    charge.vy += GRAVITY * dt
    if (charge.onGround) charge.vx = 0
    moveBody(world.grid, charge, dt)
    if (charge.fuse === null) continue
    charge.fuse -= dt
    if (charge.fuse <= 0) exploding.push(charge)
  }

  if (exploding.length === 0) return
  world.charges = world.charges.filter((charge) => !exploding.includes(charge))
  for (const charge of exploding) explode(world, centerOf(charge), C4_BLAST)
}
