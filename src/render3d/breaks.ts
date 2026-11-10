import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Material } from 'three'
import type { MeshBuilder, P3, Rgb } from './meshBuilder'
import { cellHash, fractalNoise } from './noise'

/**
 * How a wall or slab looks where it was blown apart: a dark, rough core instead of its painted or faced surface,
 * jagged chips left standing along the rim, and bent rebar poking out of broken concrete.
 * Everything here is plain geometry added to a chunk's builders, so it costs nothing per frame.
 */

/** Which way a broken edge of a tile faces, out into the hole. */
export type Side = 'top' | 'bottom' | 'left' | 'right'

/** The raw inside of each material, multiplied into the grey core texture. */
const CORE_TINT: Record<string, Rgb> = {
  concrete: [0.6, 0.58, 0.55],
  reinforced: [0.6, 0.58, 0.55],
  brick: [0.62, 0.34, 0.25],
  wood: [0.52, 0.37, 0.22],
  steel: [0.36, 0.37, 0.4],
  dirt: [0.42, 0.32, 0.23],
  rock: [0.35, 0.34, 0.33],
}

export function coreTint(surface: string): Rgb {
  return CORE_TINT[surface] ?? CORE_TINT.concrete
}

/** Materials whose break shows reinforcing bars. */
const REINFORCED = new Set(['concrete', 'reinforced'])
const REBAR: Rgb = [0.34, 0.22, 0.16]

let core: Material | undefined

/** One shared material for every broken face in the level. */
export function coreMaterial(): Material {
  if (core) return core
  const map = typeof document === 'undefined' ? null : coreTexture()
  core = new MeshStandardMaterial({ map, bumpMap: map, bumpScale: 2.5, roughness: 1, metalness: 0, vertexColors: true })
  return core
}

const CORE_SIZE = 256

