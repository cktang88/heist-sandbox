import { describe, expect, it } from 'vitest'
import { addProp } from '../hazards/testWorld'
import { propBox } from '../hazards/props'
import { boxHitsSolid } from '../physics'
import { PROP_KINDS } from '../propCatalog'
import { createRng, type Rng } from '../rng'
import { arena, GROUND } from '../security/testArena'
import { setTile } from '../tiles'
import type { Rect } from '../types'
import type { World } from '../world'
import { settleLooseProps } from './gravity'
import { isPushable } from './kinds'
import { loosen } from './state'

const inner = (box: Rect, margin: number): Rect => ({ x: box.x + margin, y: box.y + margin, w: box.w - 2 * margin, h: box.h - 2 * margin })

/** Three storeys of slab with random holes and wall stubs, like a building after a few blasts. */
function raggedBuilding(world: World, r: Rng): void {
  for (const slab of [GROUND - 6, GROUND - 12, GROUND - 18]) {
    for (let x = 4; x < 40; x += 1) if (r() < 0.75) setTile(world.grid, x, slab, 'concrete')
    for (let x = 4; x < 40; x += 1) {
      if (r() > 0.15) continue
      for (let y = slab + 1; y < slab + 6; y += 1) if (r() < 0.7) setTile(world.grid, x, y, 'brick')
    }
  }
}

describe('loose furniture falling onto ragged floors', () => {
  it('never comes to rest inside a wall or a slab, however it is shoved, thrown or undermined', () => {
    const kinds = PROP_KINDS.filter(isPushable)
    const bad: string[] = []
    for (let seed = 1; seed <= 300; seed += 1) {
      const r = createRng(seed)
      const world = arena()
      raggedBuilding(world, r)
      const kind = kinds[Math.floor(r() * kinds.length)]
      const prop = addProp(world, kind, 8 + Math.floor(r() * 28) + (r() < 0.5 ? 0 : r()), GROUND - 19 + r() * 2)
      if (boxHitsSolid(world.grid, propBox(prop))) continue
      const loose = loosen(world, prop)
      for (let step = 0; step < 1800; step += 1) {
        if (step % 30 === 0 && step < 1200) {
          const roll = r()
          const box = propBox(prop)
          if (roll < 0.4) loose.vx = (r() - 0.5) * 12
          else if (roll < 0.7) {
            // A blast takes out a tile near or under it.
            setTile(world.grid, Math.floor(box.x - 1 + r() * (box.w + 2)), Math.floor(box.y + box.h + r() * 1.5), 'air')
          } else if (roll < 0.85) {
            // A throw that ended against something in mid-air: it drops from wherever it stopped.
            const dx = (r() - 0.5) * 3
            const dy = -r() * 2.5
            if (!boxHitsSolid(world.grid, { ...box, x: box.x + dx, y: box.y + dy })) Object.assign(prop, { x: prop.x + dx, y: prop.y + dy })
            Object.assign(loose, { vx: 0, vy: 0 })
          } else loose.vy = -r() * 6
        }
        settleLooseProps(world, r() < 0.2 ? 1 / 30 : r() < 0.1 ? 1e-5 : 1 / 60)
        if (loose.vy === 0 && boxHitsSolid(world.grid, inner(propBox(prop), 0.05))) {
          bad.push(`seed ${seed} step ${step} ${kind} inside at ${prop.x.toFixed(2)},${prop.y.toFixed(2)}`)
          break
        }
      }
      if (loose.vx !== 0 || loose.vy !== 0) bad.push(`seed ${seed} ${kind} still moving`)
    }
    expect(bad).toEqual([])
  })
})
