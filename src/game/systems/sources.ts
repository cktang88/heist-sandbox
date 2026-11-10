import type { Vec } from '../types'
import type { World } from '../world'
import { pourLiquid } from './liquid'
import type { LiquidKind, LiquidSource } from './state'

/** More open leaks than this and the oldest stop: keeps a building-wide gunfight from flooding every floor. */
export const MAX_SOURCES = 24

/** Starts liquid pouring at a spot. A source with the same tag is topped up instead of doubled. */
export function addSource(world: World, kind: LiquidKind, at: Vec, rate: number, seconds: number, tag: string): LiquidSource {
  const sources = world.systems.sources
  const existing = sources.find((source) => source.tag === tag)
  if (existing) {
    existing.rate = Math.max(existing.rate, rate)
    existing.life = Math.max(existing.life, seconds)
    return existing
  }
  if (sources.length >= MAX_SOURCES) sources.shift()
  const source: LiquidSource = { x: at.x, y: at.y, kind, rate, life: seconds, tag }
  sources.push(source)
  return source
}

export function stopSource(world: World, tag: string): boolean {
  const before = world.systems.sources.length
  world.systems.sources = world.systems.sources.filter((source) => source.tag !== tag)
  return world.systems.sources.length < before
}

export function sourceByTag(world: World, tag: string): LiquidSource | undefined {
  return world.systems.sources.find((source) => source.tag === tag)
}

/** Pours each source's share for this tick and retires the spent ones. */
export function stepSources(world: World, tick: number): void {
  const sources = world.systems.sources
  if (sources.length === 0) return
  for (const source of sources) {
    pourLiquid(world, source.kind, source.x, source.y, source.rate * tick)
    source.life -= tick
  }
  world.systems.sources = sources.filter((source) => source.life > 0)
}
