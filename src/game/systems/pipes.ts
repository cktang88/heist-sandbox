import { burst } from '../effects'
import { propById, propCenter, propBox } from '../hazards/props'
import { startSpray } from '../hazards/sprays'
import { emitNoise } from '../noise'
import type { PropKind } from '../propCatalog'
import { playSound } from '../sounds'
import type { Rect, Vec } from '../types'
import type { World } from '../world'
import { addSource, sourceByTag } from './sources'
import { targetIndex } from './targets'

/**
 * Water supply that bursts: pipes in walls and ceilings (shot or caught in a blast), and broken water fixtures and
 * tanks. Each becomes a source pouring onto the floor below, with a visible jet and a loud hiss.
 */
const PIPE_RATE = 0.9
const PIPE_SECONDS = 45
const PIPE_NOISE = 6
const WATER = '#8fc8ff'
type Flow = { rate: number; seconds: number }
/** How much each broken fixture lets out: a hydrant is on the mains and never runs dry; a cooler is one bottle. */
const FIXTURE_FLOW: Partial<Record<PropKind, Flow>> = {
  sink: { rate: 0.6, seconds: 40 }, toilet: { rate: 0.6, seconds: 40 }, toiletStall: { rate: 0.6, seconds: 40 },
  showerStall: { rate: 0.7, seconds: 40 }, waterCooler: { rate: 0.6, seconds: 4 }, coffeeMachine: { rate: 0.4, seconds: 3 },
  waterTank: { rate: 1.6, seconds: 12 }, roofWaterTank: { rate: 2, seconds: 14 }, specimenTank: { rate: 1, seconds: 4 },
  fireHydrant: { rate: 2, seconds: 90 },
}

export function pipeTag(at: Vec): string {
  return `pipe:${Math.floor(at.x)}:${Math.floor(at.y)}`
}

/** A pipe bursts where it was hit: a jet of water sprays out and pours to the floor. */
export function burstPipe(world: World, hit: Vec, box: Rect): boolean {
  const at = { x: Math.min(box.x + box.w - 0.1, Math.max(box.x + 0.1, hit.x)), y: box.y + box.h / 2 }
  const tag = pipeTag(at)
  if (sourceByTag(world, tag) || world.systems.burst.has(Math.floor(at.y) * world.grid.width + Math.floor(at.x))) return false
  world.systems.burst.add(Math.floor(at.y) * world.grid.width + Math.floor(at.x))
  addSource(world, 'water', at, PIPE_RATE, PIPE_SECONDS, tag)
  const side = world.systems.rng() < 0.5 ? -1 : 1
  startSpray(world, { ...at, angle: Math.PI / 2 - side * 0.5, spread: 0.3, reach: 3, kind: 'water', life: PIPE_SECONDS })
  burst(world.effects, world.systems.rng, at, 10, WATER, 6)
  playSound(world, 'spray', at)
  emitNoise(world, at, PIPE_NOISE)
  return true
}

/** Explosions rupture the pipes they reach. Each blast (an explosion flash) is looked at once. */
export function blastPipes(world: World): void {
  const systems = world.systems
  for (const flash of world.effects.flashes) {
    if (flash.kind !== 'explosion' || systems.seenFlashes.has(flash)) continue
    systems.seenFlashes.add(flash)
    const reach = Math.ceil(flash.radius)
    const index = targetIndex(world)
    for (let y = Math.floor(flash.y) - reach; y <= Math.floor(flash.y) + reach; y += 1) {
      for (let x = Math.floor(flash.x) - reach; x <= Math.floor(flash.x) + reach; x += 1) {
        if (Math.hypot(x + 0.5 - flash.x, y + 0.5 - flash.y) > flash.radius) continue
        for (const target of index.byTile.get(y * world.grid.width + x) ?? []) {
          if (target.kind === 'pipe') burstPipe(world, { x: x + 0.5, y: y + 0.5 }, target.box)
        }
      }
    }
  }
}

/** Water fixtures and tanks: the ids worth watching, found once per prop list. */
const watched = new WeakMap<object, { count: number; ids: number[] }>()

function waterProps(world: World): number[] {
  const known = watched.get(world.props)
  if (known && known.count === world.props.length) return known.ids
  const ids = world.props.filter((prop) => FIXTURE_FLOW[prop.kind] !== undefined).map((prop) => prop.id)
  watched.set(world.props, { count: world.props.length, ids })
  return ids
}

/** A fixture or tank that has been broken (shot, blasted, crushed) starts pouring. */
export function watchFixtures(world: World): void {
  const spent = world.systems.spentProps
  for (const id of waterProps(world)) {
    if (spent.has(id)) continue
    const prop = propById(world, id)
    if (!prop?.broken) continue
    spent.add(id)
    const flow = FIXTURE_FLOW[prop.kind]!
    const box = propBox(prop)
    const at = { x: propCenter(prop).x, y: box.y + Math.min(0.5, box.h / 2) }
    addSource(world, 'water', at, flow.rate, flow.seconds, `prop:${id}`)
    if (prop.kind !== 'waterTank' && prop.kind !== 'roofWaterTank' && prop.kind !== 'fireHydrant' && prop.kind !== 'specimenTank') {
      startSpray(world, { ...at, angle: -Math.PI / 2, spread: 0.35, reach: 2, kind: 'water', life: Math.min(flow.seconds, 20) })
      playSound(world, 'spray', at)
    }
  }
}
