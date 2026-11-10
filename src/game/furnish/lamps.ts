import { propSpec } from '../propCatalog'
import type { Rng } from '../rng'
import type { Lamp, Prop, Room } from '../site'
import { between, pickFrom, shuffled } from './pick'
import type { LightLayer } from './lighting'

/** Height of a hanging fitting below the ceiling it hangs from. */
const DROP = 0.2
/** A double-height room needs lights that reach the floor from twice as far up. */
const TALL_RADIUS = 10

function choice<T>(rng: Rng, value: T | readonly T[]): T {
  return Array.isArray(value) ? pickFrom(rng, value as readonly T[]) : (value as T)
}

/** Lights a room layer by layer. `circuit` is undefined outdoors, where nothing can cut the power. */
export function lightRoom(rng: Rng, room: Room, layers: readonly LightLayer[], props: Prop[], circuit: number | undefined): Lamp[] {
  const tall = room.h > 6
  const lamps: Lamp[] = []
  const add = (layer: LightLayer, x: number, y: number, hung: boolean, fixture = choice(rng, layer.fixture), color = choice(rng, layer.color)) => {
    const lamp: Lamp = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, fixture, color, radius: layer.radius, strength: layer.strength, hung }
    if (circuit !== undefined) lamp.circuit = circuit
    lamps.push(lamp)
    return lamp
  }
  for (const layer of layers) {
    if (layer.at === 'ceiling') {
      const fixture = choice(rng, layer.fixture)
      const color = choice(rng, layer.color)
      const count = Math.max(1, Math.round(room.w / layer.gap))
      const row = Array.from({ length: count }, (_, index) => {
        const lamp = add(layer, room.x + ((index + 0.5) * room.w) / count + between(rng, -0.3, 0.3), room.y + DROP, true, fixture, color)
        if (tall) Object.assign(lamp, { radius: Math.max(layer.radius, TALL_RADIUS), strength: layer.strength * 1.25 })
        return lamp
      })
      if (rng() < (layer.flicker ?? 0)) pickFrom(rng, row).flickers = true
      if (tall && !layers.some((other) => other.at === 'wall')) {
        const sconces: LightLayer = { at: 'wall', per: 9, up: 3, fixture: 'wallSconce', color, strength: 0.45, radius: 6 }
        lamps.push(...lightRoom(rng, room, [sconces], props, circuit))
      }
    } else if (layer.at === 'wall') {
      const count = Math.max(1, Math.round(room.w / layer.per))
      const y = Math.max(room.y + 0.3, room.floorY - layer.up)
      for (let index = 0; index < count; index += 1) add(layer, room.x + ((index + 0.5) * room.w) / count + between(rng, -0.5, 0.5), y, false)
    } else {
      const hosts = shuffled(rng, props.filter((prop) => layer.hosts.includes(prop.kind))).slice(0, layer.max ?? Infinity)
      for (const host of hosts) {
        if (rng() >= layer.odds) continue
        const [x, y] = hostSpot(rng, room, host, layer.place)
        add(layer, x, y, layer.place === 'above')
      }
    }
  }
  return lamps
}

/** Where a lamp goes relative to the prop it belongs to. */
function hostSpot(rng: Rng, room: Room, host: Prop, place: 'on' | 'beside' | 'above' | 'top' | 'centre'): [number, number] {
  const { w, h } = propSpec(host.kind)
  const centre = host.x + 0.5
  const side = rng() < 0.5 ? -1 : 1
  const clampX = (x: number) => Math.min(room.x + room.w - 0.3, Math.max(room.x + 0.3, x))
  switch (place) {
    case 'on': return [centre + (w > 1.5 ? side * (w / 2 - 0.35) : 0), room.floorY - 1.3]
    case 'beside': return [clampX(centre + side * (w / 2 + 0.35)), room.floorY - 1.8]
    case 'above': return [centre, room.y + DROP]
    case 'top': return [centre, Math.max(room.y + 0.3, room.floorY - h - 0.1)]
    case 'centre': return [centre, host.y + h / 2]
  }
}
