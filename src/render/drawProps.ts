import type { Prop } from '../game/level'
import { propSpec } from '../game/propCatalog'
import { isSolidAt } from '../game/tiles'
import type { World } from '../game/world'

type Ctx = CanvasRenderingContext2D

function box(c: Ctx, color: string, x: number, y: number, w: number, h: number, radius = 0.04): void {
  c.fillStyle = color
  c.beginPath()
  c.roundRect(x, y, w, h, radius)
  c.fill()
}

/** Each painter draws with its bottom-centre at 0,0, standing on the floor. */
const PAINTERS: Partial<Record<Prop['kind'], (c: Ctx) => void>> = {
  desk(c) {
    box(c, '#5a4632', -1, -0.85, 2, 0.12)
    box(c, '#3d2f22', -0.9, -0.74, 0.12, 0.74)
    box(c, '#3d2f22', 0.78, -0.74, 0.12, 0.74)
    box(c, '#14171d', -0.35, -1.5, 0.8, 0.52)
    box(c, '#5fb3d6', -0.3, -1.45, 0.7, 0.42, 0.02)
    box(c, '#14171d', 0, -1.0, 0.1, 0.16)
  },
  filingCabinet(c) {
    box(c, '#57616e', -0.5, -1.9, 1, 1.9)
    for (const y of [-1.8, -1.2, -0.6]) {
      box(c, '#454e5a', -0.42, y, 0.84, 0.5, 0.02)
      box(c, '#aab3be', -0.12, y + 0.2, 0.24, 0.06, 0.02)
    }
  },
  crate(c) {
    box(c, '#7d5d36', -0.6, -1.1, 1.2, 1.1)
    c.strokeStyle = '#4f3a20'
    c.lineWidth = 0.07
    c.strokeRect(-0.52, -1.02, 1.04, 0.94)
    c.beginPath()
    c.moveTo(-0.52, -1.02)
    c.lineTo(0.52, -0.08)
    c.stroke()
  },
  plant(c) {
    box(c, '#7a4a35', -0.25, -0.5, 0.5, 0.5)
    c.fillStyle = '#3f7a48'
    for (const [x, y, r] of [[0, -1.0, 0.36], [-0.28, -0.75, 0.26], [0.28, -0.78, 0.26], [0.05, -1.35, 0.24]]) {
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
    }
  },
  serverRack(c) {
    box(c, '#1b1f27', -0.55, -2.4, 1.1, 2.4)
    for (let row = 0; row < 7; row += 1) {
      box(c, '#2a303b', -0.45, -2.28 + row * 0.32, 0.9, 0.24, 0.02)
      box(c, row % 3 === 0 ? '#ffb454' : '#39ff6a', 0.25, -2.2 + row * 0.32, 0.08, 0.08, 0.02)
    }
  },
  gold(c) {
    for (const [x, y] of [[-0.5, -0.2], [0, -0.2], [-0.25, -0.4]]) {
      box(c, '#b8901f', x, y, 0.5, 0.2, 0.03)
      box(c, '#ffd23f', x + 0.04, y + 0.03, 0.42, 0.06, 0.02)
    }
  },
}

/** Medkits and ammo boxes waiting to be picked up. */
export function drawPickups(context: CanvasRenderingContext2D, world: World): void {
  for (const pickup of world.pickups) {
    if (pickup.taken) continue
    if (pickup.kind === 'medkit') {
      box(context, '#e9edf2', pickup.x, pickup.y, pickup.w, pickup.h, 0.08)
      box(context, '#e0353f', pickup.x + pickup.w / 2 - 0.06, pickup.y + 0.12, 0.12, 0.36, 0.01)
      box(context, '#e0353f', pickup.x + pickup.w / 2 - 0.18, pickup.y + 0.24, 0.36, 0.12, 0.01)
    } else {
      box(context, '#4b5a3c', pickup.x, pickup.y, pickup.w, pickup.h, 0.05)
      box(context, '#e0b95a', pickup.x + 0.1, pickup.y + 0.18, pickup.w - 0.2, 0.1, 0.01)
    }
  }
}

/** Room dressing. A prop vanishes once the floor under it has been blown away. */
export function drawProps(context: CanvasRenderingContext2D, world: World): void {
  for (const prop of world.props) {
    if (!isSolidAt(world.grid, prop.x, prop.y)) continue
    context.save()
    context.translate(prop.x + 0.5, prop.y)
    const paint = PAINTERS[prop.kind]
    if (paint) paint(context)
    else {
      // The flat fallback view only knows a few props; the rest are shown as plain blocks of the right size.
      const { w, h, mount } = propSpec(prop.kind)
      if (mount === 'floor') box(context, '#4a5260', -w / 2, -h, w, h)
    }
    context.restore()
  }
}