/** Crushed aggregate: mottled grey with lighter stones and dark pits, tiling seamlessly. */
function coreTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = CORE_SIZE
  const c = canvas.getContext('2d')!
  const pixels = c.createImageData(CORE_SIZE, CORE_SIZE)
  for (let y = 0; y < CORE_SIZE; y += 1) {
    for (let x = 0; x < CORE_SIZE; x += 1) {
      const value = coreValue(x / CORE_SIZE, y / CORE_SIZE)
      const at = (y * CORE_SIZE + x) * 4
      pixels.data[at] = pixels.data[at + 1] = pixels.data[at + 2] = Math.round(value * 255)
      pixels.data[at + 3] = 255
    }
  }
  c.putImageData(pixels, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Brightness of the core texture at (u, v) in 0..1. */
export function coreValue(u: number, v: number): number {
  const mottle = fractalNoise(u, v, 8, 41, 4)
  const stones = fractalNoise(u, v, 24, 43, 2)
  const pits = fractalNoise(u, v, 48, 47, 2)
  let value = 0.42 + (mottle - 0.5) * 0.35
  if (stones > 0.62) value += (stones - 0.62) * 1.6
  if (pits < 0.3) value -= (0.3 - pits) * 1.8
  return Math.max(0.05, Math.min(1, value))
}

/** A tile edge as a line in the x-y plane, with the direction pointing out into the hole. */
type Edge = { from: [number, number]; along: [number, number]; out: [number, number] }

function edgeOf(tx: number, ty: number, side: Side): Edge {
  const [x0, x1, top, bottom] = [tx, tx + 1, -ty, -(ty + 1)]
  if (side === 'left') return { from: [x0, bottom], along: [0, 1], out: [-1, 0] }
  if (side === 'right') return { from: [x1, bottom], along: [0, 1], out: [1, 0] }
  if (side === 'top') return { from: [x0, top], along: [1, 0], out: [0, 1] }
  return { from: [x0, bottom], along: [1, 0], out: [0, -1] }
}

const SIDE_SALT: Record<Side, number> = { left: 1, right: 2, top: 3, bottom: 4 }
/** Textures on chips match the level's: they repeat every two tiles. */
const UV = 0.5

export type BreakSpec = { tx: number; ty: number; side: Side; surface: string; back: number; front: number; face: Rgb; core: Rgb }

/**
 * Chunks of the wall left sticking out past a broken edge, so the hole's outline is ragged rather than a clean
 * square. Their fronts carry the wall's own surface; their sides and backs are broken core.
 */
export function addChips(surfaceBuilder: MeshBuilder, coreBuilder: MeshBuilder, spec: BreakSpec): void {
  const edge = edgeOf(spec.tx, spec.ty, spec.side)
  const salt = SIDE_SALT[spec.side] * 7919
  const count = 2 + Math.floor(cellHash(spec.tx + salt, spec.ty, 101) * 2)
  for (let index = 0; index < count; index += 1) {
    const roll = (seed: number) => cellHash(spec.tx * 4 + index + salt, spec.ty, seed)
    const width = 0.14 + roll(102) * 0.26
    const start = (index / count) + roll(103) * (1 / count - width * 0.6)
    const reach = 0.05 + roll(104) * 0.2
    const depth = roll(105) < 0.35 ? spec.front - spec.back : 0.3 + roll(106) * 1.4
    const box = chipBox(edge, Math.max(0, Math.min(1 - width, start)), width, reach)
    const [x0, y0, x1, y1] = box
    const z0 = spec.front - depth
    const z1 = spec.front - roll(107) * 0.08
    const inward = scaledRgb(spec.core, 0.55)
    coreBuilder.sides(x0, y0, z0, x1, y1, z1, UV, spec.core, inward)
    const corners: [P3, P3, P3, P3] = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
    surfaceBuilder.face(corners, corners.map(([x, y]) => [x * UV, y * UV] as [number, number]), [spec.face, spec.face, spec.face, spec.face])
  }
}

function chipBox(edge: Edge, start: number, width: number, reach: number): [number, number, number, number] {
  const ax = edge.from[0] + edge.along[0] * start
  const ay = edge.from[1] + edge.along[1] * start
  const bx = ax + edge.along[0] * width + edge.out[0] * reach
  const by = ay + edge.along[1] * width + edge.out[1] * reach
  // Overlap the parent tile a little so no crack shows where the chip meets it.
  const ox = -edge.out[0] * 0.02
  const oy = -edge.out[1] * 0.02
  return [Math.min(ax + ox, bx), Math.min(ay + oy, by), Math.max(ax + ox, bx), Math.max(ay + oy, by)]
}

/** One or two bars bent out of a broken concrete edge. */
export function addRebar(steel: MeshBuilder, spec: BreakSpec): void {
  if (!REINFORCED.has(spec.surface)) return
  const edge = edgeOf(spec.tx, spec.ty, spec.side)
  const salt = SIDE_SALT[spec.side] * 104729
  const bars = 1 + Math.floor(cellHash(spec.tx + salt, spec.ty, 111) * 2)
  const thick = 0.035
  for (let index = 0; index < bars; index += 1) {
    const roll = (seed: number) => cellHash(spec.tx * 3 + index + salt, spec.ty, seed)
    const at = 0.2 + roll(112) * 0.6
    const z = spec.back + 0.35 + roll(113) * (spec.front - spec.back - 0.6)
    const reach = 0.2 + roll(114) * 0.35
    const bend = (roll(115) - 0.5) * 0.3
    const baseX = edge.from[0] + edge.along[0] * at
    const baseY = edge.from[1] + edge.along[1] * at
    // Straight out of the break, then kinked sideways where the blast bent it.
    const midX = baseX + edge.out[0] * reach
    const midY = baseY + edge.out[1] * reach
    bar(steel, baseX - edge.out[0] * 0.05, baseY - edge.out[1] * 0.05, midX, midY, z, thick)
    bar(steel, midX, midY, midX + edge.along[0] * bend, midY + edge.along[1] * bend, z, thick)
  }
}

/** A thin square bar between two points at depth z, as a box around their bounding rectangle. */
function bar(steel: MeshBuilder, ax: number, ay: number, bx: number, by: number, z: number, thick: number): void {
  const h = thick / 2
  steel.sides(Math.min(ax, bx) - h, Math.min(ay, by) - h, z - h, Math.max(ax, bx) + h, Math.max(ay, by) + h, z + h, UV, REBAR, REBAR)
  const [x0, y0, x1, y1] = [Math.min(ax, bx) - h, Math.min(ay, by) - h, Math.max(ax, bx) + h, Math.max(ay, by) + h]
  steel.face([[x0, y0, z + h], [x1, y0, z + h], [x1, y1, z + h], [x0, y1, z + h]], [[0, 0], [1, 0], [1, 1], [0, 1]], [REBAR, REBAR, REBAR, REBAR])
}

export function scaledRgb(color: Rgb, by: number): Rgb {
  return [color[0] * by, color[1] * by, color[2] * by]
}
